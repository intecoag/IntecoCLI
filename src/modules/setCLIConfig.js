import prompts from "prompts";
import { Config } from "../utils/config/config.js";
import chalk from "chalk";

export default async function writeCLIConfig(){
    console.log()
    
    let data = await Config.getConfig();

    let keys = Object.keys(data);
    let success = true;
    
    const responses = await prompts(keys.map(key =>  {
        return {
        // Ordnerauswahl von vorhandenen Ordner in configIndividual
        type: 'text',
        name: key,
        message: key+":",
        initial: data[key]
        }
    }), {
        onCancel: () => {
            console.log()
            console.log(chalk.red("Cancelled Config!"))
            console.log()
            success = false
        }
    })

    if(success){
        Config.setConfig(responses)
    }
}