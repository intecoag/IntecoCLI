import chalk from "chalk";
import prompts from "prompts";

export type ShellCommand = {
    name: string;
    helpText: string;
    handler: (shell: Shell, input: string, ...args: string[]) => Promise<unknown> | unknown;
};

export type ShellCommandHandler = (shell: Shell, input: string) => Promise<boolean> | boolean;

type PromptChoice = {
    title: string;
    value?: string;
};

export class Shell {
    commands: ShellCommand[];
    commandHandlers: ShellCommandHandler[];
    name: string;
    prompt: string;
    autocomplete: string[];
    exitRequested: boolean;

    constructor() {
        this.commands = [];
        this.commandHandlers = [];
        this.name = "";
        this.prompt = "";
        this.autocomplete = [];

        this.exitRequested = false;
    }

    /**
     * Starts the shell in a loop and continues until exit() is called.
     */
    async run() {
        this.exitRequested = false;

        console.log(chalk.green(`${this.name} Started.`));

        while (!this.exitRequested) {
            const response = await prompts({
                type: "autocomplete",
                name: "input",
                message: this.prompt,
                choices: this.autocomplete.map((ac): PromptChoice => ({
                    title: ac,
                    value: ac
                })),
                limit: 1,
                suggest: async (input: string, choices: PromptChoice[]) => {
                    const text = input ?? "";
                    const q = text.trim().toLowerCase();

                    const matches = q.length === 0
                        ? choices
                        : choices.filter((choice) => choice.title.toLowerCase().startsWith(q));

                    return [
                        {
                            title: text.length > 0 ? text : " ",
                            value: text
                        },
                        ...matches.filter((choice) => (choice.value ?? choice.title) !== text)
                    ];
                }
            }) as { input?: string };

            const input = (response?.input ?? "").trim();

            if (!await this.handleCommand(input)) {
                console.log(chalk.red(`Unknown command '${input}'`));
            }
        }

        console.log(chalk.yellow(`\n\n${this.name} Ended.`));
    }

    /**
     * Requests the shell to exit
     */
    exit() {
        this.exitRequested = true;
    }

    /**
     * Executes a single command in the shell
     * @param {String} input The command to execute
     * @returns {Promise<boolean>}
     */
    async handleCommand(input: string): Promise<boolean> {
        for(let i = 0; i < this.commandHandlers.length; i++) {
            const handler = this.commandHandlers[i];
            if(await handler(this, input)) {
                return true;
            }
        }
        return false;
    }
}

