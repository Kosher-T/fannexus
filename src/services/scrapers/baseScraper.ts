import type { ScraperAlert } from '../../types/scraper';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

// ============================================================
// User-Agent rotation pool — realistic browser strings
// ============================================================
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

export interface ScraperResult {
  success: boolean;
  error?: string;
}

/**
 * Callback type for soft-ban / error alerting.
 * The orchestrator wires this up to write alerts to Firebase.
 */
export type AlertCallback = (alert: ScraperAlert) => void | Promise<void>;

export class BaseScraper {
  protected readonly sourceName: string;
  protected readonly baseUrl: string;
  protected readonly fetchDelayMs: number;
  private lastFetchTime: number;
  private uaIndex: number;

  // Playwright instances
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  /**
   * If set, called whenever a notable event occurs (soft-ban, connection failure, etc.)
   */
  public onAlert?: AlertCallback;

  /**
   * Set to true by the orchestrator to request a graceful pause.
   * The scraper will complete the current request and then stop.
   */
  public isPaused: boolean = false;

  /**
   * Tracks consecutive soft-ban detections for exponential backoff.
   */
  private consecutiveBans: number = 0;

  constructor(sourceName: string, baseUrl: string, fetchDelayMs: number = 2000) {
    this.sourceName = sourceName;
    this.baseUrl = baseUrl;
    this.fetchDelayMs = fetchDelayMs;
    this.lastFetchTime = 0;
    this.uaIndex = Math.floor(Math.random() * USER_AGENTS.length);
  }

  /**
   * Initializes the headless browser. Call this before scraping.
   */
  public async initBrowser(): Promise<void> {
    if (this.browser) return;
    console.log(`[${this.sourceName}] 🚀 Initializing headless browser...`);
    this.browser = await chromium.launch({
      headless: true,
      executablePath: process.env.GITHUB_ACTIONS ? undefined : '/usr/bin/google-chrome'
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    // Set AO3 adult consent cookie
    await this.context.addCookies([{
      name: 'view_adult',
      value: 'true',
      domain: 'archiveofourown.org',
      path: '/'
    }]);
  }

  /**
   * Closes the headless browser. Call this when scraping is done.
   */
  public async closeBrowser(): Promise<void> {
    if (this.context) await this.context.close();
    if (this.browser) await this.browser.close();
    this.context = null;
    this.browser = null;
  }

  /**
   * Fetches HTML content from a URL with:
   * - Politeness delay (2s base + 0.5–1.5s random jitter)
   * - Rotating User-Agent strings
   * - Retry logic with exponential backoff
   * - Soft-ban detection (429 / Cloudflare challenge)
   * - Connection timeout recovery
   */
  protected async fetchHTML(url: string, retries: number = 3): Promise<string> {
    if (!this.browser || !this.context) {
      await this.initBrowser();
    }

    await this.enforceDelay();

    for (let attempt = 1; attempt <= retries; attempt++) {
      // Check if we've been asked to pause
      if (this.isPaused) {
        throw new Error('SCRAPER_PAUSED');
      }

      try {
        const ua = this.getNextUserAgent();
        console.log(`[${this.sourceName}] 🌐 Fetching (Attempt ${attempt}/${retries}): ${url}`);

        // Open new page
        const page = await this.context!.newPage();

        // Set User-Agent for this specific page
        await page.setExtraHTTPHeaders({ 'User-Agent': ua });

        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        if (!response) {
          await page.close();
          throw new Error('No response from server');
        }

        const status = response.status();
        const body = await page.content();

        // Close page to save memory
        await page.close();

        // --- Soft-ban / rate limit detection ---
        if (status === 429) {
          const backoff = await this.handleSoftBan(attempt, { status, headers: new Map() } as any);
          if (backoff === -1) throw new Error('SOFT_BAN_MAX_BACKOFF');
          continue;
        }

        // --- Cloudflare challenge page detection ---
        if (status === 403 || status === 503 || status === 525) {
          if (body.includes('cloudflare') || body.includes('cf-browser-verification') || body.includes('challenge-platform')) {
            console.warn(`[${this.sourceName}] 🛡️ Cloudflare challenge detected (${status}).`);
            const backoff = await this.handleSoftBan(attempt, { status, headers: new Map() } as any);
            if (backoff === -1) throw new Error('CLOUDFLARE_CHALLENGE');
            continue;
          }
          throw new Error(`HTTP Error: ${status} ${response.statusText()}`);
        }

        if (!response.ok()) {
          throw new Error(`HTTP Error: ${status} ${response.statusText()}`);
        }

        // --- Success ---
        this.consecutiveBans = 0;
        return body;

      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));

        // Re-throw pause requests and max backoff errors
        if (err.message === 'SCRAPER_PAUSED' || err.message === 'SOFT_BAN_MAX_BACKOFF' || err.message === 'CLOUDFLARE_CHALLENGE') {
          throw err;
        }

        // --- Connection timeout / network error recovery ---
        if (this.isConnectionError(err)) {
          console.warn(`[${this.sourceName}] 🔌 Connection error: ${err.message}`);

          if (attempt === retries) {
            await this.emitAlert({
              type: 'connection-error',
              runnerId: 'unknown',
              message: `Connection failed after ${retries} attempts: ${err.message}`,
              timestamp: new Date().toISOString(),
              details: { url, error: err.message },
            });

            console.warn(`[${this.sourceName}] 🛑 Abandoning ${url} after ${retries} failed attempts.`);
            throw err;
          }

          const backoff = this.fetchDelayMs * Math.pow(2, attempt);
          console.warn(`[${this.sourceName}] ⚠️ Retrying in ${backoff / 1000}s...`);
          await this.sleep(backoff);
          continue;
        }

        // --- Generic error ---
        if (attempt === retries) {
          console.error(`[${this.sourceName}] ❌ Failed to fetch ${url} after ${retries} attempts.`, err);
          throw err;
        }

        // Determine wait time for next retry
        const delay = attempt === 1 ? 4000 : 8000;
        console.warn(`[${this.sourceName}] ⚠️ Fetch failed (${err.message}). Retrying in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error('Unreachable code hit in fetchHTML');
  }

  // ============================================================
  // Soft-ban handling with exponential backoff
  // ============================================================

  /**
   * Handles a soft-ban (429 or Cloudflare challenge).
   * Returns the backoff duration used, or -1 if max backoff exceeded.
   */
  private async handleSoftBan(attempt: number, response: Response): Promise<number> {
    this.consecutiveBans++;

    // Escalating backoff: 30s → 60s → 120s → 240s → ... → max 30 min
    const baseBackoff = 30000; // 30 seconds
    const backoff = Math.min(baseBackoff * Math.pow(2, this.consecutiveBans - 1), 30 * 60 * 1000);

    // Check Retry-After header
    const retryAfter = response.headers.get('Retry-After');
    const effectiveBackoff = retryAfter ? parseInt(retryAfter) * 1000 : backoff;

    console.warn(`[${this.sourceName}] 🛑 Rate limited! Ban #${this.consecutiveBans}. Backing off for ${effectiveBackoff / 1000}s...`);

    // If we've been banned 6+ times, pause for 1 hour and alert
    if (this.consecutiveBans >= 6) {
      const pauseDuration = 60 * 60 * 1000; // 1 hour
      console.error(`[${this.sourceName}] 🚨 SOFT-BANNED — Too many consecutive rate limits. Pausing for 1 hour.`);

      await this.emitAlert({
        type: 'soft-ban',
        runnerId: 'unknown',  // Will be overridden by orchestrator
        message: `Soft-banned after ${this.consecutiveBans} consecutive 429s. Pausing for 1 hour.`,
        timestamp: new Date().toISOString(),
        details: { consecutiveBans: this.consecutiveBans },
      });

      await this.sleep(pauseDuration);
      this.consecutiveBans = 0; // Reset after long pause
      return -1; // Signal to caller that we hit max
    }

    await this.sleep(effectiveBackoff);
    return effectiveBackoff;
  }

  // ============================================================
  // Rate limiting with jitter
  // ============================================================

  private async enforceDelay() {
    const now = Date.now();
    const timeSinceLastFetch = now - this.lastFetchTime;

    // Base delay + random jitter (0.5s to 1.5s)
    const jitter = 500 + Math.random() * 1000;
    const totalDelay = this.fetchDelayMs + jitter;

    if (timeSinceLastFetch < totalDelay) {
      const waitTime = totalDelay - timeSinceLastFetch;
      await this.sleep(waitTime);
    }

    this.lastFetchTime = Date.now();
  }

  // ============================================================
  // Helpers
  // ============================================================

  private getNextUserAgent(): string {
    this.uaIndex = (this.uaIndex + 1) % USER_AGENTS.length;
    return USER_AGENTS[this.uaIndex];
  }

  private isConnectionError(err: Error): boolean {
    const connErrors = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN', 'AbortError', 'UND_ERR_CONNECT_TIMEOUT', 'fetch failed'];
    return connErrors.some(code => err.message.includes(code) || err.name === code);
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async emitAlert(alert: ScraperAlert): Promise<void> {
    console.warn(`[${this.sourceName}] 📢 ALERT: ${alert.type} — ${alert.message}`);
    if (this.onAlert) {
      try {
        await this.onAlert(alert);
      } catch (e) {
        console.error(`[${this.sourceName}] Failed to emit alert to Firebase:`, e);
      }
    }
  }
}
