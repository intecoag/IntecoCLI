import { statSync, mkdirSync, existsSync, copyFileSync, readdirSync } from "fs";
import chalk from "chalk";
import path from "path";


export class FS {
    static copyUpdatedFiles(sourceDir, destDir, dryRun = false, stats = { added: 0, updated: 0 }) {
        if (!existsSync(destDir)) {
            if (dryRun) {
                console.log(chalk.gray(`[DryRun] Would create directory: ${destDir}`));
            } else {
                mkdirSync(destDir, { recursive: true });
            }
        }

        const entries = readdirSync(sourceDir, { withFileTypes: true });

        for (const entry of entries) {
            const sourcePath = path.join(sourceDir, entry.name);
            const destPath = path.join(destDir, entry.name);

            if (entry.isDirectory()) {
                FS.copyUpdatedFiles(sourcePath, destPath, dryRun, stats);
            } else {
                let shouldCopy = false;

                if (!existsSync(destPath)) {
                    shouldCopy = true;
                } else {
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


    static copyAllFiles(sourceDir, destDir, dryRun = false, stats = { copied: 0 }) {
        if (!existsSync(destDir)) {
            if (dryRun) {
                console.log(chalk.gray(`[DryRun] Would create directory: ${destDir}`));
            } else {
                mkdirSync(destDir, { recursive: true });
            }
        }

        const entries = readdirSync(sourceDir, { withFileTypes: true });

        for (const entry of entries) {
            const sourcePath = path.join(sourceDir, entry.name);
            const destPath = path.join(destDir, entry.name);

            if (entry.isDirectory()) {
                FS.copyAllFiles(sourcePath, destPath, dryRun, stats);
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


}