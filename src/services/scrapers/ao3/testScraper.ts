/**
 * AO3 Scraper Test Script
 * 
 * Local testing tool that:
 * 1. Runs fandom discovery → displays categories and top 50 per category
 * 2. Picks one fandom (a smaller one for speed)
 * 3. Scrapes page 1 of that fandom
 * 4. Pretty-prints complete StoryMetadata for the first few works
 * 5. Writes results to data/test_output.json
 * 
 * Usage: npm run scrape:test
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AO3Scraper } from './ao3Scraper';
import { discoverFandoms } from './fandomDiscovery';
import type { FandomTargetFile, StoryMetadata } from '../../../types/scraper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../../../data');
const TARGET_FANDOMS_FILE = path.join(DATA_DIR, 'ao3_target_fandoms.json');
const TEST_OUTPUT_FILE = path.join(DATA_DIR, 'test_output.json');

function prettyPrintStory(story: StoryMetadata, index: number): void {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  📖 STORY #${index + 1}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  AO3 ID:       ${story.ao3Id}`);
  console.log(`  Title:        ${story.title}`);
  console.log(`  Link:         ${story.link}`);
  console.log(`  Author:       ${story.author}`);
  if (story.authorLink) console.log(`  Author URL:   ${story.authorLink}`);
  if (story.coAuthors?.length) console.log(`  Co-Authors:   ${story.coAuthors.map(a => a.name).join(', ')}`);
  if (story.giftedTo?.length) console.log(`  Gifted To:    ${story.giftedTo.join(', ')}`);
  console.log(`  Rating:       ${story.rating}`);
  console.log(`  Category:     ${story.category.join(', ') || 'None'}`);
  console.log(`  Warnings:     ${story.warnings.join(', ') || 'None'}`);
  console.log(`  Fandoms:      ${story.fandoms.join(', ')}`);
  console.log(`  Relationships:${story.relationships.length ? ' ' + story.relationships.join(', ') : ' None'}`);
  console.log(`  Characters:   ${story.characters.length ? story.characters.join(', ') : 'None'}`);
  console.log(`  Tags:         ${story.tags.length ? story.tags.slice(0, 8).join(', ') + (story.tags.length > 8 ? ` (+${story.tags.length - 8} more)` : '') : 'None'}`);
  console.log(`  Language:     ${story.language}`);
  console.log(`  Words:        ${story.wordCount.toLocaleString()}`);
  console.log(`  Chapters:     ${story.chapterCount}/${story.totalChapters ?? '?'}`);
  console.log(`  Completed:    ${story.isCompleted ? '✅ Yes' : '❌ No'}`);
  if (story.publishedDate) console.log(`  Published:    ${story.publishedDate}`);
  if (story.updatedDate) console.log(`  Updated:      ${story.updatedDate}`);
  console.log(`  Kudos:        ${story.stats.kudos.toLocaleString()}`);
  console.log(`  Hits:         ${story.stats.hits.toLocaleString()}`);
  console.log(`  Bookmarks:    ${story.stats.bookmarks.toLocaleString()}`);
  console.log(`  Comments:     ${story.stats.comments.toLocaleString()}`);
  if (story.series?.length) {
    story.series.forEach(s => console.log(`  Series:       Part ${s.part} of "${s.name}"`));
  }
  if (story.collections?.length) console.log(`  Collections:  ${story.collections.join(', ')}`);
  console.log(`  Source:       ${story.sourceSite}`);
  console.log(`  Scraped:      ${story.scrapedAt}`);
  console.log(`  Scraped From: ${story.scrapedFrom}`);
  if (story.summary) {
    const truncated = story.summary.length > 200 
      ? story.summary.slice(0, 200) + '...' 
      : story.summary;
    console.log(`  Summary:      ${truncated}`);
  }
}

async function runTest(): Promise<void> {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║         🧪 AO3 SCRAPER TEST                      ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  // ─── Step 1: Fandom Discovery ───
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  STEP 1: Fandom Discovery');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  let targetData: FandomTargetFile;

  if (fs.existsSync(TARGET_FANDOMS_FILE)) {
    console.log(`📂 Target fandoms file already exists. Loading from cache...`);
    targetData = JSON.parse(fs.readFileSync(TARGET_FANDOMS_FILE, 'utf-8'));
  } else {
    console.log('🔍 Running fandom discovery...\n');
    targetData = await discoverFandoms();
  }

  // Display summary
  console.log(`\n📊 FANDOM SUMMARY:`);
  console.log(`${'─'.repeat(60)}`);
  for (const cat of targetData.categories) {
    const totalWorks = cat.fandoms.reduce((sum, f) => sum + f.count, 0);
    console.log(`  📁 ${cat.name}: ${cat.fandoms.length} fandoms (${totalWorks.toLocaleString()} total works)`);
    cat.fandoms.slice(0, 3).forEach(f => {
      console.log(`     #${f.rank} ${f.name} (${f.count.toLocaleString()})`);
    });
    if (cat.fandoms.length > 3) console.log(`     ... +${cat.fandoms.length - 3} more`);
  }
  console.log(`${'─'.repeat(60)}`);
  console.log(`  Total target fandoms: ${targetData.totalFandoms}\n`);

  // ─── Step 2: Pick a test fandom ───
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  STEP 2: Scraping a Test Fandom');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Find a smaller fandom for quick testing (Theater is usually smallest)
  const allFandoms = targetData.categories.flatMap(c => c.fandoms);
  // Sort by count ascending and pick a mid-size one (not too small, not too big)
  const sorted = [...allFandoms].sort((a, b) => a.count - b.count);
  const testFandom = sorted.find(f => f.count >= 1000 && f.count <= 50000) || sorted[Math.floor(sorted.length / 2)];

  console.log(`  Selected test fandom: "${testFandom.name}"`);
  console.log(`  Category: ${testFandom.category}`);
  console.log(`  Expected works: ~${testFandom.count.toLocaleString()}`);
  console.log(`  URL: ${testFandom.url}\n`);

  // ─── Step 3: Scrape page 1 ───
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  STEP 3: Scraping Page 1');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const scraper = new AO3Scraper();
  const works = await scraper.scrapeFandomWorkList(testFandom.url, 1);

  console.log(`\n  📊 Scraped ${works.length} works from page 1.\n`);

  if (works.length === 0) {
    console.log('  ⚠️ No works found. The fandom page might be structured differently.');
    return;
  }

  // ─── Step 4: Display results ───
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  STEP 4: Story Metadata');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Show first 3 stories in detail
  const displayCount = Math.min(3, works.length);
  for (let i = 0; i < displayCount; i++) {
    prettyPrintStory(works[i], i);
  }

  // ─── Step 5: Write to file ───
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`\n  💾 Writing all ${works.length} stories to ${TEST_OUTPUT_FILE}...`);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  fs.writeFileSync(TEST_OUTPUT_FILE, JSON.stringify({
    testFandom: testFandom,
    scrapedAt: new Date().toISOString(),
    workCount: works.length,
    works: works,
  }, null, 2));

  console.log('  ✅ Test output saved.\n');

  // ─── Step 6: Metadata coverage check ───
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  STEP 5: Metadata Coverage Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const fields = [
    'ao3Id', 'title', 'link', 'author', 'authorLink', 'fandoms',
    'rating', 'category', 'warnings', 'relationships', 'characters',
    'tags', 'summary', 'language', 'wordCount', 'chapterCount',
    'totalChapters', 'isCompleted', 'updatedDate', 'stats',
    'sourceSite', 'scrapedAt', 'scrapedFrom',
  ];

  for (const field of fields) {
    const populated = works.filter(w => {
      const val = (w as any)[field];
      if (val === undefined || val === null || val === '') return false;
      if (Array.isArray(val) && val.length === 0) return false;
      return true;
    }).length;

    const pct = Math.round((populated / works.length) * 100);
    const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
    const status = pct === 100 ? '✅' : pct > 50 ? '⚠️' : '❌';
    console.log(`  ${status} ${field.padEnd(16)} ${bar} ${pct}% (${populated}/${works.length})`);
  }

  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║         ✅ TEST COMPLETE                          ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');
}

// CLI entry point
const isDirectRun = process.argv[1] && (
  process.argv[1].includes('testScraper') ||
  process.argv[1] === __filename
);

if (isDirectRun) {
  runTest()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Test failed:', err);
      process.exit(1);
    });
}
