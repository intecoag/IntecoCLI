import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const rootSpinner = {
        start: vi.fn(),
        fail: vi.fn(),
        succeed: vi.fn(),
        info: vi.fn()
    };
    const tableSpinner = {
        start: vi.fn(),
        fail: vi.fn(),
        succeed: vi.fn(),
        info: vi.fn()
    };

    rootSpinner.start.mockReturnValue(rootSpinner);
    tableSpinner.start.mockReturnValue(tableSpinner);

    return {
        prompts: vi.fn(),
        rmSync: vi.fn(),
        getDatabaseNames: vi.fn(),
        executeQueryOnDB: vi.fn(),
        ora: vi.fn((text: string) => (text.includes("Deleting in DB") ? rootSpinner : tableSpinner)),
        rootSpinner,
        tableSpinner
    };
});

vi.mock("prompts", () => ({ default: mocks.prompts }));
vi.mock("fs", () => ({ rmSync: mocks.rmSync }));
vi.mock("ora", () => ({ default: mocks.ora }));
vi.mock("../utils/db/DB.js", () => ({
    DB: {
        getDatabaseNames: mocks.getDatabaseNames,
        executeQueryOnDB: mocks.executeQueryOnDB
    }
}));

import deleteDBMand from "./deleteDB.js";

describe("deleteDBMand", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.rootSpinner.start.mockReturnValue(mocks.rootSpinner);
        mocks.tableSpinner.start.mockReturnValue(mocks.tableSpinner);
        mocks.getDatabaseNames.mockResolvedValue([{ name: "clientdb" }]);
    });

    it("aborts when prompt is cancelled", async () => {
        mocks.prompts.mockImplementation(async (_questions, options) => {
            options?.onCancel?.();
            return {};
        });

        await deleteDBMand({});

        expect(mocks.executeQueryOnDB).not.toHaveBeenCalled();
        expect(mocks.rmSync).not.toHaveBeenCalled();
    });

    it("fails spinner when no tables exist", async () => {
        mocks.prompts.mockResolvedValue({ dbName: "clientdb", mnr: 1 });
        mocks.executeQueryOnDB.mockResolvedValueOnce([]);

        await deleteDBMand({});

        expect(mocks.executeQueryOnDB).toHaveBeenCalledWith("SHOW TABLES;", "clientdb");
        expect(mocks.rootSpinner.fail).toHaveBeenCalledWith("Database has no tables: clientdb");
    });

    it("deletes data for matching mandant and skips others", async () => {
        mocks.prompts.mockResolvedValue({ dbName: "clientdb", mnr: 1 });
        mocks.executeQueryOnDB
            .mockResolvedValueOnce([{ "Tables_in_clientdb": "t1" }, { "Tables_in_clientdb": "t2" }])
            .mockResolvedValueOnce([{ "COUNT(*)": 1 }])
            .mockResolvedValueOnce([{ "COUNT(*)": 1 }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ "COUNT(*)": 0 }])
            .mockResolvedValueOnce([]);

        await deleteDBMand({});

        expect(mocks.rmSync).toHaveBeenCalled();
        expect(mocks.executeQueryOnDB).toHaveBeenCalledWith("DELETE FROM t1 WHERE t1_mnr = '1';", "clientdb");
        expect(mocks.executeQueryOnDB).toHaveBeenCalledWith("DELETE FROM mand WHERE mand_mandant = '1';", "clientdb");
        expect(mocks.tableSpinner.succeed).toHaveBeenCalledWith("Data deleted: t1");
        expect(mocks.tableSpinner.info).toHaveBeenCalledWith("Column t2_mnr not found, Skipping table: t2");
        expect(mocks.rootSpinner.succeed).toHaveBeenCalledWith("Mand deleted: 1");
    });
});
