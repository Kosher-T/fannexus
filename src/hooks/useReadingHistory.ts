import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, getDocs, limit, documentId, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import type { StoryMetadata } from '../types/scraper';

export interface ReadingHistoryItem {
    storyId: string;
    platformId: string;
    timestamp: number; // local unix timestamp
}

export function useReadingHistory() {
    const [historyItems, setHistoryItems] = useState<ReadingHistoryItem[]>([]);
    const [readingNowStories, setReadingNowStories] = useState<StoryMetadata[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Sync logic
    useEffect(() => {
        let unsubscribe = () => { };

        const loadLocal = () => {
            const localStr = localStorage.getItem('reading_now_history');
            if (localStr) {
                try {
                    const parsed = JSON.parse(localStr);
                    setHistoryItems(parsed);
                } catch (e) {
                    console.error("Local reading history corrupted", e);
                }
            } else {
                setHistoryItems([]);
            }
            setIsLoading(false);
        };

        const handleAuthChange = auth.onAuthStateChanged((user) => {
            unsubscribe(); // Clean up previous listener
            if (user) {
                // Sync with Firebase
                const q = query(collection(db, 'users', user.uid, 'readingHistory'));
                // We do not order by timestamp because onSnapshot handles all items, we sort client side.
                unsubscribe = onSnapshot(q, (snapshot) => {
                    const items: ReadingHistoryItem[] = [];
                    snapshot.forEach((doc) => {
                        const data = doc.data();
                        items.push({
                            storyId: data.storyId,
                            platformId: data.platformId,
                            timestamp: data.timestamp?.toMillis() || Date.now()
                        });
                    });

                    items.sort((a, b) => b.timestamp - a.timestamp);

                    setHistoryItems(items);
                    localStorage.setItem('reading_now_history', JSON.stringify(items));
                    setIsLoading(false);
                }, (error) => {
                    console.error("Snapshot error:", error);
                    // Instead of failing the entire app for a single missing permission that could happen when logging out, fallback to local
                    loadLocal();
                    // Still throw handleFirestoreError for the system to catch if it's a genuine rules issue
                    handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/readingHistory`);
                });
            } else {
                loadLocal();
            }
        });

        return () => {
            unsubscribe();
            handleAuthChange();
        };
    }, []);

    // Fetch the actual stories for the top 10 items
    useEffect(() => {
        const fetchStories = async () => {
            if (historyItems.length === 0) {
                setReadingNowStories([]);
                return;
            }

            const topIds = historyItems.slice(0, 10).map(item => item.storyId);

            try {
                const q = query(collection(db, 'stories'), where(documentId(), 'in', topIds));
                const snapshot = await getDocs(q);
                const storiesMap = new Map<string, StoryMetadata>();

                snapshot.forEach(doc => {
                    storiesMap.set(doc.id, { ao3Id: doc.id, ...doc.data() } as StoryMetadata);
                });

                // Ensure we maintain sorted order of reading history
                const sortedStories = topIds
                    .map(id => storiesMap.get(id))
                    .filter((story): story is StoryMetadata => story !== undefined);

                setReadingNowStories(sortedStories);
            } catch (err) {
                console.error("Error fetching reading history stories:", err);
            }
        };

        if (!isLoading) {
            fetchStories();
        }
    }, [historyItems, isLoading]);

    const addToHistory = async (storyId: string, platformId: string) => {
        // Optimistic local update
        const now = Date.now();
        setHistoryItems(prev => {
            const updated = prev.filter(item => item.storyId !== storyId);
            updated.unshift({ storyId, platformId, timestamp: now });
            localStorage.setItem('reading_now_history', JSON.stringify(updated));
            return updated;
        });

        // Firebase update if logged in
        const user = auth.currentUser;
        if (user) {
            try {
                const docRef = doc(db, 'users', user.uid, 'readingHistory', storyId);
                await setDoc(docRef, {
                    storyId,
                    platformId,
                    timestamp: serverTimestamp()
                });
            } catch (error) {
                handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/readingHistory/${storyId}`);
            }
        }
    };

    const removeFromHistory = async (storyId: string) => {
        // Optimistic local update
        setHistoryItems(prev => {
            const updated = prev.filter(item => item.storyId !== storyId);
            localStorage.setItem('reading_now_history', JSON.stringify(updated));
            return updated;
        });

        // Firebase update if logged in
        const user = auth.currentUser;
        if (user) {
            try {
                const docRef = doc(db, 'users', user.uid, 'readingHistory', storyId);
                await deleteDoc(docRef);
            } catch (error) {
                handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/readingHistory/${storyId}`);
            }
        }
    };

    return {
        historyItems,
        readingNowStories,
        isLoading,
        addToHistory,
        removeFromHistory
    };
}
