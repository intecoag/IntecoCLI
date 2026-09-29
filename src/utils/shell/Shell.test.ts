import { beforeEach, describe, expect, it, vi } from "vitest";
import { Shell } from "./Shell.js";
import { beginPromptSession, endPromptSession } from "../cliParams.js";

const mocks = vi.hoisted(() => ({
    prompts: vi.fn()
}));

vi.mock("prompts", () => ({
    default: mocks.prompts
}));

describe("Shell", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("handleCommand returns true when first handler matches", async () => {
        const shell = new Shell();
        const first = vi.fn().mockResolvedValue(true);
        const second = vi.fn().mockResolvedValue(true);
        shell.commandHandlers = [first, second];

        const handled = await shell.handleCommand(":x");

        expect(handled).toBe(true);
        expect(first).toHaveBeenCalledTimes(1);
        expect(second).not.toHaveBeenCalled();
    });

    it("handleCommand returns false when no handler matches", async () => {
        const shell = new Shell();
        shell.commandHandlers = [vi.fn().mockResolvedValue(false)];

        const handled = await shell.handleCommand(":x");

        expect(handled).toBe(false);
    });

    it("run dispatches input and exits when handler requests it", async () => {
        const shell = new Shell();
        shell.name = "TestShell";
        shell.prompt = "prompt";
        shell.autocomplete = [":q"];
        shell.commandHandlers = [
            async (s, input) => {
                if (input === ":q") {
                    s.exit();
                    return true;
                }
                return false;
            }
        ];

        mocks.prompts.mockResolvedValue({ input: ":q" });

        await shell.run();

        expect(mocks.prompts).toHaveBeenCalledTimes(1);
        expect(shell.exitRequested).toBe(true);
    });

    it("run trims input before handling", async () => {
        const shell = new Shell();
        shell.name = "TrimShell";
        shell.prompt = "prompt";
        const seen: string[] = [];

        shell.commandHandlers = [
            (s, input) => {
                seen.push(input);
                s.exit();
                return true;
            }
        ];

        mocks.prompts.mockResolvedValue({ input: "   :hello   " });

        await shell.run();

        expect(seen).toEqual([":hello"]);
    });

    it("runs an ordered command list in batch mode", async () => {
        const shell = new Shell();
        shell.name = "BatchShell";
        const seen: string[] = [];
        shell.commandHandlers = [
            (s, input) => {
                seen.push(input);
                if (input === ":q") s.exit();
                return true;
            }
        ];
        beginPromptSession({ commands: [" search ", ":q", "ignored"] }, true);

        await shell.run();

        expect(seen).toEqual(["search", ":q"]);
        expect(mocks.prompts).not.toHaveBeenCalled();
        endPromptSession();
    });

    it("rejects unknown shell commands in batch mode", async () => {
        const shell = new Shell();
        shell.commandHandlers = [() => false];
        beginPromptSession({ commands: ["unknown"] }, true);

        await expect(shell.run()).rejects.toThrow("Unknown shell command 'unknown'.");
        expect(() => endPromptSession()).not.toThrow();
    });
});
