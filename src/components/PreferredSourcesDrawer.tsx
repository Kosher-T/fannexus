import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';
import { useUserPreferences } from '../hooks/useUserPreferences';

interface PreferredSourcesDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

const SOURCES = [
    { id: 'ao3', name: 'Archive of Our Own', domain: 'archiveofourown.org' },
    { id: 'spacebattles', name: 'SpaceBattles', domain: 'forums.spacebattles.com' },
    { id: 'ffnet', name: 'FanFiction.net', domain: 'fanfiction.net' },
    { id: 'sufficientvelocity', name: 'Sufficient Velocity', domain: 'forums.sufficientvelocity.com' },
    { id: 'royalroad', name: 'Royal Road', domain: 'royalroad.com' }
];

export default function PreferredSourcesDrawer({ isOpen, onClose }: PreferredSourcesDrawerProps) {
    const { preferences, setPreferredSources } = useUserPreferences();

    const toggleSource = (sourceDomain: string) => {
        const current = preferences.preferredSources || [];
        if (current.includes(sourceDomain)) {
            setPreferredSources(current.filter(s => s !== sourceDomain));
        } else {
            setPreferredSources([...current, sourceDomain]);
        }
    };

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
                                <h2 className="text-xl font-serif text-white font-light">Preferred Sources</h2>
                                <p className="text-xs text-nexus-muted mt-1">Filter your recommendations</p>
                            </div>
                            <button
                                type="button"
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
                                        Supported Platforms
                                    </label>

                                    <div className="space-y-2">
                                        {SOURCES.map((source) => {
                                            const isSelected = (preferences.preferredSources || []).includes(source.domain);
                                            return (
                                                <button
                                                    type="button"
                                                    key={source.id}
                                                    onClick={() => toggleSource(source.domain)}
                                                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors text-left ${isSelected ? 'border-accent/30 bg-accent/10' : 'border-white/5 bg-white/5 hover:border-white/10'
                                                        }`}
                                                >
                                                    <div>
                                                        <p className={`text-sm font-medium ${isSelected ? 'text-accent' : 'text-white'}`}>{source.name}</p>
                                                        <p className="text-[11px] text-nexus-muted mt-0.5">{source.domain}</p>
                                                    </div>
                                                    {isSelected && <Check className="w-5 h-5 text-accent" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/5">
                                    <p className="text-xs text-nexus-muted text-center italic">If you select none, stories from all platforms will be shown in your recommendations.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-white/10">
                            <button
                                type="button"
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
