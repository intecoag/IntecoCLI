import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const spinner = {
        start: vi.fn(),
        warn: vi.fn(),
        fail: vi.fn(),
        succeed: vi.fn(),
        text: ""
    };
    spinner.start.mockReturnValue(spinner);

    return {
        prompts: vi.fn(),
        ora: vi.fn(() => spinner),
        execSync: vi.fn(),
        getGithubToken: vi.fn(),
        fetchPaginatedGithubAPI: vi.fn(),
        spinner
    };
});

vi.mock("prompts", () => ({ default: mocks.prompts }));
vi.mock("ora", () => ({ default: mocks.ora }));
vi.mock("child_process", () => ({ execSync: mocks.execSync }));
vi.mock("../utils/github/github.js", () => ({
    getGithubToken: mocks.getGithubToken,
    fetchPaginatedGithubAPI: mocks.fetchPaginatedGithubAPI
}));

import addGithubDeploymentKey from "./githubDeploymentKey.js";

describe("addGithubDeploymentKey", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.spinner.start.mockReturnValue(mocks.spinner);
        mocks.getGithubToken.mockResolvedValue({ token: "t", authMethod: "env" });
    });

    it("warns and returns when no repos are found", async () => {
        mocks.prompts.mockResolvedValue({ organization: "intecoag" });
        mocks.fetchPaginatedGithubAPI.mockResolvedValue([]);

        await addGithubDeploymentKey();

        expect(mocks.spinner.warn).toHaveBeenCalledWith('No repositories found in organization "intecoag"');
    });

    it("creates deployment key with gh cli on success", async () => {
        mocks.prompts
            .mockResolvedValueOnce({ organization: "intecoag" })
            .mockResolvedValueOnce({ repository: "repo1" })
            .mockResolvedValueOnce({ publicKey: "ssh-ed25519 AAAA...", keyName: "repo1-key" });
        mocks.fetchPaginatedGithubAPI.mockResolvedValue([{ name: "repo1", description: "r1" }]);

        await addGithubDeploymentKey();

        expect(mocks.execSync).toHaveBeenCalledWith(
            'gh repo deploy-key add --repo intecoag/repo1 --title "repo1-key" -',
            expect.objectContaining({ input: "ssh-ed25519 AAAA...", encoding: "utf-8" })
        );
    });
});
