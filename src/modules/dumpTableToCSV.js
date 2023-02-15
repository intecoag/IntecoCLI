import fs from "fs";
import nReadlines from 'n-readlines';
import prompts from "prompts";
import path from "path";
import ora from "ora";
import Seven from 'node-7z'
import sevenBin from '7zip-bin'


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
        let archives = fs.readdirSync(process.cwd(), { withFileTypes: true }).filter(dirent => dirent.isFile() && dirent.name.split(".")[dirent.name.split(".").length-1] == "gz").map(dirent => { return dirent.name });
        for (const archive of archives){
            await extractDumpsFromArchive(archive)
        }

        // Read Files and create csv
        let files = fs.readdirSync(process.cwd(), { withFileTypes: true }).filter(dirent => dirent.isFile() && dirent.name.split(".")[dirent.name.split(".").length-1] == "sql").map(dirent => { return dirent.name });

        await Promise.all(files.map(async (file) => {
            await createCSVDump(file, results.table)
        }));

        console.log()
    }
}

function getPromiseFromEvent(item, event) {
    return new Promise((resolve) => {
      const listener = (data) => {
        resolve(data);
      }
      item.on(event, listener);
    })
  }

async function extractDumpsFromArchive(archive){
    const spinnerZIP = ora('Unpacking Archive: '+archive).start();

    const list = Seven.list(process.cwd() + path.sep + archive, {
        $bin: sevenBin.path7za
    })

    const data = await getPromiseFromEvent(list, "data")

    let file = data.file

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