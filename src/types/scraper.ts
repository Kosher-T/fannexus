// ============================================================
// StoryStats — Numeric engagement metrics for a story
// ============================================================
export interface StoryStats {
  kudos: number;
  hits: number;
  bookmarks: number;
  comments: number;
}

// ============================================================
// StoryMetadata — Complete metadata scraped from a listing page
// ============================================================
export interface StoryMetadata {
  // === Identity ===
  ao3Id: string;              // Numeric work ID extracted from URL (e.g. "65312791")
  title: string;
  link: string;               // Full URL to the work

  // === Author ===
  author: string;
  authorLink?: string;
  coAuthors?: Array<{ name: string; url: string }>;

  // === Classification ===
  fandoms: string[];
  rating: string;             // "General Audiences" | "Teen And Up" | "Mature" | "Explicit" | "Not Rated"
  category: string[];         // M/M, F/M, F/F, Gen, Multi, Other
  warnings: string[];

  // === Tags ===
  relationships: string[];
  characters: string[];
  tags: string[];             // Freeform tags

  // === Content Info ===
  summary: string;
  language: string;
  wordCount: number;
  chapterCount: number;
  totalChapters: number | null;  // null if unknown/ongoing ("?")
  isCompleted: boolean;

  // === Dates ===
  publishedDate?: string;     // Available on listing as the displayed date for single-chapter works
  updatedDate?: string;       // The date shown on the listing blurb

  // === Stats ===
  stats: StoryStats;

  // === Cover Image (populated in detail-scraping phase, not listing) ===
  coverImageUrl?: string;

  // === Series (from listing blurb if "Part X of Series" is shown) ===
  series?: Array<{ name: string; url: string; part: number }>;

  // === Collections (from listing blurb if shown) ===  
  collections?: string[];

  // === Gifted To (from listing blurb "for <user>" if shown) ===
  giftedTo?: string[];

  // === Metadata ===
  sourceSite: 'AO3' | 'FFN' | 'Spacebattles' | 'Wattpad' | 'Unknown';
  scrapedAt: string;          // ISO timestamp of when scraped
  scrapedFrom: 'listing' | 'detail';
}

// ============================================================
// FandomTarget — A fandom selected for scraping
// ============================================================
export interface FandomTarget {
  name: string;
  url: string;
  count: number | null;
  rank: number;
  category: string;
}

// ============================================================
// FandomTargetFile — JSON structure for ao3_target_fandoms.json
// ============================================================
export interface FandomTargetFile {
  generatedAt: string;
  totalFandoms: number;
  categories: Array<{
    name: string;
    fandoms: FandomTarget[];
  }>;
}

// ============================================================
// DateChunk — Used to split large fandoms into date ranges
// ============================================================
export interface DateChunk {
  from: string;  // YYYY-MM-DD
  to: string;    // YYYY-MM-DD
}

// ============================================================
// ScrapingCheckpoint — Persistent state for resume capability
// ============================================================
export interface ScrapingCheckpoint {
  runnerId: string;
  startedAt: string;
  lastActivity: string;
  activeFandom: {
    name: string;
    url: string;
    category: string;
    dateChunk: DateChunk | null;
    lastPage: number;
  } | null;
  completedFandoms: string[];  // Array of fandom URLs
  stats: {
    totalScraped: number;
    totalFailed: number;
    totalPages: number;
    sessionScraped: number;
  };
}

// ============================================================
// FailedWork — Entry for retry queue
// ============================================================
export interface FailedWork {
  workUrl: string;
  fandomUrl: string;
  fandomName: string;
  error: string;
  failedAt: string;
  retryCount: number;
  page: number;
}

// ============================================================
// FandomLock — Firebase Realtime DB lock entry
// ============================================================
export interface FandomLock {
  lockedBy: string;           // "github-actions" | "local"
  lockedAt: string;
  lastHeartbeat: string;
  fandomName: string;
  fandomUrl: string;
  currentPage: number;
}

// ============================================================
// ScraperAlert — Firebase alert for monitoring
// ============================================================
export interface ScraperAlert {
  type: 'soft-ban' | 'connection-error' | 'session-start' | 'session-end' | 'fandom-complete';
  runnerId: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}
