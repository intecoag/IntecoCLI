import prompts from "prompts"
import { writeFileSync, readFileSync, readdirSync, writeFile, unlinkSync, mkdirSync, renameSync, rmSync } from "fs";
import Seven from 'node-7z'
import ora from "ora";
import { DB } from "../utils/db/DB.js";
import { exec, execFile, execFileSync, execSync } from "child_process";
import { Config } from "../utils/config/config.js";
import chalk from "chalk";
import path from "path";
import sevenBin from '7zip-bin'


export default async function importDB(cli){
    console.log()

    const config = await Config.getConfig();

    const archivesDirectories = readdirSync(process.cwd(), { withFileTypes: true }).filter(dirent => dirent.isFile()).map(dirent => { return { title: dirent.name } })

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
        
        rmSync("."+path.sep+"dump", {recursive:true, force:true})
        mkdirSync("."+path.sep+"/dump", {recursive:true})

        const unpack = Seven.extract(results.archive, "."+path.sep+"dump", {
            $bin: sevenBin.path7za
        })

        unpack.on('end', async()=>{
            const filename = readdirSync("."+path.sep+"dump")[0]
            renameSync("."+path.sep+"dump"+path.sep+""+filename, "."+path.sep+"dump"+path.sep+"dump.sql")
            spinnerZIP.succeed("Archive unpacked")

            const spinnerImport = ora('Importing DB').start();
    
            await DB.executeQuery("DROP DATABASE IF EXISTS "+results.dbName);
            await DB.executeQuery("CREATE DATABASE "+results.dbName);
    
            exec("mysql -u "+config.dbUser+" -p"+config.dbPassword+" "+results.dbName+" < dump"+path.sep+"dump.sql", (error, stdout, stderr) => {
                if(error != null){
                    spinnerImport.fail("Database-Import failed!")
                    console.log(error)
                }else{
                    spinnerImport.succeed("Database imported")

                    const deleteSpinner = ora("Delete temporary dump").start()
                    rmSync("."+path.sep+"dump", {recursive:true, force:true})
                    deleteSpinner.succeed("Dump deleted")
                }

                console.log()
            })
        })

    }
}