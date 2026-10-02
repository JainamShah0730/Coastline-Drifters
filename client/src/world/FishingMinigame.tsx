import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LucideFish } from 'lucide-react';

interface FishingMinigameProps {
  onCatch: (fishName: string, weight: number) => void;
  onClose: () => void;
}

const FISH_TYPES = [
  { name: 'Sea Bass', weightRange: [2, 10] },
  { name: 'Mackerel', weightRange: [1, 5] },
  { name: 'Red Snapper', weightRange: [4, 15] },
  { name: 'Mahi Mahi', weightRange: [10, 30] },
  { name: 'Old Boot', weightRange: [1, 2] },
];

export function FishingMinigame({ onCatch, onClose }: FishingMinigameProps) {
  const [gameState, setGameState] = useState<'idle' | 'casting' | 'waiting' | 'bite' | 'reeling' | 'caught' | 'escaped'>('idle');
  const [sliderPos, setSliderPos] = useState(0);
  const [targetZone, setTargetZone] = useState({ start: 40, width: 20 });

  const direction = useRef(1);
  const rafRef = useRef<number | null>(null);
  const gameStateRef = useRef(gameState);
  const sliderPosRef = useRef(sliderPos);
  const targetZoneRef = useRef(targetZone);

  // Keep refs in sync with state
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { sliderPosRef.current = sliderPos; }, [sliderPos]);
  useEffect(() => { targetZoneRef.current = targetZone; }, [targetZone]);

  // ── Handle space press ───────────────────────────────────────────
  const handleSpace = useCallback(() => {
    const gs = gameStateRef.current;

    if (gs === 'idle') {
      setGameState('casting');
      setTimeout(() => {
        setGameState('waiting');
        // Random time to bite
        setTimeout(() => setGameState('bite'), 1000 + Math.random() * 3000);
      }, 800);
    } else if (gs === 'bite') {
      // Start reeling minigame
      const newZone = { start: 30 + Math.random() * 40, width: 15 + Math.random() * 10 };
      setTargetZone(newZone);
      targetZoneRef.current = newZone;
      setGameState('reeling');
    } else if (gs === 'reeling') {
      // Check if slider is in target zone
      const center = sliderPosRef.current;
      const tz = targetZoneRef.current;
      const inZone = center >= tz.start && center <= tz.start + tz.width;

      if (inZone) {
        setGameState('caught');
        const fish = FISH_TYPES[Math.floor(Math.random() * FISH_TYPES.length)];
        const weight = +(fish.weightRange[0] + Math.random() * (fish.weightRange[1] - fish.weightRange[0])).toFixed(2);
        onCatch(fish.name, weight);
        setTimeout(() => setGameState('idle'), 3000);
      } else {
        setGameState('escaped');
        setTimeout(() => setGameState('idle'), 2000);
      }
    }
  }, [onCatch]);

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
    // Use capture phase so fishing gets the Space key before the car's brake
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleSpace, onClose]);

  // ── Game loop for reeling ───────────────────────────────────────
  useEffect(() => {
    if (gameState === 'reeling') {
      const loop = () => {
        setSliderPos((prev) => {
          let next = prev + direction.current * 1.5;
          if (next >= 100) { next = 100; direction.current = -1; }
          if (next <= 0)   { next = 0;   direction.current = 1; }
          return next;
        });
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [gameState]);

  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col items-center justify-end pb-32 pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="p-8 rounded-3xl w-96 text-center pointer-events-auto"
        style={{
          background: 'linear-gradient(135deg, rgba(26, 74, 107, 0.65) 0%, rgba(10, 58, 90, 0.85) 100%)',
          backdropFilter: 'blur(30px)',
          border: '1px solid rgba(126, 200, 184, 0.4)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.2)',
        }}
      >
        <div className="flex justify-between items-center mb-6">
          <h2
            className="font-black drop-shadow-md"
            style={{
              fontFamily: "var(--font-handwritten)",
              color: 'var(--coast-sand)',
              fontSize: '2.5rem',
              lineHeight: '1',
            }}
          >
            Fishing Dock
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-lg">🐟</span>
          </div>
        </div>

        {/* ── State Displays ─────────────────────────────────────────── */}
        <div className="h-24 flex items-center justify-center mb-6">
          <AnimatePresence mode="wait">
            {gameState === 'idle' && (
              <motion.p key="idle" className="text-white/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontFamily: "var(--font-handwritten)", fontSize: '1.2rem' }}
              >
                Press <kbd className="px-2 py-1 rounded mx-1 text-white" style={{ background: 'rgba(126, 200, 184, 0.3)', border: '1px solid rgba(126, 200, 184, 0.4)' }}>SPACE</kbd> to cast line
              </motion.p>
            )}

            {gameState === 'casting' && (
              <motion.div key="casting" className="font-bold" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                style={{ color: 'var(--coast-seafoam)', fontFamily: "var(--font-handwritten)", fontSize: '1.4rem' }}
              >
                <LucideFish className="w-8 h-8 mx-auto mb-2 animate-bounce" />
                Casting out...
              </motion.div>
            )}

            {gameState === 'waiting' && (
              <motion.div key="waiting" className="text-white/50 wave-float" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ fontFamily: "var(--font-handwritten)", fontSize: '1.2rem' }}
              >
                🌊 Waiting for a bite...
              </motion.div>
            )}

            {gameState === 'bite' && (
              <motion.div key="bite" className="font-black text-2xl animate-pulse" initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                style={{ color: 'var(--coast-warm-coral)', fontFamily: "var(--font-display)" }}
              >
                🐟 BITE! Press SPACE!
              </motion.div>
            )}

            {gameState === 'reeling' && (
              <motion.div key="reeling" className="w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="text-white/80 mb-3 text-sm" style={{ fontFamily: "var(--font-handwritten)", fontSize: '1rem' }}>
                  Hit SPACE when the marker is in the catch zone!
                </p>
                <div className="depth-meter w-full h-8 relative">
                  {/* Target Zone — seafoam green with subtle pattern */}
                  <div
                    className="absolute h-full rounded-full"
                    style={{
                      left: `${targetZone.start}%`,
                      width: `${targetZone.width}%`,
                      background: 'rgba(126, 200, 184, 0.4)',
                      border: '1px solid rgba(126, 200, 184, 0.6)',
                    }}
                  />
                  {/* Moving Marker */}
                  <div
                    className="absolute h-full w-2 rounded-full"
                    style={{
                      left: `${sliderPos}%`,
                      transform: 'translateX(-50%)',
                      background: 'var(--coast-sand)',
                      boxShadow: '0 0 10px rgba(240, 228, 200, 0.8)',
                    }}
                  />
                </div>
              </motion.div>
            )}

            {gameState === 'caught' && (
              <motion.div key="caught" className="font-bold text-xl" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                style={{ color: 'var(--coast-seafoam)', fontFamily: "var(--font-handwritten)", fontSize: '1.6rem' }}
              >
                🎉 Caught something!
              </motion.div>
            )}

            {gameState === 'escaped' && (
              <motion.div key="escaped" className="font-bold" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                style={{ color: 'var(--coast-warm-coral)', fontFamily: "var(--font-handwritten)", fontSize: '1.3rem' }}
              >
                💨 It got away...
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={onClose}
          className="transition-colors text-sm hover:text-white"
          style={{ color: 'rgba(126, 200, 184, 0.5)', fontFamily: "var(--font-handwritten)", fontSize: '1rem' }}
        >
          Press ESC to leave dock
        </button>
      </div>
    </motion.div>
  );
}
