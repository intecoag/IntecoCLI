import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    listDevices: vi.fn(),
    reverse: vi.fn(),
    prompts: vi.fn(),
    Client: vi.fn()
}));

vi.mock("adb-ts", () => ({
    default: {
        Client: mocks.Client.mockImplementation(function AdbClientMock() {
            return {
            listDevices: mocks.listDevices,
            reverse: mocks.reverse
        };
        })
    }
}));

vi.mock("prompts", () => ({ default: mocks.prompts }));

import adbBridge from "./adbBridge.js";

describe("adbBridge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.listDevices.mockResolvedValue([{ id: "emulator-1", model: "Pixel" }]);
    });

    it("creates reverse tunnel on success", async () => {
        mocks.prompts.mockResolvedValue({ device: { id: "emulator-1" }, port: 3000 });

        await adbBridge();

        expect(mocks.reverse).toHaveBeenCalledWith("emulator-1", "tcp:3000", "tcp:3000");
    });

    it("does nothing when prompt is cancelled", async () => {
        mocks.prompts.mockImplementation(async (_q, options) => {
            options?.onCancel?.();
            return {};
        });

        await adbBridge();

        expect(mocks.reverse).not.toHaveBeenCalled();
    });
});
