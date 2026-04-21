import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import { getGithubToken, fetchPaginatedGithubAPI, fetchGithubAPI } from '../utils/github/github.js';

export async function addGithubDeploymentKey() {
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

  // Step 1: Select Organization
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
      console.log(chalk.red('Cancelled GitHub Deployment Key setup!'));
      console.log();
      process.exit(0);
    }
  });

  const { organization } = orgResponse;

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

    spinner.succeed(`Found ${repos.length} repositories`);
    console.log();

    // Step 2: Select Repository
    const repoResponse = await prompts([
      {
        type: 'autocomplete',
        name: 'repository',
        message: 'Select repository:',
        choices: repos.map(repo => ({
          title: repo.name,
          value: repo.name,
          description: repo.description || 'No description'
        })),
        hint: 'Start typing to filter'
      }
    ], {
      onCancel: () => {
        console.log();
        console.log(chalk.red('Cancelled GitHub Deployment Key setup!'));
        console.log();
        process.exit(0);
      }
    });

    const { repository } = repoResponse;

    // Step 3: Generate and display setup script
    displayDeploymentKeyScript(organization, repository);

    // Step 4: Prompt for public key and create deployment key
    const publicKeyResponse = await prompts([
      {
        type: 'text',
        name: 'publicKey',
        message: 'Paste the public key content here:',
        validate: (value) => {
          if (!value.trim().length) return 'Public key is required';
          if (!value.includes('ssh-ed25519') && !value.includes('ssh-rsa') && !value.includes('ecdsa-sha2')) {
            return 'Invalid SSH public key format';
          }
          return true;
        }
      },
      {
        type: 'text',
        name: 'keyName',
        message: 'Deployment key name:',
        validate: (value) => value.length > 0 || 'Key name is required'
      }
    ], {
      onCancel: () => {
        console.log();
        console.log(chalk.yellow('Skipped creating deployment key on GitHub. You can add it manually later.'));
        console.log();
        process.exit(0);
      }
    });

    const { publicKey, keyName } = publicKeyResponse;

    // Create deployment key on GitHub
    await createDeploymentKey(organization, repository, publicKey, keyName);

    // Step 5: Show clone command
    displayCloneCommand(organization, repository);

  } catch (error) {
    console.log();
    spinner.fail('Error fetching repositories');

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

function displayDeploymentKeyScript(organization, repository) {
  const keyPath = '~/.ssh/id_ed25519_github_keys';
  const deploymentKeyName = `${repository}-deployment-key`;

  console.log();
  console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════'));
  console.log(chalk.bold.cyan(`Deployment Key Setup for: ${organization}/${repository}`));
  console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════'));
  console.log();

  console.log(chalk.bold.yellow('STEP 1: Copy and paste the script below on your server'));
  console.log(chalk.gray('─────────────────────────────────────────────────────────────'));
  console.log();

  const linuxScript = generateBashScript(keyPath, deploymentKeyName, organization, repository);

  console.log(chalk.bold('Linux/macOS Setup Script:'));
  console.log(chalk.blue('─────────────────────────────────────────────────────────────'));
  console.log(linuxScript);
  console.log();

}

function generateBashScript(keyPath, keyName, organization, repository) {
  // Convert ~ to $HOME for proper expansion in bash
  const expandedKeyPath = keyPath.replace(/^~/, '$HOME');
  
  return `#!/bin/bash
set -e

# Create SSH directory if it doesn't exist
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Generate ED25519 SSH key (secure and modern)
ssh-keygen -t ed25519 -C "${keyName}" -f "${expandedKeyPath}" -N ""

# Set proper permissions
chmod 600 "${expandedKeyPath}"
chmod 644 "${expandedKeyPath}.pub"

# Add to SSH config for easy usage
if ! grep -q "Host github-${organization}-${repository}" ~/.ssh/config 2>/dev/null; then
  cat >> ~/.ssh/config << 'EOF'

Host github-${organization}-${repository}
    HostName github.com
    User git
    IdentityFile ${keyPath}
    IdentitiesOnly yes
EOF
fi

# Display public key for GitHub setup
echo ""
echo "========================================"
echo "Public Key (copy this to Inteco CLI):"
echo "========================================"
cat "${expandedKeyPath}.pub"
echo ""
echo "========================================"
echo "Private key saved to: ${expandedKeyPath}"
echo "SSH config updated for: github-${organization}-${repository}"
echo "========================================"
echo ""`;
}

async function createDeploymentKey(organization, repository, publicKey, keyName) {
  const spinner = ora('Creating deployment key on GitHub...').start();

  try {
    // Use GitHub CLI to add the deployment key
    const result = execSync(
      `gh repo deploy-key add --repo ${organization}/${repository} --title "${keyName}" -`,
      {
        input: publicKey,
        encoding: 'utf-8'
      }
    );

    spinner.succeed(`Deployment key "${keyName}" created successfully`);
    console.log();

  } catch (error) {
    spinner.fail('Failed to create deployment key');
    
    if (error.message.includes('not found')) {
      console.error(chalk.red(`✗ Repository not found: ${organization}/${repository}`));
    } else if (error.message.includes('already exists')) {
      console.error(chalk.red(`✗ A key with this name already exists`));
    } else if (error.message.includes('Permission denied')) {
      console.error(chalk.red(`✗ Permission denied. You may not have write access to this repository`));
    } else {
      console.error(chalk.red(`✗ Error: ${error.message}`));
    }
    console.log();
    process.exit(1);
  }
}

function displayCloneCommand(organization, repository) {
  console.log(chalk.bold.yellow('Clone Command'));
  console.log(chalk.gray('─────────────────────────────────────────────────────────────'));
  console.log('Use this command to clone the repository with the deployment key:');
  console.log();
  console.log(chalk.cyan(`git clone git@github-${organization}-${repository}:${organization}/${repository}.git`));
  console.log();
  console.log(chalk.bold.yellow('Deployment Setup Complete!'));
  console.log(chalk.green(`✓ SSH key generated and stored locally`));
  console.log(chalk.green(`✓ Deployment key added to ${organization}/${repository}`));
  console.log(chalk.green(`✓ SSH config configured for easy access`));
  console.log();
}

export default addGithubDeploymentKey;
