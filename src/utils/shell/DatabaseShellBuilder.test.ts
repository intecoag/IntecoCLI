import { describe, expect, it } from "vitest";
import { DatabaseShellBuilder, TableConfig } from "./DatabaseShellBuilder.js";

function createConfig(): TableConfig {
    return new TableConfig()
        .withName("Users")
        .withShortcut(":u")
        .withSearchKeys(["name", "email"])
        .withThreshold(0.5)
        .withHeader(["Name", "Email"])
        .withFormatter((row) => [String(row.name ?? ""), String(row.email ?? "")]);
}

describe("TableConfig", () => {
    it("supports fluent configuration", () => {
        const config = createConfig();

        expect(config.name).toBe("Users");
        expect(config.cmdShortcut).toBe(":u");
        expect(config.searchKeys).toEqual(["name", "email"]);
        expect(config.threshold).toBe(0.5);
        expect(config.tableHeader).toEqual(["Name", "Email"]);
    });
});

describe("DatabaseShellBuilder", () => {
    it("throws when building without config", () => {
        const builder = new DatabaseShellBuilder();

        expect(() => builder.build()).toThrow("No table configuration provided for DatabaseShellBuilder");
    });

    it("builds shell with first config and tables", () => {
        const config = createConfig();
        const shell = new DatabaseShellBuilder()
            .withConfig(config)
            .withTables("Core", ["user", "permission"])
            .build();

        expect(shell.currentConfig).toBe(config);
        expect(shell.tables).toEqual([{ name: "Core", tables: ["user", "permission"] }]);
        expect(shell.shell).not.toBeNull();

        const names = shell.shell?.commands.map((c) => c.name) ?? [];
        expect(names).toContain(":?");
        expect(names).toContain(":q");
        expect(names).toContain(":cfg");
        expect(names).toContain(":u");
    });

    it("adds edit tool commands when configured", () => {
        const config = createConfig();
        const shell = new DatabaseShellBuilder()
            .withConfig(config)
            .withTables("Core", ["user"])
            .withEditTools(
                [{ title: "Name", column: "name" }],
                ["name"],
                ["name"],
                []
            )
            .build();

        const names = shell.shell?.commands.map((c) => c.name) ?? [];
        expect(names).toContain(":del");
        expect(names).toContain(":dup");
        expect(names).toContain(":mod");
    });
});
