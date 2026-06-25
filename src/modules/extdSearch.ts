import { DatabaseShellBuilder, TableConfig } from "../utils/shell/DatabaseShellBuilder.js";

type ExtdRow = {
    mnr?: string;
    table?: string;
    name?: string;
    bez_d?: string;
    bez_f?: string;
    bez_i?: string;
    special?: string;
    flag?: string;
    testflab?: string;
    testfeld?: string;
    dispmask?: string;
    disp_feld_1?: string;
    disp_feld_2?: string;
    disp_feld_3?: string;
    disp_feld_4?: string;
    disp_feld_5?: string;
    disp_feld_6?: string;
    disp_feld_7?: string;
    disp_feld_8?: string;
    disp_feld_9?: string;
    [key: string]: unknown;
};

// Entry point
export default async function extdSearch(): Promise<void> {
    const overviewConfig = new TableConfig()
        .withName("Overview")
        .withShortcut(":ow")
        .withSearchKeys(["mnr", "name", "bez_d", "bez_f", "bez_i"])
        .withThreshold(0.7)
        .withHeader(["MNR", "Table", "Name", "Bezeichnung Deutsch", "Bezeichnung Französisch", "Bezeichnung Italienisch"])
        .withFormatter((p) => {
            const row = p as ExtdRow;
            return [row.mnr, row.table, row.name, row.bez_d, row.bez_f, row.bez_i];
        });

    const fieldInfoConfig = new TableConfig()
        .withName("Field-Information")
        .withShortcut(":fi")
        .withSearchKeys([
            'name', 'bez_d', 'bez_f', 'bez_i',
            'b_dtext_1', 'b_dtext_2', 'b_dtext_3',
            'b_dtext_4', 'b_dtext_5', 'b_dtext_6',
            'b_dtext_7', 'b_dtext_8', 'b_dtext_9'
        ])
        .withThreshold(0.7)
        .withHeader(['MNR', 'Table', 'Name', 'Feldtyp', 'Flag', 'Testflag', 'Wert 1', 'Wert 2', 'Wert 3', 'Wert 4', 'Wert 5', 'Wert 6', 'Wert 7', 'Wert 8', 'Wert 9'])
        .withFormatter((p) => {
            const row = p as ExtdRow;
            return [
                row.mnr, row.table, row.name,
                formatFieldType(row.special),
                formatFlag(row.flag),
                formatTestFlag(row.testflab),
                ...Array.from({ length: 9 }, (_, i) => formatWert(row[`b_value_${i + 1}`], row[`b_dtext_${i + 1}`]))
            ];
        });

    const dispFieldsConfig = new TableConfig()
        .withName("Disp-Fields")
        .withShortcut(":df")
        .withSearchKeys([
            'mnr', 'name', 'bez_d', 'testfeld',
            'disp_feld_1', 'disp_feld_2', 'disp_feld_3',
            'disp_feld_4', 'disp_feld_5', 'disp_feld_6',
            'disp_feld_7', 'disp_feld_8', 'disp_feld_9'
        ])
        .withThreshold(0.7)
        .withHeader(['MNR', 'Table', 'Name', 'Test-Feld', 'Dispmask', 'Dispfeld 1', 'Dispfeld 2', 'Dispfeld 3', 'Dispfeld 4', 'Dispfeld 5', 'Dispfeld 6', 'Dispfeld 7', 'Dispfeld 8', 'Dispfeld 9'])
        .withFormatter((p) => {
            const row = p as ExtdRow;
            return [
            row.mnr, row.table, row.name, row.testfeld, row.dispmask,
            row.disp_feld_1, row.disp_feld_2, row.disp_feld_3,
            row.disp_feld_4, row.disp_feld_5, row.disp_feld_6,
            row.disp_feld_7, row.disp_feld_8, row.disp_feld_9
        ];
        });

    const builder = new DatabaseShellBuilder();
    builder
        .withEditTools(
            [
                {
                    title: 'MNR', column: 'mnr', default: '1'
                },
                {
                    title: 'Name', column: 'name',
                },
                {
                    title: 'Bezeichnung Deutsch', column: 'bez_d',
                },
                {
                    title: 'Bezeichnung Französisch', column: 'bez_f',
                },
                {
                    title: 'Bezeichnung Italienisch', column: 'bez_i'
                }
            ],
            ["name"],
            ["name"],
            ["mnr", "bez_d", "bez_f", "bez_i"])
        .withConfig(overviewConfig)
        .withConfig(fieldInfoConfig)
        .withConfig(dispFieldsConfig)
        .withTables("EXTD/EXTI", ["extd", "exti"])
        .withTables("EXTD", ["extd"])
        .withTables("EXTI", ["exti"]);

    const shell = builder.build();
    await shell.run();
}

function formatWert(value: unknown, bez: unknown): string {
    return value || bez ? `'${value}'='${bez}'` : '';
}

function formatFieldType(type: unknown): string {
    const map: Record<string, string> = {
        '0': 'Custom',
        '1': 'Checkbox',
        '2': 'Radiobutton',
        '4': 'Text'
    };
    return map[String(type)] || '';
}

function formatFlag(flag: unknown): string {
    const map: Record<string, string> = {
        '0': 'Optional',
        '1': 'Zwingend',
        '2': 'Aus',
        '3': 'Dialog aus'
    };
    return map[String(flag)] || '';
}

function formatTestFlag(flag: unknown): string {
    const map: Record<string, string> = {
        '0': 'Zwingend',
        '1': 'Null/Space erlaubt'
    };
    return map[String(flag)] || '';
}


