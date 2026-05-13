import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, limit, startAfter } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { StoryMetadata } from '../types/scraper';

const CACHE_KEY = 'fandom_cache';
const CACHE_TTL = 1000 * 60 * 30;
const BATCH_SIZE = 500;
const MAX_BATCHES = 4;

interface FandomCache {
  fandoms: string[];
  timestamp: number;
}

async function fetchFandomsFromStories(): Promise<string[]> {
  const fandomSet = new Set<string>();
  let lastDoc: any = null;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    let q = query(collection(db, 'stories'), limit(BATCH_SIZE));
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    const snapshot = await getDocs(q);
    if (snapshot.empty) break;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const fandoms = data.fandoms as string[] | undefined;
      if (fandoms && Array.isArray(fandoms)) {
        for (const f of fandoms) {
          if (f && f.trim()) fandomSet.add(f.trim());
        }
      }
    });

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size < BATCH_SIZE) break;
  }

  return Array.from(fandomSet).sort((a, b) => a.localeCompare(b));
}

function getCachedFandoms(): string[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed: FandomCache = JSON.parse(cached);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.fandoms;
  } catch {
    return null;
  }
}

function setCachedFandoms(fandoms: string[]): void {
  try {
    const cache: FandomCache = { fandoms, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* localStorage full or unavailable */
  }
}

export function useFandomCache() {
  const [fandoms, setFandoms] = useState<string[]>(() => getCachedFandoms() || []);
  const [loading, setLoading] = useState(!getCachedFandoms());

  const refreshCache = useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await fetchFandomsFromStories();
      setCachedFandoms(fetched);
      setFandoms(fetched);
    } catch (err) {
      console.error('Error fetching fandoms:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = getCachedFandoms();
    if (cached) {
      setFandoms(cached);
      setLoading(false);
    }
    refreshCache();
  }, [refreshCache]);

  const searchFandoms = useCallback(
    (searchTerm: string): string[] => {
      if (!searchTerm.trim()) return [];
      const term = searchTerm.toLowerCase();
      return fandoms.filter((f) => f.toLowerCase().includes(term)).slice(0, 20);
    },
    [fandoms]
  );

  return { fandoms, loading, searchFandoms, refreshCache };
}