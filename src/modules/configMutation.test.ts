import { describe, expect, it } from "vitest";
import YAML from "yaml";
import { addMissingNodes, mergeOverwriteNodes, removeMissingNodes } from "./configMutation.js";

describe("configMutation merge helpers", () => {
    it("addMissingNodes adds missing map keys", () => {
        const from = YAML.parseDocument("a: 1\nb: 2");
        const to = YAML.parseDocument("a: 1");

        const changed = addMissingNodes(from.contents, to.contents);

        expect(changed).toBe(true);
        expect(String(to.toString())).toContain("b: 2");
    });

    it("removeMissingNodes removes keys absent from source", () => {
        const from = YAML.parseDocument("a: 1");
        const to = YAML.parseDocument("a: 1\nb: 2");

        const changed = removeMissingNodes(from.contents, to.contents);

        expect(changed).toBe(true);
        expect(String(to.toString())).not.toContain("b:");
    });

    it("mergeOverwriteNodes overwrites scalar values", () => {
        const from = YAML.parseDocument("a: 2\nlist:\n  - x\n  - y");
        const to = YAML.parseDocument("a: 1\nlist:\n  - z");

        const changed = mergeOverwriteNodes(from.contents, to.contents);

        expect(changed).toBe(true);
        const out = String(to.toString());
        expect(out).toContain("a: 2");
    });
});
