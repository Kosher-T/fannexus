import * as cheerio from 'cheerio';
import { BaseScraper } from '../baseScraper';
import type { StoryMetadata, DateChunk } from '../../../types/scraper';

// ============================================================
// Interfaces for directory/fandom discovery
// ============================================================

export interface FandomCategory {
  categoryName: string;
  viewAllUrl: string | null;
  topFandoms: Array<{
    name: string;
    url: string;
    count: number | null;
  }>;
}

export interface FandomEntry {
  name: string;
  url: string;
  count: number | null;
}

// ============================================================
// Rating class → readable string map
// ============================================================

const RATING_MAP: Record<string, string> = {
  'rating-general-audience': 'General Audiences',
  'rating-teen': 'Teen And Up Audiences',
  'rating-mature': 'Mature',
  'rating-explicit': 'Explicit',
  'rating-notrated': 'Not Rated',
};

// ============================================================
// Category icon class → readable string map
// ============================================================

const CATEGORY_MAP: Record<string, string> = {
  'category-femslash': 'F/F',
  'category-het': 'F/M',
  'category-gen': 'Gen',
  'category-slash': 'M/M',
  'category-multi': 'Multi',
  'category-other': 'Other',
  'category-none': 'No category',
};

export class AO3Scraper extends BaseScraper {
  constructor() {
    super('AO3', 'https://archiveofourown.org', 2500); // 2 second base rate limit
  }

  // ============================================================
  // 1. SCRAPE MAIN DIRECTORY — Top-level categories from /media
  // ============================================================

  async scrapeFandomDirectory(): Promise<FandomCategory[]> {
    try {
      const html = await this.fetchHTML(`${this.baseUrl}/media`);
      const $ = cheerio.load(html);
      const categories: FandomCategory[] = [];

      const mediaList = $('.medium.listbox');

      mediaList.each((_, element) => {
        const section = $(element);
        const header = section.find('h3.heading');
        const categoryName = header.text().trim();

        if (!categoryName) return;

        const viewAllUrl = this.extractViewAllLink($, section);
        const topFandoms = this.extractFandomsFromList($, section);
        categories.push({ categoryName, viewAllUrl, topFandoms });
      });

      return categories;
    } catch (error) {
      console.error('Error scraping AO3 media directory:', error);
      return [];
    }
  }

  // ============================================================
  // 2. SCRAPE FULL FANDOM LIST — All fandoms in a category
  // ============================================================

  async scrapeCategoryFullList(url: string): Promise<FandomEntry[]> {
    try {
      const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;
      console.log(`Fetching full fandom list: ${fullUrl}`);

      const html = await this.fetchHTML(fullUrl);
      const $ = cheerio.load(html);
      const allFandoms: FandomEntry[] = [];

      const alphabetList = $('ol.alphabet.fandom.index.group');

      if (alphabetList.length === 0) {
        console.warn(`⚠️ Could not find alphabet list at ${url}. Structure might differ.`);
        return [];
      }

      alphabetList.find('li.letter').each((_, letterBlock) => {
        const $letter = $(letterBlock);
        const tagList = $letter.find('ul.tags.index.group li');

        tagList.each((_, tagItem) => {
          const $item = $(tagItem);
          const link = $item.find('a.tag').first();

          const name = link.text().trim();
          let rawUrl = link.attr('href') || '';
          let resolvedUrl = '';

          if (rawUrl) {
            if (!rawUrl.startsWith('http')) {
              rawUrl = `${this.baseUrl}${rawUrl}`;
            }
            // Keep the raw percent-encoded URL from AO3's HTML — it's already
            // in the correct form for direct fetching (CJK, spaces, etc. encoded)
            resolvedUrl = rawUrl;
          }

          const fullText = $item.text().trim();
          const remainder = fullText.replace(name, '').trim();
          const countMatch = remainder.match(/\(([\d,]+)\)\s*$/);
          const count = countMatch ? parseInt(countMatch[1].replace(/,/g, '')) : null;

          if (name && resolvedUrl) {
            allFandoms.push({ name, url: resolvedUrl, count });
          }
        });
      });

      return allFandoms;
    } catch (error) {
      console.error(`Error scraping full list at ${url}:`, error);
      return [];
    }
  }

  // ============================================================
  // 3. SCRAPE STORIES FROM A FANDOM PAGE (listing blurb only)
  // ============================================================

  /**
   * Scrapes one page of work listings from a fandom tag page.
   * Extracts ALL available metadata from the listing blurb.
   *
   * @param fandomUrl - The fandom tag URL (e.g. .../tags/Harry Potter/works)
   * @param page - Page number (1-indexed)
   * @param dateChunk - Optional date range to filter (for fandoms > 100K works)
   * @returns Array of StoryMetadata objects
   */
  async scrapeFandomWorkList(
    fandomUrl: string,
    page: number = 1,
    dateChunk?: DateChunk
  ): Promise<StoryMetadata[]> {
    try {
      const targetUrl = this.buildWorkListUrl(fandomUrl, page, dateChunk);
      console.log(`   📄 Fetching works page ${page}: ${targetUrl}`);

      const html = await this.fetchHTML(targetUrl);
      const $ = cheerio.load(html);

      const stories: StoryMetadata[] = [];
      const workBlurbs = $('li.work.blurb.group');

      if (workBlurbs.length === 0) {
        // Check if we hit the "no results" message
        const noResults = $('p.notice').text();
        if (noResults.includes('No results found') || noResults.includes('0 Works')) {
          return [];
        }
      }

      workBlurbs.each((_, element) => {
        try {
          const story = this.parseWorkBlurb($, $(element));
          if (story) {
            stories.push(story);
          }
        } catch (parseError) {
          console.warn(`   ⚠️ Failed to parse a work blurb:`, parseError);
        }
      });

      return stories;
    } catch (error) {
      console.error(`Error scraping work list for ${fandomUrl} page ${page}:`, error);
      throw error; // Re-throw so the orchestrator can handle it
    }
  }

  // ============================================================
  // 4. CHECK IF MORE PAGES EXIST
  // ============================================================

  /**
   * Checks pagination to determine if the current page has a "Next" link.
   * Used by orchestrator to know when to stop paginating.
   */
  async hasMorePages(fandomUrl: string, currentPage: number, dateChunk?: DateChunk): Promise<boolean> {
    try {
      const targetUrl = this.buildWorkListUrl(fandomUrl, currentPage, dateChunk);
      const html = await this.fetchHTML(targetUrl);
      const $ = cheerio.load(html);

      // Check for "Next →" link
      const nextLink = $('li.next a');
      return nextLink.length > 0;
    } catch {
      return false;
    }
  }

  // ============================================================
  // 5. GET TOTAL PAGE COUNT FOR A FANDOM
  // ============================================================

  /**
   * Fetches page 1 and extracts the total page count from pagination.
   * Returns null if it can't determine the total.
   */
  async getTotalPageCount(fandomUrl: string, dateChunk?: DateChunk): Promise<number | null> {
    try {
      const targetUrl = this.buildWorkListUrl(fandomUrl, 1, dateChunk);
      const html = await this.fetchHTML(targetUrl);
      const $ = cheerio.load(html);

      // The last numbered page link shows the total
      const pageLinks = $('ol.pagination li a');
      let maxPage = 1;

      pageLinks.each((_, el) => {
        const text = $(el).text().trim();
        const pageNum = parseInt(text);
        if (!isNaN(pageNum) && pageNum > maxPage) {
          maxPage = pageNum;
        }
      });

      return maxPage;
    } catch {
      return null;
    }
  }

  // ============================================================
  // 6. BUILD DATE RANGE CHUNKS for large fandoms (>100K works)
  // ============================================================

  /**
   * Generates date-range chunks to split a large fandom into
   * sub-queries, each with <100K works (5000 pages × 20/page).
   * Starts from earliest AO3 date (2008) to present.
   */
  buildDateRangeChunks(totalCount: number | null): DateChunk[] {
    const chunks: DateChunk[] = [];
    if (totalCount === null) return [];
    const maxWorksPerChunk = 90000; // Stay under 100K with margin
    const currentYear = new Date().getFullYear();
    const startYear = 2008; // AO3 launched in 2009, but be safe

    if (totalCount <= maxWorksPerChunk) {
      // No chunking needed
      return [];
    }

    // Estimate works per year (rough even distribution)
    const yearsOfContent = currentYear - startYear + 1;
    const estimatedPerYear = totalCount / yearsOfContent;

    if (estimatedPerYear <= maxWorksPerChunk) {
      // Year-based chunking is sufficient
      for (let year = startYear; year <= currentYear; year++) {
        chunks.push({
          from: `${year}-01-01`,
          to: `${year}-12-31`,
        });
      }
    } else {
      // Need month-based chunking for very large fandoms
      for (let year = startYear; year <= currentYear; year++) {
        for (let month = 1; month <= 12; month++) {
          const lastDay = new Date(year, month, 0).getDate();
          chunks.push({
            from: `${year}-${String(month).padStart(2, '0')}-01`,
            to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
          });
        }
      }
    }

    return chunks;
  }

  // ============================================================
  // PRIVATE: Parse a single work blurb <li>
  // ============================================================

  private parseWorkBlurb($: cheerio.CheerioAPI, card: cheerio.Cheerio<any>): StoryMetadata | null {
    // --- Work ID and Title ---
    const header = card.find('h4.heading');
    const titleLink = header.find('a').first();
    const title = titleLink.text().trim();
    const href = titleLink.attr('href') || '';
    const link = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

    // Extract ao3Id from URL: /works/12345678
    const idMatch = href.match(/\/works\/(\d+)/);
    const ao3Id = idMatch ? idMatch[1] : '';

    if (!ao3Id || !title) return null;

    // --- Author(s) ---
    const authorLinks = header.find('a[rel="author"]');
    let author = 'Anonymous';
    let authorUrl: string | undefined;
    const coAuthors: Array<{ name: string; url: string }> = [];

    if (authorLinks.length > 0) {
      author = $(authorLinks[0]).text().trim();
      const firstHref = $(authorLinks[0]).attr('href') || '';
      authorUrl = firstHref.startsWith('http') ? firstHref : `${this.baseUrl}${firstHref}`;

      // Additional authors
      authorLinks.each((i, el) => {
        if (i > 0) {
          const coName = $(el).text().trim();
          const coHref = $(el).attr('href') || '';
          const coUrl = coHref.startsWith('http') ? coHref : `${this.baseUrl}${coHref}`;
          coAuthors.push({ name: coName, url: coUrl });
        }
      });
    }

    // --- Gifted To ---
    const giftedTo: string[] = [];
    header.find('a').each((_, el) => {
      const giftHref = $(el).attr('href') || '';
      if (giftHref.includes('/gifts')) {
        giftedTo.push($(el).text().trim());
      }
    });

    // --- Fandoms ---
    const fandoms: string[] = [];
    card.find('h5.fandoms a.tag').each((_, el) => {
      fandoms.push($(el).text().trim());
    });

    // --- Rating ---
    const ratingSpan = card.find('span.rating');
    const ratingClasses = (ratingSpan.attr('class') || '').split(/\s+/);
    let rating = 'Unknown';
    for (const cls of ratingClasses) {
      if (RATING_MAP[cls]) {
        rating = RATING_MAP[cls];
        break;
      }
    }

    // --- Category (M/M, F/F, etc.) ---
    const category: string[] = [];
    card.find('span.category').each((_, el) => {
      const catClasses = ($(el).attr('class') || '').split(/\s+/);
      for (const cls of catClasses) {
        if (CATEGORY_MAP[cls]) {
          category.push(CATEGORY_MAP[cls]);
        }
      }
    });
    // Sometimes categories are in the text of the category span
    if (category.length === 0) {
      const catText = card.find('span.category').attr('title') || '';
      if (catText) {
        catText.split(',').forEach(c => {
          const trimmed = c.trim();
          if (trimmed) category.push(trimmed);
        });
      }
    }

    // --- Warnings ---
    const warnings: string[] = [];
    card.find('ul.tags li.warnings a.tag').each((_, el) => {
      warnings.push($(el).text().trim());
    });

    // --- Relationships ---
    const relationships: string[] = [];
    card.find('ul.tags li.relationships a.tag').each((_, el) => {
      relationships.push($(el).text().trim());
    });

    // --- Characters ---
    const characters: string[] = [];
    card.find('ul.tags li.characters a.tag').each((_, el) => {
      characters.push($(el).text().trim());
    });

    // --- Freeform Tags ---
    const tags: string[] = [];
    card.find('ul.tags li.freeforms a.tag').each((_, el) => {
      tags.push($(el).text().trim());
    });

    // --- Summary ---
    const summaryEl = card.find('blockquote.summary');
    const summary = summaryEl.length > 0 ? summaryEl.text().trim() : '';

    // --- Stats ---
    const stats = card.find('dl.stats');

    const chaptersText = stats.find('dd.chapters').text().trim(); // "1/1" or "5/?"
    const [currentChStr, totalChRaw] = (chaptersText || '0/?').split('/');
    const chapterCount = parseInt(currentChStr) || 0;
    const totalChapters = totalChRaw === '?' ? null : parseInt(totalChRaw);
    const isCompleted = totalChapters !== null && chapterCount === totalChapters;

    const parseStat = (cls: string): number => {
      const text = stats.find(`dd.${cls}`).text().trim().replace(/,/g, '');
      return parseInt(text) || 0;
    };

    const wordCount = parseStat('words');
    const language = stats.find('dd.language').text().trim() || 'English';

    // --- Date ---
    const datetimeStr = card.find('p.datetime').text().trim();
    // The listed date is the "updated" date for multi-chapter works,
    // and the "published" date for single-chapter works
    const updatedDate = datetimeStr || undefined;
    const publishedDate = (chapterCount <= 1 && totalChapters === 1) ? updatedDate : undefined;

    // --- Series (if shown on blurb) ---
    const seriesData: Array<{ name: string; url: string; part: number }> = [];
    card.find('ul.series li').each((_, el) => {
      const $li = $(el);
      const seriesLink = $li.find('a').first();
      const seriesName = seriesLink.text().trim();
      const seriesHref = seriesLink.attr('href') || '';
      const seriesUrl = seriesHref.startsWith('http') ? seriesHref : `${this.baseUrl}${seriesHref}`;

      // Extract "Part X" from text like "Part 3 of Series Name"
      const partMatch = $li.text().match(/Part\s+(\d+)/i);
      const part = partMatch ? parseInt(partMatch[1]) : 1;

      if (seriesName && seriesUrl) {
        seriesData.push({ name: seriesName, url: seriesUrl, part });
      }
    });

    // --- Collections (if shown) ---
    const collections: string[] = [];
    card.find('ul.collections a').each((_, el) => {
      collections.push($(el).text().trim());
    });

    return {
      ao3Id,
      title,
      link,
      author,
      authorLink: authorUrl,
      coAuthors: coAuthors.length > 0 ? coAuthors : undefined,
      giftedTo: giftedTo.length > 0 ? giftedTo : undefined,
      fandoms,
      rating,
      category,
      warnings,
      relationships,
      characters,
      tags,
      summary,
      language,
      wordCount,
      chapterCount,
      totalChapters,
      isCompleted,
      publishedDate,
      updatedDate,
      stats: {
        kudos: parseStat('kudos'),
        hits: parseStat('hits'),
        bookmarks: parseStat('bookmarks'),
        comments: parseStat('comments'),
      },
      series: seriesData.length > 0 ? seriesData : undefined,
      collections: collections.length > 0 ? collections : undefined,
      coverImageUrl: undefined,  // Not available on listing page
      sourceSite: 'AO3',
      scrapedAt: new Date().toISOString(),
      scrapedFrom: 'listing',
    };
  }

  // ============================================================
  // PRIVATE: Build work list URL with pagination and date filters
  // ============================================================

  private buildWorkListUrl(fandomUrl: string, page: number, dateChunk?: DateChunk): string {
    const separator = fandomUrl.includes('?') ? '&' : '?';
    let url = `${fandomUrl}${separator}page=${page}`;

    if (dateChunk) {
      url += `&work_search[date_from]=${dateChunk.from}&work_search[date_to]=${dateChunk.to}`;
    }

    return url;
  }

  // ============================================================
  // PRIVATE: Helpers
  // ============================================================

  private extractViewAllLink($: cheerio.CheerioAPI, section: cheerio.Cheerio<any>): string | null {
    let viewAllUrl = section.find('.actions a').attr('href');
    if (!viewAllUrl) {
      viewAllUrl = section.find('h3.heading a').attr('href');
    }
    if (viewAllUrl && !viewAllUrl.startsWith('http')) {
      return `${this.baseUrl}${viewAllUrl}`;
    }
    return viewAllUrl || null;
  }

  private extractFandomsFromList(
    $: cheerio.CheerioAPI,
    section: cheerio.Cheerio<any>
  ): Array<{ name: string; url: string; count: number | null }> {
    const fandoms: Array<{ name: string; url: string; count: number | null }> = [];
    const listContainer = section.find('ul.index, ol.index').first();

    if (listContainer.length > 0) {
      listContainer.find('li').each((_, li) => {
        const $li = $(li);
        if ($li.closest('.actions').length > 0 || $li.hasClass('actions')) return;

        const link = $li.find('a.tag').first();
        const name = link.text().trim();

        let rawUrl = link.attr('href') || '';
        let url = '';
        if (rawUrl) {
          if (!rawUrl.startsWith('http')) rawUrl = `${this.baseUrl}${rawUrl}`;
          // Keep the raw percent-encoded URL — directly fetchable as-is
          url = rawUrl;
        }

        const textContent = $li.text().trim();
        const remainder = textContent.replace(name, '').trim();
        const countMatch = remainder.match(/\(([\d,]+)\)/);
        const count = countMatch ? parseInt(countMatch[1].replace(/,/g, '')) : null;

        if (name && url) {
          fandoms.push({ name, url, count });
        }
      });
    }
    return fandoms;
  }

  // Fallback for single-work scraping (not used in listing-only mode)
  async scrape(_url: string): Promise<StoryMetadata> {
    throw new Error('Single work detail scraping not implemented in listing-only mode. Use scrapeFandomWorkList.');
  }
}
