import prompts, { type Answers, type Options, type PromptObject } from "prompts";

type ParameterValues = Record<string, unknown>;

type PromptSession = {
    values: ParameterValues;
    batch: boolean;
    consumed: Map<string, number>;
};

let session: PromptSession | undefined;

export class CliInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CliInputError";
    }
}

/** Start validating prompt values against the active prompt definitions. */
export function beginPromptSession(values: ParameterValues | undefined, batch: boolean): void {
    session = values === undefined && !batch
        ? undefined
        : { values: values ?? {}, batch, consumed: new Map() };
}

/** Whether prompts in the current command must be satisfied from CLI parameters. */
export function isBatchPromptSession(): boolean {
    return session?.batch ?? false;
}

/** Reject misspelled or inapplicable params once a command has finished. */
export function endPromptSession(): void {
    if (!session) return;

    const unused: string[] = [];
    for (const [name, value] of Object.entries(session.values)) {
        const consumed = session.consumed.get(name) ?? 0;
        if (!session.consumed.has(name)) {
            unused.push(name);
        } else if (Array.isArray(value) && consumed < value.length) {
            unused.push(`${name}[${consumed}...]`);
        }
    }

    session = undefined;
    if (unused.length > 0) {
        throw new CliInputError(`Unknown or unused parameter${unused.length === 1 ? "" : "s"}: ${unused.join(", ")}.`);
    }
}

/**
 * The prompt declarations are also the parameter schema: names, types, defaults,
 * and choices are shared between interactive prompts and --params batch input.
 */
export default async function prompt<T extends string = string>(
    questions: PromptObject<T> | Array<PromptObject<T>>,
    options?: Options
): Promise<Answers<T>> {
    if (!session?.batch) {
        return await prompts(questions, options);
    }

    const questionList = Array.isArray(questions) ? questions : [questions];
    const answers: Record<string, unknown> = {};
    let previous: unknown;

    for (const rawQuestion of questionList) {
        const question = rawQuestion as PromptObject & Record<string, any>;
        const name = typeof question.name === "string" ? question.name : undefined;
        if (!name) {
            throw new CliInputError("Batch prompts require a static parameter name.");
        }

        const type = typeof question.type === "function"
            ? await question.type(previous, answers, question)
            : question.type;
        if (!type) continue;

        const choices = typeof question.choices === "function"
            ? await question.choices(previous, answers, question)
            : question.choices;
        const supplied = Object.prototype.hasOwnProperty.call(session.values, name);
        let value: unknown;

        if (supplied) {
            const configured = session.values[name];
            const repeatedScalar = type !== "multiselect" && type !== "list" && Array.isArray(configured);
            if (repeatedScalar) {
                const index = session.consumed.get(name) ?? 0;
                if (index >= configured.length) {
                    throw missingParameter(name, type, question);
                }
                value = configured[index];
                session.consumed.set(name, index + 1);
            } else {
                if (session.consumed.has(name) && type !== "multiselect" && type !== "list") {
                    throw missingParameter(name, type, question);
                }
                value = configured;
                session.consumed.set(name, Array.isArray(configured) && (type === "multiselect" || type === "list") ? configured.length : 1);
            }
        } else if (question.initial !== undefined) {
            value = typeof question.initial === "function"
                ? await question.initial(previous, answers, question)
                : question.initial;
        } else {
            throw missingParameter(name, type, question);
        }

        if (!supplied) value = normalizeInitial(value, type);
        value = normalizeChoice(value, choices, type, name);
        validateValue(value, type, name);

        if (type === "number") {
            const min = typeof question.min === "function" ? await question.min(previous, answers, question) : question.min;
            const max = typeof question.max === "function" ? await question.max(previous, answers, question) : question.max;
            if (typeof min === "number" && (value as number) < min) {
                throw new CliInputError(`Parameter "${name}" must be at least ${min}.`);
            }
            if (typeof max === "number" && (value as number) > max) {
                throw new CliInputError(`Parameter "${name}" must be at most ${max}.`);
            }
        }

        if (typeof question.validate === "function") {
            const validation = await question.validate(value, answers, question);
            if (validation !== true && validation !== undefined) {
                throw new CliInputError(typeof validation === "string" ? validation : `Invalid value for "${name}".`);
            }
        }

        answers[name] = value;
        previous = value;
    }

    return answers as Answers<T>;
}

function missingParameter(name: string, type: unknown, question: PromptObject): CliInputError {
    const choices = Array.isArray(question.choices)
        ? ` (allowed: ${question.choices.map(choice => choice.title).join(", ")})`
        : "";
    return new CliInputError(`Missing required parameter "${name}" (expected ${String(type)}${choices}).`);
}

function normalizeChoice(value: unknown, choices: unknown, type: unknown, name: string): unknown {
    if ((type === "multiselect" || type === "autocompleteMultiselect") && Array.isArray(value) && Array.isArray(choices)) {
        return value.map(item => normalizeChoice(item, choices, "select", name));
    }
    if (!Array.isArray(choices) || type === "text" || type === "number" || type === "toggle" || type === "confirm") {
        return value;
    }

    const choice = choices.find((candidate: any) => {
        const choiceValue = candidate.value ?? candidate.title;
        if (Object.is(value, choiceValue) || value === candidate.title) return true;
        if (typeof value === "string" && choiceValue && typeof choiceValue === "object") {
            return value === choiceValue.id || value === choiceValue.name;
        }
        return false;
    }) as { value?: unknown; title: string } | undefined;

    if (!choice) {
        throw new CliInputError(`Invalid value for "${name}". Choose one of: ${choices.map((item: any) => item.title).join(", ")}.`);
    }
    return choice.value ?? choice.title;
}

function normalizeInitial(value: unknown, type: unknown): unknown {
    // prompts accepts numeric defaults as strings in a few existing commands.
    if (type === "number" && typeof value === "string" && value.trim() !== "") {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : value;
    }
    return value;
}

function validateValue(value: unknown, type: unknown, name: string): void {
    const valid = (() => {
        switch (type) {
            case "number": return typeof value === "number" && Number.isFinite(value);
            case "toggle":
            case "confirm": return typeof value === "boolean";
            case "multiselect":
            case "autocompleteMultiselect":
            case "list": return Array.isArray(value);
            default: return typeof value === "string";
        }
    })();

    if (!valid) {
        const expected = type === "number" ? "number" : type === "toggle" || type === "confirm" ? "boolean" : type === "multiselect" || type === "autocompleteMultiselect" || type === "list" ? "array" : "string";
        throw new CliInputError(`Invalid type for "${name}": expected ${expected}.`);
    }
}
