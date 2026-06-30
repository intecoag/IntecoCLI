import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const connection = {
        query: vi.fn(),
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

    it("executeQuery connects, queries, and closes", async () => {
        mocks.connection.query.mockResolvedValue([[{ id: 1 }], []]);

        const result = await DB.executeQuery("SELECT 1");

        expect(mocks.createConnection).toHaveBeenCalledWith({
            host: "127.0.0.1",
            user: "root",
            password: "pw",
            database: ""
        });
        expect(mocks.connection.query).toHaveBeenCalledWith("SELECT 1");
        expect(result).toEqual([{ id: 1 }]);
        expect(mocks.connection.end).toHaveBeenCalledTimes(1);
        expect(DB.connection).toBeNull();
    });

    it("executeQueryOnDB uses provided database", async () => {
        mocks.connection.query.mockResolvedValue([[{ ok: true }], []]);

        await DB.executeQueryOnDB("SELECT 1", "mandant_db");

        expect(mocks.createConnection).toHaveBeenCalledWith(expect.objectContaining({ database: "mandant_db" }));
    });

    it("closes connection even when query fails", async () => {
        mocks.connection.query.mockRejectedValue(new Error("boom"));

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
