import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Search, Plus, XCircle } from 'lucide-react';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { useFandomCache } from '../hooks/useFandomCache';

interface PreferredFandomsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PreferredFandomsDrawer({ isOpen, onClose }: PreferredFandomsDrawerProps) {
  const { preferences, addFavoriteFandom, removeFavoriteFandom } = useUserPreferences();
  const { searchFandoms, loading: fandomLoading } = useFandomCache();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      const results = searchFandoms(searchTerm);
      setSearchResults(results.filter(r => !preferences.favoriteFandoms.includes(r)));
      setIsSearching(false);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, searchFandoms, preferences.favoriteFandoms]);

  const handleAddFandom = useCallback((fandom: string) => {
    addFavoriteFandom(fandom);
    setSearchTerm('');
    setSearchResults([]);
  }, [addFavoriteFandom]);

  const handleRemoveFandom = useCallback((fandom: string) => {
    removeFavoriteFandom(fandom);
  }, [removeFavoriteFandom]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#0A0A0B] border-l border-white/10 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-serif text-white font-light">Preferred Fandoms</h2>
                <p className="text-xs text-nexus-muted mt-1">Prioritize in recommendations</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/5 text-nexus-muted hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-semibold text-nexus-muted uppercase tracking-widest mb-3 block">
                    Add Fandoms
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nexus-muted" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Start typing to search..."
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-nexus-muted focus:outline-none focus:border-accent/50 transition-colors text-sm"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>

                  {searchResults.length > 0 && (
                    <div className="mt-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                      {searchResults.map((fandom) => (
                        <button
                          key={fandom}
                          onClick={() => handleAddFandom(fandom)}
                          className="w-full px-4 py-3 text-left text-sm text-white/80 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors border-b border-white/5 last:border-0"
                        >
                          <Plus className="w-4 h-4 text-accent/70 shrink-0" />
                          <span className="truncate">{fandom}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {preferences.favoriteFandoms.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-nexus-muted uppercase tracking-widest mb-3 block">
                      Your Favorite Fandoms ({preferences.favoriteFandoms.length})
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {preferences.favoriteFandoms.map((fandom) => (
                        <span
                          key={fandom}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-full text-sm text-accent"
                        >
                          <span className="truncate max-w-[200px]">{fandom}</span>
                          <button
                            onClick={() => handleRemoveFandom(fandom)}
                            className="hover:text-white transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {preferences.favoriteFandoms.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-nexus-muted text-sm">
                      No favorite fandoms yet. Search above to add some!
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-white/10">
              <button
                onClick={onClose}
                className="w-full py-3 bg-accent/10 hover:bg-accent/20 text-accent rounded-xl font-medium text-sm transition-colors"
              >
                Done
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}