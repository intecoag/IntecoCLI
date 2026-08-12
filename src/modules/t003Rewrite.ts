import chalk from "chalk";
import prompts from "prompts";
import { Config } from "../utils/config/config.js";
import { DB } from "../utils/db/DB.js";

type UserRow = {
    t003_pw: string;
};

type UserPrompt = {
    username: string;
};

type MandRow = {
    mand_mandant: string;
    mand_name: string;
}

export default async function t003Rewrite(_cli: unknown): Promise<void> {
    console.log()

    const config = await Config.getConfig();

    const databaseNames = await DB.getDatabaseNames();

    let success = true;

    const promptOptions = {
        onCancel: () => {
            console.log();
            console.log(chalk.red("Cancelled Rewrite!"));
            console.log();
            success = false;
        }
    };

    const responseDB = await prompts({
        // DB-Auswahl von DB
        type: 'autocomplete',
        name: 'dbName',
        message: 'DB-Name?',
        choices: databaseNames.map(db => ({
            title: db.name,
            value: db.name
        }))
    }, promptOptions);

    if(!success)
        return;

    const mands = await DB.executeQueryOnDB(`SELECT mand_mandant, mand_name FROM mand ORDER BY mand_mandant`, responseDB.dbName) as MandRow[];

    const responseMand = await prompts({
        type: 'autocomplete',
        name: 'mnr',
        message: 'Mandant?',
        choices: mands.map(mand => ({
            title: `${mand.mand_mandant}: ${mand.mand_name}`,
            value: mand.mand_mandant
        })).concat([{ title: 'All', value: "ALL" }])
    }, promptOptions);

    if(!success)
        return;

    const isAll = responseMand.mnr === "ALL";

    const users = isAll
        ? await DB.executeQueryOnDB("SELECT DISTINCT t003_pw FROM t003", responseDB.dbName) as UserRow[]
        : await DB.executeQueryOnDB("SELECT t003_pw FROM t003 WHERE t003_mnr = " + responseMand.mnr, responseDB.dbName) as UserRow[];

    const responses = await prompts([{
        // Ordnerauswahl von vorhandenen Ordner in configIndividual
        type: 'autocomplete',
        name: 'username',
        message: 'Username?',
        choices: users.map(entry => { return ({ title: entry.t003_pw }) })
    }], promptOptions) as UserPrompt

    if (success) {
        console.log()

        if(isAll) {
            await DB.executeQueryOnDB("UPDATE t003 SET t003_pw = '"+config.wegasUsername+"' WHERE t003_pw = '"+responses.username+"'", responseDB.dbName);
        }
        else {
            await DB.executeQueryOnDB("UPDATE t003 SET t003_pw = '"+config.wegasUsername+"' WHERE t003_mnr = "+responseMand.mnr+" AND t003_pw = '"+responses.username+"'", responseDB.dbName);
        }

        console.log(chalk.green("T003 rewritten!"))
        console.log()
    }
}
