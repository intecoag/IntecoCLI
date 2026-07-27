import { beforeEach, describe, expect, it, vi } from "vitest";

const configMocks = vi.hoisted(() => ({
    store: {
        read: vi.fn<() => Promise<Record<string, unknown>>>(),
        write: vi.fn<(data: Record<string, unknown>) => void>(),
        filePath: "C:/tmp/inteco-config.json"
    },
    cfgFactory: vi.fn()
}));

vi.mock("application-config", () => ({
    default: configMocks.cfgFactory.mockImplementation(() => configMocks.store)
}));

type ConfigModule = typeof import("./config.js");

async function loadConfigModule(): Promise<ConfigModule> {
    vi.resetModules();
    return import("./config.js");
}

describe("Config", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        configMocks.store.filePath = "C:/tmp/inteco-config.json";
        configMocks.store.read.mockResolvedValue({});
        configMocks.store.write.mockImplementation(() => undefined);
    });

    it("normalizes loaded config and strips unknown keys", async () => {
        configMocks.store.read.mockResolvedValue({
            dbURL: "db.local",
            unknownKey: "remove-me"
        });

        const { Config } = await loadConfigModule();
        const cfg = await Config.getConfig();

        expect(cfg.dbURL).toBe("db.local");
        expect(Object.hasOwn(cfg, "unknownKey")).toBe(false);
    });

    it("returns configured file path", async () => {
        configMocks.store.filePath = "C:/app/config.json";
        const { Config } = await loadConfigModule();

        const filePath = await Config.getConfigPath();

        expect(filePath).toBe("C:/app/config.json");
    });

    it("setConfigField writes merged config", async () => {
        configMocks.store.read.mockResolvedValue({ dbUser: "old" });
        const { Config } = await loadConfigModule();

        await Config.setConfigField("dbUser", "alice");

        expect(configMocks.store.write).toHaveBeenCalledTimes(1);
        expect(configMocks.store.write).toHaveBeenCalledWith(expect.objectContaining({ dbUser: "alice" }));
    });

    it("setConfig persists full config", async () => {
        const { Config } = await loadConfigModule();

        await Config.setConfig({
            configIndividualPath: "a",
            configIndividualPathWrite: "b",
            configIndividualPathEclipse: "c",
            dbURL: "127.0.0.1",
            dbUser: "root",
            dbPassword: "pw",
            wegasUsername: "wegas"
        });

        expect(configMocks.store.write).toHaveBeenCalledWith(expect.objectContaining({
            dbUser: "root",
            dbPassword: "pw"
        }));
    });
});
