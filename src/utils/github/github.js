import chalk from 'chalk';
import { execSync } from 'child_process';

/**
 * Get GitHub authentication token from environment or GitHub CLI
 * @returns {Promise<{token: string, authMethod: string}>} Token and authentication method
 * @throws {Error} If no authentication method is available
 */
export async function getGithubToken() {
  let token = null;
  let authMethod = null;

  // 1. Try GITHUB_TOKEN environment variable
  if (process.env.GITHUB_TOKEN) {
    token = process.env.GITHUB_TOKEN;
    authMethod = 'GITHUB_TOKEN (environment variable)';
  }

  // 2. Try GitHub CLI authentication if available
  if (!token) {
    try {
      token = execSync('gh auth token', { encoding: 'utf-8' }).trim();
      authMethod = 'GitHub CLI';
    } catch (error) {
      // GitHub CLI not available or not authenticated
    }
  }

  // 3. If no token found, prompt user to authenticate
  if (!token) {
    console.log(chalk.yellow('No GitHub authentication found. Please authenticate with GitHub CLI:'));
    console.log(chalk.gray('  Run: gh auth login'));
    console.log();
    throw new Error('GitHub authentication required. Please run "gh auth login" or set GITHUB_TOKEN environment variable.');
  }

  return { token, authMethod };
}

/**
 * Make a GitHub API fetch request with proper headers and error handling
 * @param {string} url - GitHub API endpoint URL
 * @param {string} token - GitHub authentication token
 * @returns {Promise<Response>} Fetch response
 * @throws {Error} If fetch fails or returns error status
 */
export async function fetchGithubAPI(url, token) {
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'inteco-cli'
    }
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`404: Resource not found`);
    }
    if (res.status === 401) {
      throw new Error('401: GitHub authentication failed');
    }
    if (res.status === 403) {
      throw new Error('403: Access forbidden (Dependabot alerts may not be enabled)');
    }
    throw new Error(`${res.status}: GitHub API request failed: ${res.statusText}`);
  }

  return res;
}

/**
 * Fetch all items from a paginated GitHub API endpoint
 * @param {string} baseUrl - Base GitHub API endpoint URL (without pagination params)
 * @param {string} token - GitHub authentication token
 * @param {number} page - Current page (default: 1)
 * @param {Array} allItems - Accumulated items (default: [])
 * @returns {Promise<Array>} All items from all pages
 */
export async function fetchPaginatedGithubAPI(baseUrl, token, page = 1, allItems = []) {
  const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}page=${page}&per_page=100`;

  try {
    const res = await fetchGithubAPI(url, token);
    const items = await res.json();

    if (items.length === 0) {
      return allItems;
    }

    // Recursively fetch all pages
    return fetchPaginatedGithubAPI(baseUrl, token, page + 1, [...allItems, ...items]);
  } catch (error) {
    if (page === 1) {
      // Only throw on first page - error getting initial data
      throw error;
    }
    // On subsequent pages, return what we have so far
    return allItems;
  }
}
