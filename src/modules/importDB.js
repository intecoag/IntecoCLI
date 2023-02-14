import prompts from "prompts"
import { writeFileSync, readFileSync, readdirSync, writeFile, unlinkSync, mkdirSync, renameSync, rmSync } from "fs";
import Seven from 'node-7z'
import ora from "ora";
import { DB } from "../utils/db/DB.js";
import { exec, execFile, execFileSync, execSync } from "child_process";
import { Config } from "../utils/config/config.js";


export default async function importDB(cli){
    console.log()

    const config = await Config.getConfig();

    const archivesDirectories = readdirSync("./", { withFileTypes: true }).filter(dirent => dirent.isFile()).map(dirent => { return { title: dirent.name } })

    let success = true;

    const results = await prompts([
        {
            // Ordnerauswahl von vorhandenen Ordner in configIndividual
            type: 'autocomplete',
            name: 'archive',
            message: 'Archive-Name?',
            choices: archivesDirectories
        },
        {
            // Ordnerauswahl von vorhandenen Ordner in configIndividual
            type: 'text',
            name: 'dbName',
            message: 'DB-Name?'
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
        const spinnerZIP = ora('Unpacking Archive').start();
        
        rmSync("./dump", {recursive:true, force:true})
        mkdirSync("./dump", {recursive:true})

        const unpack = Seven.extract(results.archive, "./dump")

        unpack.on('end', async()=>{
            const filename = readdirSync("./dump")[0]
            renameSync("./dump/"+filename, "./dump/dump.sql")
            spinnerZIP.succeed("Archive unpacked")

            const spinnerImport = ora('Importing DB').start();
    
            await DB.executeQuery("DROP DATABASE IF EXISTS "+results.dbName);
            await DB.executeQuery("CREATE DATABASE "+results.dbName);
    
            exec("mysql -u "+config.dbUser+" -p"+config.dbPassword+" "+results.dbName+" < dump/dump.sql", (error, stdout, stderr) => {
                spinnerImport.succeed("Database imported")

                const deleteSpinner = ora("Delete temporary dump").start()
                rmSync("./dump", {recursive:true, force:true})
                deleteSpinner.succeed("Dump deleted")
                console.log()
            })
        })

    }
}