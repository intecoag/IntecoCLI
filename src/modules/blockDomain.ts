import chalk from "chalk";
import prompts from "prompts";
import { Config } from "../utils/config/config.js";
import { DB } from "../utils/db/DB.js";
import { readFile } from "fs/promises";
import { spawn } from "child_process";

export default async function blockDomain(_cli: unknown): Promise<void> {
    let success = true;

    const promptOptions = {
        onCancel: () => {
            console.log();
            console.log(chalk.red("Cancelled operation!"));
            console.log();
            success = false;
        }
    };

    const actionTypeResponse = await prompts({
        // DB-Auswahl von DB
        type: 'select',
        name: 'actionType',
        message: 'What do you want to do?',
        choices: [
            { value: 'blockDomain', title: 'Block Domain' },
            { value: 'unblockDomain', title: 'Unblock Domain' },
        ]
    }, promptOptions);

    if(!success)
        return;

    const hostFile = await readHostFile();

    const hostFileLines = hostFile.split('\n');

    if(actionTypeResponse.actionType === 'blockDomain') {
        const domainResponse = await prompts({
            type: 'text',
            name: 'domain',
            message: 'Enter the domain to block:'
        }, promptOptions);

        if(!success)
            return;

        hostFileLines.push(`0.0.0.0 ${domainResponse.domain}`);
        if(await writeHostFile(hostFileLines.join('\n'))) {
            console.log(chalk.green("Domain blocked. Please restart your browser"));
        }
        else {
            console.log(chalk.red("Failed to block domain."));
        }
    }
    else if(actionTypeResponse.actionType === 'unblockDomain') {
        const blockedDomains = hostFileLines.map((line, number) => ({ line: line, number: number }))
            .filter(lineObj => lineObj.line.startsWith("0.0.0.0"))
            .map(lineObj => ({ title: lineObj.line, value: lineObj.number }));

        if(blockedDomains.length === 0) {
            console.log(chalk.red("No blocked domains found."));
            return;
        }

        const domainResponse = await prompts({
            type: 'select',
            name: 'domain',
            message: 'Select the domain to unblock:',
            choices: blockedDomains
        }, promptOptions);

        if(!success)
            return;

        hostFileLines.splice(domainResponse.domain, 1);
        if(await writeHostFile(hostFileLines.join('\n'))) {
            console.log(chalk.green("Domain unblocked. Please restart your browser"));
        }
        else {
            console.log(chalk.red("Failed to unblock domain."));
        }
    }
}

async function readHostFile(): Promise<string> {
    const filePath = "C:\\Windows\\System32\\drivers\\etc\\hosts";
    
    return await readFile(filePath, 'utf8');
}

async function writeHostFile(hostFileContent: string) : Promise<boolean> {
    const contentBase64 = Buffer.from(hostFileContent, "utf8").toString("base64");

    const psScript = `
        $content = [System.Text.Encoding]::UTF8.GetString(
            [Convert]::FromBase64String('${contentBase64}')
        )

        [System.IO.File]::WriteAllText(
            "C:\\Windows\\System32\\drivers\\etc\\hosts",
            $content,
            [System.Text.UTF8Encoding]::new($false)
        )

        ipconfig /flushdns
    `;

    const encodedScript = Buffer
        .from(psScript, "utf16le")
        .toString("base64");

    const command = `
        Start-Process powershell.exe `
        + `-Verb RunAs `
        + `-Wait `
        + `-ArgumentList '-NoProfile','-EncodedCommand','${encodedScript}'
    `;

    const child = spawn(
        "powershell.exe",
        ["-NoProfile", "-Command", command],
        { stdio: "inherit" }
    );

    return new Promise((resolve) => {
        child.on("exit", (code) => {
            resolve(code === 0);
        });
    });
}