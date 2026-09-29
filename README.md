CLI mit diversen Funktionen fuer die Arbeit in der Inteco und mit dem WEGAS.

## Entwicklung

- `npm run typecheck` prueft den TypeScript-Stand.
- `npm test` fuehrt die Vitest-Test-Suite einmalig aus.
- `npm run build` erstellt die distributierbaren JavaScript-Dateien in `dist/`.
- `npm run dev -- <command>` startet den TS-Einstiegspunkt lokal.

## Nicht-interaktive Ausfuehrung

Prompt-basierte Befehle koennen ohne Terminal ueber `--params` (JSON-Objekt) oder
`--params-file` (JSON-Datei) ausgefuehrt werden. Die Parameternamen und -typen
entsprechen den Namen und Typen der jeweiligen Eingabeaufforderungen; vorhandene
Prompt-Standardwerte und Auswahlmoeglichkeiten gelten auch fuer Batch-Aufrufe.
Fehlende Pflichtwerte, falsche Typen, ungueltige Auswahlwerte und unbekannte
Parameternamen beenden den Aufruf mit einem Fehler statt auf Eingaben zu warten.
Mit `inteco <command> --help` werden die Parameter, Typen, Pflichtangaben,
Standardwerte und Auswahlwerte des jeweiligen Befehls angezeigt.
Die CLI-Liste und der Dispatcher werden aus den in den Command-Modulen
registrierten Funktionen erzeugt; ein separates `cmds.json` ist nicht mehr
noetig. Das Help-Schema steht jeweils direkt beim `registerCommand`-Aufruf;
die Batch-Validierung leitet akzeptierte Typen und Auswahlwerte direkt aus den
Prompt-Definitionen ab.

```sh
inteco block_domain --params '{"actionType":"blockDomain","domain":"example.com"}'
inteco adb_bridge --params-file ./adb-bridge-params.json
```

Auch die Datenbank-Shell-Befehle koennen nicht-interaktiv ausgefuehrt werden.
`commands` ist eine geordnete Liste von Shell-Eingaben (Suchbegriffen und
Shell-Kommandos); `dbName` und `tables` ersetzen die anfaengliche Auswahl:

```sh
inteco t009_search --params '{"dbName":"wegas","tables":"T009","commands":["APP",":ow","PAYROLL"]}'
inteco extd_search --params '{"dbName":"wegas","tables":"EXTD/EXTI","commands":["invoice",":fi","address"]}'
```

Shell-Bearbeitungsbefehle koennen zusaetzliche Prompt-Parameter benoetigen;
mehrfach abgefragte Werte lassen sich wie bei anderen Befehlen als Array angeben.

`--params-file -` liest JSON von stdin. Ohne Parameterdatei oder `--params`
bleiben interaktive Terminals wie gewohnt interaktiv; ohne TTY wird eine
fehlende Eingabe als Fehler gemeldet.

## Distribution

Das NPM-Paket enthaelt vorkompilierte Artefakte aus `dist/`.
Globale Installationen (`npm i -g @intecoag/inteco-cli`) benoetigen dadurch keine Transpilierung auf Zielsystemen.

Weitere Informationen: https://inteco.atlassian.net/wiki/x/BYBuAw
