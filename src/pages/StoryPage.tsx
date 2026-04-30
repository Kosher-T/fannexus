import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, BookOpen, Clock, Tag, ExternalLink, Calendar, Search, Loader2 } from 'lucide-react';
import { PlatformIcon } from '../components/PlatformIcon';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { StoryMetadata } from '../types/scraper';
import { getSeededImage } from '../lib/defaultImages';

export default function StoryPage() {
  const { id } = useParams<{ id: string }>();
  const [story, setStory] = useState<StoryMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStory = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'stories', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setStory({ ao3Id: docSnap.id, ...docSnap.data() } as StoryMetadata);
        } else {
          setError("Story not found");
        }
      } catch (err) {
        console.error("Error fetching story:", err);
        setError("Failed to load story");
      } finally {
        setIsLoading(false);
      }
    };
    fetchStory();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nexus-dark">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="min-h-screen pt-32 px-6 text-center">
        <h1 className="text-2xl text-white font-serif mb-4">Story Not Found in Nexus</h1>
        <Link to="/" className="text-accent hover:underline flex items-center justify-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Directory
        </Link>
      </div>
    );
  }

  // Formatting dates
  const pubDate = story.publishedDate ? new Date(story.publishedDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : 'Unknown';
  const upDate = story.updatedDate ? new Date(story.updatedDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unknown';

  const sourceSitePlatform = story.sourceSite === 'FFN' ? 'FFnet' : story.sourceSite;

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen pt-24 md:pt-32 pb-24 relative"
    >
      {/* Sticky Mobile/Desktop Back Button */}
      <div className="sticky top-20 z-40 max-w-7xl mx-auto px-4 sm:px-6 w-full mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-white bg-nexus-surface/80 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full hover:bg-white/10 hover:border-white/30 transition-all font-medium text-sm shadow-xl"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back to Discover</span>
          <span className="sm:hidden">Back</span>
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        <div className="flex flex-col md:flex-row gap-8 md:gap-12">

          {/* Left Column: Cover & Quick Stats */}
          <div className="w-full md:w-1/3 shrink-0">
            <div className="w-full aspect-[2/3] rounded-2xl bg-nexus-surface border border-white/10 overflow-hidden shadow-2xl relative mb-6">
              {story.coverImageUrl ? (
                <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover opacity-80" />
              ) : (
                <img src={getSeededImage(story.ao3Id, false)} alt={story.title} className="w-full h-full object-cover opacity-80 saturate-50 mix-blend-luminosity" />
              )}
            </div>

            {/* Platform Cross-References */}
            <div className="bg-transparent border-t border-white/10 pt-6 mb-6">
              <h3 className="text-xs uppercase tracking-widest text-nexus-muted mb-4 font-medium">Available Platforms</h3>
              <div className="flex flex-col gap-3">
                <a
                  href={story.link || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <PlatformIcon platform={sourceSitePlatform as any} className="w-7 h-7 text-[10px]" />
                    <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors">{sourceSitePlatform}</span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-nexus-muted group-hover:text-accent transition-colors" />
                </a>
              </div>
            </div>

            {/* Find Similar Action */}
            <Link to={`/search?url=${encodeURIComponent(story.link || '')}`} className="w-full flex items-center gap-2 justify-center py-4 bg-transparent border border-white/20 hover:border-accent hover:text-accent hover:bg-accent/5 text-white rounded-full font-normal uppercase tracking-wider text-xs transition-colors">
              <Search className="w-4 h-4" /> Find Similar Stories
            </Link>
          </div>

          {/* Right Column: Details */}
          <div className="w-full md:w-2/3">
            <div className="mb-8">
              <h1 className="font-serif text-4xl md:text-5xl font-light text-white mb-3 tracking-tight leading-snug">{story.title}</h1>
              <p className="text-xl text-nexus-muted mb-6 font-light">by <span className="text-white normal-case tracking-normal">{story.author}</span></p>

              <div className="flex flex-wrap gap-3 mb-6">
                {story.fandoms && story.fandoms.map(f => (
                  <span key={f} className="px-3 py-1 bg-transparent border border-white/20 rounded-full text-xs font-medium uppercase tracking-widest text-white">
                    {f}
                  </span>
                ))}
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-y border-white/10 mb-8">
                <div>
                  <div className="text-nexus-muted text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Words</div>
                  <div className="text-white font-medium">{(story.wordCount || 0).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-nexus-muted text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Chapters</div>
                  <div className="text-white font-medium">{story.chapterCount || '?'} <span className="text-nexus-muted/50 text-sm">({story.isCompleted ? 'Complete' : 'Ongoing'})</span></div>
                </div>
                <div>
                  <div className="text-nexus-muted text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Published</div>
                  <div className="text-white font-medium text-sm">{pubDate}</div>
                </div>
                <div>
                  <div className="text-nexus-muted text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Updated</div>
                  <div className="text-white font-medium text-sm">{upDate}</div>
                </div>
              </div>

              {/* Summary */}
              <div className="mb-10">
                <h3 className="text-lg font-serif font-normal text-white border-b border-white/10 pb-2 mb-4">Synopsis</h3>
                <p className="text-nexus-muted/90 text-lg leading-relaxed font-light whitespace-pre-wrap">
                  {story.summary}
                </p>
              </div>

              {/* Tags */}
              <div>
                <h3 className="text-xs uppercase tracking-widest text-nexus-muted border-b border-white/10 pb-2 mb-4 font-medium flex items-center gap-2"><Tag className="w-4 h-4" /> Tags & Tropes</h3>
                <div className="flex flex-wrap gap-2">
                  {story.tags && story.tags.map(tag => (
                    <span key={`tag-${tag}`} className="px-3 py-1.5 bg-nexus-surface border border-white/5 text-nexus-muted hover:text-white hover:border-white/20 transition-colors rounded-full text-xs font-light tracking-wide cursor-pointer">
                      {tag}
                    </span>
                  ))}
                  {story.characters && story.characters.map(char => (
                    <span key={`char-${char}`} className="px-3 py-1.5 bg-nexus-surface border border-white/5 text-nexus-muted hover:text-white hover:border-white/20 transition-colors rounded-full text-xs font-light tracking-wide cursor-pointer">
                      {char}
                    </span>
                  ))}
                  {story.relationships && story.relationships.map(rel => (
                    <span key={`rel-${rel}`} className="px-3 py-1.5 bg-nexus-surface border border-white/5 text-nexus-muted hover:text-white hover:border-white/20 transition-colors rounded-full text-xs font-light tracking-wide cursor-pointer">
                      {rel}
                    </span>
                  ))}
                  <span className="px-3 py-1.5 bg-transparent border border-accent/30 text-accent rounded-full text-xs tracking-wide font-medium">
                    Rating: {story.rating}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </motion.main>
  );
}

