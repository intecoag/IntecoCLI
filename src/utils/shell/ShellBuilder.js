import chalk from "chalk";
import { Shell } from "./shell.js";

export class ShellBuilder {

    constructor() {
        this.commands = [];
        this.commandHandlers = [];
        this.name = "Interactive Shell";
        this.prompt = "Interactive Shell (show help with :?)";
        this.useBuiltInHandler = false;
    }

    /**
     * Adds the built-in command handler
     * @returns {ShellBuilder}
     */
    withBuiltInHandler() {
        this.withCommandHandler(async (shell, input) => {
            const parts = this.parseArgs(input);
            if(parts.length == 0) return false;

            const commandName = parts[0];
            const args = parts.slice(1);

            for(let i = 0; i < shell.commands.length; i++) {
                const command = shell.commands[i];

                if(command.name == commandName) {
                    await command.handler(shell, input, ...args);
                    return true;
                }
            }

            return false;
        });

        this.useBuiltInHandler = true;

        return this;
    }

    /**
     * Adds the built-in commands (:q and :?), requires a supported handler to work
     * @returns {ShellBuilder}
     */
    withBuiltInCommands() {
        this.withCommand(":q", "Exit the shell", shell => {
                shell.exit();
            })
            .withCommand(":?", "Shows this help", shell => {
                console.log("\n" + chalk.cyan("Available Commands:"));
                
                shell.commands.forEach(command => {
                    console.log(`${chalk.yellow(command.name)} - ${command.helpText}`);
                });
            });

        return this;
    }

    /**
     * Add a command to be executed by the built in command handler
     * @param {String} commandName The command name to be entered in the command line
     * @param {String} helpText The text displayed in the help
     * @param {(shell: Shell, input: String, ...args: String[]) => void} handler The handler to be executed with the executing shell passed as an arugment
     * @returns {ShellBuilder}
     */
    withCommand(commandName, helpText, handler) {
        this.commands.push({
            name: commandName,
            handler: handler,
            helpText: helpText
        });
        return this;
    }

    /**
     * Change the name of the shell
     * @param {String} name The name of the shell used in some texts
     * @returns {ShellBuilder}
     */
    withName(name) {
        this.name = name;
        return this;
    }

    /**
     * Change the prompt displayed when entering text
     * @param {String} prompt The text to be displayed in the prompt
     * @returns {ShellBuilder}
     */
    withPrompt(prompt) {
        this.prompt = prompt;
        return this;
    }

    /**
     * Add a command handler to be executed if the inputted command doesn't correspond to a built in handler
     * @param {(shell: Shell, input: String) => boolean} handler The handler to be executed with the inputted text and shell passed as arguments.
     * Return true to signal that the handler was successful and shouldn't continue with another handler.
     * 
     * @returns {ShellBuilder}
     */
    withCommandHandler(handler) {
        this.commandHandlers.push(handler);
        return this;
    }

    /**
     * Creates a usable shell with the built-in and custom functions.
     * @returns {Shell}
     */
    build() {
        let shell = new Shell();
        shell.commands = this.commands;
        shell.name = this.name;
        shell.prompt = this.prompt;
        shell.commandHandlers = this.commandHandlers;
        shell.autocomplete = shell.commands.map(c => c.name);

        return shell;
    }

    /**
     * Splits a command into args with support for spaces and and escape sequences
     * @private
     * @param {String} input The unformatted command
     * @returns {String[]}
     */
    parseArgs(input) {
        const result = [];
        let current = "";
        let inQuotes = false;
        let escaping = false;

        for (let i = 0; i < input.length; i++) {
            const char = input[i];

            if (escaping) {
                current += char;
                escaping = false;
                continue;
            }

            if (char === "\\") {
                escaping = true;
                continue;
            }

            if (char === '"') {
                inQuotes = !inQuotes;
                continue;
            }

            if (char === " " && !inQuotes) {
                if (current.length > 0) {
                result.push(current);
                current = "";
                }
                continue;
            }

            current += char;
        }

        if (escaping) {
            current += "\\";
        }

        if (current.length > 0) {
            result.push(current);
        }

        return result;
    }
}