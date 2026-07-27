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
        spinner,
        TableMock
    };
});

vi.mock("prompts", () => ({ default: mocks.prompts }));
vi.mock("ora", () => ({ default: mocks.ora }));
vi.mock("cli-table3", () => ({ default: mocks.TableMock }));
vi.mock("../utils/github/github.js", () => ({
    getGithubToken: mocks.getGithubToken,
    fetchPaginatedGithubAPI: mocks.fetchPaginatedGithubAPI
}));

import listGithubDeploymentKeys from "./githubDeploymentKeysList.js";

describe("listGithubDeploymentKeys", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.spinner.start.mockReturnValue(mocks.spinner);
        mocks.getGithubToken.mockResolvedValue({ token: "t", authMethod: "env" });
        mocks.prompts.mockResolvedValue({ organization: "intecoag" });
    });

    it("warns when organization has no repos", async () => {
        mocks.fetchPaginatedGithubAPI.mockResolvedValue([]);

        await listGithubDeploymentKeys();

        expect(mocks.spinner.warn).toHaveBeenCalledWith('No repositories found in organization "intecoag"');
    });

    it("lists deployment keys across repositories", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        mocks.fetchPaginatedGithubAPI.mockImplementation(async (url: string) => {
            if (url.includes("/orgs/")) {
                return [{ name: "repo1" }, { name: "repo2" }];
            }
            if (url.includes("repo1/keys")) {
                return [{ id: 1, title: "k1", created_at: "2025-01-01", last_used: null, read_only: true }];
            }
            if (url.includes("repo2/keys")) {
                return [{ id: 2, title: "k2", created_at: "2025-01-02", last_used: "2025-01-03", read_only: false }];
            }
            return [];
        });

        await listGithubDeploymentKeys();

        expect(mocks.spinner.succeed).toHaveBeenCalledWith("Found 2 deployment keys across 2 repositories");
        const output = logSpy.mock.calls.map((c) => String(c[0] ?? "")).join("\n");
        expect(output).toContain("rows:2");
        expect(output).toContain("Total deployment keys");
    });
});
