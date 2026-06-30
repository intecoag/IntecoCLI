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

import extdSearch from "./extdSearch.js";

describe("extdSearch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        shellMocks.run.mockResolvedValue(undefined);
    });

    it("builds shell with expected configs and tables", async () => {
        await extdSearch();

        expect(shellMocks.withEditTools).toHaveBeenCalledTimes(1);
        expect(shellMocks.withConfig).toHaveBeenCalledTimes(3);
        expect(shellMocks.withTables).toHaveBeenCalledTimes(3);
        expect(shellMocks.withTables).toHaveBeenNthCalledWith(1, "EXTD/EXTI", ["extd", "exti"]);
        expect(shellMocks.withTables).toHaveBeenNthCalledWith(2, "EXTD", ["extd"]);
        expect(shellMocks.withTables).toHaveBeenNthCalledWith(3, "EXTI", ["exti"]);
        expect(shellMocks.build).toHaveBeenCalledTimes(1);
        expect(shellMocks.run).toHaveBeenCalledTimes(1);
    });

    it("formats field info values through mapping helpers", async () => {
        await extdSearch();

        const fieldInfoConfig = shellMocks.withConfig.mock.calls[1]?.[0] as {
            name: string;
            cmdShortcut: string;
            tableFormatter: (row: Record<string, unknown>) => Array<unknown>;
        };

        expect(fieldInfoConfig.name).toBe("Field-Information");
        expect(fieldInfoConfig.cmdShortcut).toBe(":fi");

        const formatted = fieldInfoConfig.tableFormatter({
            mnr: "7",
            table: "extd",
            name: "x_name",
            special: "1",
            flag: "2",
            testflab: "0",
            b_value_1: "10",
            b_dtext_1: "Ten",
            b_value_2: "",
            b_dtext_2: ""
        });

        expect(formatted.slice(0, 6)).toEqual(["7", "extd", "x_name", "Checkbox", "Aus", "Zwingend"]);
        expect(formatted[6]).toBe("'10'='Ten'");
        expect(formatted[7]).toBe("");
        expect(formatted).toHaveLength(15);
    });

    it("formats overview and disp-fields rows", async () => {
        await extdSearch();

        const overviewConfig = shellMocks.withConfig.mock.calls[0]?.[0] as {
            name: string;
            cmdShortcut: string;
            tableFormatter: (row: Record<string, unknown>) => Array<unknown>;
        };

        const dispFieldsConfig = shellMocks.withConfig.mock.calls[2]?.[0] as {
            name: string;
            cmdShortcut: string;
            tableFormatter: (row: Record<string, unknown>) => Array<unknown>;
        };

        expect(overviewConfig.name).toBe("Overview");
        expect(overviewConfig.cmdShortcut).toBe(":ow");
        expect(overviewConfig.tableFormatter({ mnr: "1", name: "abc" }).slice(0, 3)).toEqual(["1", undefined, "abc"]);

        expect(dispFieldsConfig.name).toBe("Disp-Fields");
        expect(dispFieldsConfig.cmdShortcut).toBe(":df");
        const dispFormatted = dispFieldsConfig.tableFormatter({
            mnr: "9",
            table: "exti",
            name: "f1",
            testfeld: "tf",
            dispmask: "dm",
            disp_feld_1: "a",
            disp_feld_9: "z"
        });
        expect(dispFormatted[0]).toBe("9");
        expect(dispFormatted[1]).toBe("exti");
        expect(dispFormatted[4]).toBe("dm");
        expect(dispFormatted[5]).toBe("a");
        expect(dispFormatted[13]).toBe("z");
    });
});
