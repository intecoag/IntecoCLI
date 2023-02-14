import cfg from "application-config"
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const defaultCFG = require("./default.json");

export class Config{
    static config = cfg("inteco_cli");
    static configData;

    static async initConfig(){
        if(this.configData == null){
            this.configData = await this.config.read();
        }

        if(Object.keys(this.configData).length === 0){
            // Default Configuration
            this.configData = defaultCFG
            this.config.write(defaultCFG)
        }
    }

    static async getConfig(){
        await this.initConfig()

        return this.configData
    }

    static async getConfigPath(){
        await this.initConfig();
        return this.config.filePath;
    }

    static async setConfigField(field, value){
        await this.initConfig();

        let data = this.configData;

        data[field] = value;

        this.configData = data;
        this.config.write(data);
    }

    static async setConfig(data){
        this.configData = data;
        this.config.write(data);
    }


}
