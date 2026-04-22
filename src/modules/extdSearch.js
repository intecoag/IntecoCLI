import { DatabaseShellBuilder, TableConfig } from "../utils/shell/DatabaseShellBuilder.js";

// Entry point
export default async function extdSearch() {
    const overviewConfig = new TableConfig()
        .withName("Overview")
        .withShortcut(":ow")
        .withSearchKeys(["mnr", "name", "bez_d", "bez_f", "bez_i"])
        .withThreshold(0.7)
        .withHeader(["MNR", "Table", "Name", "Bezeichnung Deutsch", "Bezeichnung Französisch", "Bezeichnung Italienisch"])
        .withFormatter(p => [p.mnr, p.table, p.name, p.bez_d, p.bez_f, p.bez_i]);

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
        .withFormatter(p => [
            p.mnr, p.table, p.name,
            formatFieldType(p.special),
            formatFlag(p.flag),
            formatTestFlag(p.testflab),
            ...Array.from({ length: 9 }, (_, i) => formatWert(p[`b_value_${i + 1}`], p[`b_dtext_${i + 1}`]))
        ]);

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
        .withFormatter(p => [
            p.mnr, p.table, p.name, p.testfeld, p.dispmask,
            p.disp_feld_1, p.disp_feld_2, p.disp_feld_3,
            p.disp_feld_4, p.disp_feld_5, p.disp_feld_6,
            p.disp_feld_7, p.disp_feld_8, p.disp_feld_9
        ]);

    const builder = new DatabaseShellBuilder();
    builder
        .withEditTools(
            [
                {
                    title: 'MNR', column: 'mnr', default: '1'
                },
                {
                    title: 'Name', column: 'name', default: null,
                },
                {
                    title: 'Bezeichnung Deutsch', column: 'bez_d', default: null,
                },
                {
                    title: 'Bezeichnung Französisch', column: 'bez_f', default: null,
                },
                {
                    title: 'Bezeichnung Italienisch', column: 'bez_i', default: null
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
