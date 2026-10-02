import * as THREE from 'three';

export interface NodeDef {
  id: string;
  label: string;
  position: [number, number, number];
  radius: number;   // trigger zone radius
  color: string;    // greybox colour
  hideMarker?: boolean;
}

export const NODES: NodeDef[] = [
  { id: "rest-stop",         label: "Coastal Gas & Goods",  position: [  20, 0,  -20], radius: 10, color: "#f5a623" },
  { id: "fishing-dock",      label: "Hidden Cove Pond",     position: [ 180, 0,  150], radius: 6,  color: "#4a90d9" },
  { id: "surf-beach",        label: "Sunset Dunes",         position: [ -80, 0, -380], radius: 15, color: "#7ed321" },
  { id: "campsite",          label: "Pine Grove Camp",      position: [-220, 0,   80], radius: 15, color: "#bd10e0" },
  { id: "bonfire-circle",    label: "Bonfire Circle",       position: [-100, 0,  200], radius: 20, color: "#d0021b" },
  { id: "lighthouse",        label: "Beacon Point",         position: [ 400, 0,  380], radius: 15, color: "#f8e71c" },
  { id: "driftwood-village", label: "Driftwood Cove",       position: [ 300, 0, -200], radius: 20, color: "#e8a882" },
];

// ── Terrain Height Calculation ────────────────────────────────────
export function simpleNoise(x: number, z: number, scale: number = 0.01): number {
  const nx = x * scale;
  const nz = z * scale;
  return (
    Math.sin(nx * 1.7 + nz * 2.3) * 0.5 +
    Math.sin(nx * 3.1 - nz * 1.9) * 0.25 +
    Math.sin(nx * 0.8 + nz * 4.1) * 0.25
  );
}

export function distToSegmentSquared(px: number, pz: number, x1: number, z1: number, x2: number, z2: number): number {
  const l2 = (x1 - x2) ** 2 + (z1 - z2) ** 2;
  if (l2 === 0) return (px - x1) ** 2 + (pz - z1) ** 2;
  let t = ((px - x1) * (x2 - x1) + (pz - z1) * (z2 - z1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return (px - (x1 + t * (x2 - x1))) ** 2 + (pz - (z1 + t * (z2 - z1))) ** 2;
}

export function getTerrainHeight(x: number, z: number): number {
  const dist = Math.sqrt(x * x + z * z);

  // Rolling hills via noise
  let height = simpleNoise(x, z, 0.008) * 3;
  height += simpleNoise(x, z, 0.02) * 1.5;
  
  // Elevate terrain to prevent inland basins dipping below sea level
  height += 2.0;
  if (height < 0.2) height = 0.2;

  // Carve hole for Fishing Pond at (180, 130)
  const dxPond = x - 180;
  const dzPond = z - 130;
  const dPond = Math.sqrt(dxPond * dxPond + dzPond * dzPond);
  if (dPond < 22) {
    if (dPond < 18) {
      height = -0.5; // Deeply below pond bed so custom meshes show
    } else {
      const t = (dPond - 18) / 4; // 0 at inner, 1 at outer edge
      const smoothT = t * t * (3 - 2 * t);
      height = -0.5 + (height - -0.5) * smoothT;
    }
  }

  // Flatten near roads (using segment distance instead of just waypoints)
  let minRoadDistSq = Infinity;
  for (let j = 0; j < DENSE_ROAD_POINTS.length; j++) {
    const wp1 = DENSE_ROAD_POINTS[j];
    const wp2 = DENSE_ROAD_POINTS[(j + 1) % DENSE_ROAD_POINTS.length];
    const dSq = distToSegmentSquared(x, z, wp1.x, wp1.z, wp2.x, wp2.z);
    if (dSq < minRoadDistSq) minRoadDistSq = dSq;
  }
  
  let flattenFactor = 1.0;
  
  const minRoadDist = Math.sqrt(minRoadDistSq);
  if (minRoadDist < 9) {
    // Perfectly flat plateau under the road (radius 6.5) and a small shoulder
    height = 0.5;
  } else if (minRoadDist < 30) {
    // Smooth transition to natural terrain
    const t = (minRoadDist - 9) / 21;
    const smoothT = t * t * (3 - 2 * t);
    height = 0.5 + (height - 0.5) * smoothT;
  }

  // Flatten near nodes (POIs)
  for (const node of NODES) {
    const dx = x - node.position[0];
    const dz = z - node.position[2];
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < node.radius + 30) {
      const t = Math.max(0, d - node.radius) / 30;
      const smoothT = t * t * (3 - 2 * t);
      flattenFactor = Math.min(flattenFactor, 0.05 + 0.95 * smoothT);
    }
  }

  height *= flattenFactor;

  // Prevent terrain from rising above the ocean near the edges, and create a natural beach slope
  if (dist > 350) {
    if (dist < 420) {
      // Beach zone: gradual slope down to near water level
      const beachFactor = (dist - 350) / 70;
      const smoothBeach = beachFactor * beachFactor; // ease-in for gentle start
      height = height * (1 - smoothBeach) + 0.2 * smoothBeach;
    } else if (dist < 480) {
      // Submerge zone: gently go below water
      const subFactor = (dist - 420) / 60;
      height = 0.2 * (1 - subFactor) + (-1.0) * subFactor;
    } else {
      height = -1.0;
    }
  }
  
  if (height < -1.0) height = -1.0;

  return height;
}

// Extended road network — figure-8 coastal highway ~800-unit span
export const ROAD_WAYPOINTS: [number, number][] = [
  // Main loop — southern coast
  [   0,    0],
  [  50,  -30],
  [ 120,  -50],
  [ 180,  -20],
  [ 240,  -60],
  [ 300, -120],
  [ 340, -190],   // approach driftwood village
  [ 310, -240],
  [ 260, -260],
  [ 200, -240],
  [ 140, -280],
  [  60, -340],
  [ -30, -370],   // approach surf beach
  [-100, -350],
  [-160, -300],
  [-200, -240],
  [-250, -180],
  // Western forest loop
  [-280, -100],
  [-300,   -20],
  [-280,    60],
  [-250,   100],  // approach campsite
  [-200,   160],
  [-150,   200],  // approach bonfire
  [-100,   250],
  [ -40,   280],
  [  30,   270],
  [ 100,   250],
  // Northern spur — lighthouse road
  [ 160,   220],
  [ 200,   230],
  [ 250,   260],
  [ 300,   300],
  [ 350,   340],
  [ 380,   360],  // lighthouse approach
  [ 350,   340],  // return from lighthouse spur
  [ 300,   300],
  [ 250,   260],
  // Eastern descent
  [ 220,   200],
  [ 220,   150],
  [ 200,   100],  // approach fishing dock
  [ 180,    50],
  [ 140,    20],
  [ 100,     0],
  [  50,   -10]
];

export const ROAD_CURVE = new THREE.CatmullRomCurve3(
  ROAD_WAYPOINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
  true, "catmullrom", 0.5
);
export const DENSE_ROAD_POINTS = ROAD_CURVE.getSpacedPoints(2000);

export const VEHICLE_SPAWN: [number, number, number] = [0, 0.5, 0];

// Deterministic RNG
function lcg(seed: number) {
  return function() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// ── Scatter arrays ───────────────────────────────────────────────
export const TREE_POSITIONS: {pos: [number,number,number], s: number, variant: number}[] = [];
export const BOULDER_POSITIONS: {pos: [number,number,number], s: number, rot: [number,number,number]}[] = [];
export const BUSH_POSITIONS: {pos: [number,number,number], s: number}[] = [];
export const GROUND_PATCHES: {pos: [number,number,number], s: number, type: 'dirt' | 'flowers'}[] = [];
export const FENCE_POSITIONS: {start: [number,number,number], angle: number, segments: number}[] = [];
export const SEAGRASS_POSITIONS: {pos: [number,number,number], s: number}[] = [];
export const WILDFLOWER_CLUSTERS: {pos: [number,number,number], color: string, count: number}[] = [];
export const DRIFTWOOD_SCATTER: {pos: [number,number,number], rot: [number,number,number], s: number}[] = [];
export const DUNE_POSITIONS: {pos: [number,number,number], sx: number, sy: number, sz: number}[] = [];
export const STREET_LIGHT_POSITIONS: {pos: [number,number,number], rot: number}[] = [];

// POI exclusion zones — circles where scatter should not generate
export const EXCLUSION_ZONES = [
  { cx: 20, cz: -20, r: 45 },    // gas station
  { cx: 180, cz: 150, r: 30 },   // fishing dock
  { cx: -80, cz: -380, r: 55 },  // surf beach
  { cx: -220, cz: 80, r: 25 },   // campsite
  { cx: -100, cz: 200, r: 25 },  // bonfire
  { cx: 400, cz: 380, r: 50 },   // lighthouse
  { cx: 300, cz: -200, r: 50 },  // driftwood village
];

// Compute StreetLights
const numLights = 70;
const samples = ROAD_CURVE.getSpacedPoints(numLights);
for (let i = 0; i < samples.length; i++) {
   const p = samples[i];
   const t = ROAD_CURVE.getTangent(i / numLights);
   const perp = new THREE.Vector3(-t.z, 0, t.x).normalize();
   const side = i % 2 === 0 ? 1 : -1;
   const x = p.x + perp.x * 12 * side;
   const z = p.z + perp.z * 12 * side;
   
   let excluded = false;
   for (const zone of EXCLUSION_ZONES) {
      if (Math.sqrt((zone.cx - x)**2 + (zone.cz - z)**2) < zone.r) {
         excluded = true;
         break;
      }
   }
   
   if (!excluded) {
       STREET_LIGHT_POSITIONS.push({ pos: [x, 0, z], rot: Math.atan2(-perp.x * side, -perp.z * side) });
   }
}

(() => {
  const rng = lcg(12345);

  const checkDist = (x: number, z: number, minDRoad: number) => {
    // Check road distance
    let minDistSq = Infinity;
    for(let i = 0; i < DENSE_ROAD_POINTS.length; i++) {
      const wp1 = DENSE_ROAD_POINTS[i];
      const wp2 = DENSE_ROAD_POINTS[(i + 1) % DENSE_ROAD_POINTS.length];
      const dSq = distToSegmentSquared(x, z, wp1.x, wp1.z, wp2.x, wp2.z);
      if(dSq < minDistSq) minDistSq = dSq;
    }
    const minDist = Math.sqrt(minDistSq);
    if (minDist < minDRoad) return false;

    // Check exclusion zones
    for (const zone of EXCLUSION_ZONES) {
      const dx = zone.cx - x;
      const dz = zone.cz - z;
      if (Math.sqrt(dx*dx + dz*dz) < zone.r) return false;
    }
    return true;
  };

  // ── Trees — 1200+ total with variant types ───────────────────
  const addTree = (x: number, z: number) => {
    if(checkDist(x, z, 25)) {
      TREE_POSITIONS.push({ pos: [x, 0, z], s: 0.6 + rng() * 0.8, variant: Math.floor(rng() * 3) });
    }
  };
  // Dense forest near campsite
  for(let i = 0; i < 350; i++) addTree(-220 + (rng() - 0.5) * 200, 80 + (rng() - 0.5) * 200);
  // Dense forest wall — northern barrier (thicker)
  for(let i = 0; i < 600; i++) addTree((rng() - 0.5) * 700, 320 + rng() * 200);
  // Western forest barrier
  for(let i = 0; i < 200; i++) addTree(-350 + (rng() - 0.5) * 120, (rng() - 0.5) * 600);
  // Scattered across the island (more fills the void)
  for(let i = 0; i < 1500; i++) addTree((rng() - 0.5) * 1200, (rng() - 0.5) * 1200);
  // Lighthouse area pines
  for(let i = 0; i < 100; i++) addTree(350 + (rng() - 0.5) * 120, 330 + (rng() - 0.5) * 120);

  // ── Boulders — 500 total ─────────────────────────────────────
  for(let i = 0; i < 500; i++) {
    const x = (rng() - 0.5) * 1200;
    const z = (rng() - 0.5) * 1200;
    if(checkDist(x, z, 15)) {
      BOULDER_POSITIONS.push({
        pos: [x, 0, z],
        s: 0.4 + rng() * 1.8,
        rot: [rng()*Math.PI, rng()*Math.PI, rng()*Math.PI]
      });
    }
  }

  // ── Bushes — 1200 total ──────────────────────────────────────
  for(let i = 0; i < 1200; i++) {
    const x = (rng() - 0.5) * 1200;
    const z = (rng() - 0.5) * 1200;
    if(checkDist(x, z, 12)) {
      BUSH_POSITIONS.push({ pos: [x, 0, z], s: 0.3 + rng() * 0.9 });
    }
  }

  // ── Ground Patches (Dirt, Sand, Wildflowers) ────────────────
  for(let i = 0; i < 900; i++) {
    const x = (rng() - 0.5) * 1200;
    const z = (rng() - 0.5) * 1200;
    if(checkDist(x, z, 25)) {
      const dist = Math.sqrt(x * x + z * z);
      // Sand-like dirt near coast, normal variety inland
      let patchType: 'dirt' | 'flowers' = rng() > 0.5 ? 'dirt' : 'flowers';
      if (dist > 300) patchType = 'dirt';
      GROUND_PATCHES.push({
        pos: [x, 0, z],
        s: 1.5 + rng() * 4,
        type: patchType
      });
    }
  }

  // ── Fence segments along fields (safely away from road) ────────
  for (let i = 0; i < 40; i++) {
    const fx = (rng() - 0.5) * 800;
    const fz = (rng() - 0.5) * 800;
    const angle = rng() * Math.PI;
    const segments = 2 + Math.floor(rng() * 4);
    
    const length = segments * 3;
    let safe = true;
    for (let j = 0; j <= length; j += 1.5) {
      const cx = fx + Math.cos(angle) * j;
      const cz = fz - Math.sin(angle) * j;
      if (!checkDist(cx, cz, 28)) {
        safe = false;
        break;
      }
    }

    if (safe) {
      FENCE_POSITIONS.push({
        start: [fx, 0, fz],
        angle: angle,
        segments: segments
      });
    }
  }

  // ── Seagrass near coastal areas ──────────────────────────────
  // Southern coast
  for (let i = 0; i < 80; i++) {
    const x = -200 + rng() * 400;
    const z = -400 + rng() * 60;
    SEAGRASS_POSITIONS.push({ pos: [x, 0, z], s: 0.5 + rng() * 1.0 });
  }
  // Eastern coast near village
  for (let i = 0; i < 40; i++) {
    const x = 280 + rng() * 100;
    const z = -260 + rng() * 120;
    SEAGRASS_POSITIONS.push({ pos: [x, 0, z], s: 0.4 + rng() * 0.8 });
  }
  // Near lighthouse cliff
  for (let i = 0; i < 30; i++) {
    const x = 350 + rng() * 100;
    const z = 340 + rng() * 80;
    SEAGRASS_POSITIONS.push({ pos: [x, 0, z], s: 0.4 + rng() * 0.6 });
  }

  // ── Wildflower clusters across meadows (100 clusters) ────────
  const flowerColors = ['#e88fd0', '#f5d76e', '#ffffff', '#c49fe8', '#7fd1cc', '#ffb5a0'];
  for (let i = 0; i < 100; i++) {
    const x = (rng() - 0.5) * 900;
    const z = (rng() - 0.5) * 900;
    if (checkDist(x, z, 20)) {
      WILDFLOWER_CLUSTERS.push({
        pos: [x, 0.1, z],
        color: flowerColors[Math.floor(rng() * flowerColors.length)],
        count: 3 + Math.floor(rng() * 8)
      });
    }
  }

  // ── Driftwood near all coastal edges ─────────────────────────
  // Southern beach
  for (let i = 0; i < 30; i++) {
    const x = -200 + rng() * 400;
    const z = -420 + rng() * 50;
    if (checkDist(x, z, 30)) {
      DRIFTWOOD_SCATTER.push({
        pos: [x, 0.1, z],
        rot: [rng() * 0.3, rng() * Math.PI * 2, rng() * 0.3],
        s: 0.5 + rng() * 1.5
      });
    }
  }
  // Eastern coast
  for (let i = 0; i < 18; i++) {
    const x = 380 + rng() * 80;
    const z = -100 + rng() * 300;
    if (checkDist(x, z, 30)) {
      DRIFTWOOD_SCATTER.push({
        pos: [x, 0.1, z],
        rot: [rng() * 0.3, rng() * Math.PI * 2, rng() * 0.3],
        s: 0.4 + rng() * 1.2
      });
    }
  }
  // Western coast
  for (let i = 0; i < 12; i++) {
    const x = -380 + rng() * 60;
    const z = -200 + rng() * 400;
    if (checkDist(x, z, 30)) {
      DRIFTWOOD_SCATTER.push({
        pos: [x, 0.1, z],
        rot: [rng() * 0.3, rng() * Math.PI * 2, rng() * 0.3],
        s: 0.4 + rng() * 1.0
      });
    }
  }

  // Western coast seagrass
  for (let i = 0; i < 40; i++) {
    const x = -360 + rng() * 50;
    const z = -200 + rng() * 400;
    SEAGRASS_POSITIONS.push({ pos: [x, 0, z], s: 0.4 + rng() * 0.8 });
  }

  // ── Sand dune mounds near beach areas ────────────────────────
  // Main beach dunes (scattered along coast, away from SurfBeach props and road)
  DUNE_POSITIONS.push(
    { pos: [-220, -3, -300], sx: 40, sy: 8, sz: 25 },
    { pos: [-180, -4, -340], sx: 35, sy: 6, sz: 20 },
    { pos: [   0, -2, -410], sx: 30, sy: 7, sz: 22 },
    { pos: [  80, -5, -390], sx: 50, sy: 10, sz: 30 },
    { pos: [ 140, -3, -360], sx: 25, sy: 5, sz: 18 },
  );
  // Eastern dunes near village (moved further east/positive X)
  DUNE_POSITIONS.push(
    { pos: [360, -3, -260], sx: 25, sy: 5, sz: 20 },
    { pos: [370, -2, -210], sx: 20, sy: 4, sz: 15 },
  );
})();
