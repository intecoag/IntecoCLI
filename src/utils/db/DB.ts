import mysql from "mysql-await"
import { Config } from "../config/config.js";

type DBConnection = {
    awaitQuery: (query: string) => Promise<unknown[]>;
    end: () => void;
};

type DatabaseNameRow = {
    Database: string;
};

export class DB {
    static connection: DBConnection | null = null;

    static async connect(db: string | null): Promise<void> {
        const config = await Config.getConfig();

        this.connection = mysql.createConnection({
            host: config.dbURL,
            user: config.dbUser,
            password: config.dbPassword,
            database: db != null ? db : ""
        }) as DBConnection;
    }

    private static getConnection(): DBConnection {
        if (!this.connection) {
            throw new Error("Database connection is not initialized");
        }

        return this.connection;
    }

    static async executeQuery(query: string): Promise<unknown[]> {
        await this.connect(null);

        const results = await this.getConnection().awaitQuery(query);

        this.getConnection().end();
        this.connection = null;

        return results;
    }

    static async executeQueryOnDB(query: string, db: string): Promise<unknown[]> {
        await this.connect(db);

        const results = await this.getConnection().awaitQuery(query);

        this.getConnection().end();
        this.connection = null;

        return results;
    }

    static async getDatabaseNames(): Promise<Array<{ name: string }>> {
        await this.connect(null);

        const results = await this.getConnection().awaitQuery("SHOW DATABASES") as DatabaseNameRow[];

        this.getConnection().end();
        this.connection = null;

        const filtered = results.filter((val) => {
            if (val.Database === "sys" || val.Database === "information_schema" || val.Database === "mysql" || val.Database === "performance_schema") {
                return false;
            }
            return true;
        });

        return filtered.map((result) => ({ name: result.Database }));
    }
}

