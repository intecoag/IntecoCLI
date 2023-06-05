#!/usr/bin/env node
import cliMeowHelp from 'cli-meow-help';
import meow from 'meow';
import adb_bridge from './modules/adbBridge.js';
import adb_intent from './modules/adbIntentSender.js';
import dumpTableToCSV from './modules/dumpTableToCSV.js';
import importDB from './modules/importDB.js';
import rewrite from './modules/rewriteConfig.js';
import writeCLIConfig from './modules/setCLIConfig.js';
import t003Rewrite from './modules/t003Rewrite.js';
import graphqlSchemaExport from './modules/graphqlSchemaExport.js';

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const commands = require("./ressources/cmds.json");

const helpText = cliMeowHelp({
	name: `inteco`,
	commands
});


const cli = meow(helpText, {
    importMeta: import.meta,
});

switch (cli.input[0]) {
    case "config_rewrite":
        rewrite(cli)
        break;
    case "import_db":
        importDB(cli)
        break;
    case "download_db":
        downloadDB(cli)
        break;  
    case "t003_rewrite":
        t003Rewrite(cli)
        break;
    case "adb_bridge":
        adb_bridge()
        break;   
    case "adb_intent":
        adb_intent()
        break;   
    case "set_cli_config":
        writeCLIConfig()
        break;   
    case "dump_table_to_csv":
        dumpTableToCSV()
        break;  
    case "graphql_schema_export":
        graphqlSchemaExport();
        break;                
    default:
        cli.showHelp()
        break;
}

