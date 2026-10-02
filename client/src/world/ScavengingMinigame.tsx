import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LucideSearch, LucidePackage } from 'lucide-react';

interface ScavengingMinigameProps {
  onFind: (itemName: string, value: number) => void;
  onClose: () => void;
}

const SCAVENGE_ITEMS = [
  { name: 'Piece of Driftwood', valueRange: [1, 5] },
  { name: 'Smooth Sea Glass', valueRange: [5, 15] },
  { name: 'Rare Seashell', valueRange: [10, 25] },
  { name: 'Message in a Bottle', valueRange: [20, 50] },
  { name: 'Old Silver Coin', valueRange: [50, 100] },
  { name: 'Tangled Seaweed', valueRange: [0, 1] },
];

export function ScavengingMinigame({ onFind, onClose }: ScavengingMinigameProps) {
  const [gameState, setGameState] = useState<'idle' | 'searching' | 'found' | 'missed'>('idle');
  const [promptVisible, setPromptVisible] = useState(false);

  // ── Handle space press ───────────────────────────────────────────
  const handleSpace = useCallback(() => {
    if (gameState === 'idle') {
      setGameState('searching');
      // Wait a random time before showing the prompt
      setTimeout(() => {
        setPromptVisible(true);
        // The player has a short window to press space again
        setTimeout(() => {
          setPromptVisible(false);
          setGameState((prev) => (prev === 'searching' ? 'missed' : prev));
        }, 800 + Math.random() * 600); // 0.8s to 1.4s window
      }, 1500 + Math.random() * 2000);
    } else if (gameState === 'searching' && promptVisible) {
      setPromptVisible(false);
      setGameState('found');
      const item = SCAVENGE_ITEMS[Math.floor(Math.random() * SCAVENGE_ITEMS.length)];
      const value = Math.floor(item.valueRange[0] + Math.random() * (item.valueRange[1] - item.valueRange[0]));
      onFind(item.name, value);
      setTimeout(() => setGameState('idle'), 2500);
    }
  }, [gameState, promptVisible, onFind]);

  // ── Keyboard controls ───────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        handleSpace();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleSpace, onClose]);

  // Reset state on miss
  useEffect(() => {
    if (gameState === 'missed') {
      const timer = setTimeout(() => setGameState('idle'), 1500);
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col items-center justify-end pb-32 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="p-8 rounded-[2rem] w-96 text-center pointer-events-auto coast-panel-warm relative overflow-hidden"
      >
        {/* Subtle decorative glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-[var(--coast-sunset-gold)] rounded-full blur-3xl opacity-20 pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-[var(--coast-seafoam)] rounded-full blur-3xl opacity-20 pointer-events-none" />
        <div className="flex justify-between items-center mb-8 relative z-10">
          <h2
            className="font-black tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              color: 'var(--coast-deep-ocean)',
              fontSize: '2rem',
              lineHeight: '1',
            }}
          >
            Driftwood Village
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xl">🪵</span>
          </div>
        </div>

        {/* ── State Displays ─────────────────────────────────────────── */}
        <div className="h-28 flex items-center justify-center mb-6 relative z-10">
          <AnimatePresence mode="wait">
            {gameState === 'idle' && (
              <motion.p key="idle" className="font-medium text-[var(--coast-deep-ocean)]/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontFamily: "var(--font-display)", fontSize: '1.1rem' }}
              >
                Press <kbd className="px-2 py-1 rounded-md mx-1 font-bold text-white bg-[var(--coast-deep-ocean)] shadow-sm">SPACE</kbd> to start scavenging
              </motion.p>
            )}

            {gameState === 'searching' && !promptVisible && (
              <motion.div key="searching" className="font-bold text-[var(--coast-deep-ocean)]" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                style={{ fontFamily: "var(--font-display)", fontSize: '1.2rem' }}
              >
                <LucideSearch className="w-8 h-8 mx-auto mb-3 animate-pulse opacity-80" />
                Searching the debris...
              </motion.div>
            )}

            {gameState === 'searching' && promptVisible && (
              <motion.div key="prompt" className="font-black text-2xl animate-bounce" initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                style={{ color: 'var(--coast-warm-coral)', fontFamily: "var(--font-display)" }}
              >
                ✨ Something shiny! Press SPACE! ✨
              </motion.div>
            )}

            {gameState === 'found' && (
              <motion.div key="found" className="font-bold" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                style={{ color: 'var(--coast-pine)', fontFamily: "var(--font-display)", fontSize: '1.4rem' }}
              >
                <LucidePackage className="w-10 h-10 mx-auto mb-3" />
                Found something!
              </motion.div>
            )}

            {gameState === 'missed' && (
              <motion.div key="missed" className="font-bold" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                style={{ color: 'var(--coast-warm-coral)', fontFamily: "var(--font-display)", fontSize: '1.2rem' }}
              >
                💨 Too slow... it got lost in the sand.
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={onClose}
          className="transition-all text-sm font-bold uppercase tracking-widest hover:text-[var(--coast-deep-ocean)] text-[var(--coast-deep-ocean)]/50 relative z-10"
          style={{ fontFamily: "var(--font-display)", fontSize: '0.85rem' }}
        >
          Press ESC to leave
        </button>
      </div>
    </motion.div>
  );
}
