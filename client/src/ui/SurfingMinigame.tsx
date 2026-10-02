import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SurfingMinigameProps {
  onClose: () => void;
  onPostScore: (score: number) => void;
}

export function SurfingMinigame({ onClose, onPostScore }: SurfingMinigameProps) {
  const [active, setActive] = useState(false);
  const [score, setScore] = useState(0);
  const [wipedOut, setWipedOut] = useState(false);
  
  // Wave state: 0 to 1 (left to right)
  const [wavePos, setWavePos] = useState(0.5);
  const [lastHit, setLastHit] = useState<'perfect' | 'good' | null>(null);
  
  const scoreRef = useRef(0);
  const wavePosRef = useRef(0.5);
  const waveSpeedRef = useRef(0.8); // units per second
  const waveDirRef = useRef(1); // 1 or -1
  const activeRef = useRef(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setActive(true);
      activeRef.current = true;
    }, 1500);
    return () => clearTimeout(timer);
  }, []);
  
  useEffect(() => {
    let lastTime = performance.now();
    let frameId: number;
    
    const update = (time: number) => {
      frameId = requestAnimationFrame(update);
      
      if (!activeRef.current || wipedOut) {
        lastTime = time;
        return;
      }
      
      const dt = (time - lastTime) / 1000;
      lastTime = time;
      
      wavePosRef.current += waveDirRef.current * waveSpeedRef.current * dt;
      
      if (wavePosRef.current >= 1) {
        wavePosRef.current = 1;
        waveDirRef.current = -1;
      } else if (wavePosRef.current <= 0) {
        wavePosRef.current = 0;
        waveDirRef.current = 1;
      }
      
      setWavePos(wavePosRef.current);
    };
    
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [wipedOut]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeRef.current || wipedOut) return;
      
      if (e.key === ' ' || e.code === 'Space') {
        const pos = wavePosRef.current;
        const distToCenter = Math.abs(pos - 0.5);
        
        if (distToCenter < 0.05) {
          // Perfect!
          scoreRef.current += 100;
          waveSpeedRef.current += 0.2; // faster!
          setLastHit('perfect');
        } else if (distToCenter < 0.15) {
          // Good
          scoreRef.current += 30;
          waveSpeedRef.current += 0.05;
          setLastHit('good');
        } else {
          // Wipe out!
          setWipedOut(true);
          activeRef.current = false;
          
          setTimeout(() => {
            onPostScore(scoreRef.current);
            onClose();
          }, 2000);
        }
        setScore(scoreRef.current);
        
        // Reset lastHit visual after a moment
        setTimeout(() => setLastHit(null), 500);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wipedOut, onClose, onPostScore]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
      >
        <div 
          className="p-8 rounded-3xl w-[28rem] shadow-2xl pointer-events-auto relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(235, 114, 84, 0.75) 0%, rgba(244, 169, 64, 0.85) 100%)',
            backdropFilter: 'blur(30px)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
          }}
        >
          {/* Decorative background wave */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, white 0%, transparent 60%)' }} />

          <div className="flex justify-between items-center mb-8 relative z-10">
            <h2 
              className="font-black drop-shadow-md text-white"
              style={{
                fontFamily: "var(--font-handwritten)",
                fontSize: '3rem',
                lineHeight: '1',
              }}
            >
              Surf's Up!
            </h2>
            <div className="text-2xl font-black bg-white/20 px-4 py-2 rounded-xl text-white border border-white/30"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {score}
            </div>
          </div>
          
          {!active && !wipedOut ? (
            <div className="text-center py-12 text-white/90">
              <p className="mb-2 text-3xl drop-shadow-md" style={{ fontFamily: "var(--font-handwritten)" }}>Catch the wave!</p>
              <p className="text-sm font-bold uppercase tracking-widest opacity-90 mt-4" style={{ fontFamily: "var(--font-display)" }}>
                Press <span className="bg-white/30 border border-white/50 px-2 py-1 rounded text-white mx-1">SPACE</span> in the center
              </p>
            </div>
          ) : wipedOut ? (
            <div className="text-center py-12">
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-black text-5xl drop-shadow-lg text-white"
                style={{ fontFamily: "var(--font-display)", color: '#d32f2f' }}
              >
                💥 WIPEOUT!
              </motion.div>
            </div>
          ) : (
            <div className="space-y-8 relative z-10 py-6">
              {/* Timing Bar */}
              <div className="relative h-12 bg-black/20 rounded-full border border-white/20 shadow-inner overflow-hidden">
                
                {/* Center Perfect Zone */}
                <div className="absolute top-0 bottom-0 left-1/2 w-8 bg-green-400/50 -translate-x-1/2 z-0 shadow-[0_0_15px_rgba(74,222,128,0.5)]" />
                {/* Good Zones */}
                <div className="absolute top-0 bottom-0 left-[calc(50%-1.5rem)] w-12 bg-yellow-400/30 -translate-x-1/2 z-0" />
                <div className="absolute top-0 bottom-0 left-[calc(50%+1.5rem)] w-12 bg-yellow-400/30 -translate-x-1/2 z-0" />
                
                {/* Moving Indicator */}
                <motion.div
                  className="absolute top-1 bottom-1 w-2 rounded-full z-10"
                  style={{
                    left: `calc(${wavePos * 100}% - 4px)`,
                    background: '#fff',
                    boxShadow: '0 0 10px rgba(255,255,255,0.8)'
                  }}
                />
              </div>
              
              <div className="text-center h-8">
                <AnimatePresence>
                  {lastHit === 'perfect' && (
                    <motion.div
                      key="perfect"
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -10, opacity: 0 }}
                      className="text-green-300 font-black text-2xl drop-shadow-md uppercase tracking-wider"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      PERFECT! +100
                    </motion.div>
                  )}
                  {lastHit === 'good' && (
                    <motion.div
                      key="good"
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -10, opacity: 0 }}
                      className="text-yellow-200 font-bold text-xl drop-shadow-md uppercase tracking-wider"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Good +30
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex justify-center text-sm text-white/90 font-bold uppercase tracking-widest mt-4" style={{ fontFamily: "var(--font-display)" }}>
                <span className="opacity-80">Hit SPACE inside the zone!</span>
              </div>
            </div>
          )}

          <div className="flex justify-center mt-6">
            <button
              className="px-6 py-2.5 rounded-full text-white/90 font-bold tracking-widest text-xs uppercase transition-all hover:bg-white/20 hover:text-white relative z-10"
              onClick={onClose}
              style={{ fontFamily: "var(--font-display)" }}
            >
              Back to Beach
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
