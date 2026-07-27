import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    prompts: vi.fn(),
    listContainers: vi.fn()
}));

vi.mock("fs", () => ({
    default: {
        existsSync: mocks.existsSync,
        readFileSync: mocks.readFileSync,
        writeFileSync: mocks.writeFileSync,
        promises: { readdir: vi.fn(), stat: vi.fn(), mkdir: vi.fn() },
        createReadStream: vi.fn()
    }
}));

vi.mock("prompts", () => ({ default: mocks.prompts }));
vi.mock("../utils/azure/azure.js", () => ({
    AzureHelper: class {
        listContainers = mocks.listContainers;
        getContainerClient() { return {}; }
        listBlobs() { return Promise.resolve([]); }
        getBlobMd5Base64() { return Promise.resolve(null); }
        uploadFile() { return Promise.resolve({}); }
        downloadToFile() { return Promise.resolve(); }
        deleteBlob() { return Promise.resolve(); }
    }
}));

import { azureCreateSyncConfig, formatBytes, globToRegExp, loadSyncConfig, matchesGlob, validateConfig } from "./azureSync.js";

describe("azureSync helpers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("matches glob patterns", () => {
        expect(matchesGlob("a/b/file.yaml", ["**/*.yaml"])) .toBe(true);
        expect(matchesGlob("a/b/file.txt", ["**/*.yaml"])) .toBe(false);
        expect(globToRegExp("src/*/a?.ts").test("src/x/ab.ts")).toBe(true);
    });

    it("formats bytes and validates configs", () => {
        expect(formatBytes(0)).toBe("0 B");
        expect(formatBytes(1024)).toContain("KB");
        expect(validateConfig({ storageAccount: "", container: "c", includes: ["**/*"], configPath: "x" })).toBe(false);
        expect(validateConfig({ storageAccount: "a", container: "c", includes: ["**/*"], configPath: "x" })).toBe(true);
    });

    it("loads .az-sync config and falls back from legacy include key", () => {
        mocks.readFileSync.mockReturnValue("storageAccount: a\ncontainer: c\nfileTypeRegexes:\n  - '**/*.yaml'");

        const cfg = loadSyncConfig("C:/repo/.az-sync");

        expect(cfg?.includes).toEqual(["**/*.yaml"]);
        expect(cfg?.storageAccount).toBe("a");
    });
});

describe("azureCreateSyncConfig", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.existsSync.mockReturnValue(false);
    });

    it("writes new config after prompts", async () => {
        mocks.prompts
            .mockResolvedValueOnce({ storageAccount: "acc1" })
            .mockResolvedValueOnce({ container: "cont1", includes: "**/*.yaml,**/*.properties" });
        mocks.listContainers.mockResolvedValue(["cont1"]);

        await azureCreateSyncConfig();

        expect(mocks.writeFileSync).toHaveBeenCalledTimes(1);
        expect(String(mocks.writeFileSync.mock.calls[0]?.[1] ?? "")).toContain("storageAccount: acc1");
        expect(String(mocks.writeFileSync.mock.calls[0]?.[1] ?? "")).toContain("container: cont1");
    });
});
