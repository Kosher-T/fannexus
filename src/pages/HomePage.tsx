import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Play, Info, Star, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { mockStories, Story } from '../lib/mockData';
import { PlatformIcon } from '../components/PlatformIcon';

export default function HomePage() {
  const navigate = useNavigate();
  // Using the first story as hero
  const featuredStory = mockStories[0];
  const recommendedStories = mockStories.slice(1);

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
          {featuredStory.coverImage ? (
             <img 
               src={featuredStory.coverImage} 
               alt="Hero Cover" 
               className="w-full h-full object-cover object-center opacity-40 mix-blend-luminosity"
             />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-nexus-surface to-nexus-dark opacity-50" />
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
              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-white/5 border border-white/10 text-white/70">{featuredStory.fandoms[0]}</span>
            </div>
            
            <h1 className="font-serif text-4xl sm:text-5xl md:text-7xl font-light leading-tight tracking-[-0.02em] mb-4 text-white drop-shadow-2xl cursor-pointer hover:text-white/90 transition-colors" onClick={() => handleStoryClick(featuredStory.id)}>
              {featuredStory.title}
            </h1>
            
            <p className="text-base md:text-lg text-nexus-muted/80 mb-6 md:mb-8 line-clamp-3 md:line-clamp-4 leading-relaxed max-w-xl font-light">
              {featuredStory.summary}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 mb-8 md:mb-10">
              <span className="text-sm font-medium text-white/90 flex items-center gap-1.5"><Star className="w-4 h-4 text-accent fill-accent"/> {featuredStory.rating}</span>
              <span className="text-xs md:text-sm font-medium text-nexus-muted">{featuredStory.words.toLocaleString()} words</span>
              <span className="hidden sm:inline text-xs md:text-sm font-medium text-nexus-muted">{featuredStory.status}</span>
              <div className="flex items-center gap-1.5 sm:border-l border-white/10 sm:pl-4">
                {featuredStory.platforms.map((p) => (
                  <PlatformIcon key={p} platform={p} className="w-5 h-5 text-[9px]" />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button 
                onClick={() => handleStoryClick(featuredStory.id)}
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
              key={story.id}
              onClick={() => handleStoryClick(story.id)}
              className="group cursor-pointer flex flex-col gap-3"
            >
              {/* Card Container */}
              <div className="w-full aspect-[2/3] rounded-xl md:rounded-2xl bg-nexus-surface border border-white/10 relative overflow-hidden flex items-center justify-center transition-transform duration-500 group-hover:scale-[1.02] group-hover:shadow-2xl group-hover:shadow-accent/5 group-hover:border-accent/40">
                {story.coverImage ? (
                  <img src={story.coverImage} alt={story.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-500 will-change-transform group-hover:scale-105" />
                ) : (
                  // Default elegant fallback for stories without covers
                  <div className="w-full h-full bg-gradient-to-b from-[#0a0a0a] to-[#040404] p-4 sm:p-6 flex items-center justify-center text-center relative overflow-hidden">
                    {/* Subtle generative texture/pattern */}
                    <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
                    <span className="font-serif text-lg sm:text-xl md:text-2xl font-light tracking-tight text-white/80 drop-shadow-sm leading-snug">{story.title}</span>
                    <div className="absolute font-sans bottom-4 sm:bottom-6 left-2 right-2 sm:left-6 sm:right-6 text-[10px] sm:text-xs text-nexus-muted/40 border-t border-white/5 pt-3 sm:pt-4 uppercase tracking-[0.2em] sm:tracking-[0.3em] overflow-hidden whitespace-nowrap text-ellipsis">{story.author}</div>
                  </div>
                )}
                
                {/* Overlay Elements */}
                <div className="absolute inset-0 bg-gradient-to-t from-nexus-dark/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                {/* Platform Badges Top Right */}
                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-col gap-1.5 opacity-80 group-hover:opacity-100">
                  {story.platforms.map((p) => (
                     <PlatformIcon key={p} platform={p} className="w-5 h-5 sm:w-6 sm:h-6 text-[9px] sm:text-[10px]" />
                  ))}
                </div>
              </div>

              {/* Outside Information */}
              <div>
                <h3 className="font-serif text-base sm:text-lg font-normal text-white/90 line-clamp-1 group-hover:text-accent transition-colors">{story.title}</h3>
                <p className="text-xs sm:text-sm font-light text-nexus-muted line-clamp-1 mb-1">{story.author}</p>
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium text-white/50 uppercase tracking-wider">
                  <span className="px-1.5 py-0.5 rounded-sm bg-transparent border border-white/20 text-[9px]">{story.rating}</span>
                  <span className="text-[9px] sm:text-[10px]">{Math.round(story.words / 1000)}k</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

    </motion.main>
  );
}
