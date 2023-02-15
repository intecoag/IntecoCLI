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
        }else{
            let data = this.configData;
            let hasChange = false;
            Object.keys(defaultCFG).forEach(key => {
                // Write new config-entries if not present
                if(!Object.keys(this.configData).includes(key)){
                    data[key] = defaultCFG[key];
                    hasChange = true;
                }
            })

            Object.keys(this.configData).forEach(key => {
                if(!Object.keys(defaultCFG).includes(key)){
                    delete data[key]
                    hasChange = true;
                }
            })

            if(hasChange){
                this.configData = data;
                this.config.write(data);
            }
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
