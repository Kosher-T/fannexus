import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Play, Info, Star, ChevronRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PlatformIcon } from '../components/PlatformIcon';
import { collection, query, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { StoryMetadata } from '../types/scraper';
import { getSeededImage } from '../lib/defaultImages';

export default function HomePage() {
  const navigate = useNavigate();
  const [stories, setStories] = useState<StoryMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setIsLoading(false);
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

  if (isLoading) {
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

      {/* Recommended / Trending Row */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-12 relative z-20">
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
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              key={story.ao3Id}
              onClick={() => handleStoryClick(story.ao3Id)}
              className="group cursor-pointer flex flex-col gap-3"
            >
              {/* Card Container */}
              <div className="w-full aspect-[2/3] rounded-xl md:rounded-2xl bg-nexus-surface border border-white/10 relative overflow-hidden flex items-center justify-center transition-transform duration-500 group-hover:scale-[1.02] group-hover:shadow-2xl group-hover:shadow-accent/5 group-hover:border-accent/40">
                {story.coverImageUrl ? (
                  <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-500 will-change-transform group-hover:scale-105" />
                ) : (
                  <img src={getSeededImage(story.ao3Id, false)} alt={story.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-500 will-change-transform group-hover:scale-105 saturate-50 mix-blend-luminosity" />
                )}

                {/* Overlay Elements */}
                <div className="absolute inset-0 bg-gradient-to-t from-nexus-dark/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Platform Badges Top Right */}
                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-col gap-1.5 opacity-80 group-hover:opacity-100">
                  <PlatformIcon platform={story.sourceSite === 'FFN' ? 'FFnet' : story.sourceSite as any} className="w-5 h-5 sm:w-6 sm:h-6 text-[9px] sm:text-[10px]" />
                </div>
              </div>

              {/* Outside Information */}
              <div>
                <h3 className="font-serif text-base sm:text-lg font-normal text-white/90 line-clamp-1 group-hover:text-accent transition-colors">{story.title}</h3>
                <p className="text-xs sm:text-sm font-light text-nexus-muted line-clamp-1 mb-1">{story.author}</p>
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium text-white/50 uppercase tracking-wider">
                  <span className="px-1.5 py-0.5 rounded-sm bg-transparent border border-white/20 text-[9px]">{story.rating}</span>
                  <span className="text-[9px] sm:text-[10px]">{Math.round((story.wordCount || 0) / 1000)}k</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

    </motion.main>
  );
}
