import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    prompts: vi.fn(),
    getConfig: vi.fn(),
    setConfig: vi.fn()
}));

vi.mock("prompts", () => ({ default: mocks.prompts }));
vi.mock("../utils/config/config.js", () => ({
    Config: {
        getConfig: mocks.getConfig,
        setConfig: mocks.setConfig
    }
}));

import writeCLIConfig from "./setCLIConfig.js";

describe("writeCLIConfig", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getConfig.mockResolvedValue({
            dbURL: "127.0.0.1",
            dbUser: "root"
        });
    });

    it("writes merged config on success", async () => {
        mocks.prompts.mockResolvedValue({ dbUser: "alice" });

        await writeCLIConfig();

        expect(mocks.setConfig).toHaveBeenCalledWith({
            dbURL: "127.0.0.1",
            dbUser: "alice"
        });
    });

    it("does not write on prompt cancel", async () => {
        mocks.prompts.mockImplementation(async (_questions, options) => {
            options?.onCancel?.();
            return {};
        });

        await writeCLIConfig();

        expect(mocks.setConfig).not.toHaveBeenCalled();
    });
});
