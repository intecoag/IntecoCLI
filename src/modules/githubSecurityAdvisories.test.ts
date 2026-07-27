import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const spinner = {
        text: "",
        start: vi.fn(),
        warn: vi.fn(),
        fail: vi.fn(),
        succeed: vi.fn()
    };
    spinner.start.mockReturnValue(spinner);

    class TableMock {
        rows: unknown[] = [];
        push(row: unknown) {
            this.rows.push(row);
        }
        toString() {
            return `rows:${this.rows.length}`;
        }
    }

    return {
        prompts: vi.fn(),
        ora: vi.fn(() => spinner),
        getGithubToken: vi.fn(),
        fetchPaginatedGithubAPI: vi.fn(),
        fetchGithubAPI: vi.fn(),
        spinner,
        TableMock
    };
});

vi.mock("prompts", () => ({ default: mocks.prompts }));
vi.mock("ora", () => ({ default: mocks.ora }));
vi.mock("cli-table3", () => ({ default: mocks.TableMock }));
vi.mock("../utils/github/github.js", () => ({
    getGithubToken: mocks.getGithubToken,
    fetchPaginatedGithubAPI: mocks.fetchPaginatedGithubAPI,
    fetchGithubAPI: mocks.fetchGithubAPI
}));

import githubSecurityAdvisories from "./githubSecurityAdvisories.js";

describe("githubSecurityAdvisories", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.spinner.start.mockReturnValue(mocks.spinner);
        mocks.getGithubToken.mockResolvedValue({ token: "t", authMethod: "env" });
        mocks.prompts.mockResolvedValue({ organization: "intecoag" });
    });

    it("warns when no repositories are found", async () => {
        mocks.fetchPaginatedGithubAPI.mockResolvedValue([]);

        await githubSecurityAdvisories();

        expect(mocks.spinner.warn).toHaveBeenCalledWith('No repositories found in organization "intecoag"');
    });

    it("shows successful summary for repos with open advisories", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        mocks.fetchPaginatedGithubAPI.mockResolvedValue([
            { name: "repo1", html_url: "https://g/repo1" },
            { name: "repo2", html_url: "https://g/repo2" }
        ]);
        mocks.fetchGithubAPI
            .mockResolvedValueOnce({ json: async () => [{ state: "open" }, { state: "closed" }] })
            .mockResolvedValueOnce({ json: async () => [{ state: "open" }, { state: "open" }] });

        await githubSecurityAdvisories();

        expect(mocks.spinner.succeed).toHaveBeenCalledWith("Security advisories check completed!");
        const out = logSpy.mock.calls.map((c) => String(c[0] ?? "")).join("\n");
        expect(out).toContain("rows:2");
        expect(out).toContain("Summary: 2 repository/repositories with open security advisories");
    });
});
