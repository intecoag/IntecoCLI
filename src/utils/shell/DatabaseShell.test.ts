import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    class TableMock {
        rows: unknown[] = [];
        push(row: unknown) {
            this.rows.push(row);
        }
        toString() {
            return `rows:${this.rows.length}`;
        }
    }

    return {
        prompts: vi.fn(),
        getDatabaseNames: vi.fn(),
        executeQueryOnDB: vi.fn(),
        fuzzysortGo: vi.fn(),
        TableMock
    };
});

vi.mock("prompts", () => ({ default: mocks.prompts }));
vi.mock("../db/DB.js", () => ({
    DB: {
        getDatabaseNames: mocks.getDatabaseNames,
        executeQueryOnDB: mocks.executeQueryOnDB
    }
}));
vi.mock("fuzzysort", () => ({ default: { go: mocks.fuzzysortGo } }));
vi.mock("cli-table3", () => ({ default: mocks.TableMock }));

import { DatabaseShell } from "./DatabaseShell.js";

describe("DatabaseShell", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("cleanData removes table prefix and appends table name", () => {
        const shell = new DatabaseShell();

        const cleaned = shell.cleanData([{ t009_mnr: 1, t009_name: "abc" }], "t009");

        expect(cleaned).toEqual([{ mnr: 1, name: "abc", table: "t009" }]);
    });

    it("configure sets db and selected tables", async () => {
        const shell = new DatabaseShell();
        shell.tables = [{ name: "T009", tables: ["t009"] }];
        mocks.getDatabaseNames.mockResolvedValue([{ name: "db1" }]);
        mocks.prompts.mockResolvedValue({ dbName: "db1", tables: ["t009"] });
        mocks.executeQueryOnDB.mockResolvedValue([{ t009_mnr: 1 }]);

        await shell.configure();

        expect(shell.db).toBe("db1");
        expect(shell.currentTables).toEqual(["t009"]);
        expect(shell.data).toEqual([{ mnr: 1, table: "t009" }]);
    });

    it("renderTable and fuzzySearch use config", () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        const shell = new DatabaseShell();
        shell.currentConfig = {
            name: "X",
            cmdShortcut: ":x",
            searchKeys: ["name"],
            threshold: 0.7,
            tableHeader: ["N"],
            tableFormatter: (row: Record<string, unknown>) => [String(row.name ?? "")]
        } as any;
        shell.data = [{ table: "t", name: "abc" }];
        mocks.fuzzysortGo.mockReturnValue([{ obj: { table: "t", name: "abc" }, score: -10 }]);

        const results = shell.fuzzySearch("ab");
        shell.renderTable(results);

        expect(results[0]?.name).toBe("abc");
        expect(logSpy.mock.calls.map((c) => String(c[0] ?? "")).join("\n")).toContain("rows:1");
    });

    it("deleteRow builds sql and reloads data", async () => {
        const shell = new DatabaseShell();
        shell.db = "db1";
        shell.currentTables = ["t009"];
        mocks.executeQueryOnDB.mockResolvedValue([{ t009_mnr: 1 }]);

        await shell.deleteRow({ table: "t009", mnr: "1", name: "a'b" });

        expect(String(mocks.executeQueryOnDB.mock.calls[0]?.[0] ?? "")).toContain("DELETE FROM `t009`");
        expect(String(mocks.executeQueryOnDB.mock.calls[0]?.[0] ?? "")).toContain("a\\'b");
    });
});
