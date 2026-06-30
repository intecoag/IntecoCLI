import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    prompts: vi.fn(),
    homedir: vi.fn(),
    createEditor: vi.fn(),
    writeFileSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    parseDocument: vi.fn(),
    getConfig: vi.fn(),
    getDatabaseNames: vi.fn()
}));

vi.mock("prompts", () => ({ default: mocks.prompts }));
vi.mock("os", () => ({ default: { homedir: mocks.homedir }, homedir: mocks.homedir }));
vi.mock("properties-parser", () => ({ createEditor: mocks.createEditor }));
vi.mock("fs", () => ({
    writeFileSync: mocks.writeFileSync,
    readFileSync: mocks.readFileSync,
    readdirSync: mocks.readdirSync
}));
vi.mock("yaml", () => ({ default: { parseDocument: mocks.parseDocument }, parseDocument: mocks.parseDocument }));
vi.mock("../utils/config/config.js", () => ({ Config: { getConfig: mocks.getConfig } }));
vi.mock("../utils/db/DB.js", () => ({ DB: { getDatabaseNames: mocks.getDatabaseNames } }));

import configRewrite from "./rewriteConfig.js";

describe("rewriteConfig", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.homedir.mockReturnValue("C:/Users/test");
        mocks.getConfig.mockResolvedValue({
            configIndividualPath: "C:/cfg/individual",
            configIndividualPathWrite: "C:/cfg/individual"
        });
        mocks.getDatabaseNames.mockResolvedValue([{ name: "db1" }]);
        mocks.readdirSync.mockReturnValue([{ name: "custA", isDirectory: () => true }]);

        const editor = { set: vi.fn(), save: vi.fn() };
        mocks.createEditor.mockReturnValue(editor);

        const doc = { set: vi.fn(), toString: vi.fn(() => "yaml-out") };
        mocks.readFileSync.mockReturnValue("pathIndividual: old");
        mocks.parseDocument.mockReturnValue(doc);
    });

    it("rewrites properties and yaml fields", async () => {
        mocks.prompts.mockResolvedValue({ dbName: "db1", configName: "custA", mnr: 2, language: "f" });

        await configRewrite({});

        expect(mocks.createEditor).toHaveBeenCalledTimes(2);
        const firstEditor = mocks.createEditor.mock.results[0]?.value as { set: (k: string, v: string) => void; save: () => void };
        const secondEditor = mocks.createEditor.mock.results[1]?.value as { set: (k: string, v: string) => void; save: () => void };
        expect(firstEditor.set).toHaveBeenCalledWith("user.mandant", "2");
        expect(secondEditor.set).toHaveBeenCalledWith("db.database", "db1");
        expect(secondEditor.set).toHaveBeenCalledWith("language", "f");
        expect(mocks.writeFileSync).toHaveBeenCalled();
    });

    it("does nothing on cancel", async () => {
        mocks.prompts.mockImplementation(async (_q, options) => {
            options?.onCancel?.();
            return {};
        });

        await configRewrite({});

        expect(mocks.createEditor).not.toHaveBeenCalled();
        expect(mocks.writeFileSync).not.toHaveBeenCalled();
    });
});
