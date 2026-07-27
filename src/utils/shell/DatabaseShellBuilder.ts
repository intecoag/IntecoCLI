import chalk from "chalk";
import { ShellBuilder } from "./ShellBuilder.js"
import { DatabaseShell, type TableRow } from "./DatabaseShell.js";

export type TableSource = {
    name: string;
    tables: string[];
};

export type EditColumn = {
    title: string;
    column: string;
    default?: string;
};

type EditTools = {
    columns: EditColumn[];
    requiredSelectors: string[];
    requiredValues: string[];
    optionalValues: string[];
};

export type TableFormatterRow = Record<string, unknown>;

export class DatabaseShellBuilder {
    configs: TableConfig[];
    tables: TableSource[];
    editTools: EditTools | null;

    constructor() {
        /**
         * The available configs for the shell
         * @type {TableConfig}
         * @private
         */
        this.configs = [];

        /**
         * The available tables for the shell
         * @type {object[]}
         * @private
         */
        this.tables = [];

        this.editTools = null;
    }

    /**
     * Adds a table config to the shell
     * @param {TableConfig} tableConfig The config to add
     * @returns {DatabaseShellBuilder}
     */
    withConfig(tableConfig: TableConfig): DatabaseShellBuilder {
        this.configs.push(tableConfig);
        return this;
    }

    /**
     * Adds a source table to the shell
     * @param {string} name The name displayed in the selection
     * @param {string[]} tables The names of the tables where to load the data from
     * @returns {DatabaseShellBuilder}
     */
    withTables(name: string, tables: string[]): DatabaseShellBuilder {
        this.tables.push({ name: name, tables: tables });
        return this;
    }

    /**
     * Enables edit tools with the specified selectors and values
     * @param {{title: string, column: string, default: string}[]} columns The colums that are used in the editor
     * @param {string[]} requiredSelectors The columns that are required to be filled in to select an entry to edit
     * @param {string[]} requiredValues The columns that are required to be filled to update an entry
     * @param {string[]} optionalValues The columns that can be optionally updated
     * @returns {DatabaseShellBuilder}
     */
    withEditTools(columns: EditColumn[], requiredSelectors: string[], requiredValues: string[], optionalValues: string[]): DatabaseShellBuilder {
        this.editTools = {
            columns: columns,
            requiredSelectors: requiredSelectors,
            requiredValues: requiredValues,
            optionalValues: optionalValues
        };

        return this;
    }

    /**
     * Builds the Shell
     * @returns {DatabaseShell}
     */
    build(): DatabaseShell {
        const databaseShell = new DatabaseShell();

        const builder = new ShellBuilder();
        builder.withBuiltInHandler()
            .withBuiltInCommands()
            .withCommandHandler((_, input) => { databaseShell.executeSearch(input); return true; })
            .withCommand(":cfg", "Reconfigure the Database and Search Type", async () => await databaseShell.configure());

        this.configs.forEach((config) => {
            builder.withCommand(config.cmdShortcut, `Switch to ${config.name}`, () => {
                databaseShell.currentConfig = config;
                console.log(`Switched to ${chalk.yellow(config.name)}.`);
            });
        });

        const editTools = this.editTools;
        if(editTools !== null) {
            builder.withCommand(":del", "Delete a row", async () => {
                    console.log(chalk.yellow("Select the row to delete: "));
                const rowData = await databaseShell.selectRow(editTools.columns, editTools.requiredSelectors);
                    if(!rowData) return;

                    await databaseShell.deleteRow(rowData);
                    console.log(chalk.red("Row deleted"));
                })
                .withCommand(":dup", "Duplicate a row", async () => {
                    console.log(chalk.yellow("Select the row to duplicate: "));
                    const rowData = await databaseShell.selectRow(editTools.columns, editTools.requiredSelectors);
                    if(!rowData) return;

                    console.log(chalk.yellow("Enter the updated row data: "));
                    const editedData = await databaseShell.editRow(rowData, editTools.columns, editTools.requiredValues, editTools.optionalValues);
                    if(!editedData) return;

                    await databaseShell.insertRow(editedData);
                    console.log(chalk.green("Row duplicated"));
                })
                .withCommand(":mod", "Modify an existing row", async () => {
                    console.log(chalk.yellow("Select the row to edit: "));
                    const rowData = await databaseShell.selectRow(editTools.columns, editTools.requiredSelectors);
                    if(rowData === null) return;

                    console.log(chalk.yellow("Enter the updated row data: "));
                    const editedData = await databaseShell.editRow(rowData, editTools.columns, editTools.requiredValues, editTools.optionalValues);
                    if(!editedData) return;

                    await databaseShell.updateRow(editedData, rowData);
                    console.log(chalk.yellow("Row updated"));
                });
        }

        const shell = builder.build();

        if (this.configs.length === 0) {
            throw new Error("No table configuration provided for DatabaseShellBuilder");
        }

        databaseShell.shell = shell;
        databaseShell.currentConfig = this.configs[0];
        databaseShell.tables = this.tables;

        return databaseShell;
    }
}

export class TableConfig {
    name: string;
    cmdShortcut: string;
    searchKeys: string[];
    threshold: number;
    tableHeader: string[];
    tableFormatter: (row: TableFormatterRow) => Array<string | number | boolean | null | undefined>;

    constructor() {
        this.name = "";
        this.cmdShortcut = "";
        this.searchKeys = [];
        this.threshold = 0.7;
        this.tableHeader = [];
        this.tableFormatter = () => [];
    }

    withName(name: string): TableConfig {
        this.name = name;
        return this;
    }

    withShortcut(shortcut: string): TableConfig {
        this.cmdShortcut = shortcut;
        return this;
    }

    withSearchKeys(keys: string[]): TableConfig {
        this.searchKeys = keys;
        return this;
    }

    withThreshold(threshold: number): TableConfig {
        this.threshold = threshold;
        return this;
    }

    withHeader(tableHeader: string[]): TableConfig {
        this.tableHeader = tableHeader;
        return this;
    }

    withFormatter(formatter: (row: TableFormatterRow) => Array<string | number | boolean | null | undefined>): TableConfig {
        this.tableFormatter = formatter;
        return this;
    }
}

