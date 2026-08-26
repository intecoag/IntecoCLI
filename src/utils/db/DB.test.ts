import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const connection = {
        query: vi.fn(),
        execute: vi.fn(),
        end: vi.fn()
    };

    return {
        createConnection: vi.fn(),
        getConfig: vi.fn(),
        connection
    };
});

vi.mock("mysql2/promise", () => ({
    createConnection: mocks.createConnection
}));

vi.mock("../config/config.js", () => ({
    Config: {
        getConfig: mocks.getConfig
    }
}));

import { DB } from "./DB.js";

describe("DB", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        DB.connection = null;
        mocks.getConfig.mockResolvedValue({
            dbURL: "127.0.0.1",
            dbUser: "root",
            dbPassword: "pw"
        });
        mocks.createConnection.mockResolvedValue(mocks.connection);
        mocks.connection.end.mockResolvedValue(undefined);
    });

    it("executeQuery connects, executes, and closes", async () => {
        mocks.connection.execute.mockResolvedValue([[{ id: 1 }], []]);

        const result = await DB.executeQuery("SELECT 1");

        expect(mocks.createConnection).toHaveBeenCalledWith({
            host: "127.0.0.1",
            user: "root",
            password: "pw",
            database: ""
        });
        expect(mocks.connection.execute).toHaveBeenCalledWith("SELECT 1", []);
        expect(result).toEqual([{ id: 1 }]);
        expect(mocks.connection.end).toHaveBeenCalledTimes(1);
        expect(DB.connection).toBeNull();
    });

    it("executeQuery passes prepared statement parameters", async () => {
        mocks.connection.execute.mockResolvedValue([[{ id: 123 }], []]);

        const result = await DB.executeQuery("SELECT * FROM users WHERE user_id = ?", 123);

        expect(mocks.connection.execute).toHaveBeenCalledWith("SELECT * FROM users WHERE user_id = ?", [123]);
        expect(result).toEqual([{ id: 123 }]);
    });

    it("executeQuery passes multiple prepared statement parameters", async () => {
        mocks.connection.execute.mockResolvedValue([[{ id: 123 }], []]);

        await DB.executeQuery("SELECT * FROM users WHERE user_id = ? AND active = ?", 123, true);

        expect(mocks.connection.execute).toHaveBeenCalledWith("SELECT * FROM users WHERE user_id = ? AND active = ?", [123, true]);
    });

    it("executeQueryOnDB uses provided database", async () => {
        mocks.connection.execute.mockResolvedValue([[{ ok: true }], []]);

        await DB.executeQueryOnDB("SELECT 1", "mandant_db");

        expect(mocks.createConnection).toHaveBeenCalledWith(expect.objectContaining({ database: "mandant_db" }));
        expect(mocks.connection.execute).toHaveBeenCalledWith("SELECT 1", []);
    });

    it("executeQueryOnDB passes prepared statement parameters", async () => {
        mocks.connection.execute.mockResolvedValue([[{ id: 123 }], []]);

        await DB.executeQueryOnDB("SELECT * FROM users WHERE user_id = ?", "mandant_db", 123);

        expect(mocks.createConnection).toHaveBeenCalledWith(expect.objectContaining({ database: "mandant_db" }));
        expect(mocks.connection.execute).toHaveBeenCalledWith("SELECT * FROM users WHERE user_id = ?", [123]);
    });

    it("closes connection even when query fails", async () => {
        mocks.connection.execute.mockRejectedValue(new Error("boom"));

        await expect(DB.executeQuery("SELECT FAIL")).rejects.toThrow("boom");

        expect(mocks.connection.end).toHaveBeenCalledTimes(1);
        expect(DB.connection).toBeNull();
    });

    it("filters out system databases", async () => {
        mocks.connection.query.mockResolvedValue([[
            { Database: "sys" },
            { Database: "information_schema" },
            { Database: "mysql" },
            { Database: "performance_schema" },
            { Database: "client_a" },
            { Database: "client_b" }
        ], []]);

        const dbs = await DB.getDatabaseNames();

        expect(dbs).toEqual([{ name: "client_a" }, { name: "client_b" }]);
        expect(mocks.connection.end).toHaveBeenCalledTimes(1);
    });
});
