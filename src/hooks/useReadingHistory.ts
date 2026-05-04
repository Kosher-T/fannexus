import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, getDocs, limit, documentId, where, writeBatch } from 'firebase/firestore';
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
    const [isFetchingStories, setIsFetchingStories] = useState(false);

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

        const handleAuthChange = auth.onAuthStateChanged(async (user) => {
            unsubscribe(); // Clean up previous listener

            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                // We use setDoc with merge to ensure the user doc exists.
                // This appeases any rules that might check for user existence, and prepares for future user preferences.
                try {
                    await setDoc(userDocRef, {
                        email: user.email,
                        displayName: user.displayName || '',
                        createdAt: serverTimestamp()
                    }, { merge: true });
                } catch (e) {
                    // Ignore if this fails due to already existing and createdAt restriction,
                    // we just want to ensure it's there
                }

                // Sync local to Firebase first, so we don't lose anything
                const localStr = localStorage.getItem('reading_now_history');
                let localItems: ReadingHistoryItem[] = [];
                if (localStr) {
                    try {
                        localItems = JSON.parse(localStr);
                    } catch (e) { }
                }

                if (localItems.length > 0) {
                    try {
                        const batch = writeBatch(db);
                        localItems.forEach(item => {
                            const docRef = doc(db, 'users', user.uid, 'readingHistory', item.storyId);
                            // Using setDoc with merge or just set in a batch so it creates or overwrites
                            batch.set(docRef, {
                                storyId: item.storyId,
                                platformId: item.platformId,
                                // Only set timestamp if we don't already have one on the server to prefer the oldest,
                                // but actually it's easier to just use the one we have locally
                                timestamp: serverTimestamp()
                            }, { merge: true }); // Use merge cautiously, here it ensures we don't drop extra fields
                        });
                        await batch.commit();
                        // Once synced, we can clear local strictly because server will become source of truth
                        // But we'll keep localStorage as a mirror for offline
                    } catch (err) {
                        console.error("Failed to sync local reading history to Firebase", err);
                    }
                }

                // Sync with Firebase
                const q = query(collection(db, 'users', user.uid, 'readingHistory'));
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
                    loadLocal();
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
                setIsFetchingStories(false);
                return;
            }

            setIsFetchingStories(true);
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
            } finally {
                setIsFetchingStories(false);
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

        setReadingNowStories(prev => prev.filter(story => story.ao3Id !== storyId));

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
        isFetchingStories,
        addToHistory,
        removeFromHistory
    };
}
