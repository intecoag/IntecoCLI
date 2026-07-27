import { describe, expect, it, vi } from "vitest";
import { ShellBuilder } from "./ShellBuilder.js";

describe("ShellBuilder", () => {
    it("parses quoted and escaped args", () => {
        const builder = new ShellBuilder();

        const args = builder.parseArgs(':cmd "hello world" test\\ value "x\\"y"');

        expect(args).toEqual([":cmd", "hello world", "test value", 'x"y']);
    });

    it("builds shell with configured metadata and commands", () => {
        const handler = vi.fn();
        const shell = new ShellBuilder()
            .withName("My Shell")
            .withPrompt("prompt>")
            .withCommand(":x", "Runs x", handler)
            .build();

        expect(shell.name).toBe("My Shell");
        expect(shell.prompt).toBe("prompt>");
        expect(shell.commands).toHaveLength(1);
        expect(shell.commands[0]?.name).toBe(":x");
        expect(shell.autocomplete).toEqual([":x"]);
    });

    it("executes built-in command handler for matching command", async () => {
        const cmd = vi.fn();
        const shell = new ShellBuilder()
            .withBuiltInHandler()
            .withCommand(":echo", "Echo", cmd)
            .build();

        const handled = await shell.handleCommand(':echo "hi there" a\\ b');

        expect(handled).toBe(true);
        expect(cmd).toHaveBeenCalledTimes(1);
        expect(cmd.mock.calls[0]?.slice(2)).toEqual(["hi there", "a b"]);
    });

    it("returns false when no built-in command matches", async () => {
        const shell = new ShellBuilder().withBuiltInHandler().build();

        const handled = await shell.handleCommand(":missing");

        expect(handled).toBe(false);
    });
});
