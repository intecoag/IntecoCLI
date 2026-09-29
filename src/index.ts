#!/usr/bin/env node
import cliMeowHelp from 'cli-meow-help';
import meow from 'meow';
import prompts from 'prompts';
import { readFileSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { beginPromptSession, CliInputError, endPromptSession } from './utils/cliParams.js';
import { executeRegisteredCommand, getRegisteredCommand, getRegisteredCommands, renderCommandHelp } from './utils/commandRegistry.js';
import updateNotifier from 'update-notifier';

async function loadCommandModules(): Promise<void> {
    const moduleDirectory = new URL('./modules/', import.meta.url);
    const extension = import.meta.url.endsWith('.ts') ? '.ts' : '.js';
    const moduleFiles = readdirSync(moduleDirectory)
        .filter(file => file.endsWith(extension) && !file.endsWith(`.test${extension}`));

    await Promise.all(moduleFiles.map(file => import(new URL(file, moduleDirectory).href)));
}

await loadCommandModules();

type PackageMeta = {
    name: string;
    version: string;
};

const packageJson = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
) as PackageMeta;

updateNotifier({
    pkg: {
        name: packageJson.name,
        version: packageJson.version
    }, 
    updateCheckInterval: 1000 * 60 * 60 * 24 // 24h
    }).notify();


const flags = {
    params: {
        type: 'string' as const,
        desc: 'JSON object containing command parameters (non-interactive mode)',
    },
    paramsFile: {
        type: 'string' as const,
        desc: 'Read command parameters from a JSON file (use - for stdin)',
    },
};

const commandDescriptions = Object.fromEntries(getRegisteredCommands().map(command => [command.name, { desc: command.description }]));

const helpText = cliMeowHelp({
    name: `inteco`,
    desc: "Version: "+packageJson.version,
    commands: commandDescriptions,
    flags,
    header: '',
    footer: ''
});

const cli = meow(helpText, {
    importMeta: import.meta,
    flags,
});

async function pickCommandInteractive(): Promise<string | undefined> {
    const registeredCommands = getRegisteredCommands();

    const response = await prompts({
        type: 'autocomplete',
        name: 'command',
        message: 'Select command',
        choices: registeredCommands.map((command) => ({
            title: `${command.name} - ${command.description}`,
            value: command.name,
        })),
        suggest: async (input: string, choices: Array<{ title: string; value?: string }>) => {
            const query = (input ?? '').toLowerCase();
            if (!query) {
                return choices;
            }
            return choices.filter((choice) => choice.title.toLowerCase().includes(query));
        }
    }) as { command?: string };

    return response.command;
}

async function readParams(): Promise<Record<string, unknown> | undefined> {
    const paramsText = cli.flags.params as string | undefined;
    const paramsFile = cli.flags.paramsFile as string | undefined;
    if (paramsText !== undefined && paramsFile !== undefined) {
        throw new CliInputError('Use either --params or --params-file, not both.');
    }

    if (paramsText === undefined && paramsFile === undefined) return undefined;

    let parsed: unknown;
    try {
        const raw = paramsFile === undefined
            ? paramsText!
            : paramsFile === '-'
                ? await new Promise<string>((resolve, reject) => {
                    let input = '';
                    process.stdin.setEncoding('utf8');
                    process.stdin.on('data', chunk => input += chunk);
                    process.stdin.on('end', () => resolve(input));
                    process.stdin.on('error', reject);
                })
                : await readFile(paramsFile, 'utf8');
        parsed = JSON.parse(raw);
    } catch (error) {
        throw new CliInputError(`Could not read parameter JSON: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new CliInputError('Parameters must be a JSON object keyed by prompt name.');
    }
    return parsed as Record<string, unknown>;
}

async function main(): Promise<void> {
    let command: string | undefined = cli.input[0];

    if (command && (cli.flags as Record<string, unknown>).help === true) {
        const registeredCommand = getRegisteredCommand(command);
        if (!registeredCommand) {
            cli.showHelp(2);
            return;
        }
        console.log(renderCommandHelp(registeredCommand));
        return;
    }

    if (!command) {
        if (cli.flags.params !== undefined || cli.flags.paramsFile !== undefined) {
            throw new CliInputError('A command is required when using --params or --params-file.');
        }
        if (!process.stdin.isTTY || !process.stdout.isTTY) {
            cli.showHelp(2);
        }
        command = await pickCommandInteractive();
    }

    if (!command) return;
    if (!getRegisteredCommand(command)) {
        cli.showHelp(2);
        return;
    }

    const params = await readParams();
    const batch = params !== undefined || !process.stdin.isTTY || !process.stdout.isTTY;
    beginPromptSession(params, batch);
    try {
        await executeRegisteredCommand(command, cli);
        endPromptSession();
    } catch (error) {
        // Clear the active parameter context even when a command rejects.
        try { endPromptSession(); } catch { /* Preserve the original command/input error. */ }
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    }
}

void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});


