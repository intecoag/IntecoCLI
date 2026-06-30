import { beforeEach, describe, expect, it, vi } from "vitest";
import { dumpDB, dumpDBMand } from "./dumpDB.js";

const mocks = vi.hoisted(() => {
    const spinner = {
        start: vi.fn(),
        fail: vi.fn(),
        succeed: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    };
    spinner.start.mockReturnValue(spinner);

    return {
        prompts: vi.fn(),
        rmSync: vi.fn(),
        ora: vi.fn(() => spinner),
        getConfig: vi.fn(),
        getDatabaseNames: vi.fn(),
        executeQueryOnDB: vi.fn(),
        exec: vi.fn(),
        execSync: vi.fn(),
        spinner
    };
});

vi.mock("prompts", () => ({ default: mocks.prompts }));
vi.mock("fs", () => ({ rmSync: mocks.rmSync }));
vi.mock("ora", () => ({ default: mocks.ora }));
vi.mock("../utils/config/config.js", () => ({ Config: { getConfig: mocks.getConfig } }));
vi.mock("../utils/db/DB.js", () => ({
    DB: {
        getDatabaseNames: mocks.getDatabaseNames,
        executeQueryOnDB: mocks.executeQueryOnDB
    }
}));
vi.mock("child_process", () => ({ exec: mocks.exec, execSync: mocks.execSync }));

describe("dumpDB", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.spinner.start.mockReturnValue(mocks.spinner);
        mocks.getConfig.mockResolvedValue({ dbUser: "root", dbPassword: "pw", dbURL: "127.0.0.1" });
        mocks.getDatabaseNames.mockResolvedValue([{ name: "clientdb" }]);
    });

    it("executes mysqldump command", async () => {
        mocks.prompts
            .mockResolvedValueOnce({ dbName: "clientdb", dataOnly: true, selectIndividualTables: false })
            .mockResolvedValueOnce({ dumpName: "dump.sql" });
        mocks.exec.mockImplementation((cmd: string, cb: (e: Error | null) => void) => cb(null));

        await dumpDB({});

        expect(mocks.exec).toHaveBeenCalledTimes(1);
        const command = String(mocks.exec.mock.calls[0]?.[0] ?? "");
        expect(command).toContain("mysqldump");
        expect(command).toContain("--no-create-info");
        expect(command).toContain("clientdb");
        expect(command).toContain("> dump.sql");
    });

    it("dumps selected tables when requested", async () => {
        mocks.prompts
            .mockResolvedValueOnce({ dbName: "clientdb", dataOnly: false, selectIndividualTables: true })
            .mockResolvedValueOnce({ table: "t1", continue: true })
            .mockResolvedValueOnce({ table: "t2", continue: false })
            .mockResolvedValueOnce({ dumpName: "dump.sql" });
        mocks.executeQueryOnDB.mockResolvedValueOnce([{ "Tables_in_clientdb": "t1" }, { "Tables_in_clientdb": "t2" }]);
        mocks.exec.mockImplementation((cmd: string, cb: (e: Error | null) => void) => cb(null));

        await dumpDB({});

        const command = String(mocks.exec.mock.calls[0]?.[0] ?? "");
        expect(command).toContain(" clientdb t1 t2 > dump.sql");
    });

    it("aborts when initial prompt is cancelled", async () => {
        mocks.prompts.mockImplementationOnce(async (_q, options) => {
            options?.onCancel?.();
            return {};
        });

        await dumpDB({});

        expect(mocks.exec).not.toHaveBeenCalled();
    });
});

describe("dumpDBMand", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.spinner.start.mockReturnValue(mocks.spinner);
        mocks.getConfig.mockResolvedValue({ dbUser: "root", dbPassword: "pw", dbURL: "127.0.0.1" });
        mocks.getDatabaseNames.mockResolvedValue([{ name: "clientdb" }]);
    });

    it("fails when db has no tables", async () => {
        mocks.prompts.mockResolvedValue({ dbName: "clientdb", mnr: 1, dumpName: "dump.sql" });
        mocks.executeQueryOnDB.mockResolvedValueOnce([]);

        await dumpDBMand({});

        expect(mocks.spinner.fail).toHaveBeenCalledWith("Database has no tables: clientdb");
    });

    it("dumps matching tables and mand", async () => {
        mocks.prompts.mockResolvedValue({ dbName: "clientdb", mnr: 1, dumpName: "dump.sql" });
        mocks.executeQueryOnDB
            .mockResolvedValueOnce([{ "Tables_in_clientdb": "t1" }, { "Tables_in_clientdb": "t2" }])
            .mockResolvedValueOnce([{ "COUNT(*)": 1 }])
            .mockResolvedValueOnce([{ "COUNT(*)": 1 }])
            .mockResolvedValueOnce([{ "COUNT(*)": 0 }]);

        await dumpDBMand({});

        expect(mocks.rmSync).toHaveBeenCalled();
        expect(mocks.execSync).toHaveBeenCalledTimes(2);
        expect(String(mocks.execSync.mock.calls[0]?.[0] ?? "")).toContain("--where=\"t1_mnr = '1'\"");
        expect(String(mocks.execSync.mock.calls[1]?.[0] ?? "")).toContain("--where=\"mand_mandant = '1'\"");
        expect(mocks.spinner.succeed).toHaveBeenCalledWith("Dumped DB to dump.sql");
    });
});
