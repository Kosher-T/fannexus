import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, Sparkles, Link as LinkIcon, ArrowRight, Focus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const initialUrl = searchParams.get('url') || '';
  
  const [url, setUrl] = useState(initialUrl);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
      handleSearchEvent();
    }
  }, [initialUrl]);

  const handleSearchEvent = () => {
    setIsSearching(true);
    // Simulate algorithmic processing, deductions, and cross-referencing
    setTimeout(() => {
      setIsSearching(false);
      // Here we would display results below
    }, 2500);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;
    handleSearchEvent();
  };

  return (
    <motion.main 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="max-w-4xl mx-auto px-6 pt-32 pb-24 min-h-screen flex flex-col"
    >
      <div className="text-center mb-16 mt-12">
        <h1 className="font-serif text-4xl md:text-5xl font-light mb-4 text-white tracking-tight">Find Your Next Obsession</h1>
        <p className="text-nexus-muted text-lg max-w-2xl mx-auto font-light leading-relaxed">
          Paste a link to any story from AO3, Spacebattles, or FFnet. We'll extract its metadata and cross-reference our database to surface identical tropes, styles, and themes.
        </p>
      </div>

      <div className="w-full max-w-3xl mx-auto">
        <form onSubmit={handleSearch} className="relative group shadow-2xl shadow-accent/5 rounded-full">
          <div className="absolute inset-y-0 left-0 pl-8 flex items-center pointer-events-none">
            <LinkIcon className="w-6 h-6 text-nexus-muted group-focus-within:text-accent transition-colors" />
          </div>
          <input
            type="url"
            name="url"
            id="url"
            className="block w-full h-20 pl-20 pr-40 bg-nexus-surface border border-white/10 rounded-full text-lg text-white font-light placeholder-nexus-muted/50 focus:ring-1 focus:ring-accent/50 focus:border-accent/50 transition-all outline-none leading-loose"
            placeholder="https://archiveofourown.org/works/..."
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute inset-y-2 right-2 px-8 bg-transparent border border-white/20 hover:border-accent hover:text-accent hover:bg-accent/5 text-white rounded-full font-normal flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider text-sm"
          >
            {isSearching ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Focus className="w-5 h-5 opacity-70" />
              </motion.div>
            ) : (
              <>Extract <ArrowRight className="w-4 h-4 opacity-70" /></>
            )}
          </button>
        </form>

        {isSearching && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-16 text-center"
          >
            <div className="inline-flex items-center justify-center p-4 rounded-full bg-accent/10 mb-4 animate-pulse">
               <Focus className="w-6 h-6 text-accent" />
            </div>
            <p className="text-nexus-muted text-sm font-mono uppercase tracking-widest">
              Cross-referencing Nexus Metadata...
            </p>
          </motion.div>
        )}
      </div>
    </motion.main>
  );
}
