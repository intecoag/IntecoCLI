import adb from "adb-ts";
import chalk from "chalk";
import prompts from "prompts";
 
type AdbDevice = {
    id: string;
    model?: string;
};

type IntentPromptResult = {
    device: AdbDevice;
    action: string;
    data: string;
    codeId: "s" | "d";
};

export default async function adb_intent(_cli: unknown): Promise<void> {

    console.log()

    const adbClient = new adb.Client({ host: "127.0.0.1" });
    const devices = await adbClient.listDevices() as AdbDevice[];

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
        }) as IntentPromptResult;

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

