import { afterEach, describe, expect, it } from "vitest";
import prompts from "./cliParams.js";
import { beginPromptSession, endPromptSession } from "./cliParams.js";

afterEach(() => {
    try { endPromptSession(); } catch { /* Each case asserts its own validation errors. */ }
});

describe("CLI parameter schemas", () => {
    it("uses prompt names, defaults, types, and choices as a batch schema", async () => {
        beginPromptSession({ mode: "unblock", port: 4444 }, true);

        const answers = await prompts([
            {
                type: "select",
                name: "mode",
                message: "Mode?",
                choices: [
                    { title: "Block", value: "block" },
                    { title: "Unblock", value: "unblock" },
                ],
            },
            { type: "number", name: "port", message: "Port?", initial: 3000 },
            { type: "toggle", name: "enabled", message: "Enabled?", initial: false },
        ]);

        expect(answers).toEqual({ mode: "unblock", port: 4444, enabled: false });
        endPromptSession();
    });

    it("evaluates conditional prompts using the previous answer", async () => {
        beginPromptSession({ enabled: true, detail: "extra" }, true);
        const answers = await prompts([
            { type: "toggle", name: "enabled", message: "Enable?" },
            {
                type: (previous: boolean) => previous ? "text" : null,
                name: "detail",
                message: "Detail?",
            },
        ]);

        expect(answers).toEqual({ enabled: true, detail: "extra" });
        endPromptSession();
    });

    it("requires a missing required value", async () => {
        beginPromptSession({}, true);
        await expect(prompts({ type: "text", name: "domain", message: "Domain?" }))
            .rejects.toThrow('Missing required parameter "domain" (expected text).');
    });

    it("rejects values outside declared choices and values with the wrong type", async () => {
        beginPromptSession({ mode: "other" }, true);
        await expect(prompts({
            type: "select",
            name: "mode",
            message: "Mode?",
            choices: [{ title: "Block", value: "block" }],
        })).rejects.toThrow('Invalid value for "mode".');

        beginPromptSession({ port: "3000" }, true);
        await expect(prompts({ type: "number", name: "port", message: "Port?" }))
            .rejects.toThrow('Invalid type for "port": expected number.');
    });

    it("preserves non-string values returned by select choices", async () => {
        beginPromptSession({ tables: "EXTD/EXTI" }, true);

        const answers = await prompts({
            type: "select",
            name: "tables",
            message: "Search-Type?",
            choices: [
                { title: "EXTD/EXTI", value: ["extd", "exti"] },
                { title: "EXTD", value: ["extd"] },
            ],
        });

        expect(answers).toEqual({ tables: ["extd", "exti"] });
        endPromptSession();
    });

    it("reports unknown parameter names after command execution", () => {
        beginPromptSession({ typo: true }, true);
        expect(() => endPromptSession()).toThrow("Unknown or unused parameter: typo.");
    });
});
