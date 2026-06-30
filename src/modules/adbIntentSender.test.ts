import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    listDevices: vi.fn(),
    shell: vi.fn(),
    prompts: vi.fn(),
    Client: vi.fn()
}));

vi.mock("adb-ts", () => ({
    default: {
        Client: mocks.Client.mockImplementation(function AdbClientMock() {
            return {
            listDevices: mocks.listDevices,
            shell: mocks.shell
        };
        })
    }
}));

vi.mock("prompts", () => ({ default: mocks.prompts }));

import adbIntentSender from "./adbIntentSender.js";

describe("adbIntentSender", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.listDevices.mockResolvedValue([{ id: "dev1", model: "M" }]);
    });

    it("sends broadcast intent", async () => {
        mocks.prompts.mockResolvedValue({
            device: { id: "dev1" },
            action: "ch.inteco.orderprep.action.BARCODE_DATA",
            codeId: "s",
            data: "123"
        });

        await adbIntentSender();

        expect(mocks.shell).toHaveBeenCalledTimes(1);
        const command = String(mocks.shell.mock.calls[0]?.[1] ?? "");
        expect(command).toContain("am broadcast -a ch.inteco.orderprep.action.BARCODE_DATA");
        expect(command).toContain("--es codeId s");
        expect(command).toContain("--es data 123");
    });

    it("does nothing on cancel", async () => {
        mocks.prompts.mockImplementation(async (_q, options) => {
            options?.onCancel?.();
            return {};
        });

        await adbIntentSender();

        expect(mocks.shell).not.toHaveBeenCalled();
    });
});
