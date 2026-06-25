import chalk from "chalk";
import { Shell } from "./Shell.js";
import { DB } from "../db/DB.js";
import fuzzysort from "fuzzysort";
import CliTable3 from "cli-table3";
import prompts from "prompts";
import { type PromptObject } from "prompts";
import { type TableConfig, type TableSource } from "./DatabaseShellBuilder.js";

export type TableRow = Record<string, unknown> & { table: string };
type EditableColumn = { title: string; column: string; default?: string };

export class DatabaseShell {
    currentTables: string[];
    currentConfig: TableConfig | null;
    db: string | null;
    data: TableRow[];
    tables: TableSource[];
    shell: Shell | null;

    constructor() {
        /**
         * The currently active tables to load the data from
         * @type {string[]}
         * @private
         */
        this.currentTables = [];

        /**
         * The currently active config
         * @type {TableConfig}
         */
        this.currentConfig = null;

        /**
         * The active database
         * @type {string}
         * @private
         */
        this.db = null;

        /**
         * The cached data of the active table
         * @type {object[]}
         * @private
         */
        this.data = [];

        /**
         * The tables the user can select to use
         * @type {object[]}
         */
        this.tables = [];

        /**
         * The underlying shell to handle user input
         * @type {Shell}
         */
        this.shell = null;
    }

    /**
     * Configures the database shell and runs the underlying shell
     */
    async run() {
        await this.configure();
        if (!this.shell) {
            throw new Error("Shell is not initialized");
        }
        await this.shell.run();
    }

    private requireDb(): string {
        if (!this.db) {
            throw new Error("Database is not configured");
        }

        return this.db;
    }

    /**
     * Searches for a string based on the current shell state and prints the results to the console.
     * @param {string} query The search string
     */
    executeSearch(query: string): void {
        const results = this.fuzzySearch(query);
        this.renderTable(results);
    }

    async deleteRow(row: TableRow): Promise<void> {
        const table = row.table;
        const where = Object.entries(row).filter(([k]) => k !== "table").map(([k, v]) => `\`${table}_${k}\`='${String(v).replaceAll("'", "\\'")}'`).join(' AND ');
        const sql = `DELETE FROM \`${table}\` WHERE ${where}`;
        await DB.executeQueryOnDB(sql, this.requireDb());
        await this.loadData();
    }

    async insertRow(row: TableRow): Promise<void> {
        const table = row.table;
        const kvPairs = Object.entries(row).filter(([k]) => k !== "table");
        const sql = `INSERT INTO \`${table}\` (${kvPairs.map(([k]) => `\`${table}_${k}\``).join(', ')}) VALUES (${kvPairs.map(([, v]) => `'${String(v).replaceAll("'", "\\'")}'`)});`;
        await DB.executeQueryOnDB(sql, this.requireDb());
        await this.loadData();
    }

    async updateRow(row: TableRow, whereRow: TableRow): Promise<void> {
        const table = whereRow.table;
        const set = Object.entries(row).filter(([k]) => k !== "table").map(([k, v]) => `\`${table}_${k}\`='${String(v).replaceAll("'", "\\'")}'`).join(', ');
        const where = Object.entries(whereRow).filter(([k]) => k !== "table").map(([k, v]) => `\`${table}_${k}\`='${String(v).replaceAll("'", "\\'")}'`).join(' AND ');
        const sql = `UPDATE \`${table}\` SET ${set} WHERE ${where};`;
        await DB.executeQueryOnDB(sql, this.requireDb());
        await this.loadData();
    }

    async editRow(data: TableRow, columns: EditableColumn[], requiredFields: string[], optionalFields: string[]): Promise<TableRow | null> {
        let cancelled = false;
        const questions: PromptObject<string>[] = [...requiredFields, ...optionalFields]
            .filter((f) => Object.hasOwn(data, f))
            .map((f) => ({
                type: 'text' as const,
                message: columns.find((c) => c.column === f)?.title ?? f,
                name: f,
                initial: String(columns.find((c) => c.column === f)?.default ?? data[f] ?? "")}));
            
        const responses = await prompts(questions, { onCancel: () => { cancelled = true; return false; } }) as Record<string, unknown>;

        if(cancelled) return null;
        
        const newData = {
            ...data,
            ...responses
        };


        return newData;
    }

    async selectRow(columns: EditableColumn[], requiredColumns: string[]): Promise<TableRow | null> {
        let cancelled = false;
        const questions: PromptObject<string>[] = requiredColumns.map((f) => ({
            type: 'text' as const,
                message: columns.find((c) => c.column === f)?.title ?? f,
                name: f,
                initial: columns.find((c) => c.column === f)?.default
            }));
            
        const responses = await prompts(questions, { onCancel: () => { cancelled = true; return false; } }) as Record<string, unknown>;
        if(cancelled) return null;
        const results = this.data.filter((d) => Object.entries(responses).every(([k, v]) => d[k] == v));
        
        if(results.length == 0) {
            console.log(chalk.red("No results found."));
            return null;
        }

        if(results.length > 1) {
            console.log(chalk.red("Multiple results found. Please select one from the list..."));
            const selection = await prompts({
                type: 'autocomplete',
                choices: results.map((r) => ({
                    title: Object.entries(r)
                        .filter(([k]) => k === "table" || columns.some((c) => c.column === k))
                        .map(([k, v]) => `${k === "table" ? "Table" : columns.find((c) => c.column === k)?.title ?? k}: ${v}`)
                        .join(", "),
                    value: r
                })),
                message: "Select Row",
                name: 'result'
            }, { onCancel: () => { cancelled = true; return false; } }) as { result?: TableRow };

            if(cancelled) return null;

            return selection.result ?? null;
        }

        return results[0] ?? null;
    }

    /**
     * Loads the rows from the currently active tables into the shell
     * @private
     */
    async loadData(): Promise<void> {
        const data: TableRow[] = [];

        for(let i = 0; i < this.currentTables.length; i++) {
            const tableData = await this.getTableData(this.currentTables[i]);
            data.push(...this.cleanData(tableData, this.currentTables[i]));
        }

        this.data = data;
    }

    /**
     * Loads all rows from a table of the currently active database
     * @param {string} table The table name
     * @returns {Promise<any>}
     * @private
     */
    async getTableData(table: string): Promise<Array<Record<string, unknown>>> {
        const query = `SELECT * FROM ${table};`;
        return await DB.executeQueryOnDB(query, this.requireDb()) as Array<Record<string, unknown>>;
    }

    /**
     * Removes the table name prefix from the individual rows
     * @param {object[]} entries The rows of the table
     * @param {string} tableName The name of the table where the data is from
     * @returns {object[]}
     * @private
     */
    cleanData(entries: Array<Record<string, unknown>>, tableName: string): TableRow[] {
        return entries.map((entry) => {
            const stripped = Object.fromEntries(
                Object.entries(entry).map(([k, v]) => [
                    k.replace(new RegExp(`^${tableName}_`), ''),
                    v
                ])
            );

            return { ...stripped, table: tableName } as TableRow;
        });
    }

    /**
     * Executes a query on the currently loaded table using fuzzysearch
     * @param {string} query The search query
     * @returns {object[]}
     * @private
     */
    fuzzySearch(query: string): Array<TableRow & { score?: number }> {
        if(!query) return this.data.slice(0, 1000);

        if (!this.currentConfig) {
            return this.data.slice(0, 1000);
        }

        return fuzzysort.go(query, this.data, {
            keys: this.currentConfig.searchKeys as ReadonlyArray<string>,
            limit: 1000,
            threshold: this.currentConfig.threshold
        }).map((r) => ({ ...(r.obj as TableRow), score: r.score }));
    }

    /**
     * Renders a table in the console using the currently active config
     * @param {object[]} tableData The table data to render
     * @private
     */
    renderTable(tableData: Array<TableRow & { score?: number }>): void {
        if (!this.currentConfig) {
            return;
        }

        const currentConfig = this.currentConfig;
        const table = new CliTable3({ head: currentConfig.tableHeader });
        tableData.forEach((row) => {
            table.push(currentConfig.tableFormatter(row));
        });
        console.log(table.toString());
    }

    /**
     * Prompts the user for the database and search type
     */
    async configure(): Promise<void> {
        console.log();
        const databaseNames = await DB.getDatabaseNames() as Array<{ name: string }>;

        const results = await prompts([
            {
                type: 'autocomplete',
                name: 'dbName',
                message: 'DB-Name?',
                choices: databaseNames.map((db) => ({ title: db.name }))
            },
            {
                type: 'select',
                name: 'tables',
                message: 'Search-Type?',
                choices: this.tables.map((t) => ({ title: t.name, value: t.tables }))
            }
        ]) as { dbName: string; tables: string[] };

        this.db = results.dbName;
        this.currentTables = results.tables;
        
        await this.loadData();
    }
}


