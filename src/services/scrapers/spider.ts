/**
 * @deprecated This file is superseded by scrapingOrchestrator.ts
 * Kept for reference only. Do not use in production.
 */
import * as fs from 'fs';
import * as path from 'path';
import { AO3Scraper } from './ao3/ao3Scraper';
import type { StoryMetadata } from '../../types/scraper';

const CHECKPOINT_FILE = path.join(__dirname, 'spider_checkpoint.json');
const OUTPUT_DIR = path.join(__dirname, '../../../data/scraped'); // Dummy storage directory
const RETRY_DELAY = 5000;
const MAX_CONSECUTIVE_ERRORS = 5;

// We do not have database context here, so we will use a dummy save function
// In production, sync this to Firebase or Postgres
async function saveStoryToDb(story: StoryMetadata) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  // Store just by fandom for now to prevent memory explosion if saving locally
  const safeName = story.fandoms[0]?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'unknown';
  const filePath = path.join(OUTPUT_DIR, `${safeName}.jsonl`);
  fs.appendFileSync(filePath, JSON.stringify(story) + '\n');
}

interface SpiderCheckpoint {
  scrapedDirectory: boolean;
  categoriesCompleted: string[];
  activeCategoryUrl: string | null;
  fandomsCompleted: string[];
  activeFandomUrl: string | null;
  lastPageScraped: number;
}

export class AO3Spider {
  private scraper: AO3Scraper;
  private checkpoint: SpiderCheckpoint;

  constructor() {
    this.scraper = new AO3Scraper();
    this.checkpoint = this.loadCheckpoint();
  }

  private loadCheckpoint(): SpiderCheckpoint {
    const defaultCheckpoint: SpiderCheckpoint = {
      scrapedDirectory: false,
      categoriesCompleted: [],
      activeCategoryUrl: null,
      fandomsCompleted: [],
      activeFandomUrl: null,
      lastPageScraped: 0,
    };

    if (fs.existsSync(CHECKPOINT_FILE)) {
      try {
        const fileContent = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
        return { ...defaultCheckpoint, ...JSON.parse(fileContent) };
      } catch (e) {
        console.warn('⚠️ Corrupt checkpoint, starting fresh.');
      }
    }
    return defaultCheckpoint;
  }

  private saveCheckpoint() {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(this.checkpoint, null, 2));
  }

  public async run() {
    console.log('🚀 Starting Universal AO3 Spider...');

    // Phase 1: Directory
    if (!this.checkpoint.scrapedDirectory) {
      console.log('📂 Scraping top-level media directory...');
      const categories = await this.scraper.scrapeFandomDirectory();

      const categoryCacheFile = path.join(__dirname, 'categories_cache.json');
      fs.writeFileSync(categoryCacheFile, JSON.stringify(categories, null, 2));

      this.checkpoint.scrapedDirectory = true;
      this.saveCheckpoint();
      console.log(`✅ Saved ${categories.length} generic categories.`);
    }

    // Load category cache
    const categories = JSON.parse(fs.readFileSync(path.join(__dirname, 'categories_cache.json'), 'utf-8'));

    // Phase 2: Iterate Categories
    for (const category of categories) {
      if (!category.viewAllUrl || this.checkpoint.categoriesCompleted.includes(category.categoryName)) {
        continue;
      }

      console.log(`\n========================================`);
      console.log(`🌐 Crawling Category: ${category.categoryName}`);
      console.log(`========================================`);

      // Get Fandoms for this category
      const fandomsCacheFile = path.join(__dirname, `fandoms_${category.categoryName.replace(/[^a-z0-9]/gi, '_')}.json`);
      let fandoms: Array<{ name: string; url: string; count: number }> = [];

      if (!fs.existsSync(fandomsCacheFile)) {
        await new Promise(r => setTimeout(r, 2000));
        fandoms = await this.scraper.scrapeCategoryFullList(category.viewAllUrl);
        fs.writeFileSync(fandomsCacheFile, JSON.stringify(fandoms, null, 2));
      } else {
        fandoms = JSON.parse(fs.readFileSync(fandomsCacheFile, 'utf-8'));
      }

      console.log(`📋 Found ${fandoms.length} fandoms in ${category.categoryName}.`);

      // Phase 3: Iterate Fandoms
      for (const fandom of fandoms) {
        if (this.checkpoint.fandomsCompleted.includes(fandom.url)) {
          continue;
        }

        console.log(`\n📚 Processing Fandom: ${fandom.name} (Expected works: ~${fandom.count})`);

        let page = this.checkpoint.activeFandomUrl === fandom.url ? this.checkpoint.lastPageScraped + 1 : 1;

        if (this.checkpoint.activeFandomUrl !== fandom.url) {
          this.checkpoint.activeFandomUrl = fandom.url;
          this.checkpoint.lastPageScraped = 0;
          this.saveCheckpoint();
        }

        let hasMorePages = true;
        let consecutiveErrors = 0;

        while (hasMorePages) {
          await new Promise(r => setTimeout(r, 2000)); // Polite crawl rate

          process.stdout.write(`   ↳ Scraping page ${page}... `);

          try {
            const works = await this.scraper.scrapeFandomWorkList(fandom.url, page);

            if (works.length === 0) {
              console.log('No works found (End of list).');
              hasMorePages = false;
              break;
            }

            for (const work of works) {
              await saveStoryToDb(work);
            }

            console.log(`Saved ${works.length} works.`);

            this.checkpoint.lastPageScraped = page;
            this.saveCheckpoint();

            page++;
            consecutiveErrors = 0;

          } catch (err) {
            console.error(`\n❌ Error on page ${page}:`, err);
            consecutiveErrors++;

            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
              console.error('🛑 Too many consecutive errors. Connection might be down. Exiting securely.');
              process.exit(1);
            }

            console.log(`   Retrying in ${RETRY_DELAY / 1000}s...`);
            await new Promise(r => setTimeout(r, RETRY_DELAY));
          }
        }

        // Fandom Complete
        this.checkpoint.fandomsCompleted.push(fandom.url);
        this.checkpoint.activeFandomUrl = null;
        this.checkpoint.lastPageScraped = 0;
        this.saveCheckpoint();
        console.log(`✅ Completed Fandom: ${fandom.name}`);
      }

      // Category Complete
      this.checkpoint.categoriesCompleted.push(category.categoryName);
      this.saveCheckpoint();
      console.log(`✅ Completed Category: ${category.categoryName}`);
    }

    console.log('\n🎉 ALL MEDIA CATEGORIES AND FANDOMS PROCESSED.');
  }
}

// Ensure the entry point exists if called directly via ts-node
if (require.main === module) {
  const spider = new AO3Spider();
  spider.run().catch(console.error);
}
