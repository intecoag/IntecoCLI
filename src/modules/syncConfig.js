import prompts from "prompts";
import { mkdirSync, existsSync, readdirSync, rmSync } from "fs";
import path from "path";
import chalk from "chalk";
import { Config } from "../utils/config/config.js";
import { FS } from "../utils/fs/FS.js";

export default async function syncConfig() {
    console.log()

    const config = await Config.getConfig();

    const configDirectoriesEclipse = readdirSync(config.configIndividualPathEclipse, { withFileTypes: true }).filter(dirent => dirent.isDirectory()).map(dirent => { return { title: dirent.name } })

    const configDirectories = readdirSync(config.configIndividualPath, { withFileTypes: true }).filter(dirent => dirent.isDirectory()).map(dirent => { return { title: dirent.name } })

    let success = true;

    const responses = await prompts([
        {
            type: 'select',
            name: 'direction',
            message: 'Select Direction:',
            choices: [
                { title: 'Import ConfigIndividual (Repository → Work)', value: 'import' },
                { title: 'Export ConfigIndividual (Work → Repository)', value: 'export' },
                { title: 'Import Config (Repository → Work)', value: 'import_config' },
                { title: 'Export Config (Work → Repository)', value: 'export_config' },
            ]
        },
        {
            type: (prev) => (prev === 'import' || prev === 'export') ? 'autocomplete' : null,
            name: 'configNameSource',
            message: (prev, values) => values.direction === 'import'
                ? 'ConfigIndividual from Repository (Origin)?'
                : 'ConfigIndividual from Work (Origin)?',
            choices: (prev, values) => values.direction === 'import'
                ? configDirectoriesEclipse
                : configDirectories
        },
        {
            type: (prev, values) => (values.direction === 'import' || values.direction === 'export') ? 'autocomplete' : null,
            name: 'configNameTarget',
            message: (prev, values) => values.direction === 'import'
                ? 'ConfigIndividual in Work (Destination)?'
                : 'ConfigIndividual in Repository (Destination)?',
            choices: (prev, values) => values.direction === 'import'
                ? configDirectories
                : configDirectoriesEclipse,
            suggest: (input, choices) => {
                const filtered = choices.filter(choice =>
                    choice.title.toLowerCase().includes(input.toLowerCase())
                );
                if (input && !choices.some(c => c.title === input)) {
                    return [...filtered, { title: `Use custom name: "${input}"`, value: input }];
                }
                return filtered;
            }
        },
        {
            type: 'confirm',
            name: 'dryRun',
            message: 'Dry run? (show what would happen without making changes)',
            initial: false
        },
        {
            type: 'select',
            name: 'type',
            message: 'Sync Type?',
            choices: [
                { title: 'UPDATE', value: 'UPDATE' },
                { title: 'OVERWRITE', value: 'OVERWRITE' }
            ]
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
        console.log();
        let sourcePath, destPath;

        switch (responses.direction) {
            case 'import':
                sourcePath = path.join(config.configIndividualPathEclipse, responses.configNameSource);
                destPath = path.join(config.configIndividualPath, responses.configNameTarget);
                break;
            case 'export':
                sourcePath = path.join(config.configIndividualPath, responses.configNameSource);
                destPath = path.join(config.configIndividualPathEclipse, responses.configNameTarget);
                break;
            case 'import_config': {
                const sourceParent = path.resolve(config.configIndividualPathEclipse, '..');
                const destParent = path.resolve(config.configIndividualPath, '..');

                sourcePath = findConfigDirNamedConfigIn(sourceParent);
                destPath = findConfigDirNamedConfigIn(destParent);
                break;
            }

            case 'export_config': {
                const sourceParent = path.resolve(config.configIndividualPath, '..');
                const destParent = path.resolve(config.configIndividualPathEclipse, '..');

                sourcePath = findConfigDirNamedConfigIn(sourceParent);
                destPath = findConfigDirNamedConfigIn(destParent);
                break;
            }
        }

        const dryRun = responses.dryRun;
        let summary = {};

        switch (responses.type) {
            case 'UPDATE':
                console.log(chalk.yellow(`Updating files from ${sourcePath} → ${destPath}`));
                summary = { added: 0, updated: 0 };
                FS.copyUpdatedFiles(sourcePath, destPath, dryRun, summary);
                console.log();
                console.log(chalk.green(`Summary: ${summary.updated} files added or updated.`));
                break;

            case 'OVERWRITE':
                console.log(chalk.red(`Overwriting files from ${sourcePath} → ${destPath}`));

                let deletedCount = 0;
                if (existsSync(destPath)) {
                    deletedCount = countAndDeleteDir(destPath, dryRun);
                    if (!dryRun) {
                        console.log(chalk.gray(`Deleted existing folder: ${destPath}`));
                    }
                }

                if (!dryRun) {
                    mkdirSync(destPath, { recursive: true });
                } else {
                    console.log(chalk.gray(`[DryRun] Would create directory: ${destPath}`));
                }

                summary = { copied: 0 };
                FS.copyAllFiles(sourcePath, destPath, dryRun, summary);

                console.log();
                console.log(chalk.green(`Summary: Deleted ${deletedCount} items, Copied ${summary.copied} files.`));
                break;
        }

        console.log();
        if (dryRun) {
            console.log(chalk.yellow("Dry run complete — no changes were made."));
        } else {
            console.log(chalk.green("Config sync completed successfully."));
        }
        console.log();
    }



}

function countAndDeleteDir(dirPath, dryRun = false) {
    let deletedCount = 0;

    if (existsSync(dirPath)) {
        if (dryRun) {
            console.log(chalk.red(`[DryRun] Would delete directory: ${dirPath}`));
            // For dry run, recursively count files/directories without deleting
            const entries = readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const entryPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    deletedCount += countAndDeleteDir(entryPath, dryRun);
                } else {
                    deletedCount++;
                    console.log(chalk.red(`[DryRun] Would delete file: ${entryPath}`));
                }
            }
            deletedCount++; // counting the directory itself
        } else {
            rmSync(dirPath, { recursive: true, force: true });
            // Can't count after delete, so you may skip or count before if desired
        }
    }
    return deletedCount;
}

function findConfigDirNamedConfigIn(parentPath) {
    if (!parentPath || typeof parentPath !== 'string') {
        throw new Error('Invalid or undefined parent path');
    }

    const candidate = path.join(parentPath, 'config');
    if (existsSync(candidate)) {
        return candidate;
    }

    throw new Error(`No 'config/' directory found directly in ${parentPath}`);
}



