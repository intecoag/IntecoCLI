import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const spinner = {
        start: vi.fn(),
        fail: vi.fn(),
        succeed: vi.fn()
    };
    spinner.start.mockReturnValue(spinner);

    return {
        prompts: vi.fn(),
        ora: vi.fn(() => spinner),
        execSync: vi.fn(),
        listContainers: vi.fn(),
        log: vi.fn(),
        spinner
    };
});

vi.mock("prompts", () => ({ default: mocks.prompts }));
vi.mock("ora", () => ({ default: mocks.ora }));
vi.mock("child_process", () => ({ execSync: mocks.execSync }));
vi.mock("../utils/azure/azure.js", () => ({
    AzureHelper: class {
        listContainers = mocks.listContainers;
    }
}));

import { generateConfigToken, getPolicyName, getTokenExpiry } from "./generateConfigToken.js";

describe("generateConfigToken", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.spinner.start.mockReturnValue(mocks.spinner);
        vi.spyOn(console, "log").mockImplementation(mocks.log);
    });

    it("adds a single hyphen between prefix and suffix", () => {
        expect(getPolicyName("kunde1")).toBe("kunde1-readonly");
        expect(getPolicyName("kunde1-")).toBe("kunde1-readonly");
        expect(getPolicyName("kunde1--")).toBe("kunde1-readonly");
    });

    it("sets the expiry twenty-five years ahead in UTC format", () => {
        expect(getTokenExpiry(new Date("2026-10-19T12:30:00Z"))).toBe("2051-10-19T12:30Z");
    });

    it("creates the prefixed readonly policy and prints the SAS URL", async () => {
        mocks.prompts
            .mockResolvedValueOnce({ storageAccount: "intecowegasconfig", prefix: "kunde1" })
            .mockResolvedValueOnce({ container: "kunde1" });
        mocks.listContainers.mockResolvedValue(["kunde1"]);
        mocks.execSync
            .mockReturnValueOnce("")
            .mockReturnValueOnce("sv=1&sig=abc");

        await generateConfigToken();

        const commands = mocks.execSync.mock.calls.map(call => String(call[0]));
        expect(commands[0]).toContain("storage container policy create");
        expect(commands[0]).toContain("--permissions rl");
        expect(commands[0]).toContain("--name kunde1-readonly");
        expect(commands[1]).toContain("storage container generate-sas");
        expect(commands[1]).toContain("--policy-name kunde1-readonly");

        const printed = mocks.log.mock.calls.map(call => String(call[0])).join("\n");
        expect(printed).toContain("SAS token:\nsv=1&sig=abc");
        expect(printed).toContain("https://intecowegasconfig.blob.core.windows.net/kunde1?sv=1&sig=abc");
    });
});
