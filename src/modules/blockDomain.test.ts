import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    prompts: vi.fn(),
    readFile: vi.fn(),
    spawn: vi.fn(),
    exitCode: 0 as number | null,
}));

vi.mock("prompts", () => ({
    default: mocks.prompts,
}));

vi.mock("fs/promises", () => ({
    readFile: mocks.readFile,
}));

vi.mock("child_process", () => ({
    spawn: mocks.spawn,
}));

vi.mock("chalk", () => ({
    default: {
        red: (text: string) => text,
        green: (text: string) => text,
    },
}));

import blockDomain from "./blockDomain.js";

describe("blockDomain", () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();

        consoleLogSpy = vi
            .spyOn(console, "log")
            .mockImplementation(() => undefined);

        mocks.exitCode = 0;

        mocks.spawn.mockImplementation(() => {
            const child = {
                on: vi.fn(
                    (
                        event: string,
                        callback: (code: number | null) => void,
                    ) => {
                        if (event === "exit") {
                            callback(mocks.exitCode);
                        }

                        return child;
                    },
                ),
            };

            return child;
        });
    });

    describe("blocking a domain", () => {
        it("adds the domain to the hosts file", async () => {
            mocks.readFile.mockResolvedValue(
                [
                    "127.0.0.1 localhost",
                    "::1 localhost",
                ].join("\n"),
            );

            mocks.prompts
                .mockResolvedValueOnce({
                    actionType: "blockDomain",
                })
                .mockResolvedValueOnce({
                    domain: "example.com",
                });

            await blockDomain(undefined);

            expect(mocks.readFile).toHaveBeenCalledWith(
                "C:\\Windows\\System32\\drivers\\etc\\hosts",
                "utf8",
            );

            expect(mocks.spawn).toHaveBeenCalledOnce();

            const writtenContent = getWrittenHostsContent();

            expect(writtenContent).toBe(
                [
                    "127.0.0.1 localhost",
                    "::1 localhost",
                    "0.0.0.0 example.com",
                ].join("\n"),
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(
                "Domain blocked. Please restart your browser and/or jWEGAS.",
            );
        });

        it("prints an error when writing the hosts file fails", async () => {
            mocks.exitCode = 1;

            mocks.readFile.mockResolvedValue(
                "127.0.0.1 localhost",
            );

            mocks.prompts
                .mockResolvedValueOnce({
                    actionType: "blockDomain",
                })
                .mockResolvedValueOnce({
                    domain: "example.com",
                });

            await blockDomain(undefined);

            expect(consoleLogSpy).toHaveBeenCalledWith(
                "Failed to block domain.",
            );
        });

        it("starts PowerShell with administrator privileges", async () => {
            mocks.readFile.mockResolvedValue(
                "127.0.0.1 localhost",
            );

            mocks.prompts
                .mockResolvedValueOnce({
                    actionType: "blockDomain",
                })
                .mockResolvedValueOnce({
                    domain: "example.com",
                });

            await blockDomain(undefined);

            expect(mocks.spawn).toHaveBeenCalledWith(
                "powershell.exe",
                [
                    "-NoProfile",
                    "-Command",
                    expect.stringContaining(
                        "Start-Process powershell.exe",
                    ),
                ],
                {
                    stdio: "inherit",
                },
            );

            const [, args] = mocks.spawn.mock.calls[0];

            expect(args[2]).toContain("-Verb RunAs");
            expect(args[2]).toContain("-EncodedCommand");
        });

        it("flushes the DNS cache after writing the hosts file", async () => {
            mocks.readFile.mockResolvedValue("");

            mocks.prompts
                .mockResolvedValueOnce({
                    actionType: "blockDomain",
                })
                .mockResolvedValueOnce({
                    domain: "example.com",
                });

            await blockDomain(undefined);

            const script = getDecodedPowerShellScript();

            expect(script).toContain("ipconfig /flushdns");
        });
    });

    describe("unblocking a domain", () => {
        it("shows only blocked domains in the selection prompt", async () => {
            mocks.readFile.mockResolvedValue(
                [
                    "127.0.0.1 localhost",
                    "0.0.0.0 example.com",
                    "::1 localhost",
                    "0.0.0.0 google.com",
                ].join("\n"),
            );

            mocks.prompts
                .mockResolvedValueOnce({
                    actionType: "unblockDomain",
                })
                .mockResolvedValueOnce({
                    domain: 1,
                });

            await blockDomain(undefined);

            expect(mocks.prompts).toHaveBeenNthCalledWith(
                2,
                {
                    type: "select",
                    name: "domain",
                    message: "Select the domain to unblock:",
                    choices: [
                        {
                            title: "0.0.0.0 example.com",
                            value: 1,
                        },
                        {
                            title: "0.0.0.0 google.com",
                            value: 3,
                        },
                    ],
                },
                expect.any(Object),
            );
        });

        it("removes the selected blocked domain", async () => {
            mocks.readFile.mockResolvedValue(
                [
                    "127.0.0.1 localhost",
                    "0.0.0.0 example.com",
                    "0.0.0.0 google.com",
                ].join("\n"),
            );

            mocks.prompts
                .mockResolvedValueOnce({
                    actionType: "unblockDomain",
                })
                .mockResolvedValueOnce({
                    domain: 1,
                });

            await blockDomain(undefined);

            expect(getWrittenHostsContent()).toBe(
                [
                    "127.0.0.1 localhost",
                    "0.0.0.0 google.com",
                ].join("\n"),
            );

            expect(consoleLogSpy).toHaveBeenCalledWith(
                "Domain unblocked. Please restart your browser and/or jWEGAS.",
            );
        });

        it("can remove a later blocked domain using its original line number", async () => {
            mocks.readFile.mockResolvedValue(
                [
                    "127.0.0.1 localhost",
                    "0.0.0.0 example.com",
                    "::1 localhost",
                    "0.0.0.0 google.com",
                ].join("\n"),
            );

            mocks.prompts
                .mockResolvedValueOnce({
                    actionType: "unblockDomain",
                })
                .mockResolvedValueOnce({
                    domain: 3,
                });

            await blockDomain(undefined);

            expect(getWrittenHostsContent()).toBe(
                [
                    "127.0.0.1 localhost",
                    "0.0.0.0 example.com",
                    "::1 localhost",
                ].join("\n"),
            );
        });

        it("prints an error when unblocking fails", async () => {
            mocks.exitCode = 1;

            mocks.readFile.mockResolvedValue(
                [
                    "127.0.0.1 localhost",
                    "0.0.0.0 example.com",
                ].join("\n"),
            );

            mocks.prompts
                .mockResolvedValueOnce({
                    actionType: "unblockDomain",
                })
                .mockResolvedValueOnce({
                    domain: 1,
                });

            await blockDomain(undefined);

            expect(consoleLogSpy).toHaveBeenCalledWith(
                "Failed to unblock domain.",
            );
        });

        it("does not ask for a domain when no blocked domains exist", async () => {
            mocks.readFile.mockResolvedValue(
                [
                    "127.0.0.1 localhost",
                    "::1 localhost",
                ].join("\n"),
            );

            mocks.prompts.mockResolvedValueOnce({
                actionType: "unblockDomain",
            });

            await blockDomain(undefined);

            expect(mocks.prompts).toHaveBeenCalledOnce();

            expect(consoleLogSpy).toHaveBeenCalledWith(
                "No blocked domains found.",
            );

            expect(mocks.spawn).not.toHaveBeenCalled();
        });
    });

    describe("cancellation", () => {
        it("stops when the action selection is cancelled", async () => {
            mocks.prompts.mockImplementationOnce(
                async (
                    _prompt: unknown,
                    options: { onCancel: () => void },
                ) => {
                    options.onCancel();
                    return {};
                },
            );

            await blockDomain(undefined);

            expect(consoleLogSpy).toHaveBeenCalledWith(
                "Cancelled operation!",
            );

            expect(mocks.readFile).not.toHaveBeenCalled();
            expect(mocks.spawn).not.toHaveBeenCalled();
        });

        it("stops when domain input is cancelled while blocking", async () => {
            mocks.readFile.mockResolvedValue(
                "127.0.0.1 localhost",
            );

            mocks.prompts
                .mockResolvedValueOnce({
                    actionType: "blockDomain",
                })
                .mockImplementationOnce(
                    async (
                        _prompt: unknown,
                        options: { onCancel: () => void },
                    ) => {
                        options.onCancel();
                        return {};
                    },
                );

            await blockDomain(undefined);

            expect(consoleLogSpy).toHaveBeenCalledWith(
                "Cancelled operation!",
            );

            expect(mocks.spawn).not.toHaveBeenCalled();
        });

        it("stops when domain selection is cancelled while unblocking", async () => {
            mocks.readFile.mockResolvedValue(
                [
                    "127.0.0.1 localhost",
                    "0.0.0.0 example.com",
                ].join("\n"),
            );

            mocks.prompts
                .mockResolvedValueOnce({
                    actionType: "unblockDomain",
                })
                .mockImplementationOnce(
                    async (
                        _prompt: unknown,
                        options: { onCancel: () => void },
                    ) => {
                        options.onCancel();
                        return {};
                    },
                );

            await blockDomain(undefined);

            expect(consoleLogSpy).toHaveBeenCalledWith(
                "Cancelled operation!",
            );

            expect(mocks.spawn).not.toHaveBeenCalled();
        });
    });

    function getWrittenHostsContent(): string {
        const script = getDecodedPowerShellScript();

        const match = script.match(
            /\[Convert\]::FromBase64String\('([^']+)'\)/,
        );

        expect(match).not.toBeNull();

        return Buffer
            .from(match![1], "base64")
            .toString("utf8");
    }

    function getDecodedPowerShellScript(): string {
        expect(mocks.spawn).toHaveBeenCalled();

        const [, args] = mocks.spawn.mock.calls[0] as [
            string,
            string[],
            unknown,
        ];

        const command = args[2];

        const match = command.match(
            /'-EncodedCommand','([^']+)'/,
        );

        expect(match).not.toBeNull();

        return Buffer
            .from(match![1], "base64")
            .toString("utf16le");
    }
});