import { beforeEach, describe, expect, it, vi } from "vitest";
import showChangelog from "./changelog.js";

describe("showChangelog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it("prints error when releases endpoint fails", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

        await showChangelog();

        expect(errorSpy).toHaveBeenCalled();
        expect(errorSpy.mock.calls[0]?.[0]).toContain("Failed to fetch changelog");
    });

    it("prints releases in chronological order", async () => {
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => [
                { name: "v2", tag_name: "v2", body: "- two" },
                { name: "v1", tag_name: "v1", body: "- one" }
            ]
        }));

        await showChangelog();

        const lines = logSpy.mock.calls.map((call) => String(call[0] ?? ""));
        const v1 = lines.findIndex((line) => line.includes("> v1"));
        const v2 = lines.findIndex((line) => line.includes("> v2"));

        expect(v1).toBeGreaterThan(-1);
        expect(v2).toBeGreaterThan(-1);
        expect(v1).toBeLessThan(v2);
    });
});
