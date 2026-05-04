/**
 * Fandom Discovery Module
 * 
 * Fetches the full list of fandoms for each AO3 category,
 * sorts by story count, and selects the top 50 per category.
 * Writes the result to data/ao3_target_fandoms.json.
 * 
 * Usage: npx tsx src/services/scrapers/ao3/fandomDiscovery.ts
 */

import './node18-polyfill';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AO3Scraper } from './ao3Scraper';
import type { FandomTarget, FandomTargetFile } from '../../../types/scraper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TOP_N = 50;
const OUTPUT_DIR = path.resolve(__dirname, '../../../../data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'ao3_target_fandoms.json');

export async function discoverFandoms(): Promise<FandomTargetFile> {
  const scraper = new AO3Scraper();

  console.log('═══════════════════════════════════════════════════');
  console.log('  🔍 AO3 FANDOM DISCOVERY');
  console.log('  Finding the top 50 fandoms per category...');
  console.log('═══════════════════════════════════════════════════\n');

  // Step 1: Get all categories from the media page
  console.log('📂 Fetching category directory from /media...');
  const categories = await scraper.scrapeFandomDirectory();

  if (categories.length === 0) {
    throw new Error('Failed to scrape any categories from /media. Check connectivity.');
  }

  console.log(`✅ Found ${categories.length} categories.\n`);

  const result: FandomTargetFile = {
    generatedAt: new Date().toISOString(),
    totalFandoms: 0,
    categories: [],
  };

  // Step 2: For each category, fetch the full fandom list and take top 50
  for (const category of categories) {
    console.log(`\n────────────────────────────────────────`);
    console.log(`📋 Category: ${category.categoryName}`);
    console.log(`────────────────────────────────────────`);

    if (!category.viewAllUrl) {
      console.warn(`   ⚠️ No "View All" URL for ${category.categoryName}. Using top fandoms from /media page.`);

      // Fall back to the top fandoms shown on the main media page
      const topFandoms: FandomTarget[] = category.topFandoms
        .sort((a, b) => (b.count || 0) - (a.count || 0))
        .slice(0, TOP_N)
        .map((f, i) => ({
          name: f.name,
          url: f.url,
          count: f.count,
          rank: i + 1,
          category: category.categoryName,
        }));

      result.categories.push({
        name: category.categoryName,
        fandoms: topFandoms,
      });
      result.totalFandoms += topFandoms.length;

      console.log(`   📊 Selected ${topFandoms.length} fandoms (from main page).`);
      topFandoms.slice(0, 5).forEach(f => {
        console.log(`      #${f.rank} ${f.name} (${f.count !== null ? f.count.toLocaleString() : 'null'} works)`);
      });
      if (topFandoms.length > 5) console.log(`      ... and ${topFandoms.length - 5} more`);
      continue;
    }

    // Fetch full list
    console.log(`   🌐 Fetching full fandom list...`);
    const allFandoms = await scraper.scrapeCategoryFullList(category.viewAllUrl);
    console.log(`   📊 Total fandoms in category: ${allFandoms.length}`);

    // Sort by count descending, take top N
    const topFandoms: FandomTarget[] = allFandoms
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, TOP_N)
      .map((f, i) => ({
        name: f.name,
        url: f.url,
        count: f.count,
        rank: i + 1,
        category: category.categoryName,
      }));

    result.categories.push({
      name: category.categoryName,
      fandoms: topFandoms,
    });
    result.totalFandoms += topFandoms.length;

    console.log(`   ✅ Selected top ${topFandoms.length} fandoms:`);
    topFandoms.slice(0, 5).forEach(f => {
      console.log(`      #${f.rank} ${f.name} (${f.count !== null ? f.count.toLocaleString() : 'null'} works)`);
    });
    if (topFandoms.length > 5) console.log(`      ... and ${topFandoms.length - 5} more`);
  }

  // Step 3: Write to file
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  ✅ FANDOM DISCOVERY COMPLETE`);
  console.log(`  Total categories: ${result.categories.length}`);
  console.log(`  Total target fandoms: ${result.totalFandoms}`);
  console.log(`  Saved to: ${OUTPUT_FILE}`);
  console.log(`═══════════════════════════════════════════════════\n`);

  return result;
}

// ============================================================
// CLI entry point
// ============================================================

const isDirectRun = process.argv[1] && (
  process.argv[1].includes('fandomDiscovery') ||
  process.argv[1] === __filename
);

if (isDirectRun) {
  discoverFandoms()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error during fandom discovery:', err);
      process.exit(1);
    });
}
