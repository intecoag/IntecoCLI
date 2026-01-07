import prompts from "prompts";
import path, { relative } from "path";
import chalk from "chalk";
import { Config } from "../utils/config/config.js";
import FS from "fs"
import YAML from "yaml";
import { YAMLMap, YAMLSeq } from "yaml/types";
import fg from "fast-glob";

export default async function mutateConfig() {
    console.log()

    const config = await Config.getConfig();

    let success = true;

    const responses = await prompts([
        {
            type: 'select',
            name: 'mergeType',
            message: 'Select Merge Type:',
            choices: [
                { title: 'Only Create missing Keys', value: 'only_create' } /*,
                { title: 'Create, Update and Overwrite Keys', value: 'create_update_overwrite' },
                { title: 'Remove missing Keys', value: 'remove_missing' },
                { title: 'Sync Config with ConfigIndividual', value: 'sync_with_individual' }*/
            ]
        },
        {
            type: 'toggle',
            name: 'mergeClients',
            message: 'Merge Clients?',
            active: false
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
        const files = await filePicker(path.join(path.dirname(config.configIndividualPathEclipse), "config", "yaml"), path.join(path.dirname(config.configIndividualPathEclipse), "config", "yaml"));

        switch (responses.mergeType) {
            case 'only_create':
                await processAddMissing(files, config.configIndividualPathEclipse, responses.mergeClients, responses.dryRun);
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
                        await processAddMissing(files, config.configIndividualPathEclipse, responses.mergeClients, false);
                        break;
                }
            }
        }
        console.log();
    }
}

async function processAddMissing(filesToUpdate, configIndividualPathEclipse, mergeClients, dryRun) {
    processEachFile(filesToUpdate, configIndividualPathEclipse, mergeClients, dryRun, addMissingInFile);
}

async function processEachFile(filesToUpdate, configIndividualPathEclipse, mergeClients, dryRun, processAction) {
    let updatedFiles = 0;
    const globalConfig = path.join(path.dirname(configIndividualPathEclipse), "config");
    for(const file of filesToUpdate) {
        const individualConfigs = FS.readdirSync(configIndividualPathEclipse, { withFileTypes: true });

        for(const c of individualConfigs) {
            if(!c.isDirectory()) continue;
            const individualConfigPath = path.join(configIndividualPathEclipse, c.name, "yaml", file);

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

function addMissingInFile(compareFrom, compareTo, dryRun) {
    try {
        if(!FS.existsSync(compareFrom) || !FS.existsSync(compareTo)) return;
        const fromDocument = YAML.parseDocument(FS.readFileSync(compareFrom, "utf-8"));
        const toDocument = YAML.parseDocument(FS.readFileSync(compareTo, "utf-8"));
        
        const hasChanges = addMissingNodes(fromDocument.contents, toDocument.contents);
        const resultText = toDocument.toString();
        

        if(hasChanges) {
            if(dryRun) {
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

async function getRelatedConfigs(file, withClients) {
    if(!withClients) return [file];

    const dir = path.dirname(file);
    const ext = path.extname(file);
    const name = path.basename(file, ext);

    let patterns = [
        path.join(dir, `${name}${ext}`),        // name.yaml
        path.join(dir, `*_${name}${ext}`)       // *_name.yaml (für mandanten)
    ];

    patterns = patterns.map(p => p.replaceAll(path.sep, '/'));

    return (await fg(patterns, {
        onlyFiles: true,
        unique: true
    })).map(f => f.replaceAll('/', path.sep));
}

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
                title: e.isDirectory() ? `[Dir] ${e.name}` : e.name,
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