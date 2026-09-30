import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    prompt: vi.fn(),
    executeSQL: vi.fn(),
}));

vi.mock("../utils/cliParams.js", () => ({ default: mocks.prompt }));
vi.mock("../utils/commandRegistry.js", () => ({ registerCommand: vi.fn() }));
vi.mock("../utils/db/DB.js", () => ({ DB: { executeSQL: mocks.executeSQL } }));

import { executeSQL } from "./executeSQL.js";

describe("executeSQL command", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.prompt.mockResolvedValue({ dbName: "app_db", query: "SELECT 1" });
    });

    it("runs the entered SQL with the selected database and displays rows", async () => {
        mocks.executeSQL.mockResolvedValue([{ value: 1 }]);
        const table = vi.spyOn(console, "table").mockImplementation(() => undefined);

        await executeSQL();

        expect(mocks.executeSQL).toHaveBeenCalledWith("SELECT 1", "app_db");
        expect(table).toHaveBeenCalledWith([{ value: 1 }]);
        table.mockRestore();
    });

    it("uses server-level connection when no database is entered", async () => {
        mocks.prompt.mockResolvedValue({ dbName: "  ", query: "CREATE DATABASE app_db" });
        mocks.executeSQL.mockResolvedValue({ affectedRows: 0 });
        const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

        await executeSQL();

        expect(mocks.executeSQL).toHaveBeenCalledWith("CREATE DATABASE app_db", null);
        expect(log).toHaveBeenCalledWith("SQL executed successfully (affected rows: 0).");
        log.mockRestore();
    });
});
