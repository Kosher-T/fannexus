/**
 * Local Scraper Runner
 * 
 * Entry point for running the AO3 scraper locally.
 * Handles git sync before and after scraping.
 * 
 * Usage: npm run scrape:local
 *        npm run scrape:local -- --max-duration=3600
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { ScrapingOrchestrator } from './scrapingOrchestrator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

function gitSync(stage: 'pre' | 'post'): void {
  try {
    if (stage === 'pre') {
      console.log('\n🔄 Pulling latest data from git...');
      execSync('git pull --rebase', { cwd: PROJECT_ROOT, stdio: 'inherit' });
      console.log('✅ Git pull complete.\n');
    } else {
      console.log('\n📤 Committing and pushing scraped data...');
      execSync('git add data/', { cwd: PROJECT_ROOT, stdio: 'inherit' });

      // Check if there are changes
      try {
        execSync('git diff --staged --quiet', { cwd: PROJECT_ROOT });
        console.log('  No new data to commit.');
        return;
      } catch {
        // git diff --staged returns non-zero if there are staged changes
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      execSync(
        `git commit -m "🏠 Local scraping session ${timestamp}"`,
        { cwd: PROJECT_ROOT, stdio: 'inherit' }
      );
      execSync('git push', { cwd: PROJECT_ROOT, stdio: 'inherit' });
      console.log('✅ Data pushed to remote.\n');
    }
  } catch (error) {
    console.warn(`⚠️ Git ${stage}-sync failed (non-fatal):`, error);
  }
}

async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║        🏠 LOCAL AO3 SCRAPER                      ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  // Parse args
  const args = process.argv.slice(2);
  let maxDuration = 0; // unlimited by default for local

  for (const arg of args) {
    if (arg.startsWith('--max-duration=')) {
      maxDuration = parseInt(arg.split('=')[1]) || 0;
    }
  }

  // Pre-sync
  gitSync('pre');

  // Run orchestrator
  const orchestrator = new ScrapingOrchestrator('local', maxDuration);
  await orchestrator.run();

  // Post-sync
  gitSync('post');
}

const isDirectRun = process.argv[1] && (
  process.argv[1].includes('runLocalScraper') ||
  process.argv[1] === __filename
);

if (isDirectRun) {
  main()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}
