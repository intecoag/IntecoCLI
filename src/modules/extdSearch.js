import { DB } from "../utils/db/DB.js";
import prompts from "prompts";
import CliTable3 from "cli-table3";
import readline from "readline";
import chalk from "chalk";
import fuzzysort from "fuzzysort";

// Entry point
export default async function extdSearch() {
    const responses = await configureDB();

    if (!responses.dbName) return;

    let currentSearchType = configs[0];
    let lastQuery = '';

    const baseData = await loadData(responses.dbName, responses.tables);
    const rl = createReadline();

    console.log(chalk.green("Interactive Search Started."));
    rl.prompt();

    rl.on('line', async (input) => {
        const query = input.trim();

        if (handleBuiltInCommands(query, rl)) return;

        const matchedConfig = configs.find(c => query === `:${c.cmd}`);
        if (matchedConfig) {
            currentSearchType = matchedConfig;
        } else {
            lastQuery = query;
        }

        const results = await fuzzySearch(baseData, lastQuery, currentSearchType);
        renderTable(results, currentSearchType);
        rl.prompt();
    });

    rl.on('close', () => {
        console.log(chalk.yellow("Search session ended."));
        process.exit(0);
    });
}

function createReadline() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'Search query (show help with :?)> '
    });
}

function handleBuiltInCommands(query, rl) {
    switch (query) {
        case ':q':
            rl.close();
            return true;
        case ':?':
            printHelp();
            rl.prompt();
            return true;
        default:
            return false;
    }
}

function printHelp() {
    console.log("\n" + chalk.cyan("Available Commands:"));
    console.log(chalk.yellow(":q") + " - Exit the application");
    console.log(chalk.yellow(":?") + " - Show this help");
    configs.forEach(config =>
        console.log(`${chalk.yellow(`:${config.cmd}`)} - Switch to ${config.name}`)
    );
    console.log();
}

async function configureDB() {
    console.log();
    const databaseNames = await DB.getDatabaseNames();

    return await prompts([
        {
            type: 'autocomplete',
            name: 'dbName',
            message: 'DB-Name?',
            choices: databaseNames.map(db => ({ title: db.name }))
        },
        {
            type: 'select',
            name: 'tables',
            message: 'Search-Type?',
            choices: [
                { title: 'EXTD/EXTI', value: 'EXTD/EXTI' },
                { title: 'EXTI only', value: 'EXTI' },
                { title: 'EXTD only', value: 'EXTD' }
            ]
        }
    ], {
        onCancel: () => {
            console.log("\n" + chalk.red("Cancelled Search!\n"));
        }
    });
}

async function loadData(db, tableChoice) {
    const extd = await getTableData('extd', db);
    const exti = await getTableData('exti', db);

    const cleaned = [
        ...cleanData(extd, 'extd'),
        ...cleanData(exti, 'exti')
    ];

    if (tableChoice === 'EXTD') return cleaned.filter(e => e.table === 'extd');
    if (tableChoice === 'EXTI') return cleaned.filter(e => e.table === 'exti');
    return cleaned;
}

function cleanData(entries, tableName) {
    return entries.map(entry => {
        const stripped = Object.fromEntries(Object.entries(entry).map(([k, v]) => {
            return [k.replace(/^ext[di]_/, ''), v];
        }));
        return { ...stripped, table: tableName };
    });
}

async function getTableData(table, db) {
    const query = `SELECT * FROM ${table};`;
    return await DB.executeQueryOnDB(query, db);
}

async function fuzzySearch(data, query, config) {
    if (!query) return data.slice(0, 1000);
    return fuzzysort.go(query, data, {
        keys: config.searchKeys,
        limit: 1000,
        threshold: config.threshold
    }).map(r => ({ ...r.obj, score: r.score }));
}

function renderTable(data, config) {
    const table = new CliTable3({ head: config.tableHeader });
    data.forEach(row => table.push(config.tableFormatter(row)));
    console.log(table.toString());
}

// ---------- Configurations & Helpers ----------

const configs = [
    {
        name: "Overview",
        cmd: "ow",
        searchKeys: ['mnr', 'name', 'bez_d', 'bez_f', 'bez_i'],
        threshold: 0.7,
        tableHeader: ['MNR', 'Table', 'Name', 'Bezeichnung Deutsch', 'Bezeichnung Französisch', 'Bezeichnung Italieniesch'],
        tableFormatter: p => [p.mnr, p.table, p.name, p.bez_d, p.bez_f, p.bez_i]
    },
    {
        name: "Field-Information",
        cmd: "fi",
        searchKeys: [
            'name', 'bez_d', 'bez_f', 'bez_i',
            'b_dtext_1', 'b_dtext_2', 'b_dtext_3',
            'b_dtext_4', 'b_dtext_5', 'b_dtext_6',
            'b_dtext_7', 'b_dtext_8', 'b_dtext_9'
        ],
        threshold: 0.7,
        tableHeader: ['MNR', 'Table', 'Name', 'Feldtyp', 'Flag', 'Testflag', 'Wert 1', 'Wert 2', 'Wert 3', 'Wert 4', 'Wert 5', 'Wert 6', 'Wert 7', 'Wert 8', 'Wert 9'],
        tableFormatter: p => [
            p.mnr, p.table, p.name,
            formatFieldType(p.special),
            formatFlag(p.flag),
            formatTestFlag(p.testflag),
            ...Array.from({ length: 9 }, (_, i) => formatWert(p[`b_value_${i + 1}`], p[`b_dtext_${i + 1}`]))
        ]
    },
    {
        name: "Disp-Fields",
        cmd: "df",
        searchKeys: [
            'mnr', 'name', 'bez_d', 'testfeld',
            'disp_feld_1', 'disp_feld_2', 'disp_feld_3',
            'disp_feld_4', 'disp_feld_5', 'disp_feld_6',
            'disp_feld_7', 'disp_feld_8', 'disp_feld_9'
        ],
        threshold: 0.7,
        tableHeader: ['MNR', 'Table', 'Name', 'Test-Feld', 'Dispmask', 'Dispfeld 1', 'Dispfeld 2', 'Dispfeld 3', 'Dispfeld 4', 'Dispfeld 5', 'Dispfeld 6', 'Dispfeld 7', 'Dispfeld 8', 'Dispfeld 9'],
        tableFormatter: p => [
            p.mnr, p.table, p.name, p.testfeld, p.dispmask,
            p.disp_feld_1, p.disp_feld_2, p.disp_feld_3,
            p.disp_feld_4, p.disp_feld_5, p.disp_feld_6,
            p.disp_feld_7, p.disp_feld_8, p.disp_feld_9
        ]
    }
];

function formatWert(value, bez) {
    return value || bez ? `'${value}'='${bez}'` : '';
}

function formatFieldType(type) {
    return {
        '0': 'Custom',
        '1': 'Checkbox',
        '2': 'Radiobutton',
        '4': 'Text'
    }[type] || '';
}

function formatFlag(flag) {
    return {
        '0': 'Optional',
        '1': 'Zwingend',
        '2': 'Aus',
        '3': 'Dialog aus'
    }[flag] || '';
}

function formatTestFlag(flag) {
    return {
        '0': 'Zwingend',
        '1': 'Null/Space erlaubt'
    }[flag] || '';
}
