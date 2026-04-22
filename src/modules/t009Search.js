import { DatabaseShellBuilder, TableConfig } from "../utils/shell/DatabaseShellBuilder.js";

export default async function t009Search() {

    const overviewConfig = new TableConfig()
        .withName("Overview")
        .withShortcut(":ow")
        .withSearchKeys(["mnr", "grp_pw", "lnr", "pgm", "flag", "bez", "bez_f", "bez_i"])
        .withThreshold(0.7)
        .withHeader(["MNR", "Mitarbeitergruppe", "Zeilennummer", "Programm-Name", "Typ (P=Programm, S=Shell)", "Bezeichnung", "Bezeichnung franz.", "Bezeichnung ital."])
        .withFormatter(p => [p.mnr, p.grp_pw, p.lnr, p.pgm, p.flag, p.bez, p.bez_f, p.bez_i]);

    const builder = new DatabaseShellBuilder();
    builder
        .withEditTools(
            [
                { title: 'MNR', column: 'mnr', default: '1' },
                { title: 'Mitarbeitergruppe', column: 'grp_pw', default: '' },
                { title: 'Zeilennummer', column: 'lnr', default: null },
                { title: 'Programm-Name', column: 'pgm', default: null },
                { title: 'Typ', column: 'flag', default: 'P' },
                { title: 'Bezeichnung', column: 'bez', default: null },
                { title: 'Bezeichnung franz.', column: 'bez_f', default: null },
                { title: 'Bezeichnung ital.', column: 'bez_i', default: null },
            ],
            ["mnr", "pgm"],
            ["mnr", "lnr", "pgm", "bez"],
            ["grp_pw", "flag", "bez_f", "bez_i"])
        .withConfig(overviewConfig)
        .withTables("T009", ["t009"]);

    const shell = builder.build();
    await shell.run();
}