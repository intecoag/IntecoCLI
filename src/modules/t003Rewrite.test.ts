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

    it("updates selected user for selected mandant", async () => {
        mocks.prompts
            .mockResolvedValueOnce({ dbName: "db1" })
            .mockResolvedValueOnce({ mnr: "1" })
            .mockResolvedValueOnce({ username: "old_user" });

        mocks.executeQueryOnDB
            .mockResolvedValueOnce([
                {
                    mand_mandant: "1",
                    mand_name: "Mandant 1"
                }
            ])
            .mockResolvedValueOnce([
                {
                    t003_pw: "old_user"
                }
            ])
            .mockResolvedValueOnce([]);

        await t003Rewrite({});

        expect(mocks.executeQueryOnDB).toHaveBeenNthCalledWith(
            1,
            "SELECT mand_mandant, mand_name FROM mand ORDER BY mand_mandant",
            "db1"
        );

        expect(mocks.executeQueryOnDB).toHaveBeenNthCalledWith(
            2,
            "SELECT t003_pw FROM t003 WHERE t003_mnr = 1",
            "db1"
        );

        expect(mocks.executeQueryOnDB).toHaveBeenNthCalledWith(
            3,
            "UPDATE t003 SET t003_pw = 'NEW_USER' WHERE t003_mnr = 1 AND t003_pw = 'old_user'",
            "db1"
        );
    });

    it("updates selected user for all mandants", async () => {
        mocks.prompts
            .mockResolvedValueOnce({ dbName: "db1" })
            .mockResolvedValueOnce({ mnr: "ALL" })
            .mockResolvedValueOnce({ username: "old_user" });

        mocks.executeQueryOnDB
            .mockResolvedValueOnce([
                {
                    mand_mandant: "1",
                    mand_name: "Mandant 1"
                },
                {
                    mand_mandant: "2",
                    mand_name: "Mandant 2"
                }
            ])
            .mockResolvedValueOnce([
                {
                    t003_pw: "old_user"
                }
            ])
            .mockResolvedValueOnce([]);

        await t003Rewrite({});

        expect(mocks.executeQueryOnDB).toHaveBeenNthCalledWith(
            1,
            "SELECT mand_mandant, mand_name FROM mand ORDER BY mand_mandant",
            "db1"
        );

        expect(mocks.executeQueryOnDB).toHaveBeenNthCalledWith(
            2,
            "SELECT DISTINCT t003_pw FROM t003",
            "db1"
        );

        expect(mocks.executeQueryOnDB).toHaveBeenNthCalledWith(
            3,
            "UPDATE t003 SET t003_pw = 'NEW_USER' WHERE t003_pw = 'old_user'",
            "db1"
        );
    });

    it("stops after database prompt cancel", async () => {
        mocks.prompts.mockImplementationOnce(async (_question, options) => {
            options?.onCancel?.();
            return {};
        });

        await t003Rewrite({});

        expect(mocks.executeQueryOnDB).not.toHaveBeenCalled();
    });

    it("stops after mandant prompt cancel", async () => {
        mocks.prompts
            .mockResolvedValueOnce({ dbName: "db1" })
            .mockImplementationOnce(async (_question, options) => {
                options?.onCancel?.();
                return {};
            });

        mocks.executeQueryOnDB.mockResolvedValueOnce([
            {
                mand_mandant: "1",
                mand_name: "Mandant 1"
            }
        ]);

        await t003Rewrite({});

        expect(mocks.executeQueryOnDB).toHaveBeenCalledTimes(1);

        expect(mocks.executeQueryOnDB).toHaveBeenCalledWith(
            "SELECT mand_mandant, mand_name FROM mand ORDER BY mand_mandant",
            "db1"
        );
    });

    it("does not update after username prompt cancel", async () => {
        mocks.prompts
            .mockResolvedValueOnce({ dbName: "db1" })
            .mockResolvedValueOnce({ mnr: "1" })
            .mockImplementationOnce(async (_question, options) => {
                options?.onCancel?.();
                return {};
            });

        mocks.executeQueryOnDB
            .mockResolvedValueOnce([
                {
                    mand_mandant: "1",
                    mand_name: "Mandant 1"
                }
            ])
            .mockResolvedValueOnce([
                {
                    t003_pw: "old_user"
                }
            ]);

        await t003Rewrite({});

        expect(mocks.executeQueryOnDB).toHaveBeenCalledTimes(2);

        expect(mocks.executeQueryOnDB).not.toHaveBeenCalledWith(
            expect.stringContaining("UPDATE t003"),
            expect.anything()
        );
    });
});