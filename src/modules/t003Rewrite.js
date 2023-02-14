import chalk from "chalk";
import prompts from "prompts";
import { Config } from "../utils/config/config.js";
import { DB } from "../utils/db/DB.js";

export default async function t003Rewrite(cli) {
    console.log()

    const config = await Config.getConfig();

    const databaseNames = await DB.getDatabaseNames();

    let success = true;

    const responseDB = await prompts([{
        // DB-Auswahl von DB
        type: 'autocomplete',
        name: 'dbName',
        message: 'DB-Name?',
        choices: databaseNames.map(name => { return { title: name.name } })
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

        const users = await DB.executeQueryOnDB("SELECT t003_pw FROM t003 WHERE t003_mnr = " + responseDB.mnr, responseDB.dbName);


        const responses = await prompts([{
            // Ordnerauswahl von vorhandenen Ordner in configIndividual
            type: 'autocomplete',
            name: 'username',
            message: 'Username?',
            choices: users.map(entry => { return ({ title: entry.t003_pw }) })
        }], {
            onCancel: () => {
                console.log()
                console.log(chalk.red("Cancelled Rewrite!"))
                console.log()
                success = false
            }
        })

        if (success) {
            console.log()

            await DB.executeQueryOnDB("UPDATE t003 SET t003_pw = '"+config.wegasUsername+"' WHERE t003_mnr = "+responseDB.mnr+" AND t003_pw = '"+responses.username+"'", responseDB.dbName);

            console.log(chalk.green("T003 rewritten!"))
            console.log()
        }
    }
}