import { statSync, mkdirSync, existsSync, copyFileSync, readdirSync } from "fs";
import chalk from "chalk";
import path, { relative } from "path";
import prompts from "prompts";

export class FS {
    static copyUpdatedFiles(sourceDir, destDir, dryRun = false, stats = { added: 0, updated: 0 }, filenameBlacklist = [], onlyCopyNonExistant = false) {
        if (!existsSync(destDir)) {
            if (dryRun) {
                console.log(chalk.gray(`[DryRun] Would create directory: ${destDir}`));
            } else {
                mkdirSync(destDir, { recursive: true });
            }
        }

        const entries = readdirSync(sourceDir, { withFileTypes: true });

        for (const entry of entries) {
            if(filenameBlacklist.includes(entry.name)) {
                continue;
            }

            const sourcePath = path.join(sourceDir, entry.name);
            const destPath = path.join(destDir, entry.name);

            if (entry.isDirectory()) {
                FS.copyUpdatedFiles(sourcePath, destPath, dryRun, stats, filenameBlacklist);
            } else {
                let shouldCopy = false;

                if (!existsSync(destPath)) {
                    shouldCopy = true;
                } else if(!onlyCopyNonExistant) {
                    const sourceStat = statSync(sourcePath);
                    const destStat = statSync(destPath);

                    if (sourceStat.mtime > destStat.mtime) {
                        shouldCopy = true;
                    }
                }

                if (shouldCopy) {
                    if (dryRun) {
                        console.log(chalk.blue(`[DryRun] Would update file: ${destPath}`));
                    } else {
                        copyFileSync(sourcePath, destPath);
                    }
                    stats.updated++;
                }
            }
        }
    }


    static copyAllFiles(sourceDir, destDir, dryRun = false, stats = { copied: 0 }, filenameBlacklist = []) {
        if (!existsSync(destDir)) {
            if (dryRun) {
                console.log(chalk.gray(`[DryRun] Would create directory: ${destDir}`));
            } else {
                mkdirSync(destDir, { recursive: true });
            }
        }

        const entries = readdirSync(sourceDir, { withFileTypes: true });

        for (const entry of entries) {
            if(filenameBlacklist.includes(entry.name)) {
                continue;
            }

            const sourcePath = path.join(sourceDir, entry.name);
            const destPath = path.join(destDir, entry.name);

            if (entry.isDirectory()) {
                FS.copyAllFiles(sourcePath, destPath, dryRun, stats, filenameBlacklist);
            } else {
                if (dryRun) {
                    console.log(chalk.magenta(`[DryRun] Would copy file: ${destPath}`));
                } else {
                    copyFileSync(sourcePath, destPath);
                }
                stats.copied++;
            }
        }
    }

    
    static async filePicker(startDir = process.cwd(), navRootDir = process.cwd()) {
        let current = startDir;
    
        while(true) {
            const entries = readdirSync(current, { withFileTypes: true });
    
            const choices = [
                { title: '[Dir] .  (Select Current Directory)', value: '.', isDirectory: true },
                ...entries.map(e => ({
                    title: e.isDirectory() ? `${e.name} [Dir]` : e.name,
                    value: e.name,
                    isDirectory: e.isDirectory()
                })).sort((a, b) => a.isDirectory && !b.isDirectory ? -1 : (!a.isDirectory && b.isDirectory ? 1 : a.value.localeCompare(b.value)))
            ]
    
            if(path.relative(navRootDir, current) !== "") {
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
                if(dir === ".") return FS.getAllFiles(current).map(e => path.relative(navRootDir, e));
                current = dir === ".." ? path.dirname(current) : path.join(current, dir);
            }
            else {
                return [path.relative(navRootDir, path.join(current, picked.value))];
            }
        }
    }

    static getAllFiles(dir) {
        const entries = readdirSync(dir, { withFileTypes: true });
        const files = [];

        for(const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if(entry.isDirectory()) {
                files.push(...FS.getAllFiles(fullPath));
            }
            else {
                files.push(fullPath);
            }
        }

        return files;
    }
}