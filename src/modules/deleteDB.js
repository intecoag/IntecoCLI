import prompts from "prompts"
import { rmSync } from "fs";
import ora from "ora";
import { DB } from "../utils/db/DB.js";
import chalk from "chalk";
import path from "path";


export default async function deleteDBMand(cli){
    console.log()

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
        }
    ],{
        onCancel: () => {
            console.log()
            console.log(chalk.red("Cancelled Import!"))
            console.log()
            success = false
        }
    })

    if(success){
        console.log()

        const spinner = ora('Deleting in DB').start();

        // Load table names
        let tables = await DB.executeQueryOnDB("SHOW TABLES;", results.dbName);
        const tableKey = Object.keys(tables[0])[0];
        tables = tables.map(row => row[tableKey])

        if(tables == null || tables.length == 0){
            spinner.fail("Database has no tables: "+results.dbName)
        }else{
            // Remove previous dump
            rmSync("."+path.sep+results.dumpName, {recursive:true, force:true})
            for(const table of tables){
                // Check if Mand-Column exists
                const tableSpinner = ora("Deleting data: "+table).start();
                const tableCol = table+"_mnr"
                const columnExists = await DB.executeQueryOnDB("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = '"+results.dbName+"' AND table_name = '"+table+"' AND column_name = '"+tableCol+"';")

                if(columnExists [0]['COUNT(*)'] != 0){
                    // Check if Mand-Data is present
                    const dataExists = await DB.executeQueryOnDB("SELECT COUNT(*) FROM "+table+" WHERE "+tableCol+" = '"+results.mnr+"';", results.dbName);

                    if(dataExists[0]['COUNT(*)'] != 0){
                        await DB.executeQueryOnDB("DELETE FROM "+table+" WHERE "+tableCol+" = '"+results.mnr+"';", results.dbName)
                        tableSpinner.succeed("Data deleted: "+table);
                    }else{
                        tableSpinner.info("No data present, Skipping table: "+table)
                    }
                }else{
                    tableSpinner.info("Column "+tableCol+" not found, Skipping table: "+table)
                }
            }
            // Dump mand-table (special field name)
            const tableSpinner = ora("Deleting mand (custom logic)")
            await DB.executeQueryOnDB("DELETE FROM mand WHERE mand_mandant = '"+results.mnr+"';", results.dbName)
            tableSpinner.succeed("Data deleted: mand")
            spinner.succeed("Mand deleted: "+results.mnr);
        }

        
        console.log();
    }
}