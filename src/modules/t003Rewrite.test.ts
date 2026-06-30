import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    prompts: vi.fn(),
    getConfig: vi.fn(),
    getDatabaseNames: vi.fn(),
    executeQueryOnDB: vi.fn()
}));

vi.mock("prompts", () => ({ default: mocks.prompts }));
vi.mock("../utils/config/config.js", () => ({ Config: { getConfig: mocks.getConfig } }));
vi.mock("../utils/db/DB.js", () => ({
    DB: {
        getDatabaseNames: mocks.getDatabaseNames,
        executeQueryOnDB: mocks.executeQueryOnDB
    }
}));

import t003Rewrite from "./t003Rewrite.js";

describe("t003Rewrite", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getConfig.mockResolvedValue({ wegasUsername: "NEW_USER" });
        mocks.getDatabaseNames.mockResolvedValue([{ name: "db1" }]);
    });

    it("updates selected user", async () => {
        mocks.prompts
            .mockResolvedValueOnce({ dbName: "db1", mnr: 1 })
            .mockResolvedValueOnce({ username: "old_user" });
        mocks.executeQueryOnDB
            .mockResolvedValueOnce([{ t003_pw: "old_user" }])
            .mockResolvedValueOnce([]);

        await t003Rewrite({});

        expect(mocks.executeQueryOnDB).toHaveBeenCalledWith("SELECT t003_pw FROM t003 WHERE t003_mnr = 1", "db1");
        expect(mocks.executeQueryOnDB).toHaveBeenCalledWith(
            "UPDATE t003 SET t003_pw = 'NEW_USER' WHERE t003_mnr = 1 AND t003_pw = 'old_user'",
            "db1"
        );
    });

    it("stops after first prompt cancel", async () => {
        mocks.prompts.mockImplementationOnce(async (_q, options) => {
            options?.onCancel?.();
            return {};
        });

        await t003Rewrite({});

        expect(mocks.executeQueryOnDB).not.toHaveBeenCalled();
    });
});
