import adb from "adb-ts";
import chalk from "chalk";
import prompts from "../utils/cliParams.js";
import { registerCommand } from "../utils/commandRegistry.js";

export default async function adb_intent(): Promise<void> {

    console.log()

    const adbClient = new adb.Client({ host: "127.0.0.1" });
    const devices = await adbClient.listDevices();

    let success = true;
    const result = await prompts([
            {
                // Ordnerauswahl von vorhandenen Ordner in configIndividual
                type: 'autocomplete',
                name: 'device',
                message: 'Device?',
                choices: devices.map((dev) => ({ title: `${dev.id} (${dev.model ?? "unknown"})`, value: dev }))
            },
            {
                // Ordnerauswahl von vorhandenen Ordner in configIndividual
                type: 'autocomplete',
                name: 'action',
                message: 'Action?',
                choices: [
                    {
                        "title":"BARCODE_DATA",
                        "value": "ch.inteco.orderprep.action.BARCODE_DATA"
                    },
                ]
            },
            {
                // Ordnerauswahl von vorhandenen Ordner in configIndividual
                type: 'text',
                name: 'data',
                message: 'Data?',
                initial:"1"
            },
            {
                // Ordnerauswahl von vorhandenen Ordner in configIndividual
                type: 'autocomplete',
                name: 'codeId',
                message: 'Code-Typ?',
                choices: [
                    {
                        "title":"QR-Code",
                        "value": "s"
                    },
                    {
                        "title":"EAN13",
                        "value": "d"
                    }
                ]
            }
        ],{
            onCancel: () => {
                console.log()
                console.log(chalk.red("Cancelled ADB Intent!"))
                console.log()
                success = false
            }
        });

    if (success) {
        await adbClient.shell(
            result.device.id,
            "am broadcast -a " + result.action + " --ei version 1 --es codeId " + result.codeId + " --es data " + result.data
        )
        console.log()
        console.log(chalk.green("Intent sent!"))
        console.log()
    }

}

registerCommand("adb_intent", "Sends a configurable Intent to an Android-Device", adb_intent, {
    parameters: {
        device: { type: "string", required: true, description: "ADB device id." },
        action: { type: "string", required: true, choices: ["ch.inteco.orderprep.action.BARCODE_DATA"] },
        data: { type: "string", default: "1" },
        codeId: { type: "string", required: true, choices: ["s", "d"], description: "s = QR-Code; d = EAN13." },
    },
});

