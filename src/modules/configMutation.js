import prompts from "prompts";
import path, { relative } from "path";
import chalk from "chalk";
import { Config } from "../utils/config/config.js";
import FS from "fs"
import YAML from "yaml";
import { YAMLMap, YAMLSeq } from "yaml";
import fg from "fast-glob";

export default async function mutateConfig() {
    console.log()

    const config = await Config.getConfig();
    const configDirectories = [
        { title: '[Update all]', value: '*' },
        ...FS.readdirSync(config.configIndividualPath, { withFileTypes: true }).filter(dirent => dirent.isDirectory()).map(dirent => { return { title: dirent.name, value: dirent.name } })
    ]

    let success = true;

    const responses = await prompts([
        {
            type: 'select',
            name: 'mergeType',
            message: 'Select Merge Type:',
            choices: [
                { title: 'Only Create missing Keys (add missing keys from source to target)', value: 'only_create' },
                { title: 'Create, Update and Overwrite Keys (copy everything except keys that only exist in target)', value: 'create_update_overwrite' },
                { title: 'Remove missing Keys (remove all keys from target that don\'t exist in source)', value: 'remove_missing' }
            ]
        },
        {
            type: 'toggle',
            name: 'mergeClients',
            message: 'Include Mand? (Apply changes to 1_, 2_, ...)',
            active: false
        },
        {
            type: 'autocomplete',
            name: 'configDest',
            message: 'Update Target?',
            choices: configDirectories
        },
        {
            type: 'toggle',
            name: 'dryRun',
            message: 'Dry run? (show what would happen without making changes)',
            initial: false,
            active: 'yes',
            inactive: 'no'
        }
    ], {
        onCancel: () => {
            console.log();
            console.log(chalk.red("Cancelled Operation!"));
            console.log();
            success = false;
        }
    });


    if (success) {
        const sourceConfigs = await filePicker(path.join(path.dirname(config.configIndividualPathEclipse), "config", "yaml"),
            path.join(path.dirname(config.configIndividualPathEclipse), "config", "yaml"));

        const configsToUpdate = responses.configDest == '*'
            ? FS.readdirSync(config.configIndividualPath, { withFileTypes: true }).filter(f => f.isDirectory()).map(f => f.name)
            : [responses.configDest];

        switch (responses.mergeType) {
            case 'only_create':
                await processAddMissing(sourceConfigs, config.configIndividualPathEclipse, configsToUpdate, responses.mergeClients, responses.dryRun);
                break;
            case 'remove_missing':
                await processRemoveMissing(sourceConfigs, config.configIndividualPathEclipse, configsToUpdate, responses.mergeClients, responses.dryRun);
                break;
            case 'create_update_overwrite':
                await processMergeOverwrite(sourceConfigs, config.configIndividualPathEclipse, configsToUpdate, responses.mergeClients, responses.dryRun);
                break;
        }

        if (responses.dryRun) {
            console.log()
            const confirmationResults = await prompts([
                {
                    type: 'confirm',
                    name: 'confirmation',
                    message: 'Would you like to execute the dry-run?',
                    initial: true
                }
            ], {
                onCancel: () => {
                    console.log();
                    console.log(chalk.red("Cancelled Operation!"));
                    console.log();
                    success = false;
                }
            })

            if(confirmationResults.confirmation){
                switch (responses.mergeType) {
                    case 'only_create':
                        await processAddMissing(sourceConfigs, config.configIndividualPathEclipse, configsToUpdate, responses.mergeClients, false);
                        break;
                    case 'remove_missing':
                        await processRemoveMissing(sourceConfigs, config.configIndividualPathEclipse, configsToUpdate, responses.mergeClients, false);
                        break;
                    case 'create_update_overwrite':
                        await processMergeOverwrite(sourceConfigs, config.configIndividualPathEclipse, configsToUpdate, responses.mergeClients, false);
                        break;
                }
            }
        }
        console.log();
    }
}

async function processMergeOverwrite(filesToUpdate, configIndividualPathEclipse, configsToUpdate, mergeClients, dryRun) {
    await processInEachFile(filesToUpdate, configIndividualPathEclipse,
        configsToUpdate, mergeClients, dryRun, mergeOverwriteNodes);
}

async function processRemoveMissing(filesToUpdate, configIndividualPathEclipse, configsToUpdate, mergeClients, dryRun) {
    await processInEachFile(filesToUpdate, configIndividualPathEclipse,
        configsToUpdate, mergeClients, dryRun, removeMissingNodes);
}

async function processAddMissing(filesToUpdate, configIndividualPathEclipse, configsToUpdate, mergeClients, dryRun) {
    await processInEachFile(filesToUpdate, configIndividualPathEclipse,
        configsToUpdate, mergeClients, dryRun, addMissingNodes);
}

async function processEachFile(filesToUpdate, configIndividualPathEclipse, configsToUpdate, mergeClients, dryRun, processAction) {
    let updatedFiles = 0;
    const globalConfig = path.join(path.dirname(configIndividualPathEclipse), "config");
    for(const file of filesToUpdate) {
        for(const c of configsToUpdate) {
            const individualConfigPath = path.join(configIndividualPathEclipse, c, "yaml", file);
            const relatedConfigsForFile = await getRelatedConfigs(individualConfigPath, mergeClients);
            for(const config of relatedConfigsForFile) {
                const hasUpdates = processAction(path.join(globalConfig, "yaml", file), config, dryRun);
                if(hasUpdates) updatedFiles++;
            }
        }
    }

    console.log();
    console.log(chalk.green(`Summary: Updated ${updatedFiles} files.`));
    if (dryRun) {
        console.log(chalk.yellow("Dry run complete — no changes were made."));
    } else {
        console.log(chalk.green("Config mutate completed successfully."));
    }
}

// Loop through each file in filesToUpdate and executes processAction
async function processInEachFile(filesToUpdate, configIndividualPathEclipse, configsToUpdate, mergeClients, dryRun, processAction) {
    return await processEachFile(filesToUpdate, configIndividualPathEclipse,
        configsToUpdate, mergeClients, dryRun,
        (globalConfig, individualConfig, dryRun) => processInFile(globalConfig, individualConfig, dryRun, processAction));
}

// Executes processAction for a yaml config file
function processInFile(compareFrom, compareTo, dryRun, processAction) {
    try {
        if(!FS.existsSync(compareFrom) || !FS.existsSync(compareTo)) return;
        const fromDocument = YAML.parseDocument(FS.readFileSync(compareFrom, "utf-8"));
        const toDocument = YAML.parseDocument(FS.readFileSync(compareTo, "utf-8"));
        
        const hasChanges = processAction(fromDocument.contents, toDocument.contents);
        const resultText = toDocument.toString();
        

        if(hasChanges) {
            if(dryRun) {
                console.debug(chalk.gray(`[Debug] From file ${compareFrom}`));
                console.log(chalk.green(`[DryRun] Would Update file: ${compareTo}`));
            }
            else {
                console.log(chalk.green(`Updating file ${compareTo}`));
                FS.writeFileSync(compareTo, resultText);
            }
        }
        return hasChanges;
    }
    catch(error) {
        if(dryRun) {
            console.log(chalk.red(`[DryRun] Error in file: ${compareFrom} <-> ${compareTo}: ${error.message}`));
        }
        else {
            console.log(chalk.red(`Could not update file ${compareFrom} <-> ${compareTo}: ${error.message}`));
        }
        return false;
    }
}

// Returns related configs for a base config file (config.yaml, 1_config.yaml, 2_config.yaml, ...)
async function getRelatedConfigs(file, withClients) {
    const dir = path.dirname(file);
    const ext = path.extname(file);
    const name = path.basename(file, ext);

    let patterns = [
        path.join(dir, `${name}${ext}`), // name.yaml
    ];

    if(withClients)
        patterns.push(path.join(dir, `*_${name}${ext}`)); // *_name.yaml (für mandanten)

    patterns = patterns.map(p => p.replaceAll(path.sep, '/'));

    return (await fg(patterns, {
        onlyFiles: true,
        unique: true
    })).map(f => f.replaceAll('/', path.sep));
}

// only_create
function addMissingNodes(fromNode, toNode) {
    let hasChanges = false;

    if (!fromNode || !toNode) return;

    if (fromNode instanceof YAMLMap && toNode instanceof YAMLMap) {
        for (const pair of fromNode.items) {
            const keyNode = pair.key;
            const fromVal = pair.value;

            if (!toNode.has(keyNode)) {
                toNode.items.push(pair);
                hasChanges = true;
                continue;
            }

            const toVal = toNode.get(keyNode, true);
            hasChanges |= addMissingNodes(fromVal, toVal);
        }
        return hasChanges;
    }

    if (fromNode instanceof YAMLSeq && toNode instanceof YAMLSeq) {
        for (const fromItem of fromNode.items) {
            const fromJson = nodeToJs(fromItem);
            let exists = false;

            for (const toItem of toNode.items) {
                if (deepEqual(fromJson, nodeToJs(toItem))) {
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                toNode.items.push(fromItem);
                hasChanges = true;
            }
        }
        return hasChanges;
    }
}

// remove_missing
function removeMissingNodes(fromNode, toNode) {
    let hasChanges = false;

    if (!fromNode || !toNode) return false;

    if (fromNode instanceof YAMLMap && toNode instanceof YAMLMap) {
        for (let i = toNode.items.length - 1; i >= 0; i--) {
            const toPair = toNode.items[i];
            const keyNode = toPair.key;

            if (!fromNode.has(keyNode)) {
                toNode.items.splice(i, 1);
                hasChanges = true;
                continue;
            }

            const fromVal = fromNode.get(keyNode, true);
            hasChanges |= removeMissingNodes(fromVal, toPair.value);
        }
        return hasChanges;
    }

    if (fromNode instanceof YAMLSeq && toNode instanceof YAMLSeq) {
        for (let i = toNode.items.length - 1; i >= 0; i--) {
            const toItem = toNode.items[i];
            const toJson = nodeToJs(toItem);

            let exists = false;
            for (const fromItem of fromNode.items) {
                if (deepEqual(toJson, nodeToJs(fromItem))) {
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                toNode.items.splice(i, 1);
                hasChanges = true;
            }
        }
        return hasChanges;
    }

    return false;
}

// create_update_overwrite
function mergeOverwriteNodes(fromNode, toNode) {
    let hasChanges = false;

    if (!fromNode || !toNode) return false;

    if (fromNode instanceof YAMLMap && toNode instanceof YAMLMap) {
        for (const fromPair of fromNode.items) {
            const keyNode = fromPair.key;
            const fromVal = fromPair.value;

            if (!toNode.has(keyNode)) {
                toNode.items.push(fromPair);
                hasChanges = true;
                continue;
            }

            const toVal = toNode.get(keyNode, true);

            if (
                fromVal?.constructor === toVal?.constructor &&
                (fromVal instanceof YAMLMap || fromVal instanceof YAMLSeq)
            ) {
                hasChanges |= mergeOverwriteNodes(fromVal, toVal);
            } else {
                toNode.set(keyNode, fromVal);
                hasChanges = true;
            }
        }
        return hasChanges;
    }

    if (fromNode instanceof YAMLSeq && toNode instanceof YAMLSeq) {
        toNode.items = [...fromNode.items];
        return true;
    }

    return false;
}


function nodeToJs(node) {
    return node && typeof node.toJSON === "function"
        ? node.toJSON()
        : node;
}

function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}


async function filePicker(startDir = process.cwd(), navRootDir = process.cwd()) {
    let current = startDir;

    while(true) {
        const entries = FS.readdirSync(current, { withFileTypes: true });

        const choices = [
            { title: '[Dir] .  (Select Current Directory)', value: '.', isDirectory: true },
            ...entries.map(e => ({
                title: e.isDirectory() ? `${e.name} [Dir]` : e.name,
                value: e.name,
                isDirectory: e.isDirectory()
            })).sort((a, b) => a.isDirectory && !b.isDirectory ? -1 : (!a.isDirectory && b.isDirectory ? 1 : a.value.localeCompare(b.value)))
        ]

        if(toRelative(navRootDir, current) !== "") {
            choices.unshift({ title: '[Dir] .. (Go Up one Directory)', value: '..', isDirectory: true });
        }

        const { file } = await prompts({
            type: 'autocomplete',
            name: "file",
            message: `Pick Files: ${current}`,
            choices
        });

        const picked = choices.find(c => c.value === file);

        if(picked.isDirectory) {
            const dir = picked.value;
            if(dir === ".") return getAllFiles(current).map(e => toRelative(navRootDir, e));
            current = dir === ".." ? path.dirname(current) : path.join(current, dir);
        }
        else {
            return [toRelative(navRootDir, path.join(current, picked.value))];
        }
    }
}

function toRelative(root, absolute) {
    const rel = path.relative(root, absolute);
    return rel;
}

function getAllFiles(dir) {
    const entries = FS.readdirSync(dir, { withFileTypes: true });
    const files = [];

    for(const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if(entry.isDirectory()) {
            files.push(...getAllFiles(fullPath));
        }
        else {
            files.push(fullPath);
        }
    }

    return files;
}