import { BlobServiceClient, type BlobUploadCommonResponse, type ContainerClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

type ProgressHandler = (progress: { loadedBytes: number }) => void;

export class AzureHelper {
    credential: DefaultAzureCredential;
    clientCache: Map<string, ContainerClient>;

    constructor(credential: DefaultAzureCredential = new DefaultAzureCredential()) {
        this.credential = credential;
        this.clientCache = new Map();
    }

    getContainerClient(storageAccount: string, container: string): ContainerClient {
        const cacheKey = `${storageAccount}|${container}`;
        let containerClient = this.clientCache.get(cacheKey);
        if (containerClient) {
            return containerClient;
        }

        const blobServiceClient = new BlobServiceClient(
            `https://${storageAccount}.blob.core.windows.net`,
            this.credential
        );
        containerClient = blobServiceClient.getContainerClient(container);
        this.clientCache.set(cacheKey, containerClient);
        return containerClient;
    }

    async listContainers(storageAccount: string): Promise<string[]> {
        const blobServiceClient = new BlobServiceClient(
            `https://${storageAccount}.blob.core.windows.net`,
            this.credential
        );
        const containers: string[] = [];
        for await (const container of blobServiceClient.listContainers()) {
            containers.push(container.name);
        }
        return containers;
    }

    async listBlobs(containerClient: ContainerClient): Promise<Array<{ name: string; properties?: { contentMD5?: Uint8Array } }>> {
        const blobs: Array<{ name: string; properties?: { contentMD5?: Uint8Array } }> = [];
        for await (const blob of containerClient.listBlobsFlat()) {
            blobs.push({
                name: blob.name,
                properties: {
                    contentMD5: blob.properties.contentMD5
                }
            });
        }
        return blobs;
    }

    async getBlobMd5Base64(containerClient: ContainerClient, blobPath: string): Promise<string | null> {
        try {
            const properties = await containerClient.getBlobClient(blobPath).getProperties();
            const contentMd5 = properties?.contentMD5;
            if (!contentMd5) {
                return null;
            }
            return Buffer.isBuffer(contentMd5) ? contentMd5.toString("base64") : null;
        } catch {
            return null;
        }
    }

    async uploadFile(containerClient: ContainerClient, blobPath: string, filePath: string, md5Base64: string | null, onProgress?: ProgressHandler): Promise<BlobUploadCommonResponse> {
        const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
        const md5Buffer = md5Base64 ? Buffer.from(md5Base64, "base64") : undefined;

        return await blockBlobClient.uploadFile(filePath, {
            blobHTTPHeaders: md5Buffer ? { blobContentMD5: md5Buffer } : undefined,
            onProgress
        });
    }

    async downloadToFile(containerClient: ContainerClient, blobPath: string, filePath: string, onProgress?: ProgressHandler): Promise<void> {
        const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
        await blockBlobClient.downloadToFile(filePath, 0, 0, { onProgress });
    }

    async deleteBlob(containerClient: ContainerClient, blobPath: string): Promise<void> {
        await containerClient.deleteBlob(blobPath);
    }
}


