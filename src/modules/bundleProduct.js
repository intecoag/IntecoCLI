import { readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "fs";
import Seven from 'node-7z'
import sevenBin from '7zip-bin'
import { Config } from "../utils/config/config.js";
import prompts from "prompts";
import chalk from "chalk";
import { fileURLToPath } from 'url';
import { dirname} from 'path';
import path from "path";
import ora from "ora";
import { cp } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default async function bundleProduct(cli) {
    console.log()

    const config = await Config.getConfig();

    let success = true;

    const folders = readdirSync(process.cwd(), { withFileTypes: true }).filter(dirent => !dirent.isFile()).map(dirent => { return { title: dirent.name } })

    const configDirectories = readdirSync(config.configIndividualPathEclipse, { withFileTypes: true }).filter(dirent => dirent.isDirectory()).map(dirent => { return { title: dirent.name } })


    const results = await prompts([
        {
            // Ordnerauswahl von vorhandenen Ordner in configIndividual
            type: 'autocomplete',
            name: 'folder',
            message: 'Product-Folder?',
            choices: folders,
            initial: "eclipse"
        },
        {
            // Ordnerauswahl von vorhandenen Ordner in configIndividual
            type: 'autocomplete',
            name: 'configIndividual',
            message: 'Customer-Config (from Eclipse-Repository)?',
            choices: configDirectories
        },
        {
            // Ordnerauswahl von vorhandenen Ordner in configIndividual
            type: 'text',
            name: 'ram',
            message: 'Xmx-Value (Max. RAM) in GB?',
            initial: "8",
            validate: input => {
                if (isNaN(input)) {
                    return "Enter a Number"
                }
                return true;
            }
        },
        {
            // Ordnerauswahl von vorhandenen Ordner in configIndividual
            type: 'text',
            name: 'folderName',
            message: 'Product-Name?',
            initial: "eclipse"
        },
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

        const spinnerRemoveOld = ora("Removing old configs")
        rmSync(path.resolve(".", results.folder, "config"), {recursive: true})
        rmSync(path.resolve(".", results.folder, "configIndividual"), {recursive: true})
        spinnerRemoveOld.succeed("Removed old configs")

        const spinnerConfig = ora('Copying config').start();


        const sourceConfig = path.resolve(config.configIndividualPathEclipse, '..', "config");
        const destConfig = path.resolve(".", results.folder, "config")

        await cp(sourceConfig, destConfig, { recursive: true })

        spinnerConfig.succeed("Config copied")

        const spinnerConfigIndividual = ora('Copying configIndividual: ' + results.configIndividual).start();


        const sourceConfigIndividual = path.resolve(config.configIndividualPathEclipse, results.configIndividual);
        const destConfigIndividual = path.resolve(".", results.folder, "configIndividual", results.configIndividual)

        await cp(sourceConfigIndividual, destConfigIndividual, { recursive: true })

        spinnerConfigIndividual.succeed("ConfigIndividual copied: " + results.configIndividual)

        const spinnerIcon = ora('Copying icon').start();

        const sourceIcon = path.resolve(__dirname, "..", "ressources", "wegas_p.ico");
        const destIcon = path.resolve(".", results.folder, "wegas_p.ico")

        await cp(sourceIcon, destIcon, { recursive: true })

        spinnerIcon.succeed("Icon copied")

        const spinnerIniRewrite = ora('Rewriting wegas.ini: -Xmx' + results.ram + "g").start();

        const iniPath = path.resolve(".", results.folder, "wegas.ini")

        let iniContent = readFileSync(iniPath, 'utf-8');
        const updatedContent = iniContent.replace(/-Xmx\d+[mgMG]?/, `-Xmx${results.ram}g`);
        writeFileSync(iniPath, updatedContent);

        spinnerIniRewrite.succeed("wegas.ini rewritten: -Xmx" + results.ram + "g")

        const spinnerRename = ora("Renaming folder: "+results.folder +" -> "+results.folderName).start();
        renameSync(path.resolve(".", results.folder), path.resolve(".", results.folderName))
        spinnerRename.succeed("Folder renamed: "+results.folder +" -> "+results.folderName)

        const spinnerZIP = ora('Zipping: ' + results.folderName+".zip").start();

        const zipPath = path.resolve(".", results.folderName+".zip")
        const addPath = path.resolve(".", results.folderName)
        const add = Seven.add(zipPath, addPath, {
            $bin: sevenBin.path7za
        })

        await getPromiseFromEvent(add, "end")

        spinnerZIP.succeed('Zipped: ' + results.folderName+".zip")

                const spinnerRenameRevert = ora("Renaming folder: "+results.folderName +" -> "+results.folder).start();
        renameSync(path.resolve(".", results.folderName), path.resolve(".", results.folder))
        spinnerRenameRevert.succeed("Folder renamed: "+results.folderName +" -> "+results.folder)


        console.log()
    }
}

function getPromiseFromEvent(item, event) {
    return new Promise((resolve) => {
      const listener = (data) => {
        resolve(data);
      }
      item.on(event, listener);
    })
  }