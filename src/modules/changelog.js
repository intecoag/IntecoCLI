import chalk from 'chalk';

const OWNER = 'intecoag';
const REPO = 'IntecoCLI';

async function showChangelog() {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/releases`,
    {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': `${REPO}-cli`
      }
    }
  );

  if (!res.ok) {
    console.error(chalk.red('Failed to fetch changelog'));
    return;
  }

  const releases = await res.json();

  // Reverse: oldest → newest
  releases.reverse();

  console.log(
    chalk.bold.cyan(`\n📦 Changelog for ${OWNER}/${REPO}\n`)
  );

  for (const r of releases) {
    const title = r.name || r.tag_name;

    console.log(
      chalk.bold.yellow(`\n▶ ${title}`)
    );

    if (!r.body) {
      console.log(chalk.gray('  No changelog provided'));
      continue;
    }

    // Light formatting for Markdown-like content
    const lines = r.body.split('\n');

    for (const line of lines) {
      if (line.startsWith('- ') || line.startsWith('* ')) {
        console.log(chalk.green(`  • ${line.slice(2)}`));
      } else if (line.startsWith('### ')) {
        console.log(chalk.bold.magenta(`\n  ${line.slice(4)}`));
      } else if (line.startsWith('## ')) {
        console.log(chalk.bold.blue(`\n${line.slice(3)}`));
      } else {
        console.log(chalk.gray(`  ${line}`));
      }
    }
  }
}

export default showChangelog;