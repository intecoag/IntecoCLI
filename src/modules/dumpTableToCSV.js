import fs from "fs";
import nReadlines from 'n-readlines';
import prompts from "prompts";
import path from "path";
import ora from "ora";



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
        let files = fs.readdirSync(process.cwd(), { withFileTypes: true }).filter(dirent => dirent.isFile()).map(dirent => { return dirent.name });

        await Promise.all(files.map(async (file) => {
            await createCSVDump(file, results.table)
        }));

        console.log()
    }
}

async function createCSVDump(file, table) {
    let count = 0;
    const spinner = ora('Reading file (' + file +"): "+count).start();
    const readFile = new nReadlines(process.cwd() + path.sep + file);

    let line = "";
    let data = "";
    let readHeader = false;
    let headerData = "";

    while ((line = readFile.next())) {
        line = line.toString('utf-8').trim()

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

    let headers = []
    let matchHeader = new RegExp(/`(.*?)`/g);
    var found;
    while (found = matchHeader.exec(headerData)) {
        if (found[0] != "`" + table + "`") {
            headers.push(found[0]);
        }

    };

    let records = [];
    var reBrackets = /\((.*?)\)/g;
    var found;
    while (found = reBrackets.exec(data)) {
        records.push(found[1]);
    };

    let recordsString = records.join("\n").replaceAll(",", ";");
    let headersString = headers.join(";")

    if (!fs.existsSync(process.cwd() + path.sep + "csv")) {
        fs.mkdirSync(process.cwd() + path.sep + "csv")
    }
    fs.writeFileSync(process.cwd() + path.sep + "csv" + path.sep + file.split(".")[0] + ".csv", headersString + "\n" + recordsString)
    spinner.succeed("CSV created: "+file.split(".")[0] + ".csv")
}