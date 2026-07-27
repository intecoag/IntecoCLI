import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const blockBlobClient = {
        uploadFile: vi.fn(),
        downloadToFile: vi.fn()
    };
    const blobClient = {
        getProperties: vi.fn()
    };
    const containerClient = {
        listBlobsFlat: vi.fn(),
        getBlobClient: vi.fn(() => blobClient),
        getBlockBlobClient: vi.fn(() => blockBlobClient),
        deleteBlob: vi.fn()
    };
    const blobServiceClient = {
        getContainerClient: vi.fn(() => containerClient),
        listContainers: vi.fn()
    };

    return {
        DefaultAzureCredential: vi.fn(),
        BlobServiceClient: vi.fn(function BlobServiceClientMock() {
            return blobServiceClient;
        }),
        blobServiceClient,
        containerClient,
        blobClient,
        blockBlobClient
    };
});

vi.mock("@azure/identity", () => ({
    DefaultAzureCredential: mocks.DefaultAzureCredential
}));

vi.mock("@azure/storage-blob", () => ({
    BlobServiceClient: mocks.BlobServiceClient
}));

import { AzureHelper } from "./azure.js";

describe("AzureHelper", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("caches container client by storage account and container", () => {
        const helper = new AzureHelper();

        const first = helper.getContainerClient("acc", "cont");
        const second = helper.getContainerClient("acc", "cont");

        expect(first).toBe(second);
        expect(mocks.BlobServiceClient).toHaveBeenCalledTimes(1);
    });

    it("lists containers", async () => {
        mocks.blobServiceClient.listContainers.mockImplementation(async function* () {
            yield { name: "a" };
            yield { name: "b" };
        });
        const helper = new AzureHelper();

        const containers = await helper.listContainers("acc");

        expect(containers).toEqual(["a", "b"]);
    });

    it("lists blobs with md5 property passthrough", async () => {
        const md5 = new Uint8Array([1, 2, 3]);
        mocks.containerClient.listBlobsFlat.mockImplementation(async function* () {
            yield { name: "f.txt", properties: { contentMD5: md5 } };
        });
        const helper = new AzureHelper();

        const blobs = await helper.listBlobs(mocks.containerClient as never);

        expect(blobs).toEqual([{ name: "f.txt", properties: { contentMD5: md5 } }]);
    });

    it("returns base64 md5 from blob properties", async () => {
        const raw = Buffer.from("abc");
        mocks.blobClient.getProperties.mockResolvedValue({ contentMD5: raw });
        const helper = new AzureHelper();

        const md5 = await helper.getBlobMd5Base64(mocks.containerClient as never, "f.txt");

        expect(md5).toBe(raw.toString("base64"));
    });

    it("returns null when blob md5 lookup fails", async () => {
        mocks.blobClient.getProperties.mockRejectedValue(new Error("boom"));
        const helper = new AzureHelper();

        const md5 = await helper.getBlobMd5Base64(mocks.containerClient as never, "f.txt");

        expect(md5).toBeNull();
    });

    it("uploads with optional md5 and progress", async () => {
        mocks.blockBlobClient.uploadFile.mockResolvedValue({ etag: "x" });
        const helper = new AzureHelper();
        const onProgress = vi.fn();

        await helper.uploadFile(mocks.containerClient as never, "f.txt", "C:/f.txt", Buffer.from("a").toString("base64"), onProgress);

        expect(mocks.blockBlobClient.uploadFile).toHaveBeenCalledTimes(1);
        expect(mocks.blockBlobClient.uploadFile.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ onProgress }));
    });

    it("downloads and deletes blob", async () => {
        mocks.blockBlobClient.downloadToFile.mockResolvedValue(undefined);
        mocks.containerClient.deleteBlob.mockResolvedValue(undefined);
        const helper = new AzureHelper();

        await helper.downloadToFile(mocks.containerClient as never, "f.txt", "C:/f.txt");
        await helper.deleteBlob(mocks.containerClient as never, "f.txt");

        expect(mocks.blockBlobClient.downloadToFile).toHaveBeenCalledWith("C:/f.txt", 0, 0, { onProgress: undefined });
        expect(mocks.containerClient.deleteBlob).toHaveBeenCalledWith("f.txt");
    });
});
