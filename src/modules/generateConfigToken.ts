import chalk from "chalk";
import { execSync } from "child_process";
import ora from "ora";
import prompts from "../utils/cliParams.js";
import { registerCommand } from "../utils/commandRegistry.js";
import { AzureHelper } from "../utils/azure/azure.js";

const defaultAccountName = "intecowegasconfig";
const policySuffix = "readonly";
const accessPolicyPermissions = "rl";
const tokenValidityYears = 25;
// Richtliniennamen sind auf 64 Zeichen begrenzt: 64 - Länge von "-readonly" (9).
const maxPrefixLength = 55;

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

// Schutzwall gegen Shell-Injection: Werte werden in einen az-Befehl eingebettet.
function assertShellSafeName(name: string, kind: string): void {
    if (!/^[a-z0-9-]{3,63}$/.test(name)) {
        throw new Error(`Invalid ${kind}: "${name}".`);
    }
}

function runAzureCli(args: string[]): string {
    return execSync(`az ${args.join(" ")}`, {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"]
    }).trim();
}

// Setzt den Richtliniennamen zusammen; der Bindestrich vor dem Suffix wird nur einmal gesetzt.
export function getPolicyName(prefix: string): string {
    return `${prefix.replace(/-+$/, "")}-${policySuffix}`;
}

// Ablaufdatum des SAS-Tokens im von az erwarteten UTC-Format (Y-m-dTH:MZ).
export function getTokenExpiry(now: Date = new Date()): string {
    const expiry = new Date(now);
    expiry.setFullYear(expiry.getFullYear() + tokenValidityYears);
    return `${expiry.toISOString().slice(0, 16)}Z`;
}

// Legt die gespeicherte Zugriffsrichtlinie an bzw. aktualisiert sie.
// "policy create" ist idempotent und überschreibt eine bestehende Richtlinie gleichen Namens;
// eine Existenzprüfung entfällt, da "policy show" bei fehlender Richtlinie Exit-Code 0 liefert.
function ensureAccessPolicy(storageAccount: string, container: string, policyName: string): void {
    runAzureCli([
        "storage", "container", "policy", "create",
        "--account-name", storageAccount,
        "--container-name", container,
        "--name", policyName,
        "--permissions", accessPolicyPermissions,
        "--only-show-errors", "-o", "none"
    ]);
}

function createContainerSas(storageAccount: string, container: string, policyName: string, expiry: string): string {
    return runAzureCli([
        "storage", "container", "generate-sas",
        "--account-name", storageAccount,
        "--name", container,
        "--policy-name", policyName,
        "--expiry", expiry,
        "--https-only",
        "-o", "tsv"
    ]);
}

// Erzeugt für einen Kunden-Container einen readonly SAS-Token über die Richtlinie "<prefix>-readonly"
export async function generateConfigToken() {
    console.log();

    let success = true;
    const onCancel = () => {
        console.log();
        console.log(chalk.red("Cancelled operation."));
        console.log();
        success = false;
    };

    const setupResponse = await prompts([
        {
            type: "text",
            name: "storageAccount",
            message: "Storage account?",
            initial: defaultAccountName
        },
        {
            type: "text",
            name: "prefix",
            message: `Prefix of the stored access policy (${policySuffix} is appended)?`,
            validate: (value: string) =>
                new RegExp(`^(?=.*[A-Za-z0-9])[A-Za-z0-9-]{1,${maxPrefixLength}}$`).test(value)
                    || `Use 1-${maxPrefixLength} letters, digits or hyphens.`
        }
    ], { onCancel });

    if (!success) {
        return;
    }

    const storageAccount = String(setupResponse.storageAccount ?? "");
    assertShellSafeName(storageAccount, "storage account");
    const policyName = getPolicyName(String(setupResponse.prefix ?? ""));

    let containerChoices: Array<{ title: string; value: string }> = [];
    try {
        const containers = await new AzureHelper().listContainers(storageAccount);
        containerChoices = containers.map(name => ({ title: name, value: name }));
    } catch (error) {
        console.log();
        console.log(chalk.yellow("Could not load containers. Falling back to manual input."));
        console.log(getErrorMessage(error));
        console.log();
    }

    const containerResponse = await prompts([
        {
            type: containerChoices.length > 0 ? "autocomplete" : "text",
            name: "container",
            message: "Customer container?",
            choices: containerChoices,
            hint: "Start typing to filter"
        }
    ], { onCancel });

    if (!success) {
        return;
    }

    const container = String(containerResponse.container ?? "").trim();

    if (!container) {
        console.log(chalk.yellow("No container selected."));
        console.log();
        return;
    }

    const expiry = getTokenExpiry();
    const spinner = ora(`Generating token for ${container}...`).start();

    try {
        assertShellSafeName(container, "container");
        ensureAccessPolicy(storageAccount, container, policyName);
        const sas = createContainerSas(storageAccount, container, policyName, expiry);
        spinner.succeed(container);
        const containerUrl = `https://${storageAccount}.blob.core.windows.net/${container}`;
        console.log();
        console.log(chalk.bold("URL:"));
        console.log(containerUrl);
        console.log();
        console.log(chalk.bold("SAS token:"));
        console.log(sas);
        console.log();
        console.log(chalk.bold("URL including SAS token:"));
        console.log(`${containerUrl}?${sas}`);
        console.log();
        console.log(chalk.gray(`Token valid until ${expiry} (policy: ${policyName}).`));
    } catch (error) {
        spinner.fail(`${container}: ${getErrorMessage(error)}`);
    }

    console.log();
}

registerCommand("generate_config_token", "Generates a readonly SAS token for a customer container in the config storage account (requires Azure-CLI)", generateConfigToken, {
    parameters: {
        storageAccount: { type: "string", default: defaultAccountName, description: "Storage account that holds one container per customer." },
        prefix: { type: "string", required: true, description: `Prefix for the stored access policy; the policy is named <prefix>-${policySuffix} (1-${maxPrefixLength} letters, digits or hyphens).` },
        container: { type: "string", required: true, description: "Customer container; selected from the account at runtime." },
    },
    note: `Uses the stored access policy "<prefix>-${policySuffix}" and creates or updates it. Requires an authenticated Azure CLI.`,
});
