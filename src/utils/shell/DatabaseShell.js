import chalk from "chalk";
import { Shell } from "./shell.js";
import { DB } from "../db/DB.js";
import fuzzysort from "fuzzysort";
import CliTable3 from "cli-table3";
import prompts from "prompts";
import { TableConfig } from "./DatabaseShellBuilder.js";

export class DatabaseShell {

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
        await this.shell.run();
    }

    /**
     * Searches for a string based on the current shell state and prints the results to the console.
     * @param {string} query The search string
     */
    executeSearch(query) {
        const results = this.fuzzySearch(query);
        this.renderTable(results);
    }

    async deleteRow(row) {
        const table = row.table;
        const where = Object.entries(row).filter(([k, v]) => k !== "table").map(([k, v]) => `\`${table}_${k}\`='${String(v).replaceAll("'", "\\'")}'`).join(' AND ');
        const sql = `DELETE FROM \`${table}\` WHERE ${where}`;
        await DB.executeQueryOnDB(sql, this.db);
        await this.loadData();
    }

    async insertRow(row) {
        const table = row.table;
        const kvPairs = Object.entries(row).filter(([k, v]) => k !== "table");
        const sql = `INSERT INTO \`${table}\` (${kvPairs.map(([k, v]) => `\`${table}_${k}\``).join(', ')}) VALUES (${kvPairs.map(([k, v]) => `'${String(v).replaceAll("'", "\\'")}'`)});`;
        await DB.executeQueryOnDB(sql, this.db);
        await this.loadData();
    }

    async updateRow(row, whereRow) {
        const table = whereRow.table;
        const set = Object.entries(row).filter(([k, v]) => k !== "table").map(([k, v]) => `\`${table}_${k}\`='${String(v).replaceAll("'", "\\'")}'`).join(', '); 
        const where = Object.entries(whereRow).filter(([k, v]) => k !== "table").map(([k, v]) => `\`${table}_${k}\`='${String(v).replaceAll("'", "\\'")}'`).join(' AND ');
        const sql = `UPDATE \`${table}\` SET ${set} WHERE ${where};`;
        await DB.executeQueryOnDB(sql, this.db);
        await this.loadData();
    }

    async editRow(data, columns, requiredFields, optionalFields) {
        let cancelled = false;
        const questions = [...requiredFields, ...optionalFields]
            .filter(f => Object.hasOwn(data, f))
            .map(f => ({
                type: 'text',
                message: columns.find(c => c.column === f).title,
                name: f,
                initial: columns.find(c => c.column === f).default ?? data[f]}));
            
        const responses = await prompts(questions, { onCancel: () => { cancelled = true; return false; } });

        if(cancelled) return null;
        
        const newData = {
            ...data,
            ...responses
        };


        return newData;
    }

    async selectRow(columns, requiredColumns) {
        let cancelled = false;
        const questions = requiredColumns.map(f => ({
                type: 'text',
                message: columns.find(c => c.column === f).title,
                name: f,
                initial: columns.find(c => c.column === f).default
            }));
            
        const responses = await prompts(questions, { onCancel: () => { cancelled = true; return false; } });
        if(cancelled) return null;
        const results = this.data.filter(d => Object.entries(responses).every(([k, v]) => d[k] == v));
        
        if(results.length == 0) {
            console.log(chalk.red("No results found."));
            return null;
        }

        if(results.length > 1) {
            console.log(chalk.red("Multiple results found. Please select one from the list..."));
            const selection = await prompts({
                type: 'autocomplete',
                choices: results.map(r => ({
                    title: Object.entries(r)
                        .filter(([k, v]) => k === "table" || columns.some(c => c.column === k))
                        .map(([k, v]) => `${k === "table" ? "Table" : columns.find(c => c.column === k).title}: ${v}`)
                        .join(", "),
                    value: r
                })),
                message: "Select Row",
                name: 'result'
            }, { onCancel: () => { cancelled = true; return false; } });

            if(cancelled) return null;

            return selection.result;
        }

        return results[0];
    }

    /**
     * Loads the rows from the currently active tables into the shell
     * @private
     */
    async loadData() {
        const data = [];

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
    async getTableData(table) {
        const query = `SELECT * FROM ${table};`;
        return await DB.executeQueryOnDB(query, this.db);
    }

    /**
     * Removes the table name prefix from the individual rows
     * @param {object[]} entries The rows of the table
     * @param {string} tableName The name of the table where the data is from
     * @returns {object[]}
     * @private
     */
    cleanData(entries, tableName) {
        return entries.map(entry => {
            const stripped = Object.fromEntries(
                Object.entries(entry).map(([k, v]) => [
                    k.replace(new RegExp(`^${tableName}_`), ''),
                    v
                ])
            );

            return { ...stripped, table: tableName };
        });
    }

    /**
     * Executes a query on the currently loaded table using fuzzysearch
     * @param {string} query The search query
     * @returns {object[]}
     * @private
     */
    fuzzySearch(query) {
        if(!query) return this.data.slice(0, 1000);

        return fuzzysort.go(query, this.data, {
            keys: this.currentConfig.searchKeys,
            limit: 1000,
            threshold: this.currentConfig.threshold
        }).map(r => ({ ...r.obj, score: r.score }));
    }

    /**
     * Renders a table in the console using the currently active config
     * @param {object[]} tableData The table data to render
     * @private
     */
    renderTable(tableData) {
        const table = new CliTable3({ head: this.currentConfig.tableHeader });
        tableData.forEach(row => {
            table.push(this.currentConfig.tableFormatter(row));
        });
        console.log(table.toString());
    }

    /**
     * Prompts the user for the database and search type
     */
    async configure() {
        console.log();
        const databaseNames = await DB.getDatabaseNames();

        const results = await prompts([
            {
                type: 'autocomplete',
                name: 'dbName',
                message: 'DB-Name?',
                choices: databaseNames.map(db => ({ title: db.name }))
            },
            {
                type: 'select',
                name: 'tables',
                message: 'Search-Type?',
                choices: this.tables.map(t => ({ title: t.name, value: t.tables }))
            }
        ]);

        this.db = results.dbName;
        this.currentTables = results.tables;
        
        await this.loadData();
    }
}
