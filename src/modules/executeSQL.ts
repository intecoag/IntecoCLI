import prompts from "../utils/cliParams.js";
import { registerCommand } from "../utils/commandRegistry.js";
import { DB } from "../utils/db/DB.js";

type QueryResultHeader = {
    affectedRows?: number;
    insertId?: number | string;
};

export async function executeSQL(): Promise<void> {
    const results = await prompts([
        {
            type: "text",
            name: "dbName",
            message: "Database (leave empty for server-level SQL)?",
            initial: "",
        },
        {
            type: "text",
            name: "query",
            message: "SQL statement?",
            validate: (value: string) => value.trim().length > 0 || "SQL statement is required.",
        },
    ]);

    const database = results.dbName.trim() || null;
    const result = await DB.executeSQL(results.query, database);

    if (Array.isArray(result)) {
        if (result.length === 0) {
            console.log("SQL executed successfully. No rows returned.");
        } else {
            console.table(result);
        }
        return;
    }

    if (result !== null && typeof result === "object") {
        const header = result as QueryResultHeader;
        const details: string[] = [];
        if (header.affectedRows !== undefined) details.push(`affected rows: ${header.affectedRows}`);
        if (header.insertId !== undefined && header.insertId !== 0) details.push(`insert id: ${header.insertId}`);
        console.log(details.length > 0
            ? `SQL executed successfully (${details.join(", ")}).`
            : "SQL executed successfully.");
        return;
    }

    console.log("SQL executed successfully.");
}

registerCommand("execute_sql", "Execute a SQL statement using the configured database connection.", executeSQL, {
    parameters: {
        dbName: { type: "string", default: "", description: "Optional database; leave empty for server-level SQL." },
        query: { type: "string", required: true, description: "SQL statement to execute." },
    },
    note: "This runs SQL with the credentials in the current CLI settings. Statements can modify or delete data.",
});
