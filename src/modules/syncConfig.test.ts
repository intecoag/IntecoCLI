import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    prompts: vi.fn(),
    mkdirSync: vi.fn(),
    existsSync: vi.fn(),
    readdirSync: vi.fn(),
    rmSync: vi.fn(),
    copyFileSync: vi.fn()
}));

vi.mock("prompts", () => ({ default: mocks.prompts }));
vi.mock("fs", () => ({
    mkdirSync: mocks.mkdirSync,
    existsSync: mocks.existsSync,
    readdirSync: mocks.readdirSync,
    rmSync: mocks.rmSync,
    copyFileSync: mocks.copyFileSync
}));

import { countAndDeleteDir, findConfigDirNamedConfigIn } from "./syncConfig.js";

type DirEntry = {
    name: string;
    isDirectory: () => boolean;
};

function file(name: string): DirEntry {
    return { name, isDirectory: () => false };
}

function dir(name: string): DirEntry {
    return { name, isDirectory: () => true };
}

function normalize(p: string): string {
    return p.replaceAll("\\", "/");
}

describe("syncConfig helpers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("finds config directory directly under parent", () => {
        mocks.existsSync.mockImplementation((p: string) => normalize(p) === "base/config");

        const found = findConfigDirNamedConfigIn("base");

        expect(normalize(found)).toBe("base/config");
    });

    it("throws when config directory is missing", () => {
        mocks.existsSync.mockReturnValue(false);

        expect(() => findConfigDirNamedConfigIn("base")).toThrow("No 'config/' directory found directly in base");
    });

    it("counts deletions in dry-run mode without deleting", () => {
        mocks.existsSync.mockImplementation((p: string) => {
            const n = normalize(p);
            return n === "root" || n === "root/nested";
        });
        mocks.readdirSync.mockImplementation((p: string) => {
            const n = normalize(p);
            if (n === "root") return [file("a.txt"), dir("nested"), file("keep.txt")];
            if (n === "root/nested") return [file("b.txt")];
            return [];
        });

        const deleted = countAndDeleteDir("root", true, ["keep.txt"]);

        expect(deleted).toBe(3);
        expect(mocks.rmSync).not.toHaveBeenCalled();
    });

    it("deletes files and directories in non dry-run mode", () => {
        mocks.existsSync.mockImplementation((p: string) => normalize(p) === "root");
        mocks.readdirSync.mockImplementation((p: string) => {
            const n = normalize(p);
            if (n === "root") return [file("a.txt")];
            return [];
        });

        const deleted = countAndDeleteDir("root", false, []);

        expect(deleted).toBe(2);
        expect(mocks.rmSync).toHaveBeenCalled();
    });
});
