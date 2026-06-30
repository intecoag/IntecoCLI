import { beforeEach, describe, expect, it, vi } from "vitest";

const childProcessMocks = vi.hoisted(() => ({
    execSync: vi.fn()
}));

vi.mock("child_process", () => ({
    execSync: childProcessMocks.execSync
}));

import { fetchGithubAPI, fetchPaginatedGithubAPI, getGithubToken } from "./github.js";

type MockResponse = {
    ok: boolean;
    status: number;
    statusText: string;
    json: () => Promise<unknown>;
};

function response(overrides: Partial<MockResponse>): MockResponse {
    return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ([]),
        ...overrides
    };
}

describe("github helpers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        delete process.env.GITHUB_TOKEN;
    });

    it("uses GITHUB_TOKEN from environment", async () => {
        process.env.GITHUB_TOKEN = "env-token";

        const result = await getGithubToken();

        expect(result).toEqual({
            token: "env-token",
            authMethod: "GITHUB_TOKEN (environment variable)"
        });
        expect(childProcessMocks.execSync).not.toHaveBeenCalled();
    });

    it("falls back to GitHub CLI token", async () => {
        childProcessMocks.execSync.mockReturnValue("cli-token\n");

        const result = await getGithubToken();

        expect(childProcessMocks.execSync).toHaveBeenCalledWith("gh auth token", { encoding: "utf-8" });
        expect(result).toEqual({ token: "cli-token", authMethod: "GitHub CLI" });
    });

    it("throws when no token is available", async () => {
        childProcessMocks.execSync.mockImplementation(() => {
            throw new Error("not authenticated");
        });

        await expect(getGithubToken()).rejects.toThrow("GitHub authentication required");
    });

    it("fetchGithubAPI sends expected headers", async () => {
        const fetchMock = vi.fn().mockResolvedValue(response({}));
        vi.stubGlobal("fetch", fetchMock);

        await fetchGithubAPI("https://api.github.test/repos/a/b", "abc");

        expect(fetchMock).toHaveBeenCalledWith(
            "https://api.github.test/repos/a/b",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer abc",
                    Accept: "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                    "User-Agent": "inteco-cli"
                })
            })
        );
    });

    it("maps 404 from fetchGithubAPI to explicit message", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ ok: false, status: 404, statusText: "Not Found" })));

        await expect(fetchGithubAPI("https://api.github.test/repos/a/b", "abc")).rejects.toThrow("404: Resource not found");
    });

    it("fetchPaginatedGithubAPI collects all pages", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(response({ json: async () => [{ id: 1 }, { id: 2 }] }))
            .mockResolvedValueOnce(response({ json: async () => [{ id: 3 }] }))
            .mockResolvedValueOnce(response({ json: async () => [] }));
        vi.stubGlobal("fetch", fetchMock);

        const result = await fetchPaginatedGithubAPI<{ id: number }>("https://api.github.test/repos/a/b/issues", "abc");

        expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("returns collected items when a later page fails", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(response({ json: async () => [{ id: 1 }] }))
            .mockResolvedValueOnce(response({ ok: false, status: 500, statusText: "Boom" }));
        vi.stubGlobal("fetch", fetchMock);

        const result = await fetchPaginatedGithubAPI<{ id: number }>("https://api.github.test/repos/a/b/issues", "abc");

        expect(result).toEqual([{ id: 1 }]);
    });
});
