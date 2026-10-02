import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sky, Environment } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { motion, AnimatePresence } from 'framer-motion';
import * as Colyseus from 'colyseus.js';
import * as THREE from 'three';

import {
  Ocean, Island, Road, Trees, StreetLights,
  NodeMarkers, FishingDock, GasStation,
  Bonfire, Campsite, SurfBeach, Boulders, Bushes, GroundDetails,
  Lighthouse, DriftwoodVillage, Fences, Seagrass, WildflowerPatches, DriftwoodScatter, Clutter
} from './world/IslandScene';
import { NODES, ROAD_WAYPOINTS } from './world/constants';
import { FishingMinigame } from './world/FishingMinigame';
import { ScavengingMinigame } from './world/ScavengingMinigame';
import { SurfingMinigame } from './ui/SurfingMinigame';
import { VehicleController, RemoteVehicle } from './vehicle/VehicleController';

const COLYSEUS_URL = `ws://${window.location.hostname || 'localhost'}:2567`;
const BOLLYWOOD_URL = "https://stream.zeno.fm/60ef4p33vxquv";

// ── Horn Sound ────────────────────────────────────────────────────
const playHornSound = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  // Friendly dual-tone horn (like a cute van beep)
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.value = 440;
  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.value = 554;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  osc1.start();
  osc2.start();
  osc1.stop(ctx.currentTime + 0.5);
  osc2.stop(ctx.currentTime + 0.5);
  setTimeout(() => ctx.close(), 600);
};

// ── Fire Crackle Sound ────────────────────────────────────────────
const startFireCrackleAudio = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return { stop: () => {} };
  const ctx = new AudioContext();
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1000;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3000;
  const gain = ctx.createGain();
  gain.gain.value = 0.04;
  noise.connect(hp).connect(lp).connect(gain).connect(ctx.destination);
  noise.start();
  // Random crackling pops
  const pop = () => {
    if (ctx.state === 'closed') return;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.04, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
    gain.gain.linearRampToValueAtTime(0.04, t + 0.08);
  };
  const id = setInterval(pop, 200 + Math.random() * 600);
  return { stop: () => { clearInterval(id); ctx.close(); } };
};

// ── Synthetic Ambient Audio ───────────────────────────────────────
const startOceanAudio = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return null;
  const ctx = new AudioContext();
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;
  noiseSource.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.15;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 50;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  const gain = ctx.createGain();
  gain.gain.value = 0.05;
  noiseSource.connect(filter).connect(gain).connect(ctx.destination);
  noiseSource.start();
  lfo.start();
  return { stop: () => ctx.close() };
};

const startCricketsAudio = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return { stop: () => {} };
  const ctx = new AudioContext();
  
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = 4500;
  
  const lfo = ctx.createOscillator();
  lfo.type = 'square';
  lfo.frequency.value = 15;

  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.5;

  const env = ctx.createGain();
  env.gain.value = 0;

  lfo.connect(lfoGain);
  lfoGain.connect(env.gain);
  osc.connect(env);

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 4000;
  env.connect(filter);

  const gain = ctx.createGain();
  gain.gain.value = 0.03;
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  lfo.start();

  const chirp = () => {
    if (ctx.state === 'closed') return;
    const t = ctx.currentTime;
    env.gain.cancelScheduledValues(t);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.1);
    env.gain.linearRampToValueAtTime(0, t + 0.2);
    
    env.gain.setValueAtTime(0, t + 0.3);
    env.gain.linearRampToValueAtTime(1, t + 0.4);
    env.gain.linearRampToValueAtTime(0, t + 0.5);
  };
  
  chirp();
  const id = setInterval(chirp, 1000 + Math.random() * 500);

  return { stop: () => { clearInterval(id); ctx.close(); } };
};

// ── Types ─────────────────────────────────────────────────────────
interface VehicleState { x: number; y: number; z: number; rotationY: number; speed: number; driverSessionId: string; color: string; }
interface PlayerState  { x: number; y: number; z: number; rotationY: number; name: string; activeNode: string; color: string; }

// ── Node emoji map ────────────────────────────────────────────────
const NODE_ICONS: Record<string, string> = {
  'rest-stop': '⛽',
  'fishing-dock': '🎣',
  'surf-beach': '🏄',
  'campsite': '⛺',
  'bonfire-circle': '🔥',
  'lighthouse': '🗼',
  'driftwood-village': '🏘️',
  'overlook': '🌅',
};

// ── Lobby screen ──────────────────────────────────────────────────
const VEHICLE_COLORS = ['#e8a020', '#d32f2f', '#1976d2', '#388e3c', '#7b1fa2', '#fbc02d', '#0097a7', '#424242'];

function LobbyScreen({ onJoin }: { onJoin: (name: string, color: string) => void }) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(VEHICLE_COLORS[0]);
  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center z-50 overflow-hidden"
      style={{ background: 'radial-gradient(circle at 50% 0%, #1a4a6b 0%, #0a192f 100%)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.4 }}
    >
      {/* Decorative background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full mix-blend-screen opacity-20 blur-[100px]" style={{ background: '#eb7254' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full mix-blend-screen opacity-20 blur-[100px]" style={{ background: '#7ec8b8' }} />
      
      <div className="absolute bottom-0 left-0 right-0 h-32 wave-float" style={{
        background: 'linear-gradient(0deg, rgba(126, 200, 184, 0.1) 0%, transparent 100%)',
        borderRadius: '50% 50% 0 0 / 100% 100% 0 0',
      }} />

      <motion.div
        className="text-center px-12 py-14 rounded-[32px] relative z-10 w-full max-w-lg"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(30px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        }}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.5, type: 'spring', bounce: 0.4 }}
      >
        <motion.h1
          className="text-5xl font-black mb-3 tracking-tight text-white"
          style={{
            fontFamily: "var(--font-display)",
            textShadow: '0 2px 10px rgba(0,0,0,0.3)',
          }}
        >
          Coastline Drifters
        </motion.h1>
        
        <p className="mb-12 text-sm tracking-[0.2em] uppercase font-bold text-white/60">
          A minimal multiplayer road trip
        </p>

        <input
          className="w-full text-lg outline-none transition-all text-center bg-transparent border-white/20 text-white placeholder:text-white/30"
          style={{
            fontFamily: "var(--font-display)",
            padding: '16px 20px',
            borderBottom: '2px solid rgba(255,255,255,0.2)',
            marginBottom: '40px'
          }}
          placeholder="Enter your driver name"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onJoin(name.trim(), selectedColor); }}
          onFocus={(e) => {
            e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.8)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.2)';
          }}
        />

        <div style={{ marginBottom: '40px' }}>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-white/50" style={{ fontFamily: "var(--font-display)", marginBottom: '20px' }}>
            Select Color
          </p>
          
          <div className="flex justify-center flex-wrap" style={{ gap: '16px' }}>
            {VEHICLE_COLORS.map(c => (
              <div 
                key={c}
                onClick={() => setSelectedColor(c)}
                className="rounded-full cursor-pointer transition-all relative"
                style={{ 
                  width: '40px',
                  height: '40px',
                  backgroundColor: c,
                  border: selectedColor === c ? '2px solid #fff' : '2px solid transparent',
                  opacity: selectedColor === c ? 1 : 0.6,
                  transform: selectedColor === c ? 'scale(1.2)' : 'scale(1)',
                  boxShadow: selectedColor === c ? '0 0 10px rgba(0,0,0,0.3)' : 'none'
                }}
              />
            ))}
          </div>
        </div>

        <motion.button
          onClick={() => name.trim() && onJoin(name.trim(), selectedColor)}
          className="w-full text-lg font-black text-black bg-white cursor-pointer tracking-wide flex items-center justify-center"
          style={{
            fontFamily: "var(--font-display)",
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            padding: '16px 0',
            borderRadius: '16px',
            gap: '8px'
          }}
          whileHover={{ scale: 1.02, backgroundColor: '#f0f0f0' }}
          whileTap={{ scale: 0.98 }}
        >
          <span>Start Driving</span>
        </motion.button>

        <p className="text-[10px] mt-8 font-bold tracking-[0.1em] text-white/30 uppercase">
          WASD to drive · SPACE to brake
        </p>
      </motion.div>
    </motion.div>
  );
}

// ── HUD ───────────────────────────────────────────────────────────
function HUD({ room, players, vehicles, isDriver, onEnterVehicle, catchLog, surfLeaderboard = [], radioPlaying, setRadioPlaying, targetNode, setTargetNode, stationIndex, setStationIndex, engineSound, setEngineSound, stations }: {
  room: Colyseus.Room;
  players: Record<string, PlayerState>;
  vehicles: Record<string, VehicleState>;
  isDriver: boolean;
  onEnterVehicle: () => void;
  catchLog: {playerName: string, fishName: string, weight: number, timestamp: number}[];
  surfLeaderboard?: {playerName: string, score: number, timestamp: number}[];
  radioPlaying: boolean;
  setRadioPlaying: (p: boolean) => void;
  targetNode: string | null;
  setTargetNode: (node: string | null) => void;
  stationIndex: number;
  setStationIndex: (idx: number) => void;
  engineSound: boolean;
  setEngineSound: (enabled: boolean) => void;
  stations: {name: string, url: string}[];
}) {
  const playerCount = Object.keys(players).length;
  const activeNode = players[room.sessionId]?.activeNode;
  const nodeInfo = activeNode ? NODES.find(n => n.id === activeNode) : null;

  const myPlayer = players[room.sessionId];
  const myVehicle = Object.values(vehicles).find(v => v.driverSessionId === room.sessionId);
  const currentSpeed = myVehicle ? Math.abs(myVehicle.speed) : 0;
  const markerX = isDriver && myVehicle ? myVehicle.x : (myPlayer?.x || 0);
  const markerZ = isDriver && myVehicle ? myVehicle.z : (myPlayer?.z || 0);

  // ── Ambient Audio Proximity ───────────────────────────────────────
  const oceanRef = useRef<{ stop: () => void } | null>(null);
  const cricketsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    const surfNode = NODES.find(n => n.id === 'surf-beach');
    const fishNode = NODES.find(n => n.id === 'fishing-dock');

    if (surfNode) {
      const dBeach = Math.sqrt((markerX - surfNode.position[0])**2 + (markerZ - surfNode.position[2])**2);
      if (dBeach < 150 && !oceanRef.current) {
        oceanRef.current = startOceanAudio();
      } else if (dBeach >= 150 && oceanRef.current) {
        oceanRef.current.stop();
        oceanRef.current = null;
      }
    }

    if (fishNode) {
      const dPond = Math.sqrt((markerX - fishNode.position[0])**2 + (markerZ - fishNode.position[2])**2);
      if (dPond < 80 && !cricketsRef.current) {
        cricketsRef.current = startCricketsAudio();
      } else if (dPond >= 80 && cricketsRef.current) {
        cricketsRef.current.stop();
        cricketsRef.current = null;
      }
    }
  }, [markerX, markerZ]);

  return (
    <motion.div
      className="absolute inset-0 pointer-events-none z-10 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
    >
      {/* Top-left status panel — premium dark glass */}
      <div className="absolute top-6 left-6 flex flex-col gap-3">
        <div className="coast-panel w-fit" style={{ padding: '20px 32px' }}>
          <div className="flex items-center gap-5">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{
              background: 'linear-gradient(135deg, rgba(126, 200, 184, 0.2) 0%, rgba(126, 200, 184, 0.08) 100%)',
              border: '1px solid rgba(126, 200, 184, 0.2)',
            }}>
              <span className="text-2xl" style={{ filter: 'drop-shadow(0 0 4px rgba(126, 200, 184, 0.5))' }}>🌊</span>
            </div>
            <div className="flex flex-col gap-1.5 pr-2">
              <h1 className="text-[17px] font-black leading-none tracking-tight whitespace-nowrap" style={{
                fontFamily: "var(--font-display)",
                background: 'linear-gradient(135deg, #ffffff 0%, #c8e6f0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                paddingRight: '6px' // extra safe margin for italic fonts
              }}>
                Coastline Drifters
              </h1>
              <p className="text-[10px] tracking-[0.2em] uppercase font-bold" style={{
                color: 'var(--coast-seafoam)',
                textShadow: '0 0 12px rgba(126, 200, 184, 0.4)',
              }}>
                {playerCount} {playerCount === 1 ? 'drifter' : 'drifters'} online
              </p>
            </div>
          </div>
        </div>

        {/* Catch Log Feed — postcard style */}
        {catchLog.length > 0 && (
          <div className="flex flex-col gap-2">
            <AnimatePresence>
              {catchLog.map((log) => (
                <motion.div
                  key={log.timestamp}
                  className="postcard px-4 py-2 text-xs w-max max-w-full"
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <span style={{ color: 'var(--coast-sunset-gold)' }} className="font-bold">{log.playerName}</span>
                  <span className="text-white/80"> caught a </span>
                  <span style={{ color: 'var(--coast-seafoam)' }} className="font-bold">{log.fishName}</span>
                  <span className="text-white/70 font-medium"> ({log.weight}lb)</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Surf Leaderboard Feed — postcard style */}
        {surfLeaderboard.length > 0 && (
          <div className="postcard px-5 py-4">
            <p className="text-xs font-black tracking-widest uppercase mb-2" style={{ color: 'var(--coast-sand)' }}>
              🏄 Top Surfers
            </p>
            <div className="space-y-2">
              <AnimatePresence>
                {surfLeaderboard.map((log, index) => (
                  <motion.div
                    key={log.timestamp}
                    className="flex justify-between w-48 text-sm"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                  >
                    <span className="text-white font-medium">
                      <span className="text-white/40 mr-2">#{index + 1}</span> {log.playerName}
                    </span>
                    <span style={{ color: 'var(--coast-sunset-gold)' }} className="font-bold">{log.score}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Player list & Radio panel */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-3">
        <div className="coast-panel w-fit min-w-[220px]" style={{ padding: '20px 32px' }}>
          <div className="flex items-center justify-end gap-3 mb-4 border-b border-white/10 pb-3 pr-2">
            <p className="text-[11px] font-black tracking-[0.15em] uppercase" style={{
              color: 'var(--coast-sand)',
              textShadow: '0 0 8px rgba(240, 228, 200, 0.4)'
            }}>
              Cruising
            </p>
            <span className="text-lg" style={{ filter: 'drop-shadow(0 0 4px rgba(240,228,200,0.6))' }}>🚐</span>
          </div>
          <div className="flex flex-col gap-3 pr-2">
            {Object.entries(players).map(([sid, p]) => (
              <div key={sid} className="flex items-center justify-end gap-3 whitespace-nowrap">
                <span className="text-white text-[13px] font-bold tracking-wide" style={{ fontFamily: "var(--font-display)", textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  {p.name} {sid === room.sessionId ? <span className="text-white/40 text-[10px] ml-1.5 font-bold">(YOU)</span> : ''}
                </span>
                <div
                  className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor]"
                  style={{ 
                    background: sid === room.sessionId ? 'var(--coast-warm-coral)' : 'var(--coast-seafoam)',
                    color: sid === room.sessionId ? 'var(--coast-warm-coral)' : 'var(--coast-seafoam)',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Radio Panel — premium styling */}
        <div className="coast-panel px-5 py-4 pointer-events-auto w-max min-w-[200px]">
          <div className="radio-panel">
            <div className="radio-info">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs" style={{ filter: 'drop-shadow(0 0 4px rgba(240,228,200,0.6))' }}>📻</span>
                <p className="text-[10px] font-black tracking-[0.15em] uppercase" style={{ color: 'var(--coast-sand)', textShadow: '0 0 8px rgba(240, 228, 200, 0.4)' }}>Van Radio</p>
              </div>
              <p className="text-[12px] font-bold whitespace-nowrap mt-0.5 text-contrast-light" style={{ fontFamily: 'var(--font-display)' }}>
                {radioPlaying ? stations[stationIndex].name : 'Off'}
              </p>
            </div>
            <div 
              className="radio-btn shadow-[0_4px_12px_rgba(0,0,0,0.3)] border border-white/20"
              style={{ background: radioPlaying ? 'var(--coast-warm-coral)' : 'rgba(255,255,255,0.1)' }}
              onClick={(e) => { e.currentTarget.blur(); setRadioPlaying(!radioPlaying); }}
            >
              <span className="text-white text-xs leading-none drop-shadow-md" style={{ marginLeft: radioPlaying ? 0 : '2px' }}>{radioPlaying ? '⏸' : '▶'}</span>
            </div>
          </div>
          
          {radioPlaying && (
            <div className="flex items-center justify-between mt-3.5 pt-3.5 border-t border-white/10">
              <button 
                onClick={(e) => { e.currentTarget.blur(); setStationIndex((stationIndex - 1 + stations.length) % stations.length); }}
                className="px-3.5 py-1.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded-md text-[9px] uppercase font-black tracking-[0.1em] text-white/80 hover:text-white transition-all hover:scale-105 active:scale-95"
              >
                Prev
              </button>
              <button 
                onClick={(e) => { e.currentTarget.blur(); setStationIndex((stationIndex + 1) % stations.length); }}
                className="px-3.5 py-1.5 bg-white/5 hover:bg-white/15 border border-white/10 rounded-md text-[9px] uppercase font-black tracking-[0.1em] text-white/80 hover:text-white transition-all hover:scale-105 active:scale-95"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Drive button — warm coral gradient */}
      {!isDriver && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 pointer-events-auto flex justify-center">
          <motion.button
            onClick={onEnterVehicle}
            className="rounded-full text-white font-black tracking-wide border border-white/20 inline-flex items-center justify-center gap-4 whitespace-nowrap w-fit"
            style={{
              padding: '20px 48px',
              background: 'linear-gradient(135deg, #eb7254 0%, #d35400 100%)',
              boxShadow: '0 12px 32px rgba(235,114,84,0.4), inset 0 2px 0 rgba(255,255,255,0.2)',
              fontFamily: "var(--font-display)",
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              fontSize: '16px'
            }}
            whileHover={{ scale: 1.05, boxShadow: '0 16px 40px rgba(235,114,84,0.6), inset 0 2px 0 rgba(255,255,255,0.3)' }}
            whileTap={{ scale: 0.95, boxShadow: '0 4px 12px rgba(235,114,84,0.3)' }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
          >
            <span className="text-xl drop-shadow-md">🚗</span> <span>Get in & Drive</span>
          </motion.button>
        </div>
      )}

      {/* Controls reminder — road sign style */}
      {isDriver && (
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center flex flex-col items-center gap-4 pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="road-sign px-5 py-2 shadow-md">
            <p className="text-contrast-light text-[10px] tracking-widest uppercase font-bold">
              WASD / Arrows · Space to brake
            </p>
          </div>
          <motion.button
            onClick={(e) => { e.currentTarget.blur(); room.send("exitVehicle", { vehicleId: `vehicle-${room.sessionId}` }); }}
            className="vehicle-btn"
            style={{ background: 'rgba(26, 74, 107, 0.7)' }}
            whileHover={{ scale: 1.05, backgroundColor: 'rgba(26, 74, 107, 0.9)' }}
            whileTap={{ scale: 0.95 }}
          >
            Leave Vehicle
          </motion.button>

          <div className="vehicle-controls-bar">
            <motion.button
              className="vehicle-btn"
              style={{ background: 'rgba(235, 114, 84, 0.75)' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => { e.currentTarget.blur(); playHornSound(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F' })); }}
            >
              <span className="btn-icon">📣</span> Honk
            </motion.button>
            <motion.button
              className="vehicle-btn"
              style={{ background: 'rgba(244, 169, 64, 0.75)' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => { e.currentTarget.blur(); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'H' })); }}
            >
              <span className="btn-icon">💡</span> Lights
            </motion.button>
            <motion.button
              className="vehicle-btn"
              style={{ background: engineSound ? 'rgba(46, 204, 113, 0.75)' : 'rgba(231, 76, 60, 0.75)' }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => { e.currentTarget.blur(); setEngineSound(!engineSound); }}
            >
              <span className="btn-icon">{engineSound ? '🔊' : '🔇'}</span> Engine {engineSound ? 'ON' : 'OFF'}
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Active Node Banner */}
      {nodeInfo && (
        <motion.div
          className="absolute top-32 left-1/2 -translate-x-1/2 node-banner pointer-events-auto cursor-pointer"
          initial={{ y: -20, opacity: 0, scale: 0.9 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -20, opacity: 0 }}
          whileHover={{ scale: 1.02 }}
        >
          <span className="node-icon">{NODE_ICONS[activeNode] || '📍'}</span>
          <span className="node-label">
            {nodeInfo.label}
          </span>
          {['fishing-dock', 'surf-beach', 'bonfire-circle', 'campsite', 'driftwood-village'].includes(activeNode) && (
            <div className="interact-badge">
              <span className="text-[11px] font-black uppercase tracking-[0.15em] text-white/60">Interact</span>
              <span className="key-hint">E</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Speedometer */}
      {isDriver && myVehicle && (
        <div className="absolute bottom-10 right-10 pointer-events-none flex flex-col items-end">
          <div className="w-32 h-32 rounded-full border-4 border-white/20 flex items-center justify-center relative overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)]" style={{ background: 'rgba(10, 30, 50, 0.6)', backdropFilter: 'blur(8px)' }}>
            <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(var(--coast-warm-coral) ${(currentSpeed / 100) * 270}deg, transparent 0)` }} />
            <div className="w-28 h-28 rounded-full bg-[#1a4a6b] flex flex-col items-center justify-center relative z-10 border-2 border-white/10 shadow-inner">
               <span className="text-4xl font-black text-white drop-shadow-md" style={{ fontFamily: 'var(--font-display)' }}>{Math.round(currentSpeed)}</span>
               <span className="text-[10px] text-white/70 uppercase tracking-widest font-bold mt-1">MPH</span>
            </div>
          </div>
        </div>
      )}

      {/* Minimap */}
      <div className="absolute bottom-10 left-10 pointer-events-auto">
        <div className="w-48 h-48 rounded-2xl overflow-hidden border-2 border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.4)] relative bg-[#0a1e32]/80 backdrop-blur-md p-2 flex flex-col transition-transform hover:scale-105">
          <div className="text-[10px] text-white/80 font-bold uppercase tracking-widest mb-1 text-center">Island Map</div>
          <div className="flex-1 relative border border-white/10 rounded-xl overflow-hidden bg-[#122e47]">
            <svg viewBox="-600 -600 1200 1200" className="w-full h-full">
              {/* Road */}
              <polyline 
                points={ROAD_WAYPOINTS.map(p => `${p[0]},${p[1]}`).join(' ')} 
                fill="none" 
                stroke="rgba(255,255,255,0.2)" 
                strokeWidth="15" 
                strokeLinejoin="round" 
              />
              <polyline 
                points={`${ROAD_WAYPOINTS[ROAD_WAYPOINTS.length-1][0]},${ROAD_WAYPOINTS[ROAD_WAYPOINTS.length-1][1]} ${ROAD_WAYPOINTS[0][0]},${ROAD_WAYPOINTS[0][1]}`} 
                fill="none" 
                stroke="rgba(255,255,255,0.2)" 
                strokeWidth="15" 
              />
              
              {/* Nodes */}
              {NODES.map(node => (
                <g key={node.id} onClick={() => setTargetNode(node.id)} className="cursor-pointer hover:opacity-100">
                  <circle 
                    cx={node.position[0]} 
                    cy={node.position[2]} 
                    r="35" 
                    fill={node.color} 
                    opacity={targetNode === node.id ? 1 : 0.6}
                  />
                  {targetNode === node.id && (
                     <circle cx={node.position[0]} cy={node.position[2]} r="55" fill="none" stroke="#fff" strokeWidth="12" className="animate-pulse" />
                  )}
                </g>
              ))}

              {/* Player / Vehicle marker */}
              <circle 
                cx={markerX} 
                cy={markerZ} 
                r="35" 
                fill="var(--coast-warm-coral)" 
                stroke="#fff" 
                strokeWidth="12" 
                className="drop-shadow-lg"
              />
            </svg>
            {targetNode && (
              <button 
                onClick={() => setTargetNode(null)}
                className="absolute top-1 right-1 bg-black/60 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center hover:bg-black transition-colors"
                title="Clear Waypoint"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Scene ─────────────────────────────────────────────────────────
function Scene({ room, vehicles, isDriver, nodes, isBusy, targetNode }: {
  room: Colyseus.Room;
  vehicles: Record<string, VehicleState>;
  isDriver: boolean;
  nodes: Record<string, { active: boolean, count: number }>;
  isBusy: boolean;
  targetNode: string | null;
}) {
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientLightRef = useRef<THREE.AmbientLight>(null);
  const skyRef = useRef<any>(null);
  
  const timeRef = useRef(Math.PI / 4); // Start at morning
  const [isNight, setIsNight] = useState(false);

  useFrame((state, delta) => {
    // Golden Hour locked lighting
    const elevation = 0.15; // low angle for long shadows
    const sunX = 80;
    const sunY = 15;
    
    // Update Directional Light (Sun)
    if (dirLightRef.current) {
      dirLightRef.current.position.set(sunX, sunY, 50);
      dirLightRef.current.intensity = 2.5;
      dirLightRef.current.color.lerp(new THREE.Color(0xffaa66), 0.1); // Warm orange/pink
    }
    
    // Update Ambient Light
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = 0.5;
      ambientLightRef.current.color.lerp(new THREE.Color(0xffddaa), 0.1); // Soft warm ambient
    }
    
    // Update Fog
    if (state.scene.fog instanceof THREE.Fog) {
      state.scene.fog.color.lerp(new THREE.Color(0xffcc88), 0.1); // Sunset fog
    }

    // Sky shader (Drei's Sky expects sunPosition vector to be mutated)
    if (skyRef.current?.material?.uniforms?.sunPosition) {
      skyRef.current.material.uniforms.sunPosition.value.set(sunX, sunY, 50);
    }

    // Always daytime (Golden Hour)
    if (isNight) {
      setIsNight(false);
    }
  });

  return (
    <>
      <ambientLight ref={ambientLightRef} intensity={0.4} color="#f4e4c8" />
      <directionalLight
        ref={dirLightRef}
        position={[80, 40, 60]}
        intensity={2.8}
        color="#ffcc88"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={400}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
      />

      {/* Atmospheric fog — fades to sky blue at distance */}
      <fog attach="fog" args={['#a8d8ea', 300, 700]} />

      <Sky
        ref={skyRef}
        sunPosition={[100, 15, 50]} // Initial fallback
        turbidity={4.5}
        rayleigh={1.2}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
      {/* We drop the preset environment to let the manual ambient/directional light drive the atmosphere fully */}

      <Physics>
        {/* Environment & Map */}
        <Ocean isNight={isNight} />
        <Island />
        <Road />
        <StreetLights isNight={isNight} />
        <Trees />
        <Boulders />
        <Bushes />
        <GroundDetails />
        <NodeMarkers />
        <FishingDock />
        <GasStation />
        <SurfBeach />
        <Lighthouse />
        <DriftwoodVillage />
        <Fences />
        <Seagrass />
        <WildflowerPatches />
        <DriftwoodScatter />
        <Clutter />
        <Bonfire active={nodes['bonfire-circle']?.active ?? false} />
        <Campsite playersSleeping={nodes['campsite']?.count ?? 0} />

        {/* Waypoint Marker Beam */}
        {targetNode && NODES.find(n => n.id === targetNode) && (
           <mesh position={[NODES.find(n => n.id === targetNode)!.position[0], 25, NODES.find(n => n.id === targetNode)!.position[2]]}>
             <cylinderGeometry args={[2, 2, 50, 16]} />
             <meshBasicMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
           </mesh>
        )}

        {/* Vehicles */}
        {Object.entries(vehicles).map(([vid, v]) => {
          const isLocalDriver = isDriver && v.driverSessionId === room.sessionId;
          if (isLocalDriver) {
            return <VehicleController key={vid} vehicleId={vid} room={room} isDriver isBusy={isBusy} isNight={isNight} color={v.color} />;
          }
          return <RemoteVehicle key={vid} state={v} />;
        })}
      </Physics>
    </>
  );
}

// ── Root ──────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase]       = useState<'lobby' | 'game'>('lobby');
  const [room, setRoom]         = useState<Colyseus.Room | null>(null);
  const [players, setPlayers]   = useState<Record<string, PlayerState>>({});
  const [vehicles, setVehicles] = useState<Record<string, VehicleState>>({});
  const [isFishing, setIsFishing] = useState(false);
  const [isSurfing, setIsSurfing] = useState(false);
  const [isScavenging, setIsScavenging] = useState(false);
  const [catchLog, setCatchLog] = useState<{playerName: string, fishName: string, weight: number, timestamp: number}[]>([]);
  const [surfLeaderboard, setSurfLeaderboard] = useState<{playerName: string, score: number, timestamp: number}[]>([]);
  const [nodes, setNodes] = useState<Record<string, { active: boolean, count: number }>>({});
  const roomRef = useRef<Colyseus.Room | null>(null);
  const [radioPlaying, setRadioPlaying] = useState(false);
  const activeAmbientAudio = useRef<{ stop: () => void } | null>(null);
  const radioAudioRef = useRef<HTMLAudioElement | null>(null);
  const [targetNode, setTargetNode] = useState<string | null>(null);
  
  const [stationIndex, setStationIndex] = useState(0);
  const [engineSound, setEngineSound] = useState(true);

  const RADIO_STATIONS = [
    { name: 'Bollywood Hits', url: 'https://stream.zeno.fm/60ef4p33vxquv' },
    { name: 'Bollywood Retro', url: 'https://stream.zeno.fm/f3wvbbqmdg8uv' },
    { name: 'Radio City Hindi', url: 'http://prclive1.listenon.in:9960/' },
  ];

  useEffect(() => {
    (window as any).ENGINE_SOUND_ENABLED = engineSound;
  }, [engineSound]);

  // ── Ambient Audio Trigger (Synthetic) ──────────────────────────
  useEffect(() => {
    if (!roomRef.current) return;
    const myPlayer = players[roomRef.current.sessionId];
    if (!myPlayer) return;

    if (activeAmbientAudio.current) {
      activeAmbientAudio.current.stop();
      activeAmbientAudio.current = null;
    }

    if (myPlayer.activeNode === 'surf-beach') {
      activeAmbientAudio.current = startOceanAudio();
    } else if (myPlayer.activeNode === 'bonfire-circle') {
      // Fire crackle when at bonfire (especially when lit)
      const isBonfireActive = nodes['bonfire-circle']?.active ?? false;
      if (isBonfireActive) {
        activeAmbientAudio.current = startFireCrackleAudio();
      } else {
        activeAmbientAudio.current = startCricketsAudio();
      }
    } else if (myPlayer.activeNode === 'campsite') {
      activeAmbientAudio.current = startCricketsAudio();
    }
    
    return () => {
      if (activeAmbientAudio.current) {
        activeAmbientAudio.current.stop();
        activeAmbientAudio.current = null;
      }
    };
  }, [players, nodes]);

  // ── Radio playback sync ─────────────────────────────────────────
  useEffect(() => {
    if (radioPlaying) {
      if (radioAudioRef.current) {
        radioAudioRef.current.pause();
        radioAudioRef.current.removeAttribute('src'); // clear previous
      }
      const audio = new Audio(RADIO_STATIONS[stationIndex].url);
      audio.loop = true;
      audio.volume = 0.2;
      radioAudioRef.current = audio;
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('Radio playback failed:', err);
          // Don't flip state so user can try again
        });
      }
    } else {
      if (radioAudioRef.current) {
        radioAudioRef.current.pause();
      }
    }
  }, [radioPlaying, stationIndex]);

  // ── Interact listener ───────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'e' || e.key === 'E') {
        if (!roomRef.current) return;
        const myPlayer = players[roomRef.current.sessionId];
        console.log("Interact pressed! Player active node is:", myPlayer?.activeNode);
        if (myPlayer) {
          if (myPlayer.activeNode === 'fishing-dock' && !isFishing) {
            setIsFishing(true);
          } else if (myPlayer.activeNode === 'surf-beach' && !isSurfing) {
            setIsSurfing(true);
          } else if (myPlayer.activeNode === 'driftwood-village' && !isScavenging) {
            setIsScavenging(true);
          } else if (myPlayer.activeNode === 'bonfire-circle') {
            const isActive = nodes['bonfire-circle']?.active ?? false;
            roomRef.current.send("toggleNode", { nodeId: 'bonfire-circle', active: !isActive });
          } else if (myPlayer.activeNode === 'campsite') {
            roomRef.current.send("updateNodeCount", { nodeId: 'campsite', delta: 1 });
            setTimeout(() => {
              roomRef.current?.send("updateNodeCount", { nodeId: 'campsite', delta: -1 });
            }, 3000);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [players, isFishing, isSurfing, isScavenging, nodes]);

  // ── Join handler ────────────────────────────────────────────────
  const handleJoin = useCallback(async (name: string, color: string) => {
    const client = new Colyseus.Client(COLYSEUS_URL);
    try {
      const joined = await client.joinOrCreate<any>("coastline", { name, color });
      roomRef.current = joined;
      setRoom(joined);

      // ── Players sync ──────────────────────────────────────────
      joined.state.players.onAdd((p: any, sid: string) => {
        setPlayers(prev => ({ ...prev, [sid]: { x: p.x, y: p.y, z: p.z, rotationY: p.rotationY, name: p.name, activeNode: p.activeNode, color: p.color } }));
        p.onChange((_changes: any) => {
          // Always read directly from the schema to avoid stale data
          setPlayers(prev => ({
            ...prev,
            [sid]: {
              x: p.x, y: p.y, z: p.z,
              rotationY: p.rotationY,
              name: p.name,
              activeNode: p.activeNode,
              color: p.color,
            }
          }));
        });
      });
      joined.state.players.onRemove((_p: any, sid: string) => {
        setPlayers(prev => { const n = { ...prev }; delete n[sid]; return n; });
      });

      // ── Vehicles sync ─────────────────────────────────────────
      joined.state.vehicles.onAdd((v: any, vid: string) => {
        setVehicles(prev => ({ ...prev, [vid]: { x: v.x, y: v.y, z: v.z, rotationY: v.rotationY, speed: v.speed, driverSessionId: v.driverSessionId, color: v.color } }));
        v.onChange((changes: any[]) => {
          setVehicles(prev => {
            const updated = { ...prev[vid] };
            if (changes && Array.isArray(changes)) {
              changes.forEach((c: any) => {
                (updated as any)[c.field] = c.value;
              });
            } else {
              updated.x = v.x; updated.y = v.y; updated.z = v.z; updated.rotationY = v.rotationY;
              updated.speed = v.speed; updated.driverSessionId = v.driverSessionId; updated.color = v.color;
            }
            return { ...prev, [vid]: updated };
          });
        });
      });

      // ── Catch Log sync ─────────────────────────────────────────
      joined.state.catchLog.onAdd((record: any) => {
        setCatchLog(prev => {
          const arr = [...prev, { playerName: record.playerName, fishName: record.fishName, weight: record.weight, timestamp: record.timestamp }];
          if (arr.length > 5) return arr.slice(arr.length - 5);
          return arr;
        });
      });

      // ── Surf Leaderboard sync ────────────────────────────────
      joined.state.surfLeaderboard.onAdd((record: any) => {
        setSurfLeaderboard(prev => {
          const arr = [...prev, { playerName: record.playerName, score: record.score, timestamp: record.timestamp }];
          return arr.sort((a, b) => b.score - a.score).slice(0, 5);
        });
      });

      joined.state.nodes.onAdd((n: any, nid: string) => {
        setNodes(prev => ({ ...prev, [nid]: { active: n.active, count: n.count } }));
        n.onChange((_changes: any) => {
          setNodes(prev => ({
            ...prev,
            [nid]: {
              active: n.active,
              count: n.count,
            }
          }));
        });
      });

      setPhase('game');
    } catch (e) {
      console.error("Failed to join room:", e);
      alert("Could not connect to the server. Make sure the server is running on :2567");
    }
  }, []);

  const handleEnterVehicle = useCallback(() => {
    if (roomRef.current) {
      roomRef.current.send("enterVehicle", { vehicleId: `vehicle-${roomRef.current.sessionId}` });
    }
  }, []);

  useEffect(() => {
    return () => { roomRef.current?.leave(); };
  }, []);

  const isDriver = room ? Object.values(vehicles).some(v => v.driverSessionId === room.sessionId) : false;

  return (
    <div className="w-full h-screen relative overflow-hidden" style={{ background: '#1a4a6b' }}>
      <AnimatePresence mode="wait">
        {phase === 'lobby' && <LobbyScreen key="lobby" onJoin={handleJoin} />}
      </AnimatePresence>

      {phase === 'game' && room && (
        <>
          <HUD 
            room={room} 
            players={players} 
            vehicles={vehicles}
            isDriver={isDriver} 
            onEnterVehicle={handleEnterVehicle} 
            catchLog={catchLog} 
            surfLeaderboard={surfLeaderboard}
            radioPlaying={radioPlaying}
            setRadioPlaying={setRadioPlaying}
            targetNode={targetNode}
            setTargetNode={setTargetNode}
            stationIndex={stationIndex}
            setStationIndex={setStationIndex}
            engineSound={engineSound}
            setEngineSound={setEngineSound}
            stations={RADIO_STATIONS}
          />

          {isFishing && (
            <FishingMinigame
              onCatch={(fishName, weight) => {
                room.send("catchFish", { fishName, weight });
              }}
              onClose={() => setIsFishing(false)}
            />
          )}

          {isSurfing && (
            <SurfingMinigame
              onPostScore={(score) => {
                room.send("postSurfScore", { score });
              }}
              onClose={() => setIsSurfing(false)}
            />
          )}

          {isScavenging && (
            <ScavengingMinigame
              onFind={(itemName, value) => {
                room.send("catchFish", { fishName: itemName, weight: value });
              }}
              onClose={() => setIsScavenging(false)}
            />
          )}

          <Canvas
            shadows
            camera={{ position: [5, 8, 18], fov: 65 }}
            style={{ position: 'absolute', inset: 0 }}
          >
            <Suspense fallback={null}>
              <Scene room={room} vehicles={vehicles} isDriver={isDriver} nodes={nodes} isBusy={isFishing || isSurfing || isScavenging} targetNode={targetNode} />
            </Suspense>
          </Canvas>
        </>
      )}
    </div>
  );
}
