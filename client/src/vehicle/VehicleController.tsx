import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RigidBody, RapierRigidBody, useRapier } from '@react-three/rapier';
import { Html } from '@react-three/drei';
import type * as Colyseus from 'colyseus.js';
import { NODES, TREE_POSITIONS, BOULDER_POSITIONS, FENCE_POSITIONS, getTerrainHeight, ROAD_WAYPOINTS, roadDistSq, STREET_LIGHT_POSITIONS } from '../world/constants';
import { CircleGrid } from '../world/spatial';

interface VehicleControllerProps {
  vehicleId: string;
  room: Colyseus.Room;
  isDriver: boolean;
  isBusy?: boolean;
  isNight?: boolean;
  color?: string;
  playerName?: string;
}

// ── Keyboard state hook ──────────────────────────────────────────
function useKeys(isBusy: boolean) {
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isBusy) return;
      if (e.key === 'w' || e.key === 'ArrowUp')    keys.current.forward  = true;
      if (e.key === 's' || e.key === 'ArrowDown')  keys.current.backward = true;
      if (e.key === 'a' || e.key === 'ArrowLeft')  keys.current.left     = true;
      if (e.key === 'd' || e.key === 'ArrowRight') keys.current.right    = true;
      if (e.key === ' ')                            keys.current.brake    = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'ArrowUp')    keys.current.forward  = false;
      if (e.key === 's' || e.key === 'ArrowDown')  keys.current.backward = false;
      if (e.key === 'a' || e.key === 'ArrowLeft')  keys.current.left     = false;
      if (e.key === 'd' || e.key === 'ArrowRight') keys.current.right    = false;
      if (e.key === ' ')                            keys.current.brake    = false;
    };
    if (isBusy) {
      keys.current.forward = false;
      keys.current.backward = false;
      keys.current.left = false;
      keys.current.right = false;
      keys.current.brake = false;
    }
    
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [isBusy]);

  return keys;
}

// ── Constants ─────────────────────────────────────────────────────
const MAX_SPEED      = 28;  // m/s
const ACCELERATION   = 18;
const BRAKE_FORCE    = 40;
const COAST_DRAG     = 10; // speed lost per second when coasting
const TURN_SPEED     = 2.2;  // radians/s at full speed


// ── Collision obstacles ───────────────────────────────────────────
// Each obstacle: { center: [x, z], radius: number }
// We treat trees, buildings, and hills as circles for simple collision
const OBSTACLES: { cx: number; cz: number; r: number }[] = [
  // Fishing pond (water surface) and wooden dock
  { cx: 180, cz: 130, r: 22 },
  { cx: 180, cz: 146, r: 3 }, // Dock end
  { cx: 180, cz: 151, r: 3 }, // Dock middle
  { cx: 180, cz: 156, r: 3 }, // Dock start (shore)
  // Bonfire Circle
  { cx: -100, cz: 200, r: 2 },
  // Campsite Tents
  { cx: -220, cz: 80, r: 2 },
  // Lighthouse keeper's cottage
  { cx: 390, cz: 385, r: 2 },
  // Driftwood Village cottages
  { cx: 290, cz: -205, r: 6 },
  { cx: 308, cz: -208, r: 6 },
  { cx: 295, cz: -190, r: 5 },
  { cx: 312, cz: -192, r: 5 },
  // Eastern cliff formations
  { cx: 440, cz: -200, r: 25 },
  { cx: 455, cz: -80, r: 25 },
  { cx: 470, cz: 40, r: 25 },
  { cx: 485, cz: 160, r: 25 },
  { cx: 500, cz: 280, r: 25 },
  // Western hillside barriers
  { cx: -430, cz: -100, r: 60 },
  { cx: -450, cz: 30, r: 75 },
  { cx: -470, cz: 160, r: 75 },
  { cx: -490, cz: 290, r: 90 },
  // Trees
  ...TREE_POSITIONS.map(t => ({ cx: t.pos[0], cz: t.pos[2], r: 0.5 * t.s })),
  // Boulders
  ...BOULDER_POSITIONS.map(b => ({ cx: b.pos[0], cz: b.pos[2], r: 0.8 * b.s })),
  // Street Lights
  ...STREET_LIGHT_POSITIONS.map(l => ({ cx: l.pos[0], cz: l.pos[2], r: 0.5 })),
  // Gas station
  { cx: 20, cz: -20, r: 4 },
  // Fences
  ...(() => {
    const obs: { cx: number; cz: number; r: number }[] = [];
    for (const f of FENCE_POSITIONS) {
      for (let s = 0; s < f.segments; s++) {
        const lx = s * 3;
        const gx = f.start[0] + Math.cos(f.angle) * lx;
        const gz = f.start[2] - Math.sin(f.angle) * lx;
        obs.push({ cx: gx, cz: gz, r: 0.2 });
      }
    }
    return obs;
  })(),
  // Street lights
  ...(() => {
    const points = ROAD_WAYPOINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const curve = new THREE.CatmullRomCurve3(points, false);
    const numLights = 70;
    const samples = curve.getSpacedPoints(numLights);
    const obs: { cx: number; cz: number; r: number }[] = [];
    for (let i = 0; i < samples.length; i++) {
       const p = samples[i];
       const t = curve.getTangent(i / numLights);
       const perp = new THREE.Vector3(-t.z, 0, t.x).normalize();
       const side = i % 2 === 0 ? 1 : -1;
       const x = p.x + perp.x * 12 * side;
       const z = p.z + perp.z * 12 * side;
       obs.push({ cx: x, cz: z, r: 0.3 });
    }
    return obs;
  })()
];

// DSA: spatial hash over the ~3200 obstacles. Each frame we only test the handful
// stored in the car's cell instead of every obstacle (O(n) -> O(1) average).
const CAR_RADIUS = 0.8;
const OBSTACLE_GRID = new CircleGrid(OBSTACLES, 32, CAR_RADIUS);

// Scratch objects reused every frame (no per-frame garbage => no GC stutter)
const _fwd = { x: 0, z: 0 };
const _vA = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camOrigin = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _camFinal = new THREE.Vector3();
const _look = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _quat = new THREE.Quaternion();
const _rayDir = new THREE.Vector3(0, -1, 0);


// ── Audio helpers ─────────────────────────────────────────────────
const playHorn = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(380, ctx.currentTime + 0.3);
  
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.setTargetAtTime(0, ctx.currentTime + 0.2, 0.1);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
};

function useEngineAudio(velRef: React.MutableRefObject<number>, isDriver: boolean, keys: React.MutableRefObject<any>) {
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!isDriver) return;
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;

    const gain = ctx.createGain();
    gain.gain.value = 0.0;

    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start();
    
    oscRef.current = osc;
    gainRef.current = gain;

    const resumeAudio = () => {
      if (ctx.state === 'suspended') ctx.resume();
    };
    window.addEventListener('keydown', resumeAudio);
    
    return () => {
      window.removeEventListener('keydown', resumeAudio);
      osc.stop();
      ctx.close();
    };
  }, [isDriver]);

  useFrame(() => {
    if (!isDriver || !oscRef.current || !gainRef.current || !ctxRef.current) return;
    
    const speed = Math.abs(velRef.current);
    const speedRatio = Math.min(speed / MAX_SPEED, 1);
    const isAccelerating = keys.current.forward || keys.current.backward;
    
    // Retro arcade engine tuning
    const baseFreq = 40;
    const targetFreq = baseFreq + speedRatio * 180 + (isAccelerating ? 30 : 0);
    
    // Check if user disabled engine sound
    const isEngineSoundEnabled = (window as any).ENGINE_SOUND_ENABLED !== false;
    const targetVol = isEngineSoundEnabled ? (0.03 + speedRatio * 0.08 + (isAccelerating ? 0.04 : 0)) : 0;
    
    oscRef.current.frequency.setTargetAtTime(targetFreq, ctxRef.current.currentTime, 0.1);
    gainRef.current.gain.setTargetAtTime(targetVol, ctxRef.current.currentTime, 0.1);
  });
}

// ── Vehicle body ──────────────────────────────────────────────────
function VehicleBody({ hasHeadlights = false, activeNode = "", color = "#e8a020" }) {
  const target1 = useMemo(() => { const t = new THREE.Object3D(); t.position.set(-0.8, 0, -20); return t; }, []);
  const target2 = useMemo(() => { const t = new THREE.Object3D(); t.position.set(0.8, 0, -20); return t; }, []);

  return (
    <group>
      {/* Main body — lowered for better ground contact feel */}
      <mesh castShadow receiveShadow position={[0, 0.40, 0]}>
        <boxGeometry args={[2.2, 0.9, 4.2]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} flatShading />
      </mesh>
      {/* Cab */}
      <mesh castShadow position={[0, 1.10, -0.3]}>
        <boxGeometry args={[1.8, 0.75, 2.2]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} flatShading />
      </mesh>
      {/* Windshield — dark glass */}
      <mesh position={[0, 1.10, -1.42]}>
        <boxGeometry args={[1.6, 0.55, 0.05]} />
        <meshStandardMaterial color="#1a2a3a" roughness={0.1} metalness={0.6} />
      </mesh>
      {/* Rear window */}
      <mesh position={[0, 1.10, 0.78]}>
        <boxGeometry args={[1.6, 0.5, 0.05]} />
        <meshStandardMaterial color="#1a2a3a" roughness={0.1} metalness={0.6} />
      </mesh>
      {/* Bumper front */}
      <mesh castShadow position={[0, 0.05, -2.15]}>
        <boxGeometry args={[2.3, 0.3, 0.15]} />
        <meshStandardMaterial color="#333" roughness={0.8} metalness={0.4} />
      </mesh>
      {/* Bumper rear */}
      <mesh castShadow position={[0, 0.05, 2.15]}>
        <boxGeometry args={[2.3, 0.3, 0.15]} />
        <meshStandardMaterial color="#333" roughness={0.8} metalness={0.4} />
      </mesh>
      {/* Roof rack */}
      <mesh castShadow position={[0, 1.52, -0.3]}>
        <boxGeometry args={[1.6, 0.08, 2.0]} />
        <meshStandardMaterial color="#444" roughness={0.9} />
      </mesh>
      {/* Luggage on roof */}
      <mesh castShadow position={[0, 1.65, -0.5]}>
        <boxGeometry args={[1.2, 0.25, 1.2]} />
        <meshStandardMaterial color="#8b4513" roughness={1} flatShading />
      </mesh>
      {/* Contact shadow under vehicle */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]}>
        <planeGeometry args={[3.0, 5.0]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} depthWrite={false} />
      </mesh>
      {/* Wheels — visible hub caps for realism */}
      {([ [-1.0, -0.02, 1.4], [1.0, -0.02, 1.4], [-1.0, -0.02, -1.4], [1.0, -0.02, -1.4] ] as [number,number,number][]).map((pos, i) => (
        <group key={i} position={pos}>
          {/* Tire */}
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.38, 0.38, 0.32, 12]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
          </mesh>
          {/* Hub cap */}
          <mesh position={[i % 2 === 0 ? -0.17 : 0.17, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.18, 0.18, 0.02, 8]} />
            <meshStandardMaterial color="#888" roughness={0.3} metalness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Headlights */}
      {hasHeadlights && (
        <group>
          <primitive object={target1} />
          <primitive object={target2} />
          <spotLight position={[-0.8, 0.8, -2.0]} target={target1} angle={0.7} penumbra={0.4} intensity={250} color="#ffffee" distance={200} />
          <spotLight position={[0.8, 0.8, -2.0]} target={target2} angle={0.7} penumbra={0.4} intensity={250} color="#ffffee" distance={200} />
        </group>
      )}

      {/* Dynamic Prop: Fishing rod */}
      {activeNode === "fishing-dock" && (
        <group position={[0.8, 1.8, -1.0]} rotation={[-0.4, 0.2, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.02, 0.04, 3, 4]} />
            <meshStandardMaterial color="#222" roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.8, 0.1]} rotation={[0, 0, Math.PI/2]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, 0.1]} />
            <meshStandardMaterial color="#888" metalness={0.8} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ── Main vehicle controller ───────────────────────────────────────
export function VehicleController({ vehicleId, room, isDriver, isBusy = false, isNight = false, color = "#e8a020", playerName }: VehicleControllerProps) {
  const rbRef  = useRef<RapierRigidBody>(null);
  const visualRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [headlights, setHeadlights] = useState(isNight);

  const keys    = useKeys(isBusy);
  const vel     = useRef(0);          // scalar speed along forward axis
  const velY    = useRef(0);          // vertical velocity for gravity
  const initialV = room.state.vehicles.get(vehicleId);
  const yaw     = useRef(initialV?.rotationY ?? 0);          // current yaw in radians
  const pitch   = useRef(0);          // current pitch in radians
  const pos     = useRef(new THREE.Vector3(initialV?.x ?? 5, initialV?.y ?? 0.5, initialV?.z ?? 5));
  const syncThrottle = useRef(0);
  const currentActiveNode = useRef<string>("");
  const { rapier, world } = useRapier();

  // Dust particles state
  const PARTICLE_COUNT = 40;
  const dustRef = useRef<THREE.InstancedMesh>(null);
  const dustData = useRef<{pos: THREE.Vector3, vel: THREE.Vector3, life: number}[]>(
    Array.from({length: PARTICLE_COUNT}, () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), life: 0 }))
  );
  const dustIndex = useRef(0);
  const camRayFrame = useRef(0);
  const camSafeDist = useRef(Infinity);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!isDriver) return;
    const handleExtKeys = (e: KeyboardEvent) => {
      if (isBusy) return;
      if (e.key === 'h' || e.key === 'H') setHeadlights(h => !h);
      if (e.key === 'f' || e.key === 'F') playHorn();
    };
    window.addEventListener('keydown', handleExtKeys);
    return () => window.removeEventListener('keydown', handleExtKeys);
  }, [isDriver, isBusy]);

  useEffect(() => {
    if (isDriver) setHeadlights(isNight);
  }, [isNight, isDriver]);

  useEngineAudio(vel, isDriver, keys);

  useFrame((_state, delta) => {
    if (!isDriver) return;

    const k = keys.current;
    const dt = Math.min(delta, 0.05);

    // ── Acceleration / braking ──────────────────────────────────
    if (k.forward)  vel.current = Math.min(vel.current + ACCELERATION * dt, MAX_SPEED);
    if (k.backward) vel.current = Math.max(vel.current - ACCELERATION * dt, -MAX_SPEED * 0.5);
    
    if (k.brake) {
      const b = BRAKE_FORCE * dt;
      if (vel.current > 0) vel.current = Math.max(0, vel.current - b);
      else vel.current = Math.min(0, vel.current + b);
    } else if (!k.forward && !k.backward) {
      // Natural friction / coasting
      const d = COAST_DRAG * dt;
      if (vel.current > 0) vel.current = Math.max(0, vel.current - d);
      else vel.current = Math.min(0, vel.current + d);
    }

    if (Math.abs(vel.current) < 0.02) vel.current = 0;

    // ── Steering ────────────────────────────────────────────────
    if (Math.abs(vel.current) > 0.3) {
      const turnAmount = TURN_SPEED * dt * Math.sign(vel.current);
      if (k.left)  yaw.current += turnAmount;
      if (k.right) yaw.current -= turnAmount;
    }

    // ── Move position ───────────────────────────────────────────
    const forward = _fwd;
    forward.x = -Math.sin(yaw.current);
    forward.z = -Math.cos(yaw.current);
    const newX = pos.current.x + forward.x * vel.current * dt;
    const newZ = pos.current.z + forward.z * vel.current * dt;

    // ── Collision detection ─────────────────────────────────────
    let blocked = false;

    const nearby = OBSTACLE_GRID.query(newX, newZ);
    for (let oi = 0; oi < nearby.length; oi++) {
      const obs = OBSTACLES[nearby[oi]];
      const dx = newX - obs.cx;
      const dz = newZ - obs.cz;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const minDist = obs.r + CAR_RADIUS;

      if (dist < minDist) {
        // Check if we are flying over the obstacle
        const isFlyingOver = pos.current.y > 3.0; // Assume obstacles are around 3 units tall
        if (!isFlyingOver) {
          // Push the car back out of the obstacle
          let pushDir = new THREE.Vector2(dx, dz);
          if (pushDir.lengthSq() === 0) {
            pushDir = new THREE.Vector2(1, 0); // fallback if perfectly centered
          } else {
            pushDir.normalize();
          }
          pos.current.x = obs.cx + pushDir.x * minDist;
          pos.current.z = obs.cz + pushDir.y * minDist;
          vel.current *= -0.3; // bounce back a little
          blocked = true;
          break;
        }
      }
    }

    // Vehicle-to-vehicle collision
    if (!blocked) {
      for (const [id, remoteV] of room.state.vehicles.entries()) {
        if (id === vehicleId) continue;
        const dx = newX - remoteV.x;
        const dz = newZ - remoteV.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < CAR_RADIUS * 2.5) {
          let pushDir = new THREE.Vector2(dx, dz);
          if (pushDir.lengthSq() === 0) pushDir = new THREE.Vector2(1, 0);
          else pushDir.normalize();
          
          pos.current.x = remoteV.x + pushDir.x * CAR_RADIUS * 2.5;
          pos.current.z = remoteV.z + pushDir.y * CAR_RADIUS * 2.5;
          vel.current *= -0.5; // bounce back
          blocked = true;
          break;
        }
      }
    }

    if (!blocked) {
      pos.current.x = newX;
      pos.current.z = newZ;
    }

    // ── Island boundary clamping (circular, matching actual island shape) ──
    // The island terrain is ~460 units radius. We restrict driving to ~420 units.
    const ISLAND_RADIUS_SOFT = 560;   // start slowing down
    const ISLAND_RADIUS_HARD = 600;   // absolute stop
    const distFromCenter = Math.sqrt(pos.current.x * pos.current.x + pos.current.z * pos.current.z);
    
    if (distFromCenter > ISLAND_RADIUS_SOFT) {
      // Gradual slowdown in the beach/edge zone
      const overFactor = (distFromCenter - ISLAND_RADIUS_SOFT) / (ISLAND_RADIUS_HARD - ISLAND_RADIUS_SOFT);
      const clampedFactor = Math.min(overFactor, 1);
      
      // Reduce speed progressively
      vel.current *= (1 - clampedFactor * 0.15);
      
      if (distFromCenter > ISLAND_RADIUS_HARD) {
        // Hard stop: push the vehicle back toward center
        const pushAngle = Math.atan2(pos.current.z, pos.current.x);
        pos.current.x = Math.cos(pushAngle) * ISLAND_RADIUS_HARD;
        pos.current.z = Math.sin(pushAngle) * ISLAND_RADIUS_HARD;
        vel.current *= -0.3; // bounce back
      }
    }

    const getFloorY = (tx: number, tz: number, carY: number) => {
      const baseTerrainY = getTerrainHeight(tx, tz);
      // Clamp floor to water level so van doesn't go underwater at beach edges
      let floor = Math.max(baseTerrainY, -0.3);
      
      // Account for road surface offset — the road mesh sits 0.1 above terrain
      if (roadDistSq(tx, tz) < 49) { // within ~7 units of road centre
        floor += 0.1;
      }
      _vA.set(tx, Math.max(carY + 2, baseTerrainY + 2), tz);
      const rayOrigin = _vA;
      const ray = new rapier.Ray(rayOrigin, _rayDir);
      const hit = world.castRay(ray, 10, true);
      
      const hitRbHandle = hit?.collider?.parent()?.handle;
      const myRbHandle = rbRef.current?.handle;
      
      if (hit && hit.collider && hitRbHandle !== undefined && hitRbHandle !== myRbHandle) {
        const hitY = rayOrigin.y - (hit as any).toi;
        if (hitY > floor) floor = hitY;
      }
      return floor;
    };

    const AXLE_OFFSET = 1.2;
    const sinYaw = Math.sin(yaw.current);
    const cosYaw = Math.cos(yaw.current);

    const frontY = getFloorY(newX - sinYaw * AXLE_OFFSET, newZ - cosYaw * AXLE_OFFSET, pos.current.y);
    const rearY = getFloorY(newX + sinYaw * AXLE_OFFSET, newZ + cosYaw * AXLE_OFFSET, pos.current.y);
    
    const floorY = (frontY + rearY) / 2;
    const targetPitch = Math.atan2(rearY - frontY, AXLE_OFFSET * 2);

    // Apply gravity — stronger for snappy ground contact
    velY.current -= 25 * dt;
    pos.current.y += velY.current * dt;

    let isGrounded = false;

    // Ground collision: wheel bottom offset 0.38
    if (pos.current.y - 0.38 <= floorY) {
      pos.current.y = floorY + 0.38;
      velY.current = 0;
      isGrounded = true;
    }

    // ── Dust Particles ──────────────────────────────────────────
    if (isDriver) {
      const minRoadDistSq = roadDistSq(newX, newZ);
      
      const isOffRoad = minRoadDistSq > 40; // Approx 6.3 units away from center
      
      if (isOffRoad && isGrounded && Math.abs(vel.current) > 8) {
        // Spawn 2 particles per frame when driving fast off-road
        for(let k=0; k<2; k++) {
          const p = dustData.current[dustIndex.current];
          p.life = 1.0 + Math.random() * 0.5;
          // Spawn near the back wheels
          p.pos.set(newX - forward.x * 2 + (Math.random()-0.5)*2, floorY + 0.2, newZ - forward.z * 2 + (Math.random()-0.5)*2);
          p.vel.set((Math.random()-0.5)*2 - forward.x * 0.5, Math.random()*2 + 0.5, (Math.random()-0.5)*2 - forward.z * 0.5);
          dustIndex.current = (dustIndex.current + 1) % PARTICLE_COUNT;
        }
      }

      if (dustRef.current) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const p = dustData.current[i];
          if (p.life > 0) {
            p.life -= dt * 1.2;
            p.pos.addScaledVector(p.vel, dt);
            dummy.position.copy(p.pos);
            const scale = p.life * 1.2;
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            dustRef.current.setMatrixAt(i, dummy.matrix);
          } else {
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            dustRef.current.setMatrixAt(i, dummy.matrix);
          }
        }
        dustRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // Smoothly interpolate pitch — faster for responsive terrain tracking
    if (isGrounded) {
      pitch.current = THREE.MathUtils.lerp(pitch.current, targetPitch, 25 * dt);
    } else {
      pitch.current = THREE.MathUtils.lerp(pitch.current, 0, 4 * dt); // level out mid-air
    }

    // ── Nuclear NaN Fail-Safes ──────────────────────────────────
    if (!Number.isFinite(pos.current.x) || !Number.isFinite(pos.current.y) || !Number.isFinite(pos.current.z)) {
      pos.current.set(5, 5, 5);
      vel.current = 0;
      velY.current = 0;
    }
    if (!Number.isFinite(pitch.current)) pitch.current = 0;
    if (!Number.isFinite(yaw.current)) yaw.current = 0;
    if (!Number.isFinite(vel.current)) vel.current = 0;
    if (!Number.isFinite(velY.current)) velY.current = 0;

    // ── Apply to physics body ───────────────────────────────────
    if (rbRef.current) {
      rbRef.current.setNextKinematicTranslation(pos.current);
      _euler.set(pitch.current, yaw.current, 0, 'YXZ');
      rbRef.current.setNextKinematicRotation(_quat.setFromEuler(_euler));
    }
    
    // ── Apply to visual mesh (144Hz smooth) ─────────────────────
    if (visualRef.current) {
      visualRef.current.position.copy(pos.current);
      visualRef.current.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
    }

    // ── Third-person camera follow (scratch vectors: zero allocations) ──
    const offX = Math.sin(yaw.current) * 12;
    const offZ = Math.cos(yaw.current) * 12;
    _camTarget.set(pos.current.x + offX, pos.current.y + 6, pos.current.z + offZ);

    // Camera collision (spring arm)
    _camOrigin.set(pos.current.x, pos.current.y + 1.5, pos.current.z);
    _camDir.set(offX, 6, offZ);
    const maxCamDist = _camDir.length();
    _camDir.divideScalar(maxCamDist || 1);

    // Throttle the expensive WASM raycast to every 2nd frame; reuse the last answer between.
    camRayFrame.current = (camRayFrame.current + 1) % 2;
    if (camRayFrame.current === 0) {
      const camHit = world.castRay(new rapier.Ray(_camOrigin, _camDir), maxCamDist, true);
      const h = camHit?.collider?.parent()?.handle;
      if (camHit && camHit.collider && h !== undefined && h !== rbRef.current?.handle) {
        // Obstacle detected between car and camera! Zoom in.
        const toi = typeof (camHit as any).toi === 'number' ? (camHit as any).toi : maxCamDist;
        camSafeDist.current = Math.max(3, toi - 0.5);
      } else {
        camSafeDist.current = maxCamDist;
      }
    }
    if (camSafeDist.current < maxCamDist) {
      _camFinal.copy(_camDir).multiplyScalar(camSafeDist.current).add(_camOrigin);
    } else {
      _camFinal.copy(_camTarget);
    }
    if (!Number.isFinite(_camFinal.x) || !Number.isFinite(_camFinal.y) || !Number.isFinite(_camFinal.z)) {
      _camFinal.copy(_camTarget);
    }
    if (!Number.isFinite(_camFinal.x)) {
      _camFinal.set(0, 10, 0); // Absolute fallback
    }

    if (!Number.isFinite(camera.position.x) || !Number.isFinite(camera.position.y) || !Number.isFinite(camera.position.z)) {
      camera.position.copy(_camFinal); // Recover from NaN poisoning!
    } else {
      camera.position.lerp(_camFinal, 8 * dt);
    }

    _look.set(pos.current.x, pos.current.y + 1, pos.current.z);
    if (Number.isFinite(_look.x) && Number.isFinite(_look.y) && Number.isFinite(_look.z)) {
      camera.lookAt(_look);
    }

    // ── Prevent Camera from going under terrain ─────────────────
    const terrainYAtCamera = getTerrainHeight(camera.position.x, camera.position.z);
    if (camera.position.y < terrainYAtCamera + 0.5) {
      camera.position.y = terrainYAtCamera + 0.5;
    }

    // ── Throttled network sync (20 Hz) ──────────────────────────
    syncThrottle.current += dt;
    if (syncThrottle.current >= 0.05) {
      syncThrottle.current = 0;
      room.send("updateVehicle", {
        id: vehicleId,
        x: pos.current.x,
        y: pos.current.y,
        z: pos.current.z,
        rotationY: yaw.current,
        speed: vel.current,
      });
      
      // ── Node trigger check ──────────────────────────────────────
      let foundNode = "";
      for (const node of NODES) {
        const dx = pos.current.x - node.position[0];
        const dz = pos.current.z - node.position[2];
        if (dx * dx + dz * dz <= node.radius * node.radius) {
          foundNode = node.id;
          break;
        }
      }

      if (foundNode !== currentActiveNode.current) {
        if (currentActiveNode.current !== "") {
          room.send("exitNode", { nodeId: currentActiveNode.current });
        }
        if (foundNode !== "") {
          room.send("enterNode", { nodeId: foundNode });
        }
        currentActiveNode.current = foundNode;
      }
    }
  });

  return (
    <>
      <RigidBody ref={rbRef} type="kinematicPosition" colliders="cuboid" position={[pos.current.x, pos.current.y, pos.current.z]}>
        <mesh visible={false}><boxGeometry args={[1.5, 1, 3]}/></mesh>
      </RigidBody>
      
      <group ref={visualRef} position={[pos.current.x, pos.current.y, pos.current.z]}>
        <VehicleBody hasHeadlights={headlights} activeNode={currentActiveNode.current} color={color} />
        {playerName && (
          <Html position={[0, 2.5, 0]} center sprite zIndexRange={[100, 0]}>
            <div className="px-2 py-1 bg-black/60 text-white text-xs rounded-md whitespace-nowrap font-bold border border-white/20 backdrop-blur-sm pointer-events-none">
              {playerName}
            </div>
          </Html>
        )}
      </group>

      {/* Dust Particle System */}
      {isDriver && (
        <instancedMesh ref={dustRef} args={[undefined as any, undefined as any, PARTICLE_COUNT]} castShadow>
          <dodecahedronGeometry args={[0.5, 0]} />
          <meshStandardMaterial color="#c4b59d" roughness={1} transparent opacity={0.6} flatShading />
        </instancedMesh>
      )}
    </>
  );
}

// ── Remote vehicle (non-driving client) ──────────────────────────
interface RemoteVehicleState {
  x: number; y: number; z: number;
  rotationY: number; speed: number; color?: string;
}

export function RemoteVehicle({ state, playerName }: { state: RemoteVehicleState, playerName?: string }) {
  const rbRef = useRef<RapierRigidBody>(null);
  const visualRef = useRef<THREE.Group>(null);
  const current = useRef({ ...state });

  useFrame((_s, delta) => {
    const t = Math.min(1, 10 * delta); // lerp factor
    current.current.x = THREE.MathUtils.lerp(current.current.x, state.x, t);
    current.current.y = THREE.MathUtils.lerp(current.current.y, state.y, t);
    current.current.z = THREE.MathUtils.lerp(current.current.z, state.z, t);
    current.current.rotationY = THREE.MathUtils.lerp(current.current.rotationY, state.rotationY, t);

    if (rbRef.current) {
      rbRef.current.setNextKinematicTranslation(current.current);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, current.current.rotationY, 0));
      rbRef.current.setNextKinematicRotation(q);
    }
    
    if (visualRef.current) {
      visualRef.current.position.copy(current.current as any);
      visualRef.current.rotation.set(0, current.current.rotationY, 0, 'YXZ');
    }
  });

  return (
    <>
      <RigidBody ref={rbRef} type="kinematicPosition" colliders="cuboid" position={[state.x, state.y, state.z]}>
        <mesh visible={false}><boxGeometry args={[1.5, 1, 3]}/></mesh>
      </RigidBody>
      
      <group ref={visualRef} position={[state.x, state.y, state.z]}>
        <VehicleBody color={state.color} />
        {playerName && (
          <Html position={[0, 2.5, 0]} center sprite zIndexRange={[100, 0]}>
            <div className="px-2 py-1 bg-black/60 text-white text-xs rounded-md whitespace-nowrap font-bold border border-white/20 backdrop-blur-sm pointer-events-none">
              {playerName}
            </div>
          </Html>
        )}
      </group>
    </>
  );
}
