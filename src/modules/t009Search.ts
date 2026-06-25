import { DatabaseShellBuilder, TableConfig } from "../utils/shell/DatabaseShellBuilder.js";

type T009Row = {
    mnr?: string;
    grp_pw?: string;
    lnr?: string;
    pgm?: string;
    flag?: string;
    bez?: string;
    bez_f?: string;
    bez_i?: string;
};

export default async function t009Search(): Promise<void> {

    const overviewConfig = new TableConfig()
        .withName("Overview")
        .withShortcut(":ow")
        .withSearchKeys(["mnr", "grp_pw", "lnr", "pgm", "flag", "bez", "bez_f", "bez_i"])
        .withThreshold(0.7)
        .withHeader(["MNR", "Mitarbeitergruppe", "Zeilennummer", "Programm-Name", "Typ (P=Programm, S=Shell)", "Bezeichnung", "Bezeichnung franz.", "Bezeichnung ital."])
        .withFormatter((p) => {
            const row = p as T009Row;
            return [row.mnr, row.grp_pw, row.lnr, row.pgm, row.flag, row.bez, row.bez_f, row.bez_i];
        });

    const builder = new DatabaseShellBuilder();
    builder
        .withEditTools(
            [
                { title: 'MNR', column: 'mnr', default: '1' },
                { title: 'Mitarbeitergruppe', column: 'grp_pw', default: '' },
                { title: 'Zeilennummer', column: 'lnr' },
                { title: 'Programm-Name', column: 'pgm' },
                { title: 'Typ', column: 'flag', default: 'P' },
                { title: 'Bezeichnung', column: 'bez' },
                { title: 'Bezeichnung franz.', column: 'bez_f' },
                { title: 'Bezeichnung ital.', column: 'bez_i' },
            ],
            ["mnr", "pgm"],
            ["mnr", "lnr", "pgm", "bez"],
            ["grp_pw", "flag", "bez_f", "bez_i"])
        .withConfig(overviewConfig)
        .withTables("T009", ["t009"]);

    const shell = builder.build();
    await shell.run();
}

