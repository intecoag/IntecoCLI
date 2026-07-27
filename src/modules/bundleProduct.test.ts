import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const add = vi.fn();
    return {
        existsSync: vi.fn(),
        readdirSync: vi.fn(),
        readFileSync: vi.fn(),
        renameSync: vi.fn(),
        rmSync: vi.fn(),
        writeFileSync: vi.fn(),
        cp: vi.fn(),
        prompts: vi.fn(),
        ora: vi.fn(() => ({ start: vi.fn().mockReturnThis(), succeed: vi.fn() })),
        getConfig: vi.fn(),
        add,
        fileURLToPath: vi.fn(() => "C:/repo/src/modules/bundleProduct.ts")
    };
});

vi.mock("fs", () => ({
    existsSync: mocks.existsSync,
    readdirSync: mocks.readdirSync,
    readFileSync: mocks.readFileSync,
    renameSync: mocks.renameSync,
    rmSync: mocks.rmSync,
    writeFileSync: mocks.writeFileSync
}));
vi.mock("fs/promises", () => ({ cp: mocks.cp }));
vi.mock("prompts", () => ({ default: mocks.prompts }));
vi.mock("ora", () => ({ default: mocks.ora }));
vi.mock("../utils/config/config.js", () => ({ Config: { getConfig: mocks.getConfig } }));
vi.mock("node-7z", () => ({ default: { add: mocks.add } }));
vi.mock("url", () => ({ fileURLToPath: mocks.fileURLToPath }));

import bundleProduct from "./bundleProduct.js";

describe("bundleProduct", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.fileURLToPath.mockReturnValue("C:/repo/src/modules/bundleProduct.ts");
        mocks.getConfig.mockResolvedValue({ configIndividualPathEclipse: "C:/cfg/individual" });
        mocks.readdirSync
            .mockReturnValueOnce([{ name: "eclipse", isFile: () => false }])
            .mockReturnValueOnce([{ name: "custA", isDirectory: () => true }]);
        mocks.prompts.mockResolvedValue({
            folder: "eclipse",
            configIndividual: "custA",
            ram: "16",
            folderName: "pkg"
        });
        mocks.existsSync.mockReturnValue(true);
        mocks.readFileSync.mockReturnValue("-Xmx8g");
        mocks.add.mockReturnValue({
            on: (event: string, listener: () => void) => {
                if (event === "end") listener();
            }
        });
        mocks.cp.mockResolvedValue(undefined);
    });

    it("copies config, rewrites ini, zips and restores folder name", async () => {
        await bundleProduct({});

        expect(mocks.cp).toHaveBeenCalled();
        expect(mocks.writeFileSync).toHaveBeenCalledWith(expect.stringContaining("wegas.ini"), "-Xmx16g");
        expect(mocks.renameSync).toHaveBeenCalledTimes(2);
        expect(mocks.add).toHaveBeenCalledTimes(1);
    });

    it("does nothing when prompt is cancelled", async () => {
        mocks.prompts.mockImplementation(async (_q, options) => {
            options?.onCancel?.();
            return {};
        });

        await bundleProduct({});

        expect(mocks.cp).not.toHaveBeenCalled();
        expect(mocks.add).not.toHaveBeenCalled();
    });
});
