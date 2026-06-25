CLI mit diversen Funktionen fuer die Arbeit in der Inteco und mit dem WEGAS.

## Entwicklung

- `npm run typecheck` prueft den TypeScript-Stand.
- `npm run build` erstellt die distributierbaren JavaScript-Dateien in `dist/`.
- `npm run dev -- <command>` startet den TS-Einstiegspunkt lokal.

## Distribution

Das NPM-Paket enthaelt vorkompilierte Artefakte aus `dist/`.
Globale Installationen (`npm i -g @intecoag/inteco-cli`) benoetigen dadurch keine Transpilierung auf Zielsystemen.

Weitere Informationen: https://inteco.atlassian.net/wiki/x/BYBuAw
