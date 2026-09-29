export type CommandHandler = (cli: unknown) => unknown | Promise<unknown>;

export type CommandParameterSchema = {
    type: string;
    required?: boolean;
    default?: string | number | boolean;
    choices?: string[];
    when?: string;
    description?: string;
};

export type CommandSchema = {
    parameters?: Record<string, CommandParameterSchema>;
    note?: string;
};

export type CommandDefinition = {
    name: string;
    description: string;
    handler: CommandHandler;
    schema?: CommandSchema;
};

const registry = new Map<string, CommandDefinition>();

/** Register a command from its implementation module. */
export function registerCommand(name: string, description: string, handler: CommandHandler, schema?: CommandSchema): void {
    if (registry.has(name)) {
        throw new Error(`Command "${name}" is already registered.`);
    }

    registry.set(name, {
        name,
        description,
        handler,
        schema,
    });
}

export function getRegisteredCommands(): CommandDefinition[] {
    return [...registry.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function getRegisteredCommand(name: string): CommandDefinition | undefined {
    return registry.get(name);
}

export async function executeRegisteredCommand(name: string, cli: unknown): Promise<void> {
    const command = registry.get(name);
    if (!command) {
        throw new Error(`Unknown command: ${name}`);
    }

    await command.handler(cli);
}

export function renderCommandHelp(command: CommandDefinition): string {
    const hasParameters = Object.keys(command.schema?.parameters ?? {}).length > 0;
    const lines = [
        `Usage: inteco ${command.name}${hasParameters ? " [--params <json> | --params-file <path>]" : ""}`,
        "",
        command.description,
        "",
    ];

    if (!hasParameters) {
        lines.push("Parameters:", "  None. This command does not accept --params.");
        if (command.schema?.note) lines.push(`  ${command.schema.note}`);
        return lines.join("\n");
    }

    lines.push("Parameters (JSON object keys; the same names are used by --params):");
    for (const [name, parameter] of Object.entries(command.schema!.parameters!)) {
        const annotations = [parameter.required ? "required" : "optional", parameter.type];
        if (parameter.default !== undefined) annotations.push(`default: ${JSON.stringify(parameter.default)}`);
        if (parameter.choices) annotations.push(`choices: ${parameter.choices.map(choice => JSON.stringify(choice)).join(" | ")}`);
        if (parameter.when) annotations.push(`when: ${parameter.when}`);
        lines.push(`  ${name} (${annotations.join("; ")})`);
        if (parameter.description) lines.push(`    ${parameter.description}`);
    }
    if (command.schema?.note) lines.push("", `Note: ${command.schema.note}`);
    lines.push("", "Use --params-file - to read the JSON object from stdin.");
    return lines.join("\n");
}
