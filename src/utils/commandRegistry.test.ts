import { describe, expect, it, vi } from "vitest";
import { executeRegisteredCommand, getRegisteredCommand, getRegisteredCommands, renderCommandHelp } from "./commandRegistry.js";

import "../modules/adbBridge.js";
import "../modules/adbIntentSender.js";
import "../modules/azureSync.js";
import "../modules/blockDomain.js";
import "../modules/bundleProduct.js";
import "../modules/changelog.js";
import "../modules/configMutation.js";
import "../modules/csvMerger.js";
import "../modules/deleteDB.js";
import "../modules/dumpDB.js";
import "../modules/dumpTableToCSV.js";
import "../modules/extdSearch.js";
import "../modules/githubDeploymentKey.js";
import "../modules/githubDeploymentKeysList.js";
import "../modules/githubSecurityAdvisories.js";
import "../modules/graphqlSchemaExport.js";
import "../modules/help.js";
import "../modules/importDB.js";
import "../modules/rewriteConfig.js";
import "../modules/setCLIConfig.js";
import "../modules/syncConfig.js";
import "../modules/t003Rewrite.js";
import "../modules/t009Search.js";

describe("command registry", () => {
    it("gets command help and handlers from self-registering modules", () => {
        const commands = getRegisteredCommands();
        const names = commands.map(({ name }) => name);

        expect(commands).toHaveLength(26);
        expect(new Set(names).size).toBe(names.length);
        expect(commands.every(command => command.description.length > 0 && typeof command.handler === "function")).toBe(true);
        expect(getRegisteredCommand("block_domain")?.schema?.parameters?.actionType?.choices)
            .toEqual(["blockDomain", "unblockDomain"]);
        expect(renderCommandHelp(getRegisteredCommand("block_domain")!)).toContain("actionType (required; string");
        expect(renderCommandHelp(getRegisteredCommand("t009_search")!)).toContain("commands (required; string[]");
        expect(renderCommandHelp(getRegisteredCommand("extd_search")!)).toContain("EXTD/EXTI");
    });

    it("executes the registered handler without a central dispatch switch", async () => {
        const showHelp = vi.fn();
        await executeRegisteredCommand("help", { showHelp });

        expect(showHelp).toHaveBeenCalledOnce();
    });
});
