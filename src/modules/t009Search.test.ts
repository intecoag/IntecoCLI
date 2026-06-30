import { beforeEach, describe, expect, it, vi } from "vitest";

const shellMocks = vi.hoisted(() => ({
    withEditTools: vi.fn(),
    withConfig: vi.fn(),
    withTables: vi.fn(),
    build: vi.fn(),
    run: vi.fn()
}));

vi.mock("../utils/shell/DatabaseShellBuilder.js", () => {
    class TableConfig {
        name = "";
        cmdShortcut = "";
        searchKeys: string[] = [];
        threshold = 0.7;
        tableHeader: string[] = [];
        tableFormatter: (row: Record<string, unknown>) => Array<unknown> = () => [];

        withName(name: string) {
            this.name = name;
            return this;
        }

        withShortcut(shortcut: string) {
            this.cmdShortcut = shortcut;
            return this;
        }

        withSearchKeys(keys: string[]) {
            this.searchKeys = keys;
            return this;
        }

        withThreshold(threshold: number) {
            this.threshold = threshold;
            return this;
        }

        withHeader(tableHeader: string[]) {
            this.tableHeader = tableHeader;
            return this;
        }

        withFormatter(formatter: (row: Record<string, unknown>) => Array<unknown>) {
            this.tableFormatter = formatter;
            return this;
        }
    }

    class DatabaseShellBuilder {
        withEditTools = shellMocks.withEditTools.mockImplementation(() => this);
        withConfig = shellMocks.withConfig.mockImplementation(() => this);
        withTables = shellMocks.withTables.mockImplementation(() => this);
        build = shellMocks.build.mockImplementation(() => ({ run: shellMocks.run }));
    }

    return { DatabaseShellBuilder, TableConfig };
});

import t009Search from "./t009Search.js";

describe("t009Search", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        shellMocks.run.mockResolvedValue(undefined);
    });

    it("wires builder and runs shell", async () => {
        await t009Search();

        expect(shellMocks.withEditTools).toHaveBeenCalledTimes(1);
        expect(shellMocks.withConfig).toHaveBeenCalledTimes(1);
        expect(shellMocks.withTables).toHaveBeenCalledWith("T009", ["t009"]);
        expect(shellMocks.build).toHaveBeenCalledTimes(1);
        expect(shellMocks.run).toHaveBeenCalledTimes(1);
    });

    it("creates overview formatter that maps known t009 fields", async () => {
        await t009Search();

        const configArg = shellMocks.withConfig.mock.calls[0]?.[0] as {
            name: string;
            cmdShortcut: string;
            searchKeys: string[];
            tableHeader: string[];
            tableFormatter: (row: Record<string, unknown>) => Array<unknown>;
        };

        expect(configArg.name).toBe("Overview");
        expect(configArg.cmdShortcut).toBe(":ow");
        expect(configArg.searchKeys).toContain("pgm");
        expect(configArg.tableHeader).toHaveLength(8);
        expect(configArg.tableFormatter({ mnr: "1", pgm: "APP", bez: "Label" })).toEqual([
            "1",
            undefined,
            undefined,
            "APP",
            undefined,
            "Label",
            undefined,
            undefined
        ]);
    });
});
