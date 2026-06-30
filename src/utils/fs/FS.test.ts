import { beforeEach, describe, expect, it, vi } from "vitest";
import path from "path";

const mocks = vi.hoisted(() => ({
    statSync: vi.fn(),
    mkdirSync: vi.fn(),
    existsSync: vi.fn(),
    copyFileSync: vi.fn(),
    readdirSync: vi.fn(),
    prompts: vi.fn()
}));

vi.mock("fs", () => ({
    statSync: mocks.statSync,
    mkdirSync: mocks.mkdirSync,
    existsSync: mocks.existsSync,
    copyFileSync: mocks.copyFileSync,
    readdirSync: mocks.readdirSync
}));

vi.mock("prompts", () => ({
    default: mocks.prompts
}));

import { FS } from "./FS.js";

type DirEntry = {
    name: string;
    isDirectory: () => boolean;
    isFile?: () => boolean;
};

function file(name: string): DirEntry {
    return { name, isDirectory: () => false, isFile: () => true };
}

function dir(name: string): DirEntry {
    return { name, isDirectory: () => true, isFile: () => false };
}

function normalize(p: string): string {
    return p.replaceAll("\\", "/");
}

describe("FS.copyUpdatedFiles", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("creates destination and copies missing files", () => {
        mocks.existsSync.mockImplementation((p: string) => {
            const n = normalize(p);
            return n !== "dest" && n !== "dest/a.txt";
        });
        mocks.readdirSync.mockReturnValue([file("a.txt")]);

        FS.copyUpdatedFiles("src", "dest", false);

        expect(mocks.mkdirSync).toHaveBeenCalledWith("dest", { recursive: true });
        expect(mocks.copyFileSync).toHaveBeenCalledWith(path.join("src", "a.txt"), path.join("dest", "a.txt"));
    });

    it("copies updated files based on mtime", () => {
        mocks.existsSync.mockReturnValue(true);
        mocks.readdirSync.mockReturnValue([file("a.txt")]);
        mocks.statSync
            .mockReturnValueOnce({ mtime: new Date("2026-01-02") })
            .mockReturnValueOnce({ mtime: new Date("2026-01-01") });

        FS.copyUpdatedFiles("src", "dest", false);

        expect(mocks.copyFileSync).toHaveBeenCalledWith(path.join("src", "a.txt"), path.join("dest", "a.txt"));
    });

    it("respects onlyCopyNonExistant flag", () => {
        mocks.existsSync.mockReturnValue(true);
        mocks.readdirSync.mockReturnValue([file("a.txt")]);

        FS.copyUpdatedFiles("src", "dest", false, { added: 0, updated: 0 }, [], true);

        expect(mocks.copyFileSync).not.toHaveBeenCalled();
        expect(mocks.statSync).not.toHaveBeenCalled();
    });

    it("skips blacklisted filenames", () => {
        mocks.existsSync.mockImplementation((p: string) => normalize(p) !== "dest/a.txt");
        mocks.readdirSync.mockReturnValue([file("a.txt"), file("ignore.txt")]);

        FS.copyUpdatedFiles("src", "dest", false, { added: 0, updated: 0 }, ["ignore.txt"]);

        expect(mocks.copyFileSync).toHaveBeenCalledTimes(1);
        expect(mocks.copyFileSync).toHaveBeenCalledWith(path.join("src", "a.txt"), path.join("dest", "a.txt"));
    });
});

describe("FS.copyAllFiles and traversal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.existsSync.mockReturnValue(true);
    });

    it("copies files recursively", () => {
        mocks.readdirSync.mockImplementation((p: string) => {
            const n = normalize(p);
            if (n === "src") return [dir("nested"), file("a.txt")];
            if (n === "src/nested") return [file("b.txt")];
            return [];
        });

        FS.copyAllFiles("src", "dest", false);

        expect(mocks.copyFileSync).toHaveBeenCalledWith(path.join("src", "a.txt"), path.join("dest", "a.txt"));
        expect(mocks.copyFileSync).toHaveBeenCalledWith(path.join("src", "nested", "b.txt"), path.join("dest", "nested", "b.txt"));
    });

    it("returns all files recursively", () => {
        mocks.readdirSync.mockImplementation((p: string) => {
            const n = normalize(p);
            if (n === "root") return [dir("nested"), file("a.txt")];
            if (n === "root/nested") return [file("b.txt")];
            return [];
        });

        const files = FS.getAllFiles("root").map(normalize);

        expect(files).toEqual(["root/nested/b.txt", "root/a.txt"]);
    });
});

describe("FS.filePicker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns selected file relative path", async () => {
        mocks.readdirSync.mockReturnValue([file("picked.txt")]);
        mocks.prompts.mockResolvedValue({ file: "picked.txt" });

        const picked = await FS.filePicker("root", "root");

        expect(picked).toEqual(["picked.txt"]);
    });

    it("select current directory and returns all files", async () => {
        mocks.readdirSync.mockImplementation((p: string) => {
            const n = normalize(p);
            if (n === "root") return [dir("nested"), file("a.txt")];
            if (n === "root/nested") return [file("b.txt")];
            return [];
        });
        mocks.prompts.mockResolvedValue({ file: "." });

        const picked = (await FS.filePicker("root", "root")).map(normalize);

        expect(picked).toEqual(["nested/b.txt", "a.txt"]);
    });
});
