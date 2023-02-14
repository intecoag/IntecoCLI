import adb from "adb-ts";
import chalk from "chalk";
import prompts from "prompts";
import { Config } from "../utils/config/config.js";


export default async function adb_bridge(cli){

    console.log()

    const config = await Config.getConfig();

    const adbClient = new adb.AdbClient({host: "127.0.0.1"})

    adbClient.listDevices()
    .then(async (devices) => {
        let success = true;
        const result = await prompts([
            {
                // Ordnerauswahl von vorhandenen Ordner in configIndividual
                type: 'autocomplete',
                name: 'device',
                message: 'Device?',
                choices: devices.map(dev => {return {title: dev.id+" ("+dev.model+")", value:dev}})
            },
            {
                // Ordnerauswahl von vorhandenen Ordner in configIndividual
                type: 'number',
                name: 'port',
                initial: "3000",
                message: 'Port?'
            }
        ],{
            onCancel: () => {
                console.log()
                console.log(chalk.red("Cancelled ADB Bridge!"))
                console.log()
                success = false
            }
        })

        if(success){
            await adbClient.reverse(result.device.id, "tcp:"+result.port, "tcp:"+result.port)
            console.log()
            console.log(chalk.green("ADB bridged!"))
            console.log()
        }
    });

    

}