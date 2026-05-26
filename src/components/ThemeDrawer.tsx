import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';
import { useUserPreferences } from '../hooks/useUserPreferences';

interface ThemeDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ThemeDrawer({ isOpen, onClose }: ThemeDrawerProps) {
    const { preferences } = useUserPreferences();

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
                                <h2 className="text-xl font-serif text-white font-light">Theme & Display</h2>
                                <p className="text-xs text-nexus-muted mt-1">Appearance settings</p>
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
                                        Choose Theme
                                    </label>

                                    <div className="space-y-3">
                                        <button type="button" className="w-full flex items-center justify-between p-4 rounded-xl border border-accent/20 bg-accent/5 text-left transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-nexus-dark border border-white/10 shrink-0 flex items-center justify-center">
                                                    <div className="w-4 h-4 rounded-full bg-white/20" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">Sophisticated Dark</p>
                                                    <p className="text-[11px] text-nexus-muted mt-0.5">High contrast, easy on the eyes</p>
                                                </div>
                                            </div>
                                            <Check className="w-5 h-5 text-accent" />
                                        </button>

                                        <button type="button" disabled className="w-full flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5 opacity-50 cursor-not-allowed text-left">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white border border-black/10 shrink-0 flex items-center justify-center">
                                                    <div className="w-4 h-4 rounded-full bg-black/20" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-white">Light (Coming Soon)</p>
                                                    <p className="text-[11px] text-nexus-muted mt-0.5">Currently not available</p>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-white/5">
                                    <p className="text-xs text-nexus-muted text-center italic">Currently, the sophisticated Dark mode is the only supported theme. More options will be added in future updates.</p>
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
