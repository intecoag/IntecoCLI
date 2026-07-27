import chalk from 'chalk';
import csv from 'csv-parser';
import fs from "fs";
import prompts from "prompts";

export default async function csvMerge() {
    console.log()

    let success = true;

    const promptResults = await prompts([
        {
            // Output-File
            type: 'text',
            name: 'output',
            message: 'Output-File?',
            initial: "results.csv"
        },
        {
            // Filterverwendung
            type: 'toggle',
            name: 'useFilter',
            message: 'Use Filter?',
            initial: false,
            active: 'yes',
            inactive: 'no'
        },
        {
            type: (prev: boolean) => prev == true ? "select" : null,
            name: 'filtertype',
            message: 'Filter type?',
            choices: [
                { title: 'Equal', value: 'eq' },
                { title: 'Non-Equal', value: 'neq' }
            ]
        },
        {
            type: (prev: string) => prev != "" ? "text" : null,
            name: 'filterfield',
            message: 'Filter field?'
        },
        {
            type: (prev: string) => prev != "" ? "text" : null,
            name: 'filtervalue',
            message: 'Filter value?'
        },
    ], {
        onCancel: () => {
            console.log()
            console.log(chalk.red("Cancelled CSV-Merge!"))
            console.log()
            success = false
        }
    })


    if (success) {
        console.log()

        const files = fs.readdirSync(process.cwd(), { withFileTypes: true }).filter((file) => file.isFile() && file.name.endsWith(".csv") && file.name != promptResults.output);

        let finalResult: Record<string, string>[] = [];

        files.forEach(file => {
            const results: Record<string, string>[] = [];

            fs.createReadStream(process.cwd() + "/" + file.name)
                .pipe(csv({ separator: ";", quote: "'" }))
                .on('data', (data: Record<string, string>) => results.push(data))
                .on('end', () => {
                    const filteredResults = results.map((row) => {
                        const newRow: Record<string, string> = {};
                        Object.entries(row).forEach((entry) => {
                            newRow[entry[0].replaceAll("'", "").replaceAll("`", "")] = entry[1]
                        })
                        newRow.file = file.name
                        return newRow
                    }).filter((row) => {
                        if (promptResults.useFilter) {
                            const filterField = promptResults.filterfield ?? "";
                            const filterValue = promptResults.filtervalue ?? "";
                            switch (promptResults.filtertype) {
                                case "neq":
                                    if (row[filterField] != filterValue) {
                                        return true
                                    }
                                    return false;
                                case "eq":
                                    if (row[filterField] == filterValue) {
                                        return true
                                    }
                                    return false;    
                            }
                            return false;
                        }
                        return true;
                    })

                    finalResult = finalResult.concat(filteredResults)

                    let firstLine = true;
                    fs.writeFileSync(process.cwd() + "/" + promptResults.output, finalResult.map((row) => {
                        let prev = ""
                        if (firstLine) {
                            prev = Object.keys(row).map((entry) => { return "\"" + entry + "\"" }).join(";") + "\n";
                            firstLine = false;
                        }
                        return prev + Object.values(row).map((entry) => { return "\"" + String(entry) + "\"" }).join(";");
                    }).join("\n"))
                    console.log(chalk.green(file.name + " merged."))
                });

        })
    }



}

