import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink, Clock } from 'lucide-react';
import { useReadingHistory } from '../hooks/useReadingHistory';

interface ReadingHistoryDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ReadingHistoryDrawer({ isOpen, onClose }: ReadingHistoryDrawerProps) {
    const { historyItems, readingNowStories, isLoading, isFetchingStories, removeFromHistory } = useReadingHistory();

    const loading = isLoading || isFetchingStories;

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
                                <h2 className="text-xl font-serif text-white font-light">Reading History</h2>
                                <p className="text-xs text-nexus-muted mt-1">Recently viewed stories</p>
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
                                {loading ? (
                                    <div className="space-y-4">
                                        <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
                                        <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
                                        <div className="h-20 bg-white/5 rounded-xl animate-pulse" />
                                    </div>
                                ) : readingNowStories.length > 0 ? (
                                    <div className="space-y-3">
                                        {readingNowStories.map((item) => {
                                            const historyItem = historyItems.find(hi => hi.storyId === item.ao3Id);
                                            const timestamp = historyItem?.timestamp || Date.now();

                                            return (
                                                <div key={item.ao3Id} className="p-4 rounded-xl border border-white/5 bg-white/5 hover:border-white/10 transition-colors">
                                                    <div className="flex justify-between items-start gap-4">
                                                        <div>
                                                            <p className="text-sm font-medium text-white line-clamp-1">{item.title}</p>
                                                            <p className="text-xs text-nexus-muted mt-1 flex items-center gap-2">
                                                                <Clock className="w-3 h-3" />
                                                                {new Date(timestamp).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            <button
                                                                onClick={() => removeFromHistory(item.ao3Id)}
                                                                className="p-2 -mr-2 -mt-2 text-accent/70 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors shrink-0"
                                                                title="Remove from history"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                            {item.url && (
                                                                <a
                                                                    href={item.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-2 -mr-2 text-accent/70 hover:text-accent hover:bg-accent/10 rounded-lg transition-colors shrink-0"
                                                                    title="Open original story"
                                                                >
                                                                    <ExternalLink className="w-4 h-4" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <Clock className="w-8 h-8 text-white/10 mx-auto mb-4" />
                                        <p className="text-sm font-medium text-white mb-2">No history yet</p>
                                        <p className="text-xs text-nexus-muted">Stories you view will appear here</p>
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
