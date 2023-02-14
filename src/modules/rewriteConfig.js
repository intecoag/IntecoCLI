import prompts from "prompts";
import os from 'os';
import { createEditor } from "properties-parser";
import { writeFileSync, readFileSync, readdirSync } from "fs";
import YAML from 'yaml'
import chalk from "chalk";
import { Config } from "../utils/config/config.js";
import { DB } from "../utils/db/DB.js";



async function configRewrite(cli) {
    console.log()

    const homedir = os.homedir();

    const config = await Config.getConfig();

    const databaseNames = await DB.getDatabaseNames();

    const configDirectories = readdirSync(config.configIndividualPath, { withFileTypes: true }).filter(dirent => dirent.isDirectory()).map(dirent => { return { title: dirent.name } })

    let success = true;

    const responses = await prompts([{
        // DB-Auswahl von DB
        type: 'autocomplete',
        name: 'dbName',
        message: 'DB-Name?',
        choices: databaseNames.map(name => { return { title: name.name } })
    }, {
        // Ordnerauswahl von vorhandenen Ordner in configIndividual
        type: 'autocomplete',
        name: 'configName',
        message: 'ConfigIndividual-Name?',
        choices: configDirectories
    }, {
        type: 'number',
        name: 'mnr',
        message: 'Mandant?',
        initial: '1'
    }], {
        onCancel: () => {
            console.log()
            console.log(chalk.red("Cancelled Rewrite!"))
            console.log()
            success = false
        }
    });

    if (success) {
        // Rewrite jwegas.properties
        const editorJwegasProperties = createEditor(homedir + "/jwegas.properties")
        editorJwegasProperties.set("user.mandant", responses.mnr.toString());
        editorJwegasProperties.save();

        // Rewrite wegas.properties
        const editorWegasProperties = createEditor(config.configIndividualPath + "/wegas.properties")
        editorWegasProperties.set("db.database", responses.dbName);
        editorWegasProperties.save();

        // Rewrite path.yaml
        const content = readFileSync(config.configIndividualPath + "/path.yaml", "utf-8");

        const doc = YAML.parseDocument(content)

        doc.set("pathIndividual", config.configIndividualPathWrite + "\\\\" + responses.configName + "\\\\")

        writeFileSync(config.configIndividualPath + "/path.yaml", doc.toString());

        console.log()
        console.log(chalk.green("Config-Rewrite successful!"))
        console.log()
    }

}

export default configRewrite;