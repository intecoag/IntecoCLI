import prompts from "prompts"
import { writeFileSync, readFileSync, readdirSync, writeFile, unlinkSync, mkdirSync, renameSync, rmSync, copyFileSync } from "fs";
import Seven from 'node-7z'
import ora from "ora";
import { DB } from "../utils/db/DB.js";
import { exec, execFile, execFileSync, execSync } from "child_process";
import { Config } from "../utils/config/config.js";
import chalk from "chalk";
import path from "path";
import sevenBin from '7zip-bin'


export default async function importDB(cli) {
    console.log()

    const config = await Config.getConfig();

    const files = readdirSync(process.cwd(), { withFileTypes: true }).filter(dirent => dirent.isFile()).map(dirent => { return { title: dirent.name } })

    let success = true;

    const results = await prompts([
        {
            // Ordnerauswahl von vorhandenen Ordner in configIndividual
            type: 'autocomplete',
            name: 'file',
            message: 'Dump-Name?',
            choices: files
        },
        {
            // Ordnerauswahl von vorhandenen Ordner in configIndividual
            type: 'text',
            name: 'dbName',
            message: 'DB-Name?'
        },
        {
            type: 'toggle',
            name: 'dropDB',
            message: 'Delete and Recreate DB before import?',
            initial: true,
            active: 'yes',
            inactive: 'no'
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
        rmSync("." + path.sep + "dump", { recursive: true, force: true })
        mkdirSync("." + path.sep + "/dump", { recursive: true })

        if (await isArchive(results.file)) {

            const spinnerZIP = ora('Unpacking Archive').start();

            const unpack = Seven.extract(results.file, "." + path.sep + "dump", {
                $bin: sevenBin.path7za
            })

            unpack.on('end', async () => {
                const filename = readdirSync("." + path.sep + "dump")[0]
                renameSync("." + path.sep + "dump" + path.sep + "" + filename, "." + path.sep + "dump" + path.sep + "dump.sql")
                spinnerZIP.succeed("Archive unpacked")

                await importDBActual(config, results)
            })
        }else{
            const spinnerCopy = ora('Copying Dump').start();

            copyFileSync("."+path.sep+results.file, "." + path.sep + "dump" + path.sep + "dump.sql")

            spinnerCopy.succeed("Dump copied")

            await importDBActual(config, results)
        }
    }
}

function isArchive(file) {
    return new Promise((resolve, reject) => {
        const test = Seven.list("."+path.sep+file, {
            $bin: sevenBin.path7za
        });
        test.on('end', (stream) => {
            resolve(true)
        })
        test.on('error', (stream) => {
            resolve(false)
        })
    });
}

async function importDBActual(config, results) {
    const spinnerImport = ora('Importing DB').start();

    if (results.dropDB) {
        await DB.executeQuery("DROP DATABASE IF EXISTS " + results.dbName);
        await DB.executeQuery("CREATE DATABASE " + results.dbName);
    }

    exec("mysql -u " + config.dbUser + " -p" + config.dbPassword + " " + results.dbName + " < dump" + path.sep + "dump.sql", (error, stdout, stderr) => {
        if (error != null) {
            spinnerImport.fail("Database-Import failed!")
            console.log(error)
        } else {
            spinnerImport.succeed("Database imported")

            const deleteSpinner = ora("Delete temporary dump").start()
            rmSync("." + path.sep + "dump", { recursive: true, force: true })
            deleteSpinner.succeed("Dump deleted")
        }

        console.log()
    })
}