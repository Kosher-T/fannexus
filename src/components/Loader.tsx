import React from 'react';
import { motion } from 'motion/react';
import { BookOpen } from 'lucide-react';

const Loader = () => {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.5, 1, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.2)]"
      >
        <BookOpen className="w-8 h-8 text-accent drop-shadow-md" />
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 1 }}
        className="mt-6 text-sm font-medium tracking-[0.2em] text-white/50 uppercase"
      >
        Loading
      </motion.p>
    </div>
  );
};

export default Loader;
