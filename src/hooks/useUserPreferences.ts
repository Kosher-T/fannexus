import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export interface UserPreferences {
  favoriteFandoms: string[];
  preferredSources: string[];
  theme: 'dark' | 'light';
  excludeCrossovers: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  favoriteFandoms: [],
  preferredSources: [],
  theme: 'dark',
  excludeCrossovers: false,
};

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setPreferences(DEFAULT_PREFERENCES);
        setLoading(false);
        return;
      }

      const userDocRef = doc(db, 'users', user.uid);
      const unsubDoc = onSnapshot(userDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setPreferences({
            favoriteFandoms: data.favoriteFandoms || [],
            preferredSources: data.preferredSources || [],
            theme: data.theme || 'dark',
            excludeCrossovers: !!data.excludeCrossovers,
          });
        } else {
          setPreferences(DEFAULT_PREFERENCES);
        }
        setLoading(false);
      });

      return () => unsubDoc();
    });

    return () => unsubAuth();
  }, []);

  const addFavoriteFandom = useCallback(async (fandom: string) => {
    const user = auth.currentUser;
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    try {
      await setDoc(ref, { favoriteFandoms: arrayUnion(fandom) }, { merge: true });
    } catch (e) {
      console.warn("Update failed, attempting to recreate user doc...", e);
      // Fallback: If merge fails because doc didn't exist and failed strict create rules
      await setDoc(ref, {
        email: user.email || '',
        displayName: user.displayName || '',
        favoriteFandoms: [fandom],
        preferredSources: [],
        theme: 'dark',
        excludeCrossovers: false,
        createdAt: serverTimestamp()
      }, { merge: true });
    }
  }, []);

  const removeFavoriteFandom = useCallback(async (fandom: string) => {
    const user = auth.currentUser;
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    await setDoc(ref, { favoriteFandoms: arrayRemove(fandom) }, { merge: true });
  }, []);

  const setPreferredSources = useCallback(async (sources: string[]) => {
    const user = auth.currentUser;
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    try {
      await setDoc(ref, { preferredSources: sources }, { merge: true });
    } catch (e) {
      console.error("First setDoc failed", e);
      try {
        await setDoc(ref, {
          email: user.email || '',
          displayName: user.displayName || '',
          favoriteFandoms: [],
          preferredSources: sources,
          theme: 'dark',
          excludeCrossovers: false,
          createdAt: serverTimestamp()
        }, { merge: true });
      } catch (e2) {
        console.error("Fallback setDoc failed!", e2);
      }
    }
  }, []);

  const setExcludeCrossovers = useCallback(async (exclude: boolean) => {

    const user = auth.currentUser;
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    try {
      await setDoc(ref, { excludeCrossovers: exclude }, { merge: true });
    } catch (e) {
      console.error("First setDoc excludeCrossovers failed", e);
      try {
        await setDoc(ref, {
          email: user.email || '',
          displayName: user.displayName || '',
          excludeCrossovers: exclude,
          favoriteFandoms: [],
          preferredSources: [],
          theme: 'dark',
          createdAt: serverTimestamp()
        }, { merge: true });
      } catch (e2) {
        console.error("Fallback setDoc excludeCrossovers failed!", e2);
      }
    }
  }, []);

  return { preferences, loading, addFavoriteFandom, removeFavoriteFandom, setPreferredSources, setExcludeCrossovers };
}