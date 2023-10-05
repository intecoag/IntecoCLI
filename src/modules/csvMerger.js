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
            type: prev => prev == true ? "select" : null,
            name: 'filtertype',
            message: 'Filter type?',
            choices: [
                { title: 'Equal', value: 'eq' },
                { title: 'Non-Equal', value: 'neq' }
            ]
        },
        {
            type: prev => prev != "" ? "text" : null,
            name: 'filterfield',
            message: 'Filter field?'
        },
        {
            type: prev => prev != "" ? "text" : null,
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

        let files = fs.readdirSync(process.cwd(), { withFileTypes: true }).filter(file => file.isFile && file.name.endsWith(".csv") && file.name != promptResults.output);

        let finalResult = [];
        let counter = 0;

        files.forEach(file => {
            const results = [];

            fs.createReadStream(process.cwd() + "/" + file.name)
                .pipe(csv({ separator: ";", quote: "'" }))
                .on('data', (data) => results.push(data))
                .on('end', () => {
                    const filteredResults = results.map(row => {
                        const newRow = {}
                        Object.entries(row).forEach(entry => {
                            newRow[entry[0].replaceAll("'", "").replaceAll("`", "")] = entry[1]
                        })
                        newRow.file = file.name
                        return newRow
                    }).filter(row => {
                        if (promptResults.useFilter) {
                            switch (promptResults.filtertype){
                                case "neq":
                                    if(row[promptResults.filterfield] != promptResults.filtervalue){
                                        return true
                                    }
                                    return false;
                                case "eq":
                                    if(row[promptResults.filterfield] == promptResults.filtervalue){
                                        return true
                                    }
                                    return false;    
                            }
                            return false;
                        }
                        return true;
                    })

                    finalResult = finalResult.concat(filteredResults)
                    counter = counter + filteredResults.length

                    let firstLine = true;
                    fs.writeFileSync(process.cwd() + "/" + promptResults.output, finalResult.map(row => {
                        let prev = ""
                        if (firstLine) {
                            prev = Object.keys(row).map(entry => { return "\"" + entry + "\"" }).join(";") + "\n";
                            firstLine = false;
                        }
                        return prev + Object.values(row).map(entry => { return "\"" + entry + "\"" }).join(";");
                    }).join("\n"))
                    console.log(chalk.green(file.name + " merged."))
                });

        })
    }



}