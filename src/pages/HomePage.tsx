import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Info, Star, ChevronRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PlatformIcon } from '../components/PlatformIcon';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { StoryMetadata } from '../types/scraper';
import { getSeededImage } from '../lib/defaultImages';
import { useReadingHistory } from '../hooks/useReadingHistory';
import { StoryCard } from '../components/StoryCard';

export default function HomePage() {
  const navigate = useNavigate();
  const [stories, setStories] = useState<StoryMetadata[]>([]);
  const [isStoriesLoading, setIsStoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { readingNowStories, historyItems, isLoading: isHistoryLoading, removeFromHistory } = useReadingHistory();

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const q = query(collection(db, 'stories'), limit(16));
        const querySnapshot = await getDocs(q);
        const fetchedStories: StoryMetadata[] = [];
        querySnapshot.forEach((doc) => {
          fetchedStories.push({ ao3Id: doc.id, ...doc.data() } as StoryMetadata);
        });
        setStories(fetchedStories);
      } catch (err) {
        console.error("Error fetching stories:", err);
        setError("Failed to load stories.");
      } finally {
        setIsStoriesLoading(false);
      }
    };
    fetchStories();
  }, []);

  // Scroll Restoration Logic
  useEffect(() => {
    // Restore scroll position when component mounts
    const savedScroll = sessionStorage.getItem('homeScrollPos');
    if (savedScroll) {
      // Delaying slightly to allow rendering, especially with AnimatePresence
      requestAnimationFrame(() => {
        window.scrollTo(0, parseInt(savedScroll, 10));
      });
    }

    // Save scroll position when component unmounts (navigating away)
    return () => {
      sessionStorage.setItem('homeScrollPos', window.scrollY.toString());
    };
  }, []);

  const handleStoryClick = (id: string) => {
    navigate(`/story/${id}`);
  };

  if (isStoriesLoading || isHistoryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nexus-dark">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (error || stories.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-nexus-dark text-white">
        <p className="text-nexus-muted mb-4">{error || "No stories found in the database."}</p>
        <button onClick={() => window.location.reload()} className="px-4 py-2 border border-white/20 rounded hover:bg-white/5">Retry</button>
      </div>
    );
  }

  const featuredStory = stories[0];
  const recommendedStories = stories.slice(1);

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pb-24"
    >
      {/* Hero Section */}
      <section className="relative min-h-[90svh] lg:min-h-[85vh] w-full flex items-end pb-12 md:pb-24 pt-32 md:pt-40 border-b border-white/5">
        {/* Background Image & Gradient overlay */}
        <div className="absolute inset-0 w-full h-full">
          {featuredStory.coverImageUrl ? (
            <img
              src={featuredStory.coverImageUrl}
              alt="Hero Cover"
              className="w-full h-full object-cover object-center opacity-40 mix-blend-luminosity"
            />
          ) : (
            <img
              src={getSeededImage(featuredStory.ao3Id, true)}
              alt="Hero Cover"
              className="w-full h-full object-cover object-center opacity-40 mix-blend-luminosity"
            />
          )}
          {/* Gradients to fade to background color */}
          <div className="absolute inset-0 bg-gradient-to-t from-nexus-dark via-nexus-dark/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-nexus-dark via-nexus-dark/90 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 w-full pt-16 md:pt-0 pb-4">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="max-w-2xl mt-auto pt-16"
          >
            <div className="flex flex-wrap gap-2 mb-4 md:mb-6 opacity-80">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-accent/10 border border-accent/20 text-accent">FEATURED</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-white/5 border border-white/10 text-white/70">{featuredStory.fandoms?.[0] || 'Unknown'}</span>
            </div>

            <h1 className="font-serif text-4xl sm:text-5xl md:text-7xl font-light leading-tight tracking-[-0.02em] mb-4 text-white drop-shadow-2xl cursor-pointer hover:text-white/90 transition-colors" onClick={() => handleStoryClick(featuredStory.ao3Id)}>
              {featuredStory.title}
            </h1>

            <p className="text-base md:text-lg text-nexus-muted/80 mb-6 md:mb-8 line-clamp-3 md:line-clamp-4 leading-relaxed max-w-xl font-light">
              {featuredStory.summary}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-8 md:mb-10">
              <span className="text-sm font-medium text-white/90 flex items-center gap-1.5"><Star className="w-4 h-4 text-accent fill-accent" /> {featuredStory.rating}</span>
              <span className="text-xs md:text-sm font-medium text-nexus-muted">{(featuredStory.wordCount || 0).toLocaleString()} words</span>
              <span className="hidden sm:inline text-xs md:text-sm font-medium text-nexus-muted">{featuredStory.isCompleted ? 'Complete' : 'Ongoing'}</span>
              <div className="flex items-center gap-1.5 sm:border-l border-white/10 sm:pl-4">
                <PlatformIcon platform={featuredStory.sourceSite === 'FFN' ? 'FFnet' : featuredStory.sourceSite as any} className="w-5 h-5 text-[9px]" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={() => handleStoryClick(featuredStory.ao3Id)}
                className="w-full sm:w-auto h-12 px-8 bg-transparent border border-white/30 text-white rounded-full font-medium flex items-center justify-center gap-2 transition-all hover:border-white hover:bg-white/5 active:scale-95"
              >
                <Info className="w-5 h-5" /> View Metadata
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Reading Now Row */}
      {readingNowStories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 md:mt-16 relative z-20">
          <div className="flex items-end justify-between mb-6">
            <h2 className="text-2xl font-serif text-white tracking-tight font-light flex items-center gap-3">
              Reading Now
              <span className="text-xs font-sans tracking-widest text-white/30 uppercase border border-white/10 px-2 py-1 rounded-sm">{readingNowStories.length} updates</span>
            </h2>
          </div>

          <div className="flex overflow-x-auto gap-4 md:gap-6 pb-6 snap-x snap-mandatory hide-scrollbar">
            {readingNowStories.map((story, i) => {
              const historyItem = historyItems.find(h => h.storyId === story.ao3Id);
              return (
                <div key={`reading-${story.ao3Id}`} className="shrink-0 w-[140px] sm:w-[160px] md:w-[180px] lg:w-[200px] snap-start">
                  <StoryCard
                    story={story}
                    index={i}
                    onClick={handleStoryClick}
                    isReadingNow={true}
                    onRemove={removeFromHistory}
                    onShowMeta={handleStoryClick}
                    onRead={addToHistory}
                    platform={historyItem?.platformId}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Recommended / Trending Row */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 md:mt-16 relative z-20">
        <div className="flex items-end justify-between mb-6">
          <h2 className="text-2xl font-serif text-white tracking-tight font-light">
            Curated Recommendations
          </h2>
          <button className="hidden sm:flex text-xs uppercase tracking-[0.1em] text-nexus-muted hover:text-accent font-medium items-center gap-1 transition-colors">
            Explore All <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {recommendedStories.map((story, i) => (
            <StoryCard
              key={story.ao3Id}
              story={story}
              index={i}
              onClick={handleStoryClick}
            />
          ))}
        </div>
      </section>

    </motion.main>
  );
}
