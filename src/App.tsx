/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Search, Compass, BookOpen, Settings, Link as LinkIcon, Menu, X, LogIn, LogOut } from 'lucide-react';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import StoryPage from './pages/StoryPage';
import { auth, signInWithGoogle, signOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  if (typeof window !== 'undefined') {
    window.onscroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
  }

  const handleLinkSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkInput.trim()) return;
    navigate(`/search?url=${encodeURIComponent(linkInput)}`);
    setLinkInput('');
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  };

  const renderUserProfileBox = (onCloseAction: () => void) => {
    if (!user) return null;
    return (
       <div className="p-3 rounded-xl bg-nexus-surface border border-white/5 flex items-center justify-between gap-3 shadow-sm">
         <div className="flex items-center gap-3 overflow-hidden">
           {user.photoURL ? (
             <img src={user.photoURL} alt="Avatar" className="w-9 h-9 shrink-0 rounded-full border border-white/10" />
           ) : (
             <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-accent to-red-600 border border-white/10"></div>
           )}
           <div className="overflow-hidden">
             <p className="font-medium text-white text-sm truncate">{user.displayName || user.email}</p>
             {user.displayName && <p className="text-[10px] text-nexus-muted tracking-widest uppercase truncate">{user.email}</p>}
           </div>
         </div>
         <button onClick={() => { signOut(); onCloseAction(); }} className="w-8 h-8 shrink-0 rounded-full bg-nexus-dark border border-white/10 flex items-center justify-center hover:border-accent/50 hover:text-red-400 transition-colors group" title="Sign Out">
            <LogOut className="w-3.5 h-3.5 text-nexus-muted group-hover:text-red-400 transition-colors" />
         </button>
       </div>
    );
  };

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-500 ease-in-out ${isScrolled ? 'bg-nexus-dark/95 backdrop-blur-xl py-3' : 'bg-transparent py-4 md:py-6'}`}>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 flex items-center h-10">
          
          {/* Logo (Left) */}
          <Link to="/" className="flex flex-1 items-center gap-2 group z-10 w-48">
            <BookOpen className="w-6 h-6 md:w-7 md:h-7 text-accent group-hover:scale-110 transition-transform duration-300" />
            <span className={`font-serif text-lg md:text-xl font-bold tracking-tight text-white transition-opacity ${isScrolled ? 'max-md:block md:hidden lg:block' : 'block'}`}>
              Fan<span className="text-accent">Nexus</span>
            </span>
          </Link>

          {/* Dynamic Search / Nav Area (Center - Absolute) */}
          <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-full max-w-lg z-0 items-center justify-center">
            <AnimatePresence mode="wait">
              {!isScrolled ? (
                 <motion.nav 
                   key="nav-links"
                   initial={{ opacity: 0, y: -10 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.9 }}
                   className="flex items-center gap-8 text-sm font-medium"
                 >
                   <Link to="/" className="text-nexus-muted hover:text-accent transition-colors flex items-center gap-2">
                     <Compass className="w-4 h-4" /> Discover
                   </Link>
                   <Link to="/search" className="text-nexus-muted hover:text-accent transition-colors flex items-center gap-2">
                     <Search className="w-4 h-4" /> Find Similar
                   </Link>
                 </motion.nav>
              ) : (
                <motion.form 
                  key="sticky-search"
                  initial={{ opacity: 0, scale: 0.9, width: "auto" }}
                  animate={{ opacity: 1, scale: 1, width: "100%" }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleLinkSearch}
                  className="relative w-full max-w-lg group hidden md:block"
                >
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LinkIcon className="w-4 h-4 text-nexus-muted group-focus-within:text-accent transition-colors" />
                  </div>
                  <input
                    type="url"
                    placeholder="Paste story link for recommendations..."
                    className="w-full h-10 pl-10 pr-24 bg-nexus-surface border border-white/5 rounded-full text-sm text-white placeholder-nexus-muted/70 focus:ring-1 focus:ring-accent focus:border-accent transition-all outline-none"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={!linkInput.trim()}
                    className="absolute inset-y-1 right-1 px-4 bg-accent hover:bg-accent-hover text-nexus-dark rounded-full text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Find
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* User / Settings / Mobile Toggle (Right) */}
          <div className="flex flex-1 items-center justify-end z-10 w-48 relative h-10">
            {/* Hamburger - fades in on scroll for desktop, always visible on mobile */}
            <div className={`absolute right-0 flex items-center justify-center transition-all duration-500 ease-in-out ${isScrolled ? 'opacity-100 pointer-events-auto z-10' : 'opacity-100 md:opacity-0 pointer-events-auto md:pointer-events-none z-0'}`}>
              <button 
                 className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white hover:bg-white/5 transition-colors"
                 onClick={() => setIsMobileMenuOpen(true)}
              >
                 <Menu className="w-6 h-6 text-accent" />
              </button>
            </div>
            
            {/* Desktop User Profile / Sign In - fades out on scroll */}
            <div className={`hidden md:flex absolute right-0 items-center justify-end transition-all duration-500 ease-in-out ${isScrolled ? 'opacity-0 pointer-events-none z-0' : 'opacity-100 pointer-events-auto z-10'}`}>
              {user ? (
                <button onClick={() => setIsUserMenuOpen(true)} className="rounded-full transition-all group overflow-hidden">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-10 h-10 shrink-0 rounded-full border-2 border-transparent group-hover:border-accent transition-colors object-cover" />
                  ) : (
                    <div className="w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-accent to-red-600 border-2 border-transparent group-hover:border-accent transition-colors"></div>
                  )}
                </button>
              ) : (
                <button onClick={signInWithGoogle} className="flex items-center gap-2 px-4 h-10 shrink-0 rounded-full bg-accent hover:bg-accent-hover text-nexus-dark text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-lg whitespace-nowrap">
                  <LogIn className="w-4 h-4" /> Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Drawer: Main Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
              onClick={() => setIsMobileMenuOpen(false)} 
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-[320px] max-w-[85vw] h-full bg-[#0D0D0F] border-l border-white/5 flex flex-col shadow-2xl"
            >
              <div className="p-6 flex items-center justify-between border-b border-white/5">
                 <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 group shrink-0">
                    <BookOpen className="w-6 h-6 text-accent" />
                    <span className="font-serif text-xl font-light text-white">Fan<span className="text-accent font-medium">Nexus</span></span>
                 </Link>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-full hover:bg-white/5 text-nexus-muted hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
                 {/* Mobile Search - only show on mobile or tablet */}
                 <form onSubmit={handleLinkSearch} className="md:hidden relative w-full group mb-2 border-b border-white/10 pb-6">
                    <div className="absolute inset-y-0 left-0 pl-1 top-0 bottom-6 flex items-center pointer-events-none">
                      <LinkIcon className="w-4 h-4 text-accent" />
                    </div>
                    <input
                      type="url"
                      placeholder="Paste story link..."
                      className="w-full h-12 pl-8 pr-20 bg-transparent border-none text-lg font-light text-white placeholder-nexus-muted/50 focus:ring-0 transition-all outline-none"
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={!linkInput.trim()}
                      className="absolute right-0 top-2 bottom-8 px-4 bg-accent text-nexus-dark rounded-full text-xs font-semibold flex items-center transition-all disabled:opacity-30 disabled:scale-95"
                    >
                      Find
                    </button>
                  </form>

                 <nav className="flex flex-col gap-6 text-xl font-serif text-white/80">
                   <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-accent flex items-center gap-4 transition-colors"><Compass className="w-6 h-6 text-accent/50"/> Discover</Link>
                   <Link to="/search" onClick={() => setIsMobileMenuOpen(false)} className="hover:text-accent flex items-center gap-4 transition-colors"><Search className="w-6 h-6 text-accent/50"/> Advanced Search</Link>
                   {!user && (
                     <button onClick={() => { signInWithGoogle(); setIsMobileMenuOpen(false); }} className="hover:text-accent flex items-center gap-4 transition-colors text-left font-serif text-xl"><LogIn className="w-6 h-6 text-accent/50"/> Sign In</button>
                   )}
                 </nav>
              </div>

              {user && (
                 <div className="p-6 border-t border-white/5 mt-auto">
                    {renderUserProfileBox(() => setIsMobileMenuOpen(false))}
                 </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Drawer: Account Menu */}
      <AnimatePresence>
        {isUserMenuOpen && (
          <div className="fixed inset-0 z-[100] flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
              onClick={() => setIsUserMenuOpen(false)} 
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-[320px] max-w-[85vw] h-full bg-[#0D0D0F] border-l border-white/5 flex flex-col shadow-2xl"
            >
              <div className="p-6 flex items-center justify-between border-b border-white/5">
                <h2 className="text-lg font-serif text-white">Account Settings</h2>
                <button onClick={() => setIsUserMenuOpen(false)} className="p-2 rounded-full hover:bg-white/5 text-nexus-muted hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                 {/* Settings / Preferences Buttons */}
                 <div className="space-y-2">
                   <p className="text-xs font-semibold text-nexus-muted uppercase tracking-widest mb-4">Preferences</p>
                   <button className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 text-white/80 hover:text-white transition-colors text-sm text-left">
                     <Settings className="w-5 h-5 text-accent/70 shrink-0" /> 
                     <span>
                       <span className="block font-medium">Theme & Display</span>
                       <span className="block text-[11px] text-nexus-muted mt-0.5">Sophisticated Dark, Typography</span>
                     </span>
                   </button>
                   <button className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 text-white/80 hover:text-white transition-colors text-sm text-left">
                     <BookOpen className="w-5 h-5 text-accent/70 shrink-0" />
                     <span>
                       <span className="block font-medium">Preferred Fandoms</span>
                       <span className="block text-[11px] text-nexus-muted mt-0.5">Prioritize in recommendations</span>
                     </span>
                   </button>
                   <button className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 text-white/80 hover:text-white transition-colors text-sm text-left">
                     <Compass className="w-5 h-5 text-accent/70 shrink-0" />
                     <span>
                       <span className="block font-medium">Preferred Sources</span>
                       <span className="block text-[11px] text-nexus-muted mt-0.5">AO3, Spacebattles, FF.net</span>
                     </span>
                   </button>
                 </div>
                 
                 <div className="w-12 h-[1px] bg-white/5 my-2"></div>
                 
                 <div className="space-y-2">
                   <p className="text-xs font-semibold text-nexus-muted uppercase tracking-widest mb-4">Library</p>
                   <button className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 text-white/80 hover:text-white transition-colors text-sm text-left">
                     <BookOpen className="w-5 h-5 text-nexus-muted shrink-0" /> Reading History
                   </button>
                 </div>
              </div>

              <div className="p-6 border-t border-white/5 mt-auto bg-[#0A0A0B]/50">
                 {renderUserProfileBox(() => setIsUserMenuOpen(false))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <div key={location.pathname}>
        <Routes location={location}>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/story/:id" element={<StoryPage />} />
        </Routes>
      </div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-nexus-dark text-nexus-text selection:bg-accent/30 selection:text-accent">
        <Navigation />
        <AnimatedRoutes />
      </div>
    </BrowserRouter>
  );
}
