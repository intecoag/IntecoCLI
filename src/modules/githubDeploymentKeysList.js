import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { getGithubToken, fetchPaginatedGithubAPI, fetchGithubAPI } from '../utils/github/github.js';

/**
 * Format a date string to a readable format, or show "Never" if null
 * @param {string|null} dateString - ISO date string or null
 * @returns {string} Formatted date or "Never"
 */
function formatDate(dateString) {
  if (!dateString) return chalk.gray('Never');
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return chalk.green('Today');
  if (diffDays === 1) return chalk.green('Yesterday');
  if (diffDays < 7) return chalk.green(`${diffDays} days ago`);
  if (diffDays < 30) return chalk.yellow(`${Math.floor(diffDays / 7)} weeks ago`);
  if (diffDays < 365) return chalk.yellow(`${Math.floor(diffDays / 30)} months ago`);
  
  return chalk.red(`${Math.floor(diffDays / 365)} years ago`);
}

/**
 * Fetch all deployment keys for a repository
 * @param {string} baseUrl - Base API URL for the repository keys
 * @param {string} token - GitHub authentication token
 * @returns {Promise<Array>} Array of deployment keys
 */
async function fetchDeploymentKeys(baseUrl, token) {
  try {
    return await fetchPaginatedGithubAPI(baseUrl, token);
  } catch (error) {
    // Return empty array if there's an error fetching keys for this repo
    return [];
  }
}

/**
 * List all deployment keys across all repositories in an organization
 */
export async function listGithubDeploymentKeys() {
  console.log();

  // Get GitHub authentication token
  let token;
  let authMethod;

  try {
    ({ token, authMethod } = await getGithubToken());
  } catch (error) {
    console.log();
    console.error(chalk.red(`✗ ${error.message}`));
    console.log(chalk.yellow('\nAuthentication setup:'));
    console.log(chalk.gray('  Option 1: Install GitHub CLI and run: gh auth login'));
    console.log(chalk.gray('  Option 2: Set GITHUB_TOKEN environment variable'));
    console.log();
    process.exit(1);
  }

  console.log(chalk.green(`✓ Authenticated via: ${authMethod}`));
  console.log();

  // Get organization name
  const orgResponse = await prompts([
    {
      type: 'text',
      name: 'organization',
      message: 'GitHub Organization Name?',
      initial: 'intecoag',
      validate: (value) => value.length > 0 || 'Organization name is required'
    }
  ], {
    onCancel: () => {
      console.log();
      console.log(chalk.red('Cancelled deployment keys listing!'));
      console.log();
      process.exit(0);
    }
  });

  const { organization } = orgResponse;

  let mainSpinner = ora('Fetching repositories...').start();

  try {
    // Fetch all repositories for the organization
    const baseReposUrl = `https://api.github.com/orgs/${organization}/repos`;
    const repos = await fetchPaginatedGithubAPI(baseReposUrl, token);

    if (repos.length === 0) {
      mainSpinner.warn(`No repositories found in organization "${organization}"`);
      console.log();
      return;
    }

    // Fetch deployment keys for all repositories
    const allKeys = [];
    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i];
      const progress = `[${i + 1}/${repos.length}]`;
      mainSpinner.text = `${progress} Fetching deployment keys from: ${chalk.blue(repo.name)}...`;
      
      const keysUrl = `https://api.github.com/repos/${organization}/${repo.name}/keys`;
      const keys = await fetchDeploymentKeys(keysUrl, token);
      
      keys.forEach(key => {
        allKeys.push({
          repository: repo.name,
          keyId: key.id,
          title: key.title,
          createdAt: key.created_at,
          lastUsedAt: key.last_used,
          readOnly: key.read_only
        });
      });
    }

    mainSpinner.succeed(`Found ${allKeys.length} deployment keys across ${repos.length} repositories`);
    console.log();

    if (allKeys.length === 0) {
      console.log(chalk.yellow('No deployment keys found in this organization.'));
      console.log();
      return;
    }

    // Display keys in a table
    const table = new Table({
      head: [
        chalk.cyan('Repository'),
        chalk.cyan('Key Title'),
        chalk.cyan('Created'),
        chalk.cyan('Last Used'),
        chalk.cyan('Read-Only')
      ].map(h => h),
      style: { head: [], border: ['cyan'] },
      colWidths: [25, 30, 20, 20, 12],
      wordWrap: true
    });

    // Sort by repository name and then by last used date (newest first)
    allKeys.sort((a, b) => {
      if (a.repository !== b.repository) {
        return a.repository.localeCompare(b.repository);
      }
      return new Date(b.lastUsedAt || 0) - new Date(a.lastUsedAt || 0);
    });

    allKeys.forEach(key => {
      table.push([
        chalk.blue(key.repository),
        key.title,
        new Date(key.createdAt).toLocaleDateString(),
        formatDate(key.lastUsedAt),
        key.readOnly ? chalk.green('Yes') : chalk.yellow('No')
      ]);
    });

    console.log(table.toString());
    console.log();

    // Show statistics
    const keysNeverUsed = allKeys.filter(k => !k.lastUsedAt).length;
    const readOnlyKeys = allKeys.filter(k => k.readOnly).length;
    const readWriteKeys = allKeys.filter(k => !k.readOnly).length;

    console.log(chalk.bold('Summary:'));
    console.log(`  Total deployment keys: ${chalk.cyan(allKeys.length)}`);
    console.log(`  Never used: ${chalk.yellow(keysNeverUsed)}`);
    console.log(`  Read-only keys: ${chalk.green(readOnlyKeys)}`);
    console.log(`  Read-write keys: ${chalk.yellow(readWriteKeys)}`);
    console.log();

  } catch (error) {
    console.log();
    mainSpinner.fail('Error fetching deployment keys');

    if (error.message.startsWith('401')) {
      console.error(chalk.red(`✗ ${error.message}`));
      console.log(chalk.yellow('\nAuthentication setup:'));
      console.log(chalk.gray('  Option 1: Install GitHub CLI and run: gh auth login'));
      console.log(chalk.gray('  Option 2: Set GITHUB_TOKEN environment variable'));
    } else if (error.message.startsWith('404')) {
      console.error(chalk.red(`✗ ${error.message} - Organization not found`));
    } else {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    console.log();
    process.exit(1);
  }
}

export default listGithubDeploymentKeys;
