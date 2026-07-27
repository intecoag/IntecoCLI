import cfg from "application-config"
import defaultCFG from './default.json' with {type: 'json'};

export interface CLIConfig {
    configIndividualPath: string;
    configIndividualPathWrite: string;
    configIndividualPathEclipse: string;
    dbURL: string;
    dbUser: string;
    dbPassword: string;
    wegasUsername: string;
    [key: string]: unknown;
}

type ConfigStore = {
    read: () => Promise<Record<string, unknown>>;
    write: (data: Record<string, unknown>) => Promise<void> | void;
    filePath: string;
};

const defaultConfig = defaultCFG as CLIConfig;

export class Config {
    static config: ConfigStore = cfg("inteco_cli") as ConfigStore;
    static configData: CLIConfig | null = null;

    private static normalizeConfig(data: Record<string, unknown>): CLIConfig {
        const normalized: CLIConfig = { ...defaultConfig };

        for (const key of Object.keys(defaultConfig)) {
            if (Object.hasOwn(data, key)) {
                normalized[key] = data[key];
            }
        }

        return normalized;
    }

    static async initConfig(): Promise<void> {
        if (this.configData == null) {
            const rawData = await this.config.read();
            this.configData = this.normalizeConfig(rawData);
        }

        if (!this.configData || Object.keys(this.configData).length === 0) {
            // Default Configuration
            this.configData = { ...defaultConfig };
            this.config.write(this.configData);
        } else {
            const data = this.normalizeConfig(this.configData);
            let hasChange = false;

            Object.keys(defaultConfig).forEach((key) => {
                // Write new config-entries if not present
                if (!Object.keys(this.configData as CLIConfig).includes(key)) {
                    data[key] = defaultConfig[key];
                    hasChange = true;
                }
            });

            Object.keys(this.configData).forEach((key) => {
                if (!Object.keys(defaultConfig).includes(key)) {
                    delete data[key]
                    hasChange = true;
                }
            });

            if (hasChange) {
                this.configData = data;
                this.config.write(data);
            } else {
                this.configData = data;
            }
        }
    }

    static async getConfig(): Promise<CLIConfig> {
        await this.initConfig();

        if (!this.configData) {
            this.configData = { ...defaultConfig };
        }

        return this.configData;
    }

    static async getConfigPath(): Promise<string> {
        await this.initConfig();
        return this.config.filePath;
    }

    static async setConfigField(field: string, value: unknown): Promise<void> {
        await this.initConfig();

        const data: CLIConfig = { ...(this.configData ?? defaultConfig) };

        data[field] = value;

        this.configData = data;
        this.config.write(data);
    }

    static async setConfig(data: CLIConfig): Promise<void> {
        this.configData = data;
        this.config.write(data);
    }


}


