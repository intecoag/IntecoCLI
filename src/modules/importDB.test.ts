import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const sevenList = vi.fn();
    const sevenExtract = vi.fn();
    return {
        prompts: vi.fn(),
        readdirSync: vi.fn(),
        mkdirSync: vi.fn(),
        renameSync: vi.fn(),
        rmSync: vi.fn(),
        copyFileSync: vi.fn(),
        ora: vi.fn(() => ({ start: vi.fn().mockReturnThis(), fail: vi.fn(), succeed: vi.fn() })),
        executeQuery: vi.fn(),
        exec: vi.fn(),
        getConfig: vi.fn(),
        sevenList,
        sevenExtract
    };
});

vi.mock("prompts", () => ({ default: mocks.prompts }));
vi.mock("fs", () => ({
    readdirSync: mocks.readdirSync,
    mkdirSync: mocks.mkdirSync,
    renameSync: mocks.renameSync,
    rmSync: mocks.rmSync,
    copyFileSync: mocks.copyFileSync
}));
vi.mock("ora", () => ({ default: mocks.ora }));
vi.mock("../utils/db/DB.js", () => ({ DB: { executeQuery: mocks.executeQuery } }));
vi.mock("child_process", () => ({ exec: mocks.exec }));
vi.mock("../utils/config/config.js", () => ({ Config: { getConfig: mocks.getConfig } }));
vi.mock("node-7z", () => ({ default: { list: mocks.sevenList, extract: mocks.sevenExtract } }));

import importDB from "./importDB.js";

describe("importDB", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getConfig.mockResolvedValue({ dbUser: "root", dbPassword: "pw" });
        mocks.readdirSync.mockReturnValue([{ isFile: () => true, name: "dump.sql" }]);
        mocks.exec.mockImplementation((cmd: string, cb: (err: Error | null) => void) => cb(null));
    });

    it("imports non-archive dump and optionally recreates db", async () => {
        mocks.prompts.mockResolvedValue({ file: "dump.sql", dbName: "db1", dropDB: true });
        mocks.sevenList.mockImplementation(() => ({
            on: (event: string, handler: () => void) => {
                if (event === "error") handler();
            }
        }));

        await importDB({});

        expect(mocks.copyFileSync).toHaveBeenCalled();
        expect(mocks.executeQuery).toHaveBeenCalledWith("DROP DATABASE IF EXISTS db1");
        expect(mocks.executeQuery).toHaveBeenCalledWith("CREATE DATABASE db1");
        expect(String(mocks.exec.mock.calls[0]?.[0] ?? "")).toContain("mysql -u root -ppw db1 < dump");
    });

    it("aborts on cancel", async () => {
        mocks.prompts.mockImplementation(async (_q, options) => {
            options?.onCancel?.();
            return {};
        });

        await importDB({});

        expect(mocks.copyFileSync).not.toHaveBeenCalled();
        expect(mocks.exec).not.toHaveBeenCalled();
    });
});
