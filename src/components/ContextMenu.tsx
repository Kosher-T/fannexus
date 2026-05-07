import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share, RefreshCw, ChevronLeft, ChevronRight, Settings, Maximize, Copy, Link as LinkIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ContextMenuProps {
  children: React.ReactNode;
}

export function ContextMenuProvider({ children }: ContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Allow default context menu on inputs and textareas
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable ||
        // Check if there is selected text. If so, let normal context menu appear.
        window.getSelection()?.toString().length
      ) {
         return;
      }

      e.preventDefault();
      
      let x = e.clientX;
      let y = e.clientY;
      
      // Default menu size approximation, to adjust if near borders
      const menuWidth = 220;
      const menuHeight = 280;
      
      if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 10;
      }
      if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - 10;
      }

      setPosition({ x, y });
      setIsOpen(true);
    };

    const handleClick = (e: MouseEvent) => {
      if (isOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    // Listen for scroll to dismiss menu
    const handleScroll = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <>
      {children}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -5 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              left: position.x,
              top: position.y,
              zIndex: 9999,
            }}
            className="w-56 bg-[#1A1A1D]/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5 text-sm"
          >
            <div className="flex px-1 pb-1">
               <button onClick={() => handleAction(() => window.history.back())} className="flex-1 flex justify-center py-2 hover:bg-white/10 rounded-md transition-colors text-nexus-muted hover:text-white">
                  <ChevronLeft className="w-4 h-4" />
               </button>
               <button onClick={() => handleAction(() => window.history.forward())} className="flex-1 flex justify-center py-2 hover:bg-white/10 rounded-md transition-colors text-nexus-muted hover:text-white">
                  <ChevronRight className="w-4 h-4" />
               </button>
               <button onClick={() => handleAction(() => window.location.reload())} className="flex-1 flex justify-center py-2 hover:bg-white/10 rounded-md transition-colors text-nexus-muted hover:text-white">
                  <RefreshCw className="w-4 h-4" />
               </button>
            </div>
            
            <div className="h-[1px] bg-white/10 mx-1 mb-1"></div>

            <button onClick={() => handleAction(handleCopyLink)} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent/20 hover:text-accent transition-colors text-white/80 w-full text-left">
              <LinkIcon className="w-4 h-4" /> Copy Link
            </button>
            
            <button onClick={() => handleAction(() => navigator.clipboard.writeText(window.getSelection()?.toString() || ''))} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/10 transition-colors text-white/80 w-full text-left">
              <Copy className="w-4 h-4" /> Copy
            </button>

            {navigator.share && (
              <button onClick={() => handleAction(() => navigator.share({ url: window.location.href }))} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/10 transition-colors text-white/80 w-full text-left">
                <Share className="w-4 h-4" /> Share
              </button>
            )}

            <div className="h-[1px] bg-white/10 mx-1 my-0.5"></div>

            <button onClick={() => handleAction(toggleFullscreen)} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/10 transition-colors text-white/80 w-full text-left">
              <Maximize className="w-4 h-4" /> Fullscreen
            </button>
            
            <button onClick={() => handleAction(() => navigate('/'))} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-white/10 transition-colors text-white/80 w-full text-left">
              <Settings className="w-4 h-4" /> App Settings
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
