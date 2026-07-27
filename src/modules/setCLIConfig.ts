import prompts from "prompts";
import { Config, type CLIConfig } from "../utils/config/config.js";
import chalk from "chalk";

export default async function writeCLIConfig(): Promise<void> {
    console.log()
    
    const data = await Config.getConfig();

    const keys = Object.keys(data);
    let success = true;
    
    const responses: Partial<CLIConfig> = await prompts(keys.map((key) => {
        return {
        // Ordnerauswahl von vorhandenen Ordner in configIndividual
        type: 'text',
        name: key,
        message: key+":",
        initial: String(data[key] ?? "")
        }
    }), {
        onCancel: () => {
            console.log()
            console.log(chalk.red("Cancelled Config!"))
            console.log()
            success = false
        }
    });

    if(success) {
        await Config.setConfig({ ...data, ...responses })
    }
}

