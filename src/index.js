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
import csvMerge from './modules/csvMerger.js';
import {dumpDBMand, dumpDB } from './modules/dumpDB.js';
import deleteDBMand from './modules/deleteDB.js';
import showChangelog from './modules/changelog.js';

import commands from "./ressources/cmds.json" with {type: 'json'};
import packageJson from "../package.json" with {type: 'json'}
import extdSearch from './modules/extdSearch.js';
import syncConfig from './modules/syncConfig.js';
import configMutation from './modules/configMutation.js';
import bundleProduct from './modules/bundleProduct.js';
import { azureCreateSyncConfig, azurePush, azurePull } from './modules/azureSync.js';

import updateNotifier from 'update-notifier';

updateNotifier({
    pkg: {
        name: packageJson.name,
        version: packageJson.version
    }, 
    updateCheckInterval: 1000 * 60 * 60 * 24 // 24h
    }).notify();


const helpText = cliMeowHelp({
    name: `inteco`,
    desc: "Version: "+packageJson.version,
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
    case "csv_merge":
        csvMerge();
        break;
    case "graphql_schema_export":
        graphqlSchemaExport();
        break;
    case "dump_db_mand":
        dumpDBMand(cli);
        break;
    case "dump_db":
        dumpDB(cli);
        break;
    case "delete_db_mand":
        deleteDBMand();
        break;
    case "extd_search":
        extdSearch();
        break;
    case "sync_config":
        syncConfig();
        break;
    case "config_mutation":
        configMutation();
        break;
    case "bundle_product":
        bundleProduct(cli);
        break;
    case "changelog":
        showChangelog();
        break;
    case "azure_sync_config":
        azureCreateSyncConfig();
        break;
    case "azure_sync_push":
        azurePush();
        break;
    case "azure_sync_pull":
        azurePull();
        break;
    default:
        cli.showHelp()
        break;
}

