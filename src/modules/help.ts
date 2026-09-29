import { registerCommand } from "../utils/commandRegistry.js";

function showHelp(cli: unknown): void {
    const helpCli = cli as { showHelp: (exitCode?: number) => void };
    helpCli.showHelp();
}

registerCommand("help", "Shows help and available commands", showHelp);
