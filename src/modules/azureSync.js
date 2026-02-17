import chalk from "chalk";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import prompts from "prompts";
import YAML from "yaml";
import ora from "ora";
import { AzureHelper } from "../utils/azure/azure.js";

const defaultAccountName = "intecodev";

// Erstellt .az-sync Konfigurationsdatei im aktuellen Verzeichnis oder überschreibt sie, wenn sie bereits existiert
export async function azureCreateSyncConfig() {
    console.log()

    const configPath = path.join(process.cwd(), ".az-sync");
    let existingConfig = {};

    if (fs.existsSync(configPath)) {
        try {
            const rawConfig = fs.readFileSync(configPath, "utf-8");
            existingConfig = YAML.parse(rawConfig) ?? {};
        } catch (error) {
            console.log();
            console.log(chalk.red("Failed to read existing .az-sync file."));
            console.log(error?.message ?? error);
            console.log();
        }
    }

    const defaultincludes = Array.isArray(existingConfig.includes)
        ? existingConfig.includes.join(", ")
        : (existingConfig.includes ?? "");

    let success = true;

    const storageResponse = await prompts([
        {
            type: "text",
            name: "storageAccount",
            message: "Storage account?",
            initial: existingConfig.storageAccount ?? defaultAccountName
        }
    ], {
        onCancel: () => {
            console.log();
            console.log(chalk.red("Cancelled operation."));
            console.log();
            success = false;
        }
    });

    if (!success) {
        return;
    }

    const storageAccount = storageResponse.storageAccount ?? "";

    let containerChoices = [];
    if (storageAccount) {
        try {
            const azure = new AzureHelper();
            const containers = await azure.listContainers(storageAccount);
            containerChoices = containers.map(name => ({ title: name, value: name }));
        } catch (error) {
            console.log();
            console.log(chalk.yellow("Could not load containers. Falling back to manual input."));
            console.log(error?.message ?? error);
            console.log();
            containerChoices = [];
        }
    }

    const responses = await prompts([
        {
            type: containerChoices.length > 0 ? "autocomplete" : "text",
            name: "container",
            message: "Azure container?",
            choices: containerChoices,
            initial: existingConfig.container ?? ""
        },
        {
            type: "text",
            name: "includes",
            message: "File types (glob, comma-separated)?",
            initial: defaultincludes
        }
    ], {
        onCancel: () => {
            console.log();
            console.log(chalk.red("Cancelled operation."));
            console.log();
            success = false;
        }
    });

    if (!success) {
        return;
    }

    const includes = (responses.includes ?? "")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);

    const config = {
        storageAccount,
        container: responses.container ?? "",
        includes
    };

    fs.writeFileSync(configPath, YAML.stringify(config), "utf-8");
    console.log();
    console.log(chalk.green("Saved .az-sync configuration."));
    console.log();
}

// Push aller Änderungen von lokalen Dateien zu Azure basierend auf der .az-sync Konfiguration
// Löscht auch Dateien in Azure
export async function azurePush() {
    console.log()

    const syncState = await collectSyncState(process.cwd());

    if (!syncState || syncState.size === 0) {
        console.log(chalk.yellow("No files found to sync."));
        console.log();
        return;
    }

    const azure = new AzureHelper();
    const operations = await buildPushOperations(syncState, azure);
    await executeOperations("push", operations);
}

// Pull aller Änderungen von Azure zu lokalen Dateien basierend auf der .az-sync Konfiguration
// Löscht keine Dateien lokal
export async function azurePull() {
    console.log()

    const syncState = await collectSyncState(process.cwd());

    if (!syncState || syncState.size === 0) {
        console.log(chalk.yellow("No files found to sync."));
        console.log();
        return;
    }

    const azure = new AzureHelper();
    const operations = await buildPullOperations(syncState, azure);
    await executeOperations("pull", operations);
}

async function collectSyncState(startDir) {
    const state = new Map();
    await walkSyncTree(startDir, null, null, state);
    return state;
}

async function walkSyncTree(currentDir, activeConfig, activeRootDir, state) {
    const configPath = path.join(currentDir, ".az-sync");

    if (fs.existsSync(configPath)) {
        const loadedConfig = loadSyncConfig(configPath);
        if (loadedConfig) {
            activeConfig = loadedConfig;
            activeRootDir = currentDir;
        }
    }

    if (activeConfig && activeRootDir) {
        const key = activeConfig.configPath;
        if (!state.has(key)) {
            state.set(key, {
                config: activeConfig,
                rootDir: activeRootDir,
                localFiles: new Map()
            });
        }
    }

    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name === ".git" || entry.name === "node_modules") {
            continue;
        }

        const entryPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
            await walkSyncTree(entryPath, activeConfig, activeRootDir, state);
            continue;
        }

        if (!entry.isFile() || entry.name === ".az-sync") {
            continue;
        }

        if (!activeConfig || !activeRootDir) {
            continue;
        }

        const relativePath = path.relative(activeRootDir, entryPath);
        if (!matchesGlob(relativePath, activeConfig.includes)) {
            continue;
        }

        if (!activeConfig.storageAccount || !activeConfig.container) {
            continue;
        }

        const key = activeConfig.configPath;
        const entryState = state.get(key);
        if (!entryState) {
            continue;
        }

        const fileStats = await fs.promises.stat(entryPath);

        entryState.localFiles.set(relativePath.split(path.sep).join("/"), {
            filePath: entryPath,
            relativePath,
            blobPath: relativePath.split(path.sep).join("/"),
            mtimeMs: fileStats.mtimeMs,
            size: fileStats.size
        });
    }
}

function loadSyncConfig(configPath) {
    try {
        const rawConfig = fs.readFileSync(configPath, "utf-8");
        const parsedConfig = YAML.parse(rawConfig) ?? {};
        const includes = Array.isArray(parsedConfig.includes)
            ? parsedConfig.includes
            : (parsedConfig.includes ? [parsedConfig.includes] : []);
        const legacyIncludes = Array.isArray(parsedConfig.fileTypeRegexes)
            ? parsedConfig.fileTypeRegexes
            : (parsedConfig.fileTypeRegexes ? [parsedConfig.fileTypeRegexes] : []);
        const mergedIncludes = includes.length > 0 ? includes : legacyIncludes;

        return {
            storageAccount: parsedConfig.storageAccount ?? "",
            container: parsedConfig.container ?? "",
            includes: mergedIncludes,
            configPath
        };
    } catch (error) {
        console.log();
        console.log(chalk.red(`Failed to read ${configPath}.`));
        console.log(error?.message ?? error);
        console.log();
        return null;
    }
}

function matchesGlob(relativePath, globList) {
    if (!Array.isArray(globList) || globList.length === 0) {
        return false;
    }

    const normalizedPath = relativePath.split(path.sep).join("/");

    for (const pattern of globList) {
        try {
            const regex = globToRegExp(pattern);
            if (regex.test(normalizedPath)) {
                return true;
            }
        } catch (error) {
            continue;
        }
    }

    return false;
}

function globToRegExp(pattern) {
    const normalizedPattern = pattern.split(path.sep).join("/").trim();
    let regexBody = "";
    let index = 0;

    while (index < normalizedPattern.length) {
        const char = normalizedPattern[index];

        if (char === "*") {
            const nextChar = normalizedPattern[index + 1];
            if (nextChar === "*") {
                const isSlash = normalizedPattern[index + 2] === "/";
                regexBody += isSlash ? "(?:.*/)?" : ".*";
                index += isSlash ? 3 : 2;
                continue;
            }

            regexBody += "[^/]*";
            index += 1;
            continue;
        }

        if (char === "?") {
            regexBody += "[^/]";
            index += 1;
            continue;
        }

        regexBody += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        index += 1;
    }

    return new RegExp(`^${regexBody}$`);
}

async function ensureDirectory(dirPath) {
    if (!dirPath) {
        return;
    }

    await fs.promises.mkdir(dirPath, { recursive: true });
}

async function executeOperations(mode, operations) {
    if (operations.length === 0) {
        console.log(chalk.yellow("No changes detected."));
        console.log();
        return;
    }

    const uploadOps = operations.filter(operation => operation.type === "upload");
    const downloadOps = operations.filter(operation => operation.type === "download");
    const deleteOps = operations.filter(operation => operation.type === "delete");

    console.log(chalk.gray(`Planned ${mode} changes: ${operations.length} total (${uploadOps.length} upload, ${downloadOps.length} download, ${deleteOps.length} delete)`));
    operations.forEach(operation => {
        const name = operation.localFile?.relativePath ?? operation.blobPath;
        console.log(chalk.gray(`- ${operation.type}: ${name}`));
    });
    console.log();

    const confirmation = await prompts([
        {
            type: "confirm",
            name: "proceed",
            message: `Apply ${operations.length} ${mode} changes?`,
            initial: false
        }
    ], {
        onCancel: () => {
            console.log();
            console.log(chalk.red("Cancelled operation."));
            console.log();
            return false;
        }
    });

    if (!confirmation.proceed) {
        console.log(chalk.yellow("No changes applied."));
        console.log();
        return;
    }

    const spinner = ora(`Syncing ${operations.length} changes...`).start();
    const failures = [];

    for (let index = 0; index < operations.length; index += 1) {
        const operation = operations[index];
        try {
            if (operation.type === "upload") {
                const totalBytes = operation.localFile.size ?? null;
                spinner.text = `Uploading ${operation.localFile.relativePath} (${index + 1}/${operations.length})`;
                const md5Base64 = operation.localFile.md5Base64
                    ?? await getLocalMd5Base64(operation.localFile.filePath);
                await operation.azure.uploadFile(
                    operation.containerClient,
                    operation.localFile.blobPath,
                    operation.localFile.filePath,
                    md5Base64,
                    progress => {
                        if (!totalBytes) {
                            return;
                        }
                        const percent = ((progress.loadedBytes / totalBytes) * 100).toFixed(1);
                        spinner.text = `Uploading ${operation.localFile.relativePath} ${percent}% (${formatBytes(progress.loadedBytes)}/${formatBytes(totalBytes)})`;
                    }
                );
            } else if (operation.type === "download") {
                const totalBytes = operation.localFile.size ?? null;
                spinner.text = `Downloading ${operation.localFile.relativePath} (${index + 1}/${operations.length})`;
                await ensureDirectory(path.dirname(operation.localFile.filePath));
                await operation.azure.downloadToFile(
                    operation.containerClient,
                    operation.localFile.blobPath,
                    operation.localFile.filePath,
                    progress => {
                        if (!totalBytes) {
                            return;
                        }
                        const percent = ((progress.loadedBytes / totalBytes) * 100).toFixed(1);
                        spinner.text = `Downloading ${operation.localFile.relativePath} ${percent}% (${formatBytes(progress.loadedBytes)}/${formatBytes(totalBytes)})`;
                    }
                );
            } else if (operation.type === "delete") {
                spinner.text = `Deleting ${operation.blobPath} (${index + 1}/${operations.length})`;
                await operation.azure.deleteBlob(operation.containerClient, operation.blobPath);
            }
        } catch (error) {
            failures.push({ operation, error });
            spinner.warn(`Failed ${operation.type}: ${operation.localFile?.relativePath ?? operation.blobPath}`);
            spinner.start();
        }
    }

    if (failures.length > 0) {
        spinner.warn(`Completed with ${failures.length} failures.`);
        failures.forEach(({ operation, error }) => {
            const name = operation.localFile?.relativePath ?? operation.blobPath;
            console.log(chalk.red(`- ${name}: ${error?.message ?? error}`));
        });
    } else {
        spinner.succeed(`Synced ${operations.length} changes.`);
    }

    console.log();
}

async function getLocalMd5Base64(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash("md5");
        const stream = fs.createReadStream(filePath);

        stream.on("data", chunk => hash.update(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(hash.digest("base64")));
    });
}

async function buildPushOperations(syncState, azure) {
    const operations = [];

    for (const entry of syncState.values()) {
        if (!validateConfig(entry.config)) {
            continue;
        }

        const containerClient = azure.getContainerClient(entry.config.storageAccount, entry.config.container);
        const remoteBlobs = await listRemoteBlobNames(containerClient, entry.config.includes);

        for (const localFile of entry.localFiles.values()) {
            const existsRemote = remoteBlobs.has(localFile.blobPath);

            if (!existsRemote) {
                operations.push({
                    type: "upload",
                    azure,
                    containerClient,
                    localFile
                });
                continue;
            }

            const remoteHash = await azure.getBlobMd5Base64(containerClient, localFile.blobPath);
            const localHash = await getLocalMd5Base64(localFile.filePath);

            if (!remoteHash || !localHash || remoteHash !== localHash) {
                localFile.md5Base64 = localHash;
                operations.push({
                    type: "upload",
                    azure,
                    containerClient,
                    localFile
                });
            }

            remoteBlobs.delete(localFile.blobPath);
        }

        for (const blobName of remoteBlobs.values()) {
            operations.push({
                type: "delete",
                azure,
                containerClient,
                blobPath: blobName
            });
        }
    }

    return operations;
}

async function buildPullOperations(syncState, azure) {
    const operations = [];

    for (const entry of syncState.values()) {
        if (!validateConfig(entry.config)) {
            continue;
        }

        const containerClient = azure.getContainerClient(entry.config.storageAccount, entry.config.container);
        const blobs = await azure.listBlobs(containerClient);

        for (const blob of blobs) {
            if (!matchesGlob(blob.name, entry.config.includes)) {
                continue;
            }

            const localPath = path.join(entry.rootDir, blob.name.split("/").join(path.sep));
            const localExists = fs.existsSync(localPath);
            const remoteHash = await azure.getBlobMd5Base64(containerClient, blob.name);
            let localHash = null;

            if (localExists) {
                localHash = await getLocalMd5Base64(localPath);
            }

            if (!remoteHash || !localHash || remoteHash !== localHash) {
                operations.push({
                    type: "download",
                    azure,
                    containerClient,
                    localFile: {
                        filePath: localPath,
                        relativePath: path.relative(entry.rootDir, localPath),
                        blobPath: blob.name,
                        size: blob.properties?.contentLength ?? null
                    }
                });
            }
        }
    }

    return operations;
}

function validateConfig(config) {
    if (!config.storageAccount || !config.container) {
        console.log(chalk.yellow(`Skipping config at ${config.configPath} (missing storage account or container).`));
        return false;
    }

    if (!config.includes || config.includes.length === 0) {
        console.log(chalk.yellow(`Skipping config at ${config.configPath} (no includes configured).`));
        return false;
    }

    return true;
}

async function listRemoteBlobNames(containerClient, includes) {
    const remoteBlobs = new Set();
    for await (const blob of containerClient.listBlobsFlat()) {
        if (!matchesGlob(blob.name, includes)) {
            continue;
        }
        remoteBlobs.add(blob.name);
    }
    return remoteBlobs;
}

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) {
        return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}