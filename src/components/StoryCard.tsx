import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, X } from 'lucide-react';
import { PlatformIcon } from './PlatformIcon';
import { getSeededImage } from '../lib/defaultImages';
import type { StoryMetadata } from '../types/scraper';

interface StoryCardProps {
    story: StoryMetadata;
    index: number;
    onClick: (storyId: string) => void;
    // If true, behaves like "Reading Now"
    isReadingNow?: boolean;
    onRemove?: (storyId: string) => void;
    onShowMeta?: (storyId: string) => void;
    onRead?: (storyId: string, platform: string) => void;
    platform?: string; // the platform to show/use
}

export function StoryCard({
    story,
    index,
    onClick,
    isReadingNow = false,
    onRemove,
    onShowMeta,
    onRead,
    platform
}: StoryCardProps) {
    const [isHovered, setIsHovered] = React.useState(false);
    const cardRef = React.useRef<HTMLDivElement>(null);
    const displayPlatform = platform || story.sourceSite;

    // Fix for when a story is removed and the next one slides under the stationary cursor
    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (cardRef.current) {
                const actuallyHovered = cardRef.current.matches(':hover');
                if (actuallyHovered && !isHovered) {
                    setIsHovered(true);
                } else if (!actuallyHovered && isHovered) {
                    setIsHovered(false);
                }
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [index, story.ao3Id]);

    const handleCardClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (isReadingNow && story.link) {
            if (onRead) onRead(story.ao3Id, displayPlatform);
            window.open(story.link, '_blank', 'noopener,noreferrer');
        } else {
            onClick(story.ao3Id);
        }
    };

    const handleShowMeta = (e: React.MouseEvent) => {
        e.stopPropagation(); // prevent card click
        if (onShowMeta) {
            onShowMeta(story.ao3Id);
        } else {
            onClick(story.ao3Id);
        }
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onRemove) {
            onRemove(story.ao3Id);
        }
    };

    return (
        <motion.div
            ref={cardRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleCardClick}
            className="group cursor-pointer flex flex-col gap-3 relative"
        >
            {/* Card Container */}
            <div className="w-full aspect-[2/3] rounded-xl md:rounded-2xl bg-nexus-surface border border-white/10 relative overflow-hidden flex items-center justify-center transition-transform duration-500 group-hover:scale-[1.02] group-hover:shadow-2xl group-hover:shadow-accent/5 group-hover:border-accent/40">
                {story.coverImageUrl ? (
                    <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-20 transition-opacity duration-500 will-change-transform group-hover:scale-105" />
                ) : (
                    <img src={getSeededImage(story.ao3Id, false)} alt={story.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-20 transition-opacity duration-500 will-change-transform group-hover:scale-105 saturate-50 mix-blend-luminosity" />
                )}

                {/* Overlay Gradients */}
                <div className="absolute inset-0 bg-gradient-to-t from-nexus-dark/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                <div className="absolute inset-0 bg-nexus-dark/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                {/* Platform Badges Top Right (always visible, but fades out for other elements if needed, let's keep it visible) */}
                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex shadow-lg flex-col gap-1.5 opacity-80 group-hover:opacity-0 transition-opacity">
                    <PlatformIcon platform={displayPlatform === 'FFN' ? 'FFnet' : displayPlatform as any} className="w-5 h-5 sm:w-6 sm:h-6 text-[9px] sm:text-[10px]" />
                </div>

                {/* Reading Now specific controls */}
                {isReadingNow && (
                    <AnimatePresence>
                        {isHovered && (
                            <motion.button
                                type="button"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className="absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 rounded-full bg-black/60 hover:bg-black text-white/70 hover:text-white transition-colors z-20"
                                onClick={handleRemove}
                                title="Remove from Reading Now"
                            >
                                <X className="w-4 h-4 sm:w-5 sm:h-5" />
                            </motion.button>
                        )}
                    </AnimatePresence>
                )}

                {/* Hover Content */}
                <AnimatePresence>
                    {isHovered && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute inset-0 flex flex-col justify-center p-4 sm:p-5 text-center z-10"
                        >
                            <h4 className="text-white font-serif font-light text-base sm:text-lg lg:text-xl line-clamp-3 mb-2 leading-snug">
                                {story.title}
                            </h4>
                            {story.fandoms && story.fandoms.length > 0 && (
                                <p className="text-accent/90 text-[10px] sm:text-xs font-medium uppercase tracking-wider mb-2 line-clamp-2">
                                    {story.fandoms.join(', ')}
                                </p>
                            )}
                            <p className="text-nexus-muted text-xs sm:text-sm font-light line-clamp-5 leading-relaxed">
                                {story.summary || "No summary available."}
                            </p>

                            {isReadingNow && (
                                <div className="mt-auto pt-4 flex justify-center w-full">
                                    <button
                                        type="button"
                                        onClick={handleShowMeta}
                                        className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-white bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-full backdrop-blur-sm transition-colors"
                                    >
                                        <Info className="w-3.5 h-3.5" /> Meta
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
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
    );
}
