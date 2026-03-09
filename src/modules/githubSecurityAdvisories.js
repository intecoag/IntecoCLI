import prompts from 'prompts';
import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import { getGithubToken, fetchPaginatedGithubAPI, fetchGithubAPI } from '../utils/github/github.js';

async function githubSecurityAdvisories() {
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

  const responses = await prompts([
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
      console.log(chalk.red('Cancelled GitHub Security Advisories check!'));
      console.log();
      process.exit(0);
    }
  });

  const { organization } = responses;

  const spinner = ora('Fetching repositories...').start();

  try {
    // Fetch all repositories for the organization
    const baseUrl = `https://api.github.com/orgs/${organization}/repos`;
    const repos = await fetchPaginatedGithubAPI(baseUrl, token);

    if (repos.length === 0) {
      spinner.warn(`No repositories found in organization "${organization}"`);
      console.log();
      return;
    }

    spinner.text = `Found ${repos.length} repositories. Checking security advisories...`;

    // Check security advisories for each repo
    const results = [];
    for (let i = 0; i < repos.length; i++) {
      const repo = repos[i];
      spinner.text = `Checking security advisories... [${i + 1}/${repos.length}] ${repo.name}`;

      const advisories = await fetchSecurityAdvisories(organization, repo.name, token);
      
      if (advisories.length > 0) {
        results.push({
          repository: repo.name,
          advisoryCount: advisories.length,
          url: repo.html_url
        });
      }
    }

    spinner.succeed('Security advisories check completed!');
    console.log();

    if (results.length === 0) {
      console.log(chalk.green.bold('✓ No security advisories found in any repositories!'));
      console.log();
      return;
    }

    // Sort by advisory count (descending)
    results.sort((a, b) => b.advisoryCount - a.advisoryCount);

    // Display results in a table
    const table = new Table({
      head: [
        chalk.bold.cyan('Repository'),
        chalk.bold.cyan('Advisories'),
        chalk.bold.cyan('URL')
      ],
      style: {
        head: [],
        border: ['cyan']
      },
      colWidths: [40, 15, 60],
      wordWrap: true
    });

    for (const result of results) {
      const advisoryColor = chalk.red;
      table.push([
        result.repository,
        advisoryColor.bold(result.advisoryCount.toString()),
        chalk.blue.underline(result.url)
      ]);
    }

    console.log(table.toString());
    console.log();
    console.log(chalk.yellow.bold(`Summary: ${results.length} repository/repositories with open security advisories`));
    console.log();

  } catch (error) {
    console.log();
    spinner.fail('Error checking security advisories');
    
    if (error.message.includes('Organization')) {
      console.error(chalk.red(`✗ ${error.message}`));
    } else if (error.message.includes('authentication')) {
      console.error(chalk.red(`✗ ${error.message}`));
      console.log(chalk.yellow('\nAuthentication setup:'));
      console.log(chalk.gray('  Option 1: Install GitHub CLI and run: gh auth login'));
      console.log(chalk.gray('  Option 2: Set GITHUB_TOKEN environment variable'));
    } else {
      console.error(chalk.red(`Error: ${error.message}`));
    }
    console.log();
    process.exit(1);
  }
}

async function fetchSecurityAdvisories(organization, repository, token) {
  const url = `https://api.github.com/repos/${organization}/${repository}/dependabot/alerts`;

  try {
    const res = await fetchGithubAPI(url, token);
    const alerts = await res.json();

    // Filter for open and unresolved alerts
    const openAlerts = Array.isArray(alerts) ? alerts.filter(alert => alert.state === 'open') : [];

    return openAlerts;
  } catch (error) {
    // If the endpoint is not available or the repo is not accessible, return empty array
    if (error.message.includes('404') || error.message.includes('403')) {
      return [];
    }
    throw error;
  }
}

export default githubSecurityAdvisories;
