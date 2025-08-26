import prompts from "prompts"
import { rmSync } from "fs";
import ora from "ora";
import { DB } from "../utils/db/DB.js";
import { Config } from "../utils/config/config.js";
import chalk from "chalk";
import path from "path";
import { exec, execSync } from "child_process";


export async function dumpDB(cli) {
    console.log()

    const config = await Config.getConfig();

    const databaseNames = await DB.getDatabaseNames();

    let success = true;

    const resultsDB = await prompts([
        {
            // DB-Auswahl von DB
            type: 'autocomplete',
            name: 'dbName',
            message: 'DB-Name?',
            choices: databaseNames.map(name => { return { title: name.name } })
        },
        {
            type: 'toggle',
            name: 'dataOnly',
            message: 'Dump data only (no table recreation)?',
            initial: false,
            active: 'yes',
            inactive: 'no'
        }
        , {
            type: 'toggle',
            name: 'selectIndividualTables',
            message: 'Select individual tables?',
            initial: false,
            active: 'yes',
            inactive: 'no'
        }], {
        onCancel: () => {
            console.log()
            console.log(chalk.red("Cancelled Import!"))
            console.log()
            success = false
        }
    })

    if (success) {
        let selectedTables = [];
        if (resultsDB.selectIndividualTables) {

            let tables = await DB.executeQueryOnDB("SHOW TABLES;", resultsDB.dbName);
            const tableKey = Object.keys(tables[0])[0];
            tables = tables.map(row => row[tableKey])
            let continuePrompt = true;
            while (continuePrompt) {
                const resultsTable = await prompts([
                    {
                        // DB-Auswahl von DB
                        type: 'autocomplete',
                        name: 'table',
                        message: 'Table?',
                        choices: tables.map(name => { return { title: name } }),
                        default: ""
                    }, {
                        type: 'toggle',
                        name: 'continue',
                        message: 'Add another table?',
                        initial: false,
                        active: 'yes',
                        inactive: 'no'
                    }], {
                    onCancel: () => {
                        console.log()
                        console.log(chalk.red("Cancelled Import!"))
                        console.log()
                        success = false
                    }
                })

                selectedTables.push(resultsTable.table)
                continuePrompt = resultsTable.continue
            }

        }

        const results = await prompts([
            {
                // Ordnerauswahl von vorhandenen Ordner in configIndividual
                type: 'text',
                name: 'dumpName',
                message: 'Dump-Name?',
                initial: 'dump.sql'
            }
        ], {
            onCancel: () => {
                console.log()
                console.log(chalk.red("Cancelled Import!"))
                console.log()
                success = false
            }
        })

        if (success) {
            console.log()
            const spinner = ora('Dumping DB').start();

            const dumpCommand = `mysqldump ${resultsDB.dataOnly?'--no-create-info':''} -u${config.dbUser} -p${config.dbPassword} -h${config.dbURL} ${resultsDB.dbName} ${selectedTables.join(" ")} > ${results.dumpName}`;

            exec(dumpCommand, (error, stdout, stderr) => {
                if (error) {
                    spinner.fail('Failed to dump DB');
                    console.error(error);
                    return;
                }

                spinner.succeed("Dumped DB to " + results.dumpName);
                console.log();
            });
        }
    }


}

export async function dumpDBMand(cli) {
    console.log()

    const config = await Config.getConfig();

    const databaseNames = await DB.getDatabaseNames();

    let success = true;

    const results = await prompts([
        {
            // DB-Auswahl von DB
            type: 'autocomplete',
            name: 'dbName',
            message: 'DB-Name?',
            choices: databaseNames.map(name => { return { title: name.name } })
        },
        {
            type: 'number',
            name: 'mnr',
            message: 'Mandant?',
            initial: '1'
        },
        {
            // Ordnerauswahl von vorhandenen Ordner in configIndividual
            type: 'text',
            name: 'dumpName',
            message: 'Dump-Name?',
            initial: 'dump.sql'
        }
    ], {
        onCancel: () => {
            console.log()
            console.log(chalk.red("Cancelled Import!"))
            console.log()
            success = false
        }
    })

    if (success) {
        console.log()

        const spinner = ora('Dumping DB').start();

        // Load table names
        let tables = await DB.executeQueryOnDB("SHOW TABLES;", results.dbName);
        const tableKey = Object.keys(tables[0])[0];
        tables = tables.map(row => row[tableKey])

        if (tables == null || tables.length == 0) {
            spinner.fail("Database has no tables: " + results.dbName)
        } else {
            // Remove previous dump
            rmSync("." + path.sep + results.dumpName, { recursive: true, force: true })
            for (const table of tables) {
                // Check if Mand-Column exists
                const tableSpinner = ora("Dumping data: " + table).start();
                const tableCol = table + "_mnr"
                const columnExists = await DB.executeQueryOnDB("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = '" + results.dbName + "' AND table_name = '" + table + "' AND column_name = '" + tableCol + "';")

                if (columnExists[0]['COUNT(*)'] != 0) {
                    // Check if Mand-Data is present
                    const dataExists = await DB.executeQueryOnDB("SELECT COUNT(*) FROM " + table + " WHERE " + tableCol + " = '" + results.mnr + "';", results.dbName);

                    if (dataExists[0]['COUNT(*)'] != 0) {
                        // Dump table
                        execSync("mysqldump -u" + config.dbUser + " -p" + config.dbPassword + " -h" + config.dbURL + " --no-create-info --where=\"" + tableCol + " = '" + results.mnr + "'\" " + results.dbName + " " + table + " >> " + results.dumpName);

                        tableSpinner.succeed("Data dumped: " + table);
                    } else {
                        tableSpinner.info("No data present, Skipping table: " + table)
                    }
                } else {
                    tableSpinner.info("Column " + tableCol + " not found, Skipping table: " + table)
                }
            }
            // Dump mand-table (special field name)
            const tableSpinner = ora("Dumping mand (custom logic)")
            execSync("mysqldump -u" + config.dbUser + " -p" + config.dbPassword + " -h" + config.dbURL + " --no-create-info --where=\"mand_mandant = '" + results.mnr + "'\" " + results.dbName + " mand >> " + results.dumpName);
            tableSpinner.succeed("Data dumped: mand")
            spinner.succeed("Dumped DB to " + results.dumpName);
        }


        console.log();
    }
}