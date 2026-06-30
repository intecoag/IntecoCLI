import fs from "fs";
import nReadlines from 'n-readlines';
import prompts from "prompts";
import path from "path";
import ora from "ora";
import Seven from 'node-7z'
import sevenBin from '7zip-bin'
import chalk from "chalk";

export default async function dumpTableToCSV() {
    console.log()

    let success = true;

    const results = await prompts([
        {
            // Tabelle die exportiert werden soll
            type: 'text',
            name: 'table',
            message: 'Tabellen-Name?'
        }
    ], {
        onCancel: () => {
            console.log()
            console.log(chalk.red("Cancelled Dump!"))
            console.log()
            success = false
        }
    })


    if (success) {
        console.log()

        // Unpack archives
        const archives = fs.readdirSync(process.cwd(), { withFileTypes: true })
            .filter((dirent) => dirent.isFile() && (dirent.name.endsWith(".gz") || dirent.name.endsWith(".7z")))
            .map((dirent) => dirent.name);
        for (const archive of archives) {
            await extractDumpsFromArchive(archive)
        }

        console.log()

        // Read Files and create csv
        const files = fs.readdirSync(process.cwd(), { withFileTypes: true })
            .filter((dirent) => dirent.isFile() && dirent.name.endsWith(".sql"))
            .map((dirent) => dirent.name);

        await Promise.all(files.map(async (file) => {
            await createCSVDump(file, results.table)
        }));

        console.log()
    }
}

function getPromiseFromEvent<T = unknown>(item: { on: (event: string, listener: (data: T) => void) => void }, event: string): Promise<T> {
        return new Promise((resolve) => {
            const listener = (data: T) => {
        resolve(data);
      }
      item.on(event, listener);
    })
  }

async function extractDumpsFromArchive(archive: string): Promise<void> {
    const spinnerZIP = ora('Unpacking Archive: '+archive).start();

    const list = Seven.list(process.cwd() + path.sep + archive, {
        $bin: sevenBin.path7za
    })

    const data = await getPromiseFromEvent<{ file: string }>(list as { on: (event: string, listener: (data: { file: string }) => void) => void }, "data")

    const file = data.file

    if(file.split(".").length == 1){
        const rename = Seven.rename(process.cwd() + path.sep + archive,[[file, file+".sql"]], {
            $bin: sevenBin.path7za
        })

        await getPromiseFromEvent(rename, "end")
    }  

    const unpack = Seven.extract(process.cwd() + path.sep + archive,"."+path.sep, {
        $bin: sevenBin.path7za
    })

    await getPromiseFromEvent(unpack, "end")

    spinnerZIP.succeed("Archive unpacked: "+archive)

}

async function createCSVDump(file: string, table: string): Promise<void> {
    let count = 0;
    const spinner = ora('Reading file (' + file +"): "+count).start();
    const readFile = new nReadlines(process.cwd() + path.sep + file);

    let line = "";
    let data = "";
    let readHeader = false;
    let headerData = "";
    let lineBuffer: Buffer | false | null;

    while ((lineBuffer = readFile.next())) {
        line = lineBuffer.toString('utf-8').trim()

        if (line.includes("INSERT INTO `" + table + "` VALUES")) {
            data = data + line;
        }

        if (line.includes("CREATE TABLE `" + table + "`")) {
            readHeader = true;
        }

        if (readHeader) {
            if (line.includes("PRIMARY KEY")) {
                readHeader = false;
            } else {
                headerData = headerData.concat(line);
            }

        }

        count++;
        spinner.text = 'Reading file (' + file +"): "+count
        spinner.render()
    }
    spinner.text = 'Writing file (' + file +")"
    spinner.render()

    const headers = parseHeadersFromCreateStatement(headerData, table);
    const records = parseInsertRecords(data);

    let recordsString = records.join("\n").replaceAll(",", ";");
    let headersString = headers.join(";")

    if (!fs.existsSync(process.cwd() + path.sep + "csv")) {
        fs.mkdirSync(process.cwd() + path.sep + "csv")
    }
    fs.writeFileSync(process.cwd() + path.sep + "csv" + path.sep + file.split(".")[0] + ".csv", headersString + "\n" + recordsString)
    spinner.succeed("CSV created: "+file.split(".")[0] + ".csv")
}

export function parseHeadersFromCreateStatement(headerData: string, table: string): string[] {
    const headers: string[] = [];
    const matchHeader = /`(.*?)`/g;
    let found: RegExpExecArray | null;

    while ((found = matchHeader.exec(headerData))) {
        if (found[0] !== `\`${table}\``) {
            headers.push(found[0]);
        }
    }

    return headers;
}

export function parseInsertRecords(data: string): string[] {
    const records: string[] = [];
    const reBrackets = /\((.*?)\)/g;
    let found: RegExpExecArray | null;

    while ((found = reBrackets.exec(data))) {
        records.push(found[1]);
    }

    return records;
}

