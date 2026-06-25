import adb from "adb-ts";
import chalk from "chalk";
import prompts from "prompts";
 
type AdbDevice = {
    id: string;
    model?: string;
};

type BridgePromptResult = {
    device: AdbDevice;
    port: number;
};

export default async function adb_bridge(_cli: unknown): Promise<void> {

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
                type: 'number',
                name: 'port',
                initial: 3000,
                message: 'Port?'
            }
        ], {
            onCancel: () => {
                console.log()
                console.log(chalk.red("Cancelled ADB Bridge!"))
                console.log()
                success = false
            }
        }) as BridgePromptResult;

    if (success) {
        const portString = String(result.port);
        await adbClient.reverse(result.device.id, "tcp:" + portString, "tcp:" + portString)
        console.log()
        console.log(chalk.green("ADB bridged!"))
        console.log()
    }

}

