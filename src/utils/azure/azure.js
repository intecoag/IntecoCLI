import { BlobServiceClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

export class AzureHelper {
    constructor(credential = new DefaultAzureCredential()) {
        this.credential = credential;
        this.clientCache = new Map();
    }

    getContainerClient(storageAccount, container) {
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

    async listContainers(storageAccount) {
        const blobServiceClient = new BlobServiceClient(
            `https://${storageAccount}.blob.core.windows.net`,
            this.credential
        );
        const containers = [];
        for await (const container of blobServiceClient.listContainers()) {
            containers.push(container.name);
        }
        return containers;
    }

    async listBlobs(containerClient) {
        const blobs = [];
        for await (const blob of containerClient.listBlobsFlat()) {
            blobs.push(blob);
        }
        return blobs;
    }

    async getBlobMd5Base64(containerClient, blobPath) {
        try {
            const properties = await containerClient.getBlobClient(blobPath).getProperties();
            const contentMd5 = properties?.contentMD5;
            if (!contentMd5) {
                return null;
            }
            return Buffer.isBuffer(contentMd5) ? contentMd5.toString("base64") : null;
        } catch (error) {
            return null;
        }
    }

    async uploadFile(containerClient, blobPath, filePath, md5Base64) {
        const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
        const md5Buffer = md5Base64 ? Buffer.from(md5Base64, "base64") : undefined;

        await blockBlobClient.uploadFile(filePath, {
            blobHTTPHeaders: md5Buffer ? { blobContentMD5: md5Buffer } : undefined
        });
    }

    async downloadToFile(containerClient, blobPath, filePath) {
        const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
        await blockBlobClient.downloadToFile(filePath);
    }

    async deleteBlob(containerClient, blobPath) {
        await containerClient.deleteBlob(blobPath);
    }
}
