import type { ScraperAlert } from '../../types/scraper';

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
   * Fetches HTML content from a URL with:
   * - Politeness delay (2s base + 0.5–1.5s random jitter)
   * - Rotating User-Agent strings
   * - Retry logic with exponential backoff
   * - Soft-ban detection (429 / Cloudflare challenge)
   * - Connection timeout recovery
   */
  protected async fetchHTML(url: string, retries: number = 3): Promise<string> {
    await this.enforceDelay();

    for (let attempt = 1; attempt <= retries; attempt++) {
      // Check if we've been asked to pause
      if (this.isPaused) {
        throw new Error('SCRAPER_PAUSED');
      }

      try {
        const ua = this.getNextUserAgent();
        console.log(`[${this.sourceName}] 🌐 Fetching (Attempt ${attempt}/${retries}): ${url}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(url, {
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0',
            'Cookie': 'view_adult=true',
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        // --- Soft-ban / rate limit detection ---
        if (response.status === 429) {
          const backoff = await this.handleSoftBan(attempt, response);
          if (backoff === -1) throw new Error('SOFT_BAN_MAX_BACKOFF');
          continue;
        }

        // --- Cloudflare challenge page detection ---
        if (response.status === 403 || response.status === 503) {
          const body = await response.text();
          if (body.includes('cloudflare') || body.includes('cf-browser-verification') || body.includes('challenge-platform')) {
            console.warn(`[${this.sourceName}] 🛡️ Cloudflare challenge detected (${response.status}).`);
            const backoff = await this.handleSoftBan(attempt, response);
            if (backoff === -1) throw new Error('CLOUDFLARE_CHALLENGE');
            continue;
          }
          throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        // --- Success ---
        this.consecutiveBans = 0;
        return await response.text();

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

        const backoff = this.fetchDelayMs * attempt;
        console.warn(`[${this.sourceName}] ⚠️ Fetch failed (${err.message}). Retrying in ${backoff / 1000}s...`);
        await this.sleep(backoff);
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
