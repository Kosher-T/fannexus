/**
 * AO3 Scraping Orchestrator
 * 
 * Production-grade spider with:
 * - Checkpoint persistence for resume capability
 * - Deduplication via scraped_ids.txt
 * - Failed work retry queue
 * - Firebase coordination for dual-scraper harmony
 * - Session time limits with graceful shutdown
 * - Date-range chunking for large fandoms (>100K works)
 * 
 * Usage:
 *   npx tsx src/services/scrapers/ao3/scrapingOrchestrator.ts --runner-id=github-actions --max-duration=18000
 *   npx tsx src/services/scrapers/ao3/scrapingOrchestrator.ts --runner-id=local
 */

import './node18-polyfill';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AO3Scraper } from './ao3Scraper';
import {
  initFirebase,
  acquireFandomLock,
  releaseFandomLock,
  startHeartbeat,
  stopHeartbeat,
  markFandomCompleted,
  isFandomCompleted,
  getNextAvailableFandom,
  updateScraperStatus,
  pushAlert,
  createAlertCallback,
} from './firebaseCoordination';
import type {
  StoryMetadata,
  FandomTarget,
  FandomTargetFile,
  ScrapingCheckpoint,
  DateChunk,
  FailedWork,
} from '../../../types/scraper';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// Paths
// ============================================================

const DATA_DIR = path.resolve(__dirname, '../../../../data');
const SCRAPING_DIR = path.join(DATA_DIR, 'scraping');
const SCRAPED_DIR = path.join(DATA_DIR, 'scraped');
const SCRAPED_IDS_DIR = SCRAPING_DIR; // Use the same dir for scraped ID files
const FAILED_WORKS_FILE_PREFIX = 'failed_works_';
const PENDING_INGEST_FILE_PREFIX = 'pending_ingest_files_';
const TARGET_FANDOMS_FILE = path.join(DATA_DIR, 'ao3_target_fandoms.json');

// Legacy paths for migration
const LEGACY_CHECKPOINT_FILE = path.join(SCRAPING_DIR, 'checkpoint.json');
const LEGACY_FAILED_WORKS_FILE = path.join(SCRAPING_DIR, 'failed_works.jsonl');
const LEGACY_PENDING_INGEST_FILE = path.join(SCRAPING_DIR, 'pending_ingest_files.txt');
const LEGACY_SCRAPED_IDS_FILE = path.join(SCRAPING_DIR, 'scraped_ids.txt');

// ============================================================
// Constants
// ============================================================

const MAX_CONSECUTIVE_ERRORS = 3;
const RETRY_DELAY_MS = 10000;
const DEFAULT_MAX_DURATION_S = 0;  // 0 = unlimited


export class ScrapingOrchestrator {
  private scraper: AO3Scraper;
  private runnerId: string;
  private checkpointPath: string;
  private failedWorksPath: string;
  private pendingIngestPath: string;
  private maxDurationMs: number;
  private startTime: number;
  private checkpoint: ScrapingCheckpoint;
  private scrapedIds: Set<string>;
  private currentPage: number = 0;
  private shouldStop: boolean = false;

  constructor(runnerId: string = 'local', maxDurationSeconds: number = DEFAULT_MAX_DURATION_S) {
    this.runnerId = runnerId;
    this.checkpointPath = path.join(SCRAPING_DIR, `checkpoint_${this.runnerId}.json`);
    this.failedWorksPath = path.join(SCRAPING_DIR, `${FAILED_WORKS_FILE_PREFIX}${this.runnerId}.jsonl`);
    this.pendingIngestPath = path.join(SCRAPING_DIR, `${PENDING_INGEST_FILE_PREFIX}${this.runnerId}.txt`);
    this.maxDurationMs = maxDurationSeconds > 0 ? maxDurationSeconds * 1000 : 0;
    this.startTime = Date.now();

    this.scraper = new AO3Scraper();
    this.checkpoint = this.loadCheckpoint();
    this.scrapedIds = this.loadScrapedIds();

    // Wire up Firebase alerting
    this.scraper.onAlert = createAlertCallback(this.runnerId);

    // Handle graceful shutdown on SIGINT/SIGTERM
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
  }

  // ============================================================
  // Main entry point
  // ============================================================

  async run(): Promise<void> {
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║        🕷️  AO3 SCRAPING ORCHESTRATOR              ║');
    console.log('╠═══════════════════════════════════════════════════╣');
    console.log(`║  Runner:      ${this.runnerId.padEnd(35)}║`);
    console.log(`║  Max duration: ${this.maxDurationMs ? `${this.maxDurationMs / 1000}s` : 'unlimited'}${' '.repeat(Math.max(0, 34 - (this.maxDurationMs ? `${this.maxDurationMs / 1000}s`.length : 'unlimited'.length)))}║`);
    console.log(`║  Scraped IDs:  ${String(this.scrapedIds.size).padEnd(34)}║`);
    console.log('╚═══════════════════════════════════════════════════╝\n');

    // Initialize Firebase
    try {
      initFirebase();
      await updateScraperStatus(this.runnerId, 'running', {
        startedAt: new Date().toISOString(),
      });
      await pushAlert({
        type: 'session-start',
        runnerId: this.runnerId,
        message: `Scraping session started. ${this.scrapedIds.size} IDs in dedup index.`,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('[Orchestrator] ⚠️ Firebase init failed — running without coordination:', e);
    }

    // Load target fandoms
    if (!fs.existsSync(TARGET_FANDOMS_FILE)) {
      console.error(`❌ Target fandoms file not found: ${TARGET_FANDOMS_FILE}`);
      console.error('   Run fandom discovery first: npx tsx src/services/scrapers/ao3/fandomDiscovery.ts');
      process.exit(1);
    }

    const targetData: FandomTargetFile = JSON.parse(fs.readFileSync(TARGET_FANDOMS_FILE, 'utf-8'));
    const allFandoms: FandomTarget[] = targetData.categories.flatMap(c => c.fandoms);

    console.log(`📋 Loaded ${allFandoms.length} target fandoms across ${targetData.categories.length} categories.\n`);

    // Update checkpoint
    this.checkpoint.runnerId = this.runnerId;
    this.checkpoint.startedAt = new Date().toISOString();
    this.saveCheckpoint();

    // Main scraping loop
    let fandomsAttempted = 0;

    while (!this.shouldStop && !this.isTimeUp()) {
      const fandom = await getNextAvailableFandom(allFandoms, this.runnerId);

      if (!fandom) {
        console.log('\n🎉 All fandoms either completed or locked. Nothing to do.');
        break;
      }

      fandomsAttempted++;
      await this.scrapeFandom(fandom);

      if (this.shouldStop) break;
    }

    // Session end
    await this.endSession();
  }

  // ============================================================
  // Scrape a single fandom (all pages, with date chunking if needed)
  // ============================================================

  private async scrapeFandom(fandom: FandomTarget): Promise<void> {
    console.log(`\n╔═══════════════════════════════════════════════════╗`);
    console.log(`║  📚 FANDOM: ${fandom.name.slice(0, 38).padEnd(38)}║`);
    console.log(`║  Category: ${fandom.category.slice(0, 39).padEnd(39)}║`);
    const countStr = fandom.count !== null ? fandom.count.toLocaleString() : 'null';
    console.log(`║  Expected: ~${countStr} works${' '.repeat(Math.max(0, 36 - `~${countStr} works`.length))}║`);
    console.log(`╚═══════════════════════════════════════════════════╝\n`);

    // Determine if we need date-range chunking
    const dateChunks = this.scraper.buildDateRangeChunks(fandom.count);
    const needsChunking = dateChunks.length > 0;

    if (needsChunking) {
      console.log(`   📅 Fandom requires date-range chunking (${dateChunks.length} chunks).`);
    }

    // Prepare output directory
    const categorySlug = this.slugify(fandom.category);
    const fandomSlug = this.slugify(fandom.name);
    const outputDir = path.join(SCRAPED_DIR, categorySlug);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputFile = path.join(outputDir, `${fandomSlug}.jsonl`);

    // Update checkpoint
    this.checkpoint.activeFandom = {
      name: fandom.name,
      url: fandom.url,
      category: fandom.category,
      dateChunk: null,
      lastPage: 0,
    };
    this.saveCheckpoint();

    // Start heartbeat
    startHeartbeat(fandom.url, () => this.currentPage);

    let totalForFandom = 0;
    let consecutiveErrors = 0;

    try {
      if (needsChunking) {
        // Scrape each date chunk
        for (const chunk of dateChunks) {
          if (this.shouldStop || this.isTimeUp()) break;

          console.log(`\n   📅 Date chunk: ${chunk.from} → ${chunk.to}`);
          this.checkpoint.activeFandom!.dateChunk = chunk;
          this.saveCheckpoint();

          const chunkCount = await this.scrapePages(fandom, outputFile, chunk);
          totalForFandom += chunkCount;
          consecutiveErrors = 0;
        }
      } else {
        // Scrape without chunking
        totalForFandom = await this.scrapePages(fandom, outputFile);
      }
    } catch (error) {
      console.error(`   ❌ Fatal error scraping fandom "${fandom.name}":`, error);
    }

    // Cleanup
    stopHeartbeat();

    if (totalForFandom > 0) {
      this.appendPendingIngestFile(outputFile);
    }

    if (!this.shouldStop && !this.isTimeUp()) {
      // Fandom completed successfully
      try {
        await markFandomCompleted(fandom.url, fandom.name, this.runnerId, totalForFandom);
        await releaseFandomLock(fandom.url);
        await pushAlert({
          type: 'fandom-complete',
          runnerId: this.runnerId,
          message: `Completed "${fandom.name}": ${totalForFandom} stories scraped.`,
          timestamp: new Date().toISOString(),
          details: { fandomName: fandom.name, count: totalForFandom },
        });
      } catch (e) {
        console.warn('[Orchestrator] ⚠️ Failed to update Firebase on fandom completion:', e);
      }

      this.checkpoint.completedFandoms.push(fandom.url);
      this.checkpoint.activeFandom = null;
      this.saveCheckpoint();

      console.log(`\n   ✅ COMPLETED: "${fandom.name}" — ${totalForFandom} stories scraped.`);
    } else {
      // Time up or shutdown — save progress, keep lock
      console.log(`\n   ⏸️  Pausing "${fandom.name}" at page ${this.currentPage}.`);
    }
  }

  // ============================================================
  // Scrape all pages for a fandom (or date chunk)
  // ============================================================

  private async scrapePages(
    fandom: FandomTarget,
    outputFile: string,
    dateChunk?: DateChunk
  ): Promise<number> {
    // Determine starting page (resume from checkpoint if same fandom/chunk)
    let page = 1;
    if (
      this.checkpoint.activeFandom?.url === fandom.url &&
      this.checkpoint.activeFandom?.lastPage > 0 &&
      this.isSameChunk(this.checkpoint.activeFandom.dateChunk, dateChunk || null)
    ) {
      page = this.checkpoint.activeFandom.lastPage + 1;
      console.log(`   ↪️ Resuming from page ${page}.`);
    }

    let totalCount = 0;
    let consecutiveErrors = 0;
    let hasMore = true;

    while (hasMore && !this.shouldStop && !this.isTimeUp()) {
      this.currentPage = page;

      try {
        const works = await this.scraper.scrapeFandomWorkList(fandom.url, page, dateChunk);

        if (works.length === 0) {
          console.log(`   📭 Page ${page}: No works found (end of listing).`);
          hasMore = false;
          break;
        }

        // Deduplication
        let newWorks = 0;
        let dupCount = 0;

        for (const work of works) {
          if (this.scrapedIds.has(work.ao3Id)) {
            dupCount++;
            continue;
          }

          // Save to JSONL
          fs.appendFileSync(outputFile, JSON.stringify(work) + '\n');

          // Track dedup
          this.scrapedIds.add(work.ao3Id);
          this.appendScrapedId(work.ao3Id);

          newWorks++;
          totalCount++;
          this.checkpoint.stats.totalScraped++;
          this.checkpoint.stats.sessionScraped++;
        }

        const dupMsg = dupCount > 0 ? ` (${dupCount} duplicates skipped)` : '';
        console.log(`   ✅ Page ${page}: ${newWorks} new works saved${dupMsg}.`);

        // If less than 20 works are returned, it's the last page
        if (works.length < 20) {
          console.log(`   🏁 Page ${page}: Less than 20 works returned. End of listing.`);
          hasMore = false;
        }

        // Update checkpoint
        this.checkpoint.activeFandom!.lastPage = page;
        this.checkpoint.stats.totalPages++;
        this.checkpoint.lastActivity = new Date().toISOString();
        this.saveCheckpoint();

        page++;
        consecutiveErrors = 0;

        // AO3 caps at 5000 pages
        if (page > 5000) {
          console.log(`   ⚠️ Reached AO3's 5000 page limit.`);
          hasMore = false;
        }

      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));

        // Scraper pause request — bubble up
        if (err.message === 'SCRAPER_PAUSED') {
          console.log(`   ⏸️ Scraper paused.`);
          break;
        }

        // Soft-ban — the base scraper already handled backoff, but if we get
        // here it means max backoff was exceeded
        if (err.message === 'SOFT_BAN_MAX_BACKOFF' || err.message === 'CLOUDFLARE_CHALLENGE') {
          console.error(`   🚨 Soft-ban recovery exhausted. Pausing session.`);
          this.shouldStop = true;
          break;
        }

        consecutiveErrors++;
        console.error(`   ❌ Error on page ${page} (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, err.message);

        // Log failed page for retry
        this.logFailedWork({
          workUrl: `${fandom.url}?page=${page}`,
          fandomUrl: fandom.url,
          fandomName: fandom.name,
          error: err.message,
          failedAt: new Date().toISOString(),
          retryCount: 0,
          page,
        });

        this.checkpoint.stats.totalFailed++;

        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error(`   🛑 Too many consecutive errors (${MAX_CONSECUTIVE_ERRORS}). Moving on.`);
          break;
        }

        // Wait and retry
        console.log(`   ⏳ Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await this.sleep(RETRY_DELAY_MS);
      }
    }

    return totalCount;
  }

  // ============================================================
  // Session management
  // ============================================================

  private isTimeUp(): boolean {
    if (this.maxDurationMs === 0) return false;
    return (Date.now() - this.startTime) >= this.maxDurationMs;
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    console.log(`\n\n🛑 Received ${signal}. Initiating graceful shutdown...`);
    if (this.shouldStop) {
      console.log('Forcing exit due to multiple signals...');
      process.exit(1);
    }
    this.shouldStop = true;
    this.scraper.isPaused = true;

    // Safety timeout: if graceful shutdown hangs (e.g. Firebase unresponsive), force exit
    setTimeout(() => {
      console.log('\n🛑 Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 5000).unref();
  }

  private async endSession(): Promise<void> {
    stopHeartbeat();
    await this.scraper.closeBrowser();

    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    console.log(`\n╔═══════════════════════════════════════════════════╗`);
    console.log(`║           📊 SESSION SUMMARY                      ║`);
    console.log(`╠═══════════════════════════════════════════════════╣`);
    console.log(`║  Runner:          ${this.runnerId.padEnd(31)}║`);
    console.log(`║  Duration:        ${`${minutes}m ${seconds}s`.padEnd(31)}║`);
    console.log(`║  Stories scraped:  ${String(this.checkpoint.stats.sessionScraped).padEnd(30)}║`);
    console.log(`║  Total in index:   ${String(this.scrapedIds.size).padEnd(30)}║`);
    console.log(`║  Pages processed:  ${String(this.checkpoint.stats.totalPages).padEnd(30)}║`);
    console.log(`║  Failed items:     ${String(this.checkpoint.stats.totalFailed).padEnd(30)}║`);
    console.log(`╚═══════════════════════════════════════════════════╝\n`);

    this.saveCheckpoint();

    try {
      await updateScraperStatus(this.runnerId, 'idle', {
        lastSessionEnd: new Date().toISOString(),
        sessionScraped: this.checkpoint.stats.sessionScraped,
      });
      await pushAlert({
        type: 'session-end',
        runnerId: this.runnerId,
        message: `Session ended. ${this.checkpoint.stats.sessionScraped} stories in ${minutes}m ${seconds}s.`,
        timestamp: new Date().toISOString(),
        details: { 
          duration: elapsed,
          scraped: this.checkpoint.stats.sessionScraped,
          totalInIndex: this.scrapedIds.size,
        },
      });
    } catch (e) {
      console.warn('[Orchestrator] ⚠️ Failed to update Firebase on session end:', e);
    }
  }

  // ============================================================
  // Checkpoint persistence
  // ============================================================

  private loadCheckpoint(): ScrapingCheckpoint {
    const defaultCheckpoint: ScrapingCheckpoint = {
      runnerId: this.runnerId,
      startedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      activeFandom: null,
      completedFandoms: [],
      stats: {
        totalScraped: 0,
        totalFailed: 0,
        totalPages: 0,
        sessionScraped: 0,
      },
    };

    this.ensureDir(SCRAPING_DIR);

    // Try runner-specific checkpoint first
    let sourcePath = this.checkpointPath;
    if (!fs.existsSync(this.checkpointPath) && fs.existsSync(LEGACY_CHECKPOINT_FILE)) {
      sourcePath = LEGACY_CHECKPOINT_FILE;
      console.log(`🚛 Migrating from legacy checkpoint: ${LEGACY_CHECKPOINT_FILE}`);
    }

    if (fs.existsSync(sourcePath)) {
      try {
        const content = fs.readFileSync(sourcePath, 'utf-8');
        const loaded = JSON.parse(content);
        // Reset session counter but preserve cumulative stats
        return {
          ...defaultCheckpoint,
          ...loaded,
          stats: {
            ...defaultCheckpoint.stats,
            ...loaded.stats,
            sessionScraped: 0,  // Reset per-session counter
          },
        };
      } catch (e) {
        console.warn(`⚠️ Corrupt checkpoint file at ${sourcePath}, starting fresh.`);
      }
    }

    return defaultCheckpoint;
  }

  private saveCheckpoint(): void {
    this.ensureDir(SCRAPING_DIR);
    fs.writeFileSync(this.checkpointPath, JSON.stringify(this.checkpoint, null, 2));
  }

  // ============================================================
  // Deduplication index
  // ============================================================

  private loadScrapedIds(): Set<string> {
    const ids = new Set<string>();

    // Load from all possible sources to maintain global dedup index
    const sources = [
      LEGACY_SCRAPED_IDS_FILE,
      path.join(SCRAPING_DIR, `scraped_ids_${this.runnerId}.txt`)
    ];

    // Also look for other runner files in the directory
    if (fs.existsSync(SCRAPING_DIR)) {
      const files = fs.readdirSync(SCRAPING_DIR);
      for (const file of files) {
        if (file.startsWith('scraped_ids_') && file.endsWith('.txt')) {
          const fullPath = path.join(SCRAPING_DIR, file);
          if (!sources.includes(fullPath)) sources.push(fullPath);
        }
      }
    }

    for (const source of sources) {
      if (fs.existsSync(source)) {
        const content = fs.readFileSync(source, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          const id = line.trim();
          if (id) ids.add(id);
        }
      }
    }

    if (ids.size > 0) {
      console.log(`📂 Loaded ${ids.size} scraped IDs from global dedup index.`);
    } else {
      console.log('📂 No dedup index found. Starting fresh.');
    }

    return ids;
  }

  private appendScrapedId(id: string): void {
    this.ensureDir(SCRAPING_DIR);
    const runnerScrapedIdsFile = path.join(SCRAPING_DIR, `scraped_ids_${this.runnerId}.txt`);
    fs.appendFileSync(runnerScrapedIdsFile, id + '\n');
  }

  // ============================================================
  // Failed works log
  // ============================================================

  private logFailedWork(entry: FailedWork): void {
    this.ensureDir(SCRAPING_DIR);
    fs.appendFileSync(this.failedWorksPath, JSON.stringify(entry) + '\n');
  }

  private appendPendingIngestFile(filePath: string): void {
    this.ensureDir(SCRAPING_DIR);
    fs.appendFileSync(this.pendingIngestPath, filePath + '\n');
  }

  // ============================================================
  // Helpers
  // ============================================================

  private slugify(str: string): string {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 80);
  }

  private ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private isSameChunk(a: DateChunk | null | undefined, b: DateChunk | null | undefined): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.from === b.from && a.to === b.to;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================
// CLI entry point
// ============================================================

function parseArgs(): { runnerId: string; maxDuration: number } {
  const args = process.argv.slice(2);
  let runnerId = 'local';
  let maxDuration = DEFAULT_MAX_DURATION_S;

  for (const arg of args) {
    if (arg.startsWith('--runner-id=')) {
      runnerId = arg.split('=')[1];
    } else if (arg.startsWith('--max-duration=')) {
      maxDuration = parseInt(arg.split('=')[1]) || DEFAULT_MAX_DURATION_S;
    }
  }

  return { runnerId, maxDuration };
}

const isDirectRun = process.argv[1] && (
  process.argv[1].includes('scrapingOrchestrator') ||
  process.argv[1] === fileURLToPath(import.meta.url)
);

if (isDirectRun) {
  const { runnerId, maxDuration } = parseArgs();
  const orchestrator = new ScrapingOrchestrator(runnerId, maxDuration);

  orchestrator.run()
    .then(() => {
      console.log('Orchestrator finished.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Fatal error in orchestrator:', err);
      process.exit(1);
    });
}
