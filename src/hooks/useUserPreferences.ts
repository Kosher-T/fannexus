import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export interface UserPreferences {
  favoriteFandoms: string[];
  preferredSources: string[];
  theme: 'dark' | 'light';
}

const DEFAULT_PREFERENCES: UserPreferences = {
  favoriteFandoms: [],
  preferredSources: [],
  theme: 'dark',
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
    await setDoc(ref, { favoriteFandoms: arrayUnion(fandom) }, { merge: true });
  }, []);

  const removeFavoriteFandom = useCallback(async (fandom: string) => {
    const user = auth.currentUser;
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    await setDoc(ref, { favoriteFandoms: arrayRemove(fandom) }, { merge: true });
  }, []);

  return { preferences, loading, addFavoriteFandom, removeFavoriteFandom };
}