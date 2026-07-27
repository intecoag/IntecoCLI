import { createConnection, type Connection, type RowDataPacket } from "mysql2/promise";
import { Config } from "../config/config.js";


export class DB {
    static connection: Connection | null = null;

    static async connect(db: string | null): Promise<void> {
        const config = await Config.getConfig();

        this.connection = await createConnection({
            host: config.dbURL,
            user: config.dbUser,
            password: config.dbPassword,
            database: db != null ? db : ""
        });
    }

    private static getConnection(): Connection {
        if (!this.connection) {
            throw new Error("Database connection is not initialized");
        }

        return this.connection;
    }

    private static async closeConnection(): Promise<void> {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
    }

    private static async runQuery(query: string, db: string | null): Promise<unknown[]> {
        await this.connect(db);

        try {
            const [results] = await this.getConnection().query(query);

            return Array.isArray(results) ? (results as unknown[]) : [];
        } finally {
            await this.closeConnection();
        }
    }

    static async executeQuery(query: string): Promise<unknown[]> {
        return await this.runQuery(query, null);
    }

    static async executeQueryOnDB(query: string, db: string): Promise<unknown[]> {
        return await this.runQuery(query, db);
    }

    static async getDatabaseNames(): Promise<Array<{ name: string }>> {
        await this.connect(null);

        let results: Array<{ Database: string }> = [];

        try {
            const [rows] = await this.getConnection().query("SHOW DATABASES");
            results = rows as Array<{ Database: string }>;
        } finally {
            await this.closeConnection();
        }

        const filtered = results.filter((val) => {
            if (val.Database === "sys" || val.Database === "information_schema" || val.Database === "mysql" || val.Database === "performance_schema") {
                return false;
            }
            return true;
        });

        return filtered.map((result) => ({ name: result.Database }));
    }
}

