import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    prompts: vi.fn(),
    readdirSync: vi.fn(),
    createReadStream: vi.fn(),
    writeFileSync: vi.fn(),
    csvParser: vi.fn()
}));

vi.mock("prompts", () => ({
    default: mocks.prompts
}));

vi.mock("csv-parser", () => ({
    default: mocks.csvParser
}));

vi.mock("fs", () => ({
    default: {
        readdirSync: mocks.readdirSync,
        createReadStream: mocks.createReadStream,
        writeFileSync: mocks.writeFileSync
    }
}));

import csvMerge from "./csvMerger.js";

function mockCsvRows(rows: Record<string, string>[]) {
    const piped = {
        on: vi.fn((event: string, cb: (data?: Record<string, string>) => void) => {
            if (event === "data") {
                rows.forEach((row) => cb(row));
            }

            if (event === "end") {
                cb();
            }

            return piped;
        })
    };

    mocks.createReadStream.mockReturnValue({
        pipe: vi.fn(() => piped)
    });
}

describe("csvMerger", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.csvParser.mockReturnValue({});
    });

    it("stops when prompt flow is cancelled", async () => {
        mocks.prompts.mockImplementation(async (_questions, options) => {
            options?.onCancel?.();
            return {};
        });

        await csvMerge();

        expect(mocks.readdirSync).not.toHaveBeenCalled();
        expect(mocks.writeFileSync).not.toHaveBeenCalled();
    });

    it("writes merged and filtered output", async () => {
        mocks.prompts.mockResolvedValue({
            output: "results.csv",
            useFilter: true,
            filtertype: "eq",
            filterfield: "status",
            filtervalue: "ok"
        });
        mocks.readdirSync.mockReturnValue([
            { isFile: () => true, name: "input.csv" }
        ]);
        mockCsvRows([
            { "'status'": "ok", "`id`": "1" },
            { "'status'": "no", "`id`": "2" }
        ]);

        await csvMerge();

        expect(mocks.writeFileSync).toHaveBeenCalledTimes(1);
        const [, output] = mocks.writeFileSync.mock.calls[0] as [string, string];
        expect(output).toContain('"status";"id";"file"');
        expect(output).toContain('"ok";"1";"input.csv"');
        expect(output).not.toContain('"no";"2";"input.csv"');
    });
});
