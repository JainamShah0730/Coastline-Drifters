import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html, Text } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';
import {
  NODES, ROAD_WAYPOINTS, TREE_POSITIONS, BOULDER_POSITIONS,
  BUSH_POSITIONS, GROUND_PATCHES, FENCE_POSITIONS, SEAGRASS_POSITIONS,
  WILDFLOWER_CLUSTERS, DRIFTWOOD_SCATTER, DUNE_POSITIONS,
  getTerrainHeight, STREET_LIGHT_POSITIONS, ROAD_CURVE
} from './constants';

// ── Ocean ────────────────────────────────────────────────────────
export function Ocean({ isNight }: { isNight?: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geoRef = useRef<THREE.PlaneGeometry>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  // Store original positions for wave animation
  const originalPositions = useRef<Float32Array | null>(null);

  useMemo(() => {
    // We'll set up original positions after first render
  }, []);

  useFrame(({ clock }) => {
    if (!geoRef.current) return;
    const geo = geoRef.current;
    const posAttr = geo.attributes.position;

    if (!originalPositions.current) {
      originalPositions.current = new Float32Array(posAttr.array);
    }

    const time = clock.getElapsedTime() * 0.6;
    const orig = originalPositions.current;

    for (let i = 0; i < posAttr.count; i++) {
      const ox = orig[i * 3];
      const oy = orig[i * 3 + 1];
      posAttr.array[i * 3 + 2] = (
        Math.sin(ox * 0.02 + time) * 0.3 +
        Math.sin(oy * 0.03 + time * 1.3) * 0.2 +
        Math.sin((ox + oy) * 0.015 + time * 0.7) * 0.1
      );
    }
    posAttr.needsUpdate = true;
    if (geoRef.current) {
      geoRef.current.computeVertexNormals();
    }

    if (matRef.current) {
      const targetColor = isNight ? new THREE.Color("#021a28") : new THREE.Color("#0a5f85");
      matRef.current.color.lerp(targetColor, 0.05);
    }
  });

  return (
    <group>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.8, 0]} receiveShadow>
        <planeGeometry ref={geoRef} args={[3000, 3000, 80, 80]} />
        <meshStandardMaterial
          ref={matRef}
          color="#0a5f85"
          roughness={0.08}
          metalness={0.7}
          flatShading
          transparent
          opacity={0.92}
        />
      </mesh>
      {/* Foam ring around island shoreline — kept below water to avoid visual artifacts */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
        <ringGeometry args={[445, 475, 64]} />
        <meshStandardMaterial
          color="#b8ddd8"
          roughness={0.6}
          transparent
          opacity={0.3}
          depthWrite={false}
        />
      </mesh>
      {/* Secondary foam ring — subtle, submerged */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.65, 0]}>
        <ringGeometry args={[455, 490, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.5}
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ── Island ground with terrain displacement ──────────────────────
export function Island() {
  const terrainGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1100, 1100, 100, 100);
    const posAttr = geo.attributes.position;

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      
      const height = getTerrainHeight(x, -y); // -y because Plane local Y maps to World -Z

      posAttr.setZ(i, height);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <>
      {/* Main island surface with displacement */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow geometry={terrainGeo}>
        <meshStandardMaterial color="#6aab4a" roughness={0.95} flatShading />
      </mesh>

      {/* Sandy beach fringe — sits below terrain to blend naturally */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]} receiveShadow>
        <ringGeometry args={[360, 480, 64, 8]} />
        <meshStandardMaterial color="#e8d5a3" roughness={1} flatShading depthWrite={false} />
      </mesh>

      {/* Sandy-to-grass transition ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <ringGeometry args={[340, 380, 64, 4]} />
        <meshStandardMaterial color="#b5c67a" roughness={1} transparent opacity={0.6} flatShading depthWrite={false} />
      </mesh>

      {/* Dune mounds near beaches */}
      {DUNE_POSITIONS.map((d, i) => (
        <mesh key={`dune-${i}`} position={d.pos} scale={[d.sx, d.sy, d.sz]} receiveShadow castShadow>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color="#dbc68f" roughness={1} flatShading />
        </mesh>
      ))}

      {/* Rocky cliff face — eastern barrier */}
      {[0, 1, 2, 3, 4].map(i => (
        <group key={`cliff-e-${i}`} position={[440 + i * 15, -10, -200 + i * 120]}>
          <mesh castShadow receiveShadow position={[0, 10, 0]}>
            <dodecahedronGeometry args={[25 + i * 3, 1]} />
            <meshStandardMaterial color="#6b635a" roughness={0.95} flatShading />
          </mesh>
          <mesh position={[5, 22, 3]} castShadow>
            <dodecahedronGeometry args={[8 + i * 2, 0]} />
            <meshStandardMaterial color="#7c766b" roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}

      {/* Lighthouse cliff platform removed to fix road blockage */}

      {/* Western hillside barrier */}
      {[0, 1, 2, 3].map(i => (
        <mesh key={`hill-w-${i}`} position={[-430 - i * 20, -15, -100 + i * 130]} receiveShadow>
          <sphereGeometry args={[60 + i * 15, 12, 8]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#5a9b3e" : "#6aab4a"} roughness={1} flatShading />
        </mesh>
      ))}
    </>
  );
}

// ── Street Lights ────────────────────────────────────────────────
export function StreetLights({ isNight }: { isNight: boolean }) {
  const lightPositions = useMemo(() => {
    return STREET_LIGHT_POSITIONS.map(lp => ({
      position: new THREE.Vector3(lp.pos[0], getTerrainHeight(lp.pos[0], lp.pos[2]), lp.pos[2]),
      rotation: lp.rot
    }));
  }, []);

  return (
    <group>
      {lightPositions.map((lp, i) => (
        <group key={i} position={lp.position} rotation={[0, lp.rotation, 0]}>
           {/* Pole */}
           <mesh position={[0, 4, 0]} castShadow>
             <cylinderGeometry args={[0.2, 0.3, 8]} />
             <meshStandardMaterial color="#444" roughness={0.7} />
           </mesh>
           {/* Arm */}
           <mesh position={[0, 7.8, 1.5]} rotation={[Math.PI/2, 0, 0]} castShadow>
             <cylinderGeometry args={[0.15, 0.15, 3]} />
             <meshStandardMaterial color="#444" roughness={0.7} />
           </mesh>
           {/* Bulb */}
           <mesh position={[0, 7.7, 2.8]}>
             <boxGeometry args={[0.6, 0.2, 0.6]} />
             <meshStandardMaterial color={isNight ? "#ffffee" : "#222"} emissive={isNight ? "#ffffee" : "#000"} emissiveIntensity={isNight ? 5 : 0} />
           </mesh>
           {/* Actual Light Source */}
           <pointLight
             position={[0, 7.5, 2.8]}
             intensity={isNight ? 25 : 0}
             distance={40}
             decay={2}
             color="#ffffee"
           />
        </group>
      ))}
    </group>
  );
}

// ── Road ─────────────────────────────────────────────────────────
export function Road() {
  const { geometry, dashGeometry, shoulderGeometry, gravelGeometry } = useMemo(() => {
    const curve = ROAD_CURVE;
    const ROAD_WIDTH = 13;
    const SEGMENTS = 2000;

    const samples = curve.getSpacedPoints(SEGMENTS);
    const tangents = samples.map((_p, i) => {
      const next = samples[(i + 1) % samples.length];
      const prev = samples[(i - 1 + samples.length) % samples.length];
      return new THREE.Vector3().subVectors(next, prev).normalize();
    });

    // Main road surface
    const positions: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      const t = tangents[i];
      const perp = new THREE.Vector3(-t.z, 0, t.x).normalize();

      const rx1 = p.x + perp.x * ROAD_WIDTH * 0.5;
      const rz1 = p.z + perp.z * ROAD_WIDTH * 0.5;
      const rx2 = p.x - perp.x * ROAD_WIDTH * 0.5;
      const rz2 = p.z - perp.z * ROAD_WIDTH * 0.5;

      const y1 = getTerrainHeight(rx1, rz1) + 0.1;
      const y2 = getTerrainHeight(rx2, rz2) + 0.1;

      positions.push(rx1, y1, rz1);
      positions.push(rx2, y2, rz2);
      normals.push(0, 1, 0, 0, 1, 0); // Simplified normals for now
      uvs.push(i / samples.length, 0, i / samples.length, 1);
    }

    for (let i = 0; i < samples.length - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      indices.push(a, c, b, b, c, d);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);

    // Dashed center line — proper flat quads instead of Points
    const dashPositions: number[] = [];
    const dashIndices: number[] = [];
    const DASH_WIDTH = 0.4;
    const dashLength = 4;
    const gapLength = 6;
    let accumulated = 0;
    let visible = true;
    for (let i = 0; i < samples.length - 1; i++) {
      const p1 = samples[i];
      const p2 = samples[i + 1];
      const dist = p1.distanceTo(p2);
      
      if (visible) {
        const t1 = tangents[i];
        const perp1 = new THREE.Vector3(-t1.z, 0, t1.x).normalize();
        const t2 = tangents[i + 1];
        const perp2 = new THREE.Vector3(-t2.z, 0, t2.x).normalize();

        const offset = dashPositions.length / 3;

        const sx1 = p1.x + perp1.x * DASH_WIDTH * 0.5;
        const sz1 = p1.z + perp1.z * DASH_WIDTH * 0.5;
        const sx2 = p1.x - perp1.x * DASH_WIDTH * 0.5;
        const sz2 = p1.z - perp1.z * DASH_WIDTH * 0.5;
        dashPositions.push(sx1, getTerrainHeight(sx1, sz1) + 0.12, sz1);
        dashPositions.push(sx2, getTerrainHeight(sx2, sz2) + 0.12, sz2);

        const nx1 = p2.x + perp2.x * DASH_WIDTH * 0.5;
        const nz1 = p2.z + perp2.z * DASH_WIDTH * 0.5;
        const nx2 = p2.x - perp2.x * DASH_WIDTH * 0.5;
        const nz2 = p2.z - perp2.z * DASH_WIDTH * 0.5;
        dashPositions.push(nx1, getTerrainHeight(nx1, nz1) + 0.12, nz1);
        dashPositions.push(nx2, getTerrainHeight(nx2, nz2) + 0.12, nz2);

        dashIndices.push(offset, offset + 2, offset + 1, offset + 1, offset + 2, offset + 3);
      }
      
      accumulated += dist;
      if (accumulated > (visible ? dashLength : gapLength)) {
        accumulated = 0;
        visible = !visible;
      }
    }
    const dashGeo = new THREE.BufferGeometry();
    dashGeo.setAttribute('position', new THREE.Float32BufferAttribute(dashPositions, 3));
    dashGeo.setIndex(dashIndices);
    dashGeo.computeVertexNormals();

    // Shoulder lines (white edge markings)
    const shoulderPositions: number[] = [];
    const shoulderIndices: number[] = [];
    const shoulderNormals: number[] = [];
    const shoulderUVs: number[] = [];
    const SHOULDER_WIDTH = 0.4;

    for (let side = -1; side <= 1; side += 2) {
      const offset = shoulderPositions.length / 3;
      for (let i = 0; i < samples.length; i++) {
        const p = samples[i];
        const t = tangents[i];
        const perp = new THREE.Vector3(-t.z, 0, t.x).normalize();
        const edgeOffset = ROAD_WIDTH * 0.48 * side;

        const sx1 = p.x + perp.x * (edgeOffset + SHOULDER_WIDTH * 0.5);
        const sz1 = p.z + perp.z * (edgeOffset + SHOULDER_WIDTH * 0.5);
        const sx2 = p.x + perp.x * (edgeOffset - SHOULDER_WIDTH * 0.5);
        const sz2 = p.z + perp.z * (edgeOffset - SHOULDER_WIDTH * 0.5);

        const sy1 = getTerrainHeight(sx1, sz1) + 0.11;
        const sy2 = getTerrainHeight(sx2, sz2) + 0.11;

        shoulderPositions.push(sx1, sy1, sz1);
        shoulderPositions.push(sx2, sy2, sz2);
        shoulderNormals.push(0, 1, 0, 0, 1, 0);
        shoulderUVs.push(i / samples.length, 0, i / samples.length, 1);
      }
      for (let i = 0; i < samples.length - 1; i++) {
        const a = offset / 1 + i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        shoulderIndices.push(a, c, b, b, c, d);
      }
    }
    const shoulderGeo = new THREE.BufferGeometry();
    shoulderGeo.setAttribute('position', new THREE.Float32BufferAttribute(shoulderPositions, 3));
    shoulderGeo.setAttribute('normal', new THREE.Float32BufferAttribute(shoulderNormals, 3));
    shoulderGeo.setAttribute('uv', new THREE.Float32BufferAttribute(shoulderUVs, 2));
    shoulderGeo.setIndex(shoulderIndices);

    // Gravel shoulder strips (dirt/gravel transition at road edge)
    const gravelPositions: number[] = [];
    const gravelIndices: number[] = [];
    const GRAVEL_WIDTH = 3;

    for (let side = -1; side <= 1; side += 2) {
      const offset = gravelPositions.length / 3;
      for (let i = 0; i < samples.length; i++) {
        const p = samples[i];
        const t = tangents[i];
        const perp = new THREE.Vector3(-t.z, 0, t.x).normalize();
        const roadEdge = ROAD_WIDTH * 0.5 * side;
        const gravelOuter = (ROAD_WIDTH * 0.5 + GRAVEL_WIDTH) * side;

        const ex = p.x + perp.x * roadEdge;
        const ez = p.z + perp.z * roadEdge;
        const gx = p.x + perp.x * gravelOuter;
        const gz = p.z + perp.z * gravelOuter;

        gravelPositions.push(ex, getTerrainHeight(ex, ez) + 0.08, ez);
        gravelPositions.push(gx, getTerrainHeight(gx, gz) + 0.05, gz);
      }
      for (let i = 0; i < samples.length - 1; i++) {
        const a = offset + i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        gravelIndices.push(a, c, b, b, c, d);
      }
    }
    const gravelGeo = new THREE.BufferGeometry();
    gravelGeo.setAttribute('position', new THREE.Float32BufferAttribute(gravelPositions, 3));
    gravelGeo.setIndex(gravelIndices);
    gravelGeo.computeVertexNormals();

    return { geometry: geo, dashGeometry: dashGeo, shoulderGeometry: shoulderGeo, gravelGeometry: gravelGeo };
  }, []);

  return (
    <group>
      {/* Main road surface — dark realistic asphalt */}
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial color="#363840" roughness={0.85} metalness={0.05} side={THREE.DoubleSide} />
      </mesh>
      {/* Dashed center line (bright yellow) */}
      <mesh geometry={dashGeometry} receiveShadow>
        <meshStandardMaterial color="#ffcc00" roughness={0.5} emissive="#ffcc00" emissiveIntensity={0.05} side={THREE.DoubleSide} />
      </mesh>
      {/* White shoulder lines — slightly brighter */}
      <mesh geometry={shoulderGeometry} receiveShadow>
        <meshStandardMaterial color="#f0f0f0" roughness={0.5} emissive="#ffffff" emissiveIntensity={0.02} side={THREE.DoubleSide} />
      </mesh>
      {/* Worn pavement patches — small, stays within road bounds */}
      {[
        [50, -30], [180, -20], [-200, -180], [-100, 250], [200, 230],
      ].map(([x, z], i) => (
        <mesh key={`patch-${i}`} rotation={[-Math.PI / 2, 0, i * 0.8]} position={[x, getTerrainHeight(x, z) + 0.12, z]} receiveShadow>
          <planeGeometry args={[3 + i * 0.5, 2 + i * 0.3]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#2d2f31" : "#3a3c3e"} roughness={1} transparent opacity={0.3} depthWrite={false} />
        </mesh>
      ))}
      {/* Gravel shoulder transition strips */}
      <mesh geometry={gravelGeometry} receiveShadow>
        <meshStandardMaterial color="#7a7568" roughness={1} flatShading />
      </mesh>
    </group>
  );
}

// ── Tree variants ────────────────────────────────────────────────
function PineTree({ position, scale = 1 }: { position: [number, number, number], scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.5, 2.4, 6]} />
        <meshStandardMaterial color="#4a3112" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 3.2, 0]} castShadow>
        <coneGeometry args={[2.2, 3, 7]} />
        <meshStandardMaterial color="#1f4d30" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 4.8, 0]} castShadow>
        <coneGeometry args={[1.4, 2.5, 7]} />
        <meshStandardMaterial color="#2a6340" roughness={1} flatShading />
      </mesh>
    </group>
  );
}

function BroadTree({ position, scale = 1 }: { position: [number, number, number], scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.6, 3, 6]} />
        <meshStandardMaterial color="#5a3a1a" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 3.8, 0]} castShadow>
        <sphereGeometry args={[2.5, 8, 6]} />
        <meshStandardMaterial color="#3a7a2e" roughness={0.9} flatShading />
      </mesh>
      <mesh position={[1.2, 3.2, 0.8]} castShadow>
        <sphereGeometry args={[1.8, 7, 5]} />
        <meshStandardMaterial color="#4a8a3e" roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

function PalmTree({ position, scale = 1 }: { position: [number, number, number], scale?: number }) {
  return (
    <group position={position} scale={scale}>
      {/* Curved trunk */}
      <mesh position={[0, 2, 0]} rotation={[0, 0, 0.15]} castShadow>
        <cylinderGeometry args={[0.25, 0.4, 5, 6]} />
        <meshStandardMaterial color="#6b5030" roughness={1} flatShading />
      </mesh>
      {/* Palm fronds — radiating cones */}
      {[0, 1, 2, 3, 4, 5].map(i => (
        <mesh key={i} position={[
          Math.cos(i * Math.PI / 3) * 1.5,
          4.5,
          Math.sin(i * Math.PI / 3) * 1.5
        ]} rotation={[0.8, i * Math.PI / 3, 0]} castShadow>
          <coneGeometry args={[0.8, 3, 4]} />
          <meshStandardMaterial color="#2d7a3a" roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
}

export function Trees() {
  return (
    <>
      {TREE_POSITIONS.map((t, i) => {
        const y = getTerrainHeight(t.pos[0], t.pos[2]);
        if (t.variant === 0) return <PineTree key={i} position={[t.pos[0], y, t.pos[2]]} scale={t.s} />;
        if (t.variant === 1) return <BroadTree key={i} position={[t.pos[0], y, t.pos[2]]} scale={t.s} />;
        return <PalmTree key={i} position={[t.pos[0], y, t.pos[2]]} scale={t.s} />;
      })}
    </>
  );
}

export function Boulders() {
  return (
    <>
      {BOULDER_POSITIONS.map((b, i) => {
        const y = getTerrainHeight(b.pos[0], b.pos[2]);
        return (
          <mesh key={i} position={[b.pos[0], y, b.pos[2]]} scale={b.s} rotation={b.rot} castShadow receiveShadow>
            <dodecahedronGeometry args={[2, 0]} />
            <meshStandardMaterial
              color={i % 3 === 0 ? "#7a7e7f" : i % 3 === 1 ? "#8b8a82" : "#6e6d65"}
              roughness={0.9}
              flatShading
            />
          </mesh>
        );
      })}
    </>
  );
}

export function Bushes() {
  return (
    <>
      {BUSH_POSITIONS.map((b, i) => {
        const y = getTerrainHeight(b.pos[0], b.pos[2]);
        return (
          <mesh key={i} position={[b.pos[0], y + 0.5, b.pos[2]]} scale={b.s} castShadow>
            <dodecahedronGeometry args={[1.5, 0]} />
            <meshStandardMaterial
              color={i % 4 === 0 ? "#4a7530" : i % 4 === 1 ? "#558238" : i % 4 === 2 ? "#638c40" : "#3f6828"}
              roughness={1}
              flatShading
            />
          </mesh>
        );
      })}
    </>
  );
}

export function GroundDetails() {
  return (
    <>
      {GROUND_PATCHES.map((p, i) => (
        <mesh key={i} position={[p.pos[0], getTerrainHeight(p.pos[0], p.pos[2]) + 0.03, p.pos[2]]} rotation={[-Math.PI/2, 0, i * 0.5]} receiveShadow>
          <circleGeometry args={[p.s, 8]} />
          <meshStandardMaterial
            color={p.type === 'dirt' ? "#a38b6d" : "#c48fb8"}
            roughness={1}
            transparent
            opacity={p.type === 'dirt' ? 0.4 : 0.6}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}

// ── Environmental node markers (replaces abstract circles) ───────
export function NodeMarkers() {
  return (
    <>
      {NODES.map((n) => {
        switch (n.id) {
          case 'rest-stop':
            return (
              <group key={n.id} position={n.position}>
                {/* Concrete pad */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
                  <planeGeometry args={[16, 14]} />
                  <meshStandardMaterial color="#888888" roughness={0.9} />
                </mesh>
                
                {/* Vintage Gas Station Building */}
                <group position={[0, 2.5, -4]}>
                  <mesh castShadow receiveShadow>
                    <boxGeometry args={[12, 5, 5]} />
                    <meshStandardMaterial color="#c2d5c4" roughness={0.8} />
                  </mesh>
                  {/* Roof overhang */}
                  <mesh position={[0, 2.6, 2.5]} castShadow>
                    <boxGeometry args={[13, 0.4, 10]} />
                    <meshStandardMaterial color="#f0f0f0" roughness={0.9} />
                  </mesh>
                  {/* Store window */}
                  <mesh position={[0, -0.5, 2.55]}>
                    <boxGeometry args={[5, 2.5, 0.1]} />
                    <meshStandardMaterial color="#87cefa" roughness={0.2} metalness={0.5} />
                  </mesh>
                  {/* Wooden sign on roof */}
                  <group position={[0, 3.5, 0]}>
                    <mesh castShadow>
                      <boxGeometry args={[6, 1.5, 0.5]} />
                      <meshStandardMaterial color="#8b5a2b" roughness={0.9} />
                    </mesh>
                  </group>
                </group>

                {/* Gas Pumps */}
                {[-2.5, 2.5].map(px => (
                  <group key={px} position={[px, 1.5, 3]}>
                    <mesh castShadow>
                      <boxGeometry args={[1.2, 3, 1]} />
                      <meshStandardMaterial color="#e05a5a" roughness={0.8} />
                    </mesh>
                    {/* Pump Globe */}
                    <mesh position={[0, 1.8, 0]}>
                      <sphereGeometry args={[0.5, 16, 16]} />
                      <meshStandardMaterial color="#ffffff" roughness={0.4} />
                    </mesh>
                  </group>
                ))}
              </group>
            );
          case 'fishing-dock':
            return (
              <group key={n.id} position={n.position}>
                {/* Gravel path leading to dock */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 28]}>
                  <planeGeometry args={[3, 12]} />
                  <meshStandardMaterial color="#b5a88a" roughness={1} transparent opacity={0.6} />
                </mesh>
                {/* Cattails / reeds around pond */}
                {[[-12, 8], [14, 5], [-8, -10], [15, -8], [-14, -3]].map(([rx, rz], i) => (
                  <group key={i} position={[rx, 0, rz]}>
                    <mesh position={[0, 1.5, 0]} castShadow>
                      <cylinderGeometry args={[0.05, 0.08, 3, 4]} />
                      <meshStandardMaterial color="#4a6632" roughness={1} />
                    </mesh>
                    <mesh position={[0, 2.8, 0]}>
                      <sphereGeometry args={[0.2, 4, 4]} />
                      <meshStandardMaterial color="#5a4020" roughness={1} flatShading />
                    </mesh>
                  </group>
                ))}
              </group>
            );
          case 'surf-beach':
            return (
              <group key={n.id} position={n.position}>
                {/* Sand blending outward */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                  <circleGeometry args={[50, 16]} />
                  <meshStandardMaterial color="#e8cc8a" roughness={1} transparent opacity={0.5} />
                </mesh>
                {/* Beach towel — striped red */}
                <mesh rotation={[-Math.PI / 2, 0, -0.5]} position={[-4, 0.05, 8]}>
                  <planeGeometry args={[1.5, 3]} />
                  <meshStandardMaterial color="#e05260" roughness={1} />
                </mesh>
                {/* Beach towel — teal */}
                <mesh rotation={[-Math.PI / 2, 0, 0.3]} position={[-2, 0.05, 10]}>
                  <planeGeometry args={[1.8, 3.2]} />
                  <meshStandardMaterial color="#4ecdc4" roughness={1} />
                </mesh>
                {/* Low-poly Wooden Bench overlooking water */}
                <group position={[6, 0.5, -4]} rotation={[0, -0.4, 0]}>
                  <mesh position={[0, 0, 0]} castShadow>
                    <boxGeometry args={[3.5, 0.15, 0.8]} />
                    <meshStandardMaterial color="#725a3f" roughness={1} />
                  </mesh>
                  <mesh position={[-1.4, -0.25, 0]} castShadow>
                    <boxGeometry args={[0.2, 0.5, 0.6]} />
                    <meshStandardMaterial color="#55422d" roughness={1} />
                  </mesh>
                  <mesh position={[1.4, -0.25, 0]} castShadow>
                    <boxGeometry args={[0.2, 0.5, 0.6]} />
                    <meshStandardMaterial color="#55422d" roughness={1} />
                  </mesh>
                  {/* Bench backrest */}
                  <mesh position={[0, 0.35, -0.35]} castShadow>
                    <boxGeometry args={[3.5, 0.6, 0.1]} />
                    <meshStandardMaterial color="#725a3f" roughness={1} />
                  </mesh>
                </group>
                {/* Physics Beach Ball — players can drive into it! */}
                <RigidBody position={[-2, 2.5, 15]} colliders="ball" mass={0.3} restitution={0.85} linearDamping={0.5}>
                  <mesh castShadow>
                    <sphereGeometry args={[1.5, 16, 16]} />
                    <meshStandardMaterial color="#3498db" roughness={0.3} />
                  </mesh>
                  {/* White stripe */}
                  <mesh rotation={[0, 0, Math.PI / 2]}>
                    <torusGeometry args={[1.5, 0.08, 4, 24]} />
                    <meshStandardMaterial color="#ffffff" roughness={0.4} />
                  </mesh>
                  {/* Red stripe */}
                  <mesh rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[1.5, 0.08, 4, 24]} />
                    <meshStandardMaterial color="#e74c3c" roughness={0.4} />
                  </mesh>
                </RigidBody>
              </group>
            );
          case 'campsite':
            return (
              <group key={n.id} position={n.position}>
                {/* Pine needle ground cover */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                  <circleGeometry args={[12, 12]} />
                  <meshStandardMaterial color="#5a4a30" roughness={1} transparent opacity={0.4} />
                </mesh>
                {/* Dirt trail leading in */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[15, 0.03, -10]}>
                  <planeGeometry args={[3, 20]} />
                  <meshStandardMaterial color="#8a7a5a" roughness={1} transparent opacity={0.5} />
                </mesh>
              </group>
            );
          case 'bonfire-circle':
            return (
              <group key={n.id} position={n.position}>
                {/* Charred ground */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
                  <circleGeometry args={[5, 12]} />
                  <meshStandardMaterial color="#2a2520" roughness={1} transparent opacity={0.6} />
                </mesh>
                {/* Ash circle */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
                  <ringGeometry args={[4, 6, 16]} />
                  <meshStandardMaterial color="#8a8280" roughness={1} transparent opacity={0.4} />
                </mesh>
              </group>
            );
          case 'lighthouse':
            return (
              <group key={n.id} position={n.position}>
                {/* Rocky gravel approach */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-20, 0.04, -20]}>
                  <planeGeometry args={[4, 25]} />
                  <meshStandardMaterial color="#9a9080" roughness={1} transparent opacity={0.5} />
                </mesh>
              </group>
            );
          case 'driftwood-village':
            return (
              <group key={n.id} position={n.position}>
                {/* Packed dirt village ground */}
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
                  <circleGeometry args={[25, 16]} />
                  <meshStandardMaterial color="#c4a878" roughness={1} transparent opacity={0.5} />
                </mesh>
              </group>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

// ── Fishing Pond & Dock ──────────────────────────────────────────
export function FishingDock() {
  return (
    <group position={[180, 0, 130]}>
      {/* Pond water surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[20, 32]} />
        <meshStandardMaterial color="#1a7a95" roughness={0.05} metalness={0.6} transparent opacity={0.88} />
      </mesh>
      {/* Pond bed */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[20, 32]} />
        <meshStandardMaterial color="#0c3c4a" roughness={1} />
      </mesh>
      {/* Grassy bank ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[18, 25, 32]} />
        <meshStandardMaterial color="#5a9a40" roughness={1} />
      </mesh>

      {/* Wooden dock */}
      <mesh position={[0, 0.15, 20]} receiveShadow castShadow>
        <boxGeometry args={[4, 0.25, 12]} />
        <meshStandardMaterial color="#78593a" roughness={0.9} />
      </mesh>
      {/* Dock railing posts */}
      {[-1.8, 1.8].map(x => [-3, 0, 3, 6].map(z => (
        <mesh key={`rail-${x}-${z}`} position={[x, 0.8, 17 + z]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 1.4, 4]} />
          <meshStandardMaterial color="#5a4020" roughness={1} />
        </mesh>
      )))}
      {/* Dock support posts */}
      {[-4, 0, 4].map((z) => (
        <mesh key={z} position={[0, -0.5, 18 + z]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 2, 6]} />
          <meshStandardMaterial color="#4a3520" roughness={1} />
        </mesh>
      ))}

      {/* Small rowboat moored at dock */}
      <group position={[4, 0.15, 22]} rotation={[0, 0.3, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.5, 0.4, 3.5]} />
          <meshStandardMaterial color="#8b6040" roughness={0.8} flatShading />
        </mesh>
        <mesh position={[0, 0.3, -1]}>
          <cylinderGeometry args={[0.05, 0.05, 1.5, 4]} />
          <meshStandardMaterial color="#5a4a3a" roughness={1} />
        </mesh>
      </group>

      {/* Fishing rod propped against dock rail */}
      <mesh position={[-1.5, 0.7, 24]} rotation={[0.3, 0.2, 0.8]} castShadow>
        <cylinderGeometry args={[0.03, 0.02, 3, 4]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.6} />
      </mesh>

      {/* Bucket near dock end */}
      <mesh position={[1, 0.4, 25]} castShadow>
        <cylinderGeometry args={[0.4, 0.3, 0.6, 8]} />
        <meshStandardMaterial color="#4a6a8a" roughness={0.7} flatShading />
      </mesh>

      {/* Lily pads with varied sizes */}
      {[
        [-5, -12, 1.2], [8, -8, -0.5], [-10, 5, 0.8],
        [12, 10, 2.1], [-2, 14, -1.1], [6, -15, 0.3],
        [-13, 2, 1.8], [3, 8, -0.8]
      ].map(([x, z, rot], i) => (
        <mesh key={i} position={[x, 0.055, z]} rotation={[0, rot, 0]}>
          <cylinderGeometry args={[0.8 + (i % 3) * 0.4, 0.8 + (i % 3) * 0.4, 0.02, 12, 1, false, 0, Math.PI * 1.8]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#3f8a45" : "#4a9a50"} roughness={0.8} flatShading />
        </mesh>
      ))}
    </group>
  );
}

// ── Gas Station — enhanced with coastal character ────────────────
export function GasStation() {
  return (
    <group position={[20, 0, -20]}>
      {/* Concrete base */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <planeGeometry args={[32, 28]} />
        <meshStandardMaterial color="#8e9294" roughness={1} />
      </mesh>

      {/* Main building — seafoam green */}
      <mesh position={[0, 3, -7]} castShadow receiveShadow>
        <boxGeometry args={[16, 6, 10]} />
        <meshStandardMaterial color="#a8dbd0" roughness={0.85} flatShading />
      </mesh>
      {/* Building branding */}
      <Text
        position={[0, 4.8, -1.93]}
        fontSize={0.7}
        color="#1a4a6b"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        COASTAL GAS & GOODS
      </Text>
      {/* Building trim stripe */}
      <mesh position={[0, 5.8, -1.95]} castShadow>
        <boxGeometry args={[16.1, 0.5, 0.1]} />
        <meshStandardMaterial color="#eb7254" roughness={0.8} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 1.8, -1.95]} castShadow>
        <boxGeometry args={[2.5, 3.6, 0.15]} />
        <meshStandardMaterial color="#5a4a3a" roughness={0.8} />
      </mesh>
      {/* Window */}
      <mesh position={[5, 3, -1.95]} castShadow>
        <boxGeometry args={[3, 2, 0.1]} />
        <meshStandardMaterial color="#a8d8ea" roughness={0.2} metalness={0.3} />
      </mesh>
      <mesh position={[-5, 3, -1.95]} castShadow>
        <boxGeometry args={[3, 2, 0.1]} />
        <meshStandardMaterial color="#a8d8ea" roughness={0.2} metalness={0.3} />
      </mesh>

      {/* Roof */}
      <mesh position={[0, 6.5, -7]} castShadow rotation={[0, Math.PI/4, 0]}>
        <coneGeometry args={[12, 4, 4]} />
        <meshStandardMaterial color="#4a5e58" roughness={0.9} flatShading />
      </mesh>

      {/* Canopy over pumps */}
      <mesh position={[0, 5.5, 6]} castShadow>
        <boxGeometry args={[20, 0.5, 12]} />
        <meshStandardMaterial color="#4a5e58" roughness={0.9} flatShading />
      </mesh>
      {/* Canopy support pillars */}
      {[[-8, 1], [8, 1], [-8, 11], [8, 11]].map(([x, z], i) => (
        <mesh key={`pillar-${i}`} position={[x, 3, z]} castShadow>
          <cylinderGeometry args={[0.25, 0.25, 5.5, 6]} />
          <meshStandardMaterial color="#ddd" roughness={0.5} />
        </mesh>
      ))}
      <pointLight position={[0, 4.5, 6]} intensity={1.5} color="#ffeaa7" distance={30} />

      {/* Wooden sign */}
      <group position={[12, 0, 5]} rotation={[0, -0.3, 0]}>
        {/* Sign post */}
        <mesh position={[0, 2, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 4, 6]} />
          <meshStandardMaterial color="#5a4020" roughness={1} />
        </mesh>
        {/* Sign board */}
        <mesh position={[0, 3.5, 0.2]} castShadow>
          <boxGeometry args={[4, 1.8, 0.2]} />
          <meshStandardMaterial color="#e8d5a3" roughness={0.9} />
        </mesh>
        <Text
          position={[0, 3.5, 0.31]}
          fontSize={0.45}
          color="#1a4a6b"
          anchorX="center"
          anchorY="middle"
        >
          COASTAL GAS
        </Text>
      </group>

      {/* Vintage fuel pumps */}
      {[-3, 3].map((x) => (
        <group key={x} position={[x, 0, 6]}>
          <mesh position={[0, 1.2, 0]} castShadow>
            <boxGeometry args={[1.2, 2.4, 0.8]} />
            <meshStandardMaterial color="#bd5c5c" roughness={0.7} />
          </mesh>
          {/* Pump top globe */}
          <mesh position={[0, 2.7, 0]} castShadow>
            <sphereGeometry args={[0.55, 10, 10]} />
            <meshStandardMaterial color="#e8e8e0" roughness={0.3} />
          </mesh>
          {/* Nozzle holder */}
          <mesh position={[0.5, 1.5, 0.45]} castShadow>
            <boxGeometry args={[0.15, 0.6, 0.15]} />
            <meshStandardMaterial color="#333" roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Trash cans */}
      {[[-6, -1], [-7.2, -1]].map(([x, z], i) => (
        <group key={`trash-${i}`}>
          <mesh position={[x, 0.6, z]} castShadow>
            <cylinderGeometry args={[0.4, 0.3, 1.2, 8]} />
            <meshStandardMaterial color={i === 0 ? "#444b4d" : "#383d3f"} roughness={0.8} flatShading />
          </mesh>
          {/* Trash can lid */}
          <mesh position={[x, 1.22, z]} castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.06, 8]} />
            <meshStandardMaterial color="#555" roughness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Oil drum stack */}
      <group position={[-9, 0, -5]}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 1.4, 10]} />
          <meshStandardMaterial color="#2a5a8a" roughness={0.7} />
        </mesh>
        <mesh position={[1.3, 0.7, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 1.4, 10]} />
          <meshStandardMaterial color="#8a3a2a" roughness={0.7} />
        </mesh>
        <mesh position={[0.65, 2.1, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 1.4, 10]} />
          <meshStandardMaterial color="#3a6a3a" roughness={0.7} />
        </mesh>
      </group>

      {/* Tire stack */}
      <group position={[9, 0, -4]}>
        {[0, 0.5, 1.0, 1.5].map((y, i) => (
          <mesh key={`tire-${i}`} position={[0, 0.25 + y, 0]} rotation={[Math.PI / 2, 0, i * 0.3]} castShadow>
            <torusGeometry args={[0.5, 0.2, 8, 12]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
          </mesh>
        ))}
      </group>

      {/* Dynamic Traffic Cones */}
      {[[-4, 10], [0, 11], [4, 10], [5, 13]].map(([x, z], i) => (
        <RigidBody key={`cone-${i}`} position={[x, 0.5, z]} colliders="hull" mass={1} restitution={0.2}>
          <mesh castShadow>
            <coneGeometry args={[0.3, 0.8, 8]} />
            <meshStandardMaterial color="#ff5500" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.3, 0]} castShadow>
            <boxGeometry args={[0.7, 0.05, 0.7]} />
            <meshStandardMaterial color="#ff5500" roughness={0.7} />
          </mesh>
        </RigidBody>
      ))}

      {/* Vending machine */}
      <mesh position={[8, 1.2, -1.9]} castShadow>
        <boxGeometry args={[1.5, 2.4, 1]} />
        <meshStandardMaterial color="#2a5080" roughness={0.6} />
      </mesh>
      <mesh position={[8, 1.4, -1.38]} castShadow>
        <boxGeometry args={[1.2, 1.6, 0.05]} />
        <meshStandardMaterial color="#60a0c0" roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Trash Can */}
      <group position={[6, 0.5, -2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.4, 0.35, 1, 8]} />
          <meshStandardMaterial color="#555" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, 0.1, 8]} />
          <meshStandardMaterial color="#333" roughness={0.9} />
        </mesh>
      </group>

      {/* Air Pump Station */}
      <group position={[-12, 0, 3]}>
        <mesh position={[0, 1.2, 0]} castShadow>
          <boxGeometry args={[1.5, 2.4, 1.5]} />
          <meshStandardMaterial color="#c0c0c0" roughness={0.7} />
        </mesh>
        {/* Air hose */}
        <mesh position={[0.8, 1.0, 0.5]} rotation={[0, 0, 0.4]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 1.5, 6]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
        </mesh>
        <Text
          position={[0, 2, 0.76]}
          fontSize={0.22}
          color="#333"
          anchorX="center"
          anchorY="middle"
        >
          AIR
        </Text>
      </group>

      {/* Ice Cooler outside */}
      <group position={[-4, 0, -1.5]} rotation={[0, 0.1, 0]}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <boxGeometry args={[2, 1.4, 1.2]} />
          <meshStandardMaterial color="#e8e8e0" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.45, 0]} castShadow>
          <boxGeometry args={[2.05, 0.1, 1.25]} />
          <meshStandardMaterial color="#4a9ae0" roughness={0.5} />
        </mesh>
        <Text
          position={[0, 0.9, 0.61]}
          fontSize={0.28}
          color="#4a9ae0"
          anchorX="center"
          anchorY="middle"
        >
          ICE
        </Text>
      </group>

      {/* Newspaper stand */}
      <group position={[4.5, 0, -1.5]}>
        <mesh position={[0, 0.8, 0]} castShadow>
          <boxGeometry args={[1, 1.6, 0.6]} />
          <meshStandardMaterial color="#c24040" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.0, 0.31]} castShadow>
          <boxGeometry args={[0.85, 0.5, 0.02]} />
          <meshStandardMaterial color="#e8e8e0" roughness={0.5} />
        </mesh>
      </group>

      {/* Potted plants at entrance */}
      {[-3.5, 3.5].map((px, i) => (
        <group key={`plant-${i}`} position={[px, 0, -1.5]}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.4, 0.35, 0.7, 8]} />
            <meshStandardMaterial color="#8b6040" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.8, 0]} castShadow>
            <sphereGeometry args={[0.6, 8, 6]} />
            <meshStandardMaterial color="#3a7a3a" roughness={0.9} flatShading />
          </mesh>
        </group>
      ))}
      {/* Traffic Cones (Physics) */}
      {[
        [-5, 8], [-3, 8], [-1, 8.5], [1, 8.5], [3, 9]
      ].map(([x, z], i) => (
        <RigidBody key={`cone-${i}`} position={[x, 1, z]} colliders="hull" mass={0.5}>
          <group>
            {/* Base */}
            <mesh position={[0, -0.45, 0]} castShadow>
              <boxGeometry args={[0.6, 0.1, 0.6]} />
              <meshStandardMaterial color="#f05020" roughness={0.8} />
            </mesh>
            {/* Cone */}
            <mesh position={[0, 0, 0]} castShadow>
              <coneGeometry args={[0.25, 1, 8]} />
              <meshStandardMaterial color="#f05020" roughness={0.8} />
            </mesh>
            {/* White stripe */}
            <mesh position={[0, 0.1, 0]}>
              <cylinderGeometry args={[0.2, 0.22, 0.25, 8]} />
              <meshStandardMaterial color="#ffffff" roughness={0.8} />
            </mesh>
          </group>
        </RigidBody>
      ))}
    </group>
  );
}

// ── Environmental Clutter ────────────────────────────────────────
export function Clutter() {
  const getClutterHeight = (x: number, z: number) => getTerrainHeight(x, z) + 0.1;
  return (
    <group>
      {/* Beach Towels at Surf Beach */}
      {[
        { pos: [-360, -320], color: "#d96256", rot: 0.2 },
        { pos: [-365, -310], color: "#65a6c2", rot: -0.4 },
        { pos: [-350, -315], color: "#f2c66d", rot: 0.1 },
        { pos: [-355, -325], color: "#8da87c", rot: 0.8 },
      ].map((t, i) => (
        <mesh key={`towel-${i}`} position={[t.pos[0], getClutterHeight(t.pos[0], t.pos[1]), t.pos[1]]} rotation={[-Math.PI / 2, 0, t.rot]} receiveShadow castShadow>
          <planeGeometry args={[2, 4]} />
          <meshStandardMaterial color={t.color} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* Coolers at Bonfire and Beach */}
      {[
        { pos: [85, 235], rot: 0.5, color: "#c2443a" }, // Bonfire
        { pos: [90, 245], rot: -0.2, color: "#427ca8" }, // Bonfire
        { pos: [-352, -318], rot: 0.1, color: "#e8a020" }, // Beach
      ].map((c, i) => (
        <group key={`cooler-${i}`} position={[c.pos[0], getClutterHeight(c.pos[0], c.pos[1]) + 0.5, c.pos[1]]} rotation={[0, c.rot, 0]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.5, 1, 1]} />
            <meshStandardMaterial color={c.color} roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.55, 0]} castShadow>
            <boxGeometry args={[1.6, 0.1, 1.1]} />
            <meshStandardMaterial color="#ffffff" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── Bonfire ────────────────────────────────────────────────────────
export function Bonfire({ active }: { active: boolean }) {
  return (
    <group position={[-100, 0, 200]}>
      {/* Stone ring */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
        <mesh key={i} position={[Math.cos(i * Math.PI / 6) * 2.5, 0.4, Math.sin(i * Math.PI / 6) * 2.5]} castShadow>
          <dodecahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial color="#5a5550" roughness={1} flatShading />
        </mesh>
      ))}
      {/* Log fuel */}
      <mesh position={[0, 0.6, 0]} rotation={[0.3, 0.5, 0.2]} castShadow>
        <cylinderGeometry args={[0.25, 0.3, 3, 6]} />
        <meshStandardMaterial color="#4a3520" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 0.6, 0]} rotation={[-0.3, -0.5, 0.2]} castShadow>
        <cylinderGeometry args={[0.25, 0.3, 3, 6]} />
        <meshStandardMaterial color="#4a3520" roughness={1} flatShading />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[0.1, 1.2, 0.4]} castShadow>
        <cylinderGeometry args={[0.2, 0.25, 2.5, 6]} />
        <meshStandardMaterial color="#5a4530" roughness={1} flatShading />
      </mesh>

      {/* Seating logs around the bonfire */}
      {[
        { pos: [5, 0.35, 0] as [number,number,number], rot: [0, 0, 0.05] as [number,number,number] },
        { pos: [-4, 0.35, 3] as [number,number,number], rot: [0, 0.8, 0.05] as [number,number,number] },
        { pos: [0, 0.35, -5] as [number,number,number], rot: [0, 1.5, 0.05] as [number,number,number] },
      ].map((log, i) => (
        <mesh key={`log-${i}`} position={log.pos} rotation={log.rot} castShadow>
          <cylinderGeometry args={[0.4, 0.4, 4, 8]} />
          <meshStandardMaterial color="#594635" roughness={1} flatShading />
        </mesh>
      ))}

      {active && (
        <group>
          <pointLight position={[0, 3, 0]} intensity={5} color="#ff9d00" distance={50} decay={2} castShadow />
          <pointLight position={[0, 1.5, 0]} intensity={3} color="#ff5500" distance={20} decay={2} />
          {/* Flame layers */}
          <mesh position={[0, 1.8, 0]}>
            <coneGeometry args={[1.2, 2.5, 5]} />
            <meshBasicMaterial color="#ff5500" transparent opacity={0.8} />
          </mesh>
          <mesh position={[0, 2.2, 0]}>
            <coneGeometry args={[0.8, 1.8, 5]} />
            <meshBasicMaterial color="#ffaa00" transparent opacity={0.7} />
          </mesh>
          <mesh position={[0.3, 2.5, 0.2]}>
            <coneGeometry args={[0.4, 1.2, 4]} />
            <meshBasicMaterial color="#ffdd44" transparent opacity={0.6} />
          </mesh>
          <BonfireSparks />
        </group>
      )}
    </group>
  );
}

// ── Bonfire Sparks Component ─────────────────────────────────────
function BonfireSparks() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const count = 30;
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 1.5,
      y: Math.random() * 2,
      z: (Math.random() - 0.5) * 1.5,
      speedY: 1 + Math.random() * 2,
      speedX: (Math.random() - 0.5) * 1,
      speedZ: (Math.random() - 0.5) * 1,
    }));
  }, [count]);

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    particles.forEach((p, i) => {
      p.y += p.speedY * dt;
      p.x += p.speedX * dt;
      p.z += p.speedZ * dt;
      if (p.y > 4) {
        p.y = 0;
        p.x = (Math.random() - 0.5) * 1.5;
        p.z = (Math.random() - 0.5) * 1.5;
      }
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(Math.max(0, 1 - p.y / 4));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined as any, undefined as any, count]} position={[0, 1, 0]}>
      <boxGeometry args={[0.08, 0.08, 0.08]} />
      <meshBasicMaterial color="#ffcc00" transparent opacity={0.8} />
    </instancedMesh>
  );
}

// ── Campsite — enhanced with clutter ─────────────────────────────
export function Campsite({ playersSleeping }: { playersSleeping: number }) {
  return (
    <group position={[-220, 0, 80]}>
      {playersSleeping > 0 && (
        <Html position={[0, 5, 0]} center>
          <div className="text-white font-bold text-2xl drop-shadow-md animate-bounce">
            Zzz...
          </div>
        </Html>
      )}

      {/* Tent 1 — teal */}
      <group position={[0, 0, -4]} rotation={[0, 0.5, 0]}>
        <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
          <coneGeometry args={[3, 3, 4]} />
          <meshStandardMaterial color="#2b596e" roughness={0.9} flatShading />
        </mesh>
        {/* Tent entrance flap */}
        <mesh position={[1.5, 0.5, 1.5]} rotation={[0, 0.5, 0.4]} castShadow>
          <planeGeometry args={[1.5, 2]} />
          <meshStandardMaterial color="#3a7a8e" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Tent 2 — orange */}
      <group position={[6, 0, 4]} rotation={[0, -0.8, 0]}>
        <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
          <coneGeometry args={[3, 3, 4]} />
          <meshStandardMaterial color="#c27236" roughness={0.9} flatShading />
        </mesh>
      </group>

      {/* Seating logs */}
      <mesh position={[3, 0.4, -1]} rotation={[Math.PI / 2, 0, 0.5]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 3, 8]} />
        <meshStandardMaterial color="#594635" roughness={1} flatShading />
      </mesh>
      <mesh position={[-1, 0.4, 2]} rotation={[Math.PI / 2, 0, -0.3]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 3, 8]} />
        <meshStandardMaterial color="#594635" roughness={1} flatShading />
      </mesh>

      {/* Cooler */}
      <group position={[4, 0, -3]} rotation={[0, 0.8, 0]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1.5, 1, 1]} />
          <meshStandardMaterial color="#c93636" roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.05, 0]} castShadow>
          <boxGeometry args={[1.55, 0.2, 1.05]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
      </group>

      {/* Picnic table */}
      <group position={[-5, 0, -2]} rotation={[0, 0.3, 0]}>
        {/* Table top */}
        <mesh position={[0, 1.0, 0]} castShadow>
          <boxGeometry args={[3, 0.15, 1.5]} />
          <meshStandardMaterial color="#6a5030" roughness={0.9} />
        </mesh>
        {/* Table legs */}
        {[[-1.2, -0.6], [1.2, -0.6], [-1.2, 0.6], [1.2, 0.6]].map(([x, z], i) => (
          <mesh key={`tleg-${i}`} position={[x, 0.5, z]} castShadow>
            <boxGeometry args={[0.15, 1.0, 0.15]} />
            <meshStandardMaterial color="#5a4020" roughness={1} />
          </mesh>
        ))}
        {/* Bench seats */}
        <mesh position={[0, 0.5, -1.2]} castShadow>
          <boxGeometry args={[2.5, 0.1, 0.6]} />
          <meshStandardMaterial color="#6a5030" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.5, 1.2]} castShadow>
          <boxGeometry args={[2.5, 0.1, 0.6]} />
          <meshStandardMaterial color="#6a5030" roughness={0.9} />
        </mesh>
      </group>

      {/* Backpack near tent */}
      <mesh position={[2, 0.5, -5]} rotation={[0.3, 0.5, 0]} castShadow>
        <boxGeometry args={[0.8, 1.2, 0.5]} />
        <meshStandardMaterial color="#3a6a50" roughness={0.8} flatShading />
      </mesh>

      {/* Lantern on post */}
      <group position={[-3, 0, 5]}>
        <mesh position={[0, 1.0, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 2, 4]} />
          <meshStandardMaterial color="#5a4a3a" roughness={1} />
        </mesh>
        <mesh position={[0, 2.1, 0]} castShadow>
          <boxGeometry args={[0.4, 0.5, 0.4]} />
          <meshStandardMaterial color="#d4a030" roughness={0.5} metalness={0.3} />
        </mesh>
        <pointLight position={[0, 2.1, 0]} intensity={0.8} color="#ffeaa7" distance={12} decay={2} />
      </group>

      {/* Dynamic Crates */}
      <group position={[-8, 0, 5]}>
        {[
          { pos: [0, 0.6, 0] as [number, number, number] },
          { pos: [0, 1.8, 0] as [number, number, number] },
          { pos: [0, 3.0, 0] as [number, number, number] }
        ].map((crate, i) => (
          <RigidBody key={`crate-${i}`} position={crate.pos} colliders="cuboid" mass={2} restitution={0.1}>
            <mesh castShadow>
              <boxGeometry args={[1.1, 1.1, 1.1]} />
              <meshStandardMaterial color="#8b7355" roughness={0.9} />
            </mesh>
            <mesh castShadow>
              <boxGeometry args={[1.15, 1.15, 1.15]} />
              <meshStandardMaterial color="#5a4020" roughness={1} wireframe />
            </mesh>
          </RigidBody>
        ))}
      </group>

      {/* String lights between trees (decorative) */}
      {[[-8, 3.5, -8], [-4, 3.2, 0], [0, 3.5, 6], [4, 3.3, 3]].map(([x, y, z], i) => (
        <pointLight key={`slight-${i}`} position={[x, y, z]} intensity={0.3} color="#fff5d6" distance={6} decay={2} />
      ))}
    </group>
  );
}

// ── Surf Beach — enhanced with beach life ────────────────────────
export function SurfBeach() {
  return (
    <group position={[-80, 0, -380]}>
      {/* Sandy beach area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[120, 100]} />
        <meshStandardMaterial color="#e8cc8a" roughness={1} />
      </mesh>

      {/* Surfboards stuck in sand */}
      <mesh position={[-8, 1.5, 10]} rotation={[0.2, 0.5, 0.1]} castShadow>
        <boxGeometry args={[1, 4, 0.15]} />
        <meshStandardMaterial color="#00e5ff" roughness={0.4} />
      </mesh>
      <mesh position={[-6, 1.2, 12]} rotation={[0.3, -0.2, -0.1]} castShadow>
        <boxGeometry args={[0.9, 3.5, 0.15]} />
        <meshStandardMaterial color="#ff3366" roughness={0.4} />
      </mesh>
      <mesh position={[-10, 1.0, 8]} rotation={[0.15, 0.8, 0.15]} castShadow>
        <boxGeometry args={[0.85, 3.8, 0.15]} />
        <meshStandardMaterial color="#ffcc00" roughness={0.4} />
      </mesh>

      {/* Beach umbrellas — multiple with striped colors */}
      {[
        { pos: [12, 0, 5] as [number,number,number], color1: '#f0d556', color2: '#ffffff' },
        { pos: [-15, 0, -5] as [number,number,number], color1: '#ff6b6b', color2: '#ffffff' },
        { pos: [25, 0, -8] as [number,number,number], color1: '#4ecdc4', color2: '#ffffff' },
      ].map((umb, i) => (
        <group key={`umb-${i}`} position={umb.pos}>
          <mesh position={[0, 3, 0]} castShadow>
            <coneGeometry args={[3, 1.5, 12]} />
            <meshStandardMaterial color={umb.color1} roughness={0.8} flatShading />
          </mesh>
          <mesh position={[0, 1.5, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.08, 3, 6]} />
            <meshStandardMaterial color="#999" roughness={0.8} />
          </mesh>
          {/* Beach towel */}
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI/2, 0, i * 0.5]}>
            <planeGeometry args={[3.5, 5]} />
            <meshStandardMaterial color={umb.color1} roughness={1} transparent opacity={0.8} />
          </mesh>
        </group>
      ))}

      {/* Lifeguard tower */}
      <group position={[30, 0, -15]}>
        {/* Stilts */}
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z], i) => (
          <mesh key={`stilt-${i}`} position={[x, 2, z]} castShadow>
            <cylinderGeometry args={[0.15, 0.2, 4, 6]} />
            <meshStandardMaterial color="#c4a060" roughness={0.9} />
          </mesh>
        ))}
        {/* Platform */}
        <mesh position={[0, 4, 0]} castShadow>
          <boxGeometry args={[3, 0.2, 3]} />
          <meshStandardMaterial color="#c4a060" roughness={0.9} />
        </mesh>
        {/* Cabin */}
        <mesh position={[0, 5.2, 0]} castShadow>
          <boxGeometry args={[2.5, 2, 2.5]} />
          <meshStandardMaterial color="#e8d5a3" roughness={0.85} flatShading />
        </mesh>
        {/* Roof */}
        <mesh position={[0, 6.5, 0]} castShadow>
          <coneGeometry args={[2, 1.2, 4]} />
          <meshStandardMaterial color="#bd5c5c" roughness={0.8} flatShading />
        </mesh>
      </group>

      {/* Volleyball net */}
      <group position={[-25, 0, 5]}>
        {/* Poles */}
        <mesh position={[-4, 1.5, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 3, 6]} />
          <meshStandardMaterial color="#888" roughness={0.8} />
        </mesh>
        <mesh position={[4, 1.5, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 3, 6]} />
          <meshStandardMaterial color="#888" roughness={0.8} />
        </mesh>
        {/* Net (simplified as a thin box) */}
        <mesh position={[0, 2.2, 0]}>
          <boxGeometry args={[8, 1.2, 0.05]} />
          <meshStandardMaterial color="#ffffff" roughness={0.9} transparent opacity={0.5} wireframe />
        </mesh>
      </group>

      {/* Sandcastle */}
      <group position={[5, 0, -15]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[1, 1.3, 0.8, 8]} />
          <meshStandardMaterial color="#d4b878" roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 1.0, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.8, 0.5, 8]} />
          <meshStandardMaterial color="#d4b878" roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 1.4, 0]} castShadow>
          <coneGeometry args={[0.4, 0.6, 6]} />
          <meshStandardMaterial color="#d4b878" roughness={1} flatShading />
        </mesh>
      </group>

      {/* Driftwood scattered on the sand */}
      {[
        { pos: [-20, 0.1, -15] as [number,number,number], rot: [0, 0.6, 0] as [number,number,number] },
        { pos: [25, 0.2, -5] as [number,number,number], rot: [0, -0.4, 0.1] as [number,number,number] },
        { pos: [5, 0.1, 25] as [number,number,number], rot: [0, 1.2, 0] as [number,number,number] },
        { pos: [-30, 0.1, 20] as [number,number,number], rot: [0, 0.9, 0] as [number,number,number] },
        { pos: [40, 0.15, -3] as [number,number,number], rot: [0.1, -0.6, 0] as [number,number,number] },
      ].map((dw, i) => (
        <group key={`dw-${i}`} position={dw.pos} rotation={dw.rot}>
          <mesh castShadow>
            <cylinderGeometry args={[0.2 + i * 0.05, 0.3 + i * 0.05, 3 + i * 0.5, 7]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#8b7355" : "#9c876b"} roughness={1} flatShading />
          </mesh>
        </group>
      ))}

      {/* Seashells */}
      {[[-3, -20], [8, -18], [-12, -22], [15, -16]].map(([x, z], i) => (
        <mesh key={`shell-${i}`} position={[x, 0.06, z]} rotation={[-Math.PI / 2, 0, i * 1.3]}>
          <circleGeometry args={[0.3 + i * 0.1, 5]} />
          <meshStandardMaterial color="#f0e0d0" roughness={0.8} flatShading />
        </mesh>
      ))}

      {/* Wooden Bench */}
      <group position={[-15, 0, -25]} rotation={[0, 0.4, 0]}>
        {/* Seat */}
        <mesh position={[0, 0.7, 0]} castShadow>
          <boxGeometry args={[4, 0.15, 1.2]} />
          <meshStandardMaterial color="#8b7355" roughness={0.9} />
        </mesh>
        {/* Backrest */}
        <mesh position={[0, 1.3, -0.5]} rotation={[0.2, 0, 0]} castShadow>
          <boxGeometry args={[4, 0.8, 0.15]} />
          <meshStandardMaterial color="#8b7355" roughness={0.9} />
        </mesh>
        {/* Legs */}
        {[[-1.5, -0.3], [1.5, -0.3], [-1.5, 0.3], [1.5, 0.3]].map(([x, z], i) => (
          <mesh key={`benchleg-${i}`} position={[x, 0.35, z]} castShadow>
            <boxGeometry args={[0.15, 0.7, 0.15]} />
            <meshStandardMaterial color="#5a4020" roughness={1} />
          </mesh>
        ))}
      </group>

      {/* Scattered Beach Towel & Flip-flops */}
      <group position={[18, 0, -22]} rotation={[0, -0.7, 0]}>
        {/* Towel */}
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[3, 6]} />
          <meshStandardMaterial color="#ff6b6b" roughness={1} />
        </mesh>
        {/* Towel stripes */}
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.5, 6]} />
          <meshStandardMaterial color="#ffffff" roughness={1} />
        </mesh>
        
        {/* Left Flip-flop */}
        <mesh position={[-1.2, 0.05, -3.2]} rotation={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[0.4, 0.08, 0.9]} />
          <meshStandardMaterial color="#4ecdc4" roughness={0.8} />
        </mesh>
        {/* Right Flip-flop */}
        <mesh position={[-0.5, 0.05, -3.5]} rotation={[0, -0.5, 0]} castShadow>
          <boxGeometry args={[0.4, 0.08, 0.9]} />
          <meshStandardMaterial color="#4ecdc4" roughness={0.8} />
        </mesh>
      </group>

      {/* Bouncy Beach Ball (Physics) */}
      <RigidBody position={[0, 10, -5]} colliders="ball" restitution={0.9} mass={1}>
        <mesh castShadow>
          <sphereGeometry args={[2, 32, 32]} />
          <meshStandardMaterial color="#ff3366" roughness={0.2} />
        </mesh>
        {/* Beach ball stripes */}
        <mesh castShadow rotation={[0, Math.PI / 2, 0]}>
          <sphereGeometry args={[2.01, 32, 32, 0, Math.PI / 4]} />
          <meshStandardMaterial color="#00e5ff" roughness={0.2} side={THREE.DoubleSide} />
        </mesh>
        <mesh castShadow rotation={[0, -Math.PI / 2, 0]}>
          <sphereGeometry args={[2.01, 32, 32, 0, Math.PI / 4]} />
          <meshStandardMaterial color="#ffcc00" roughness={0.2} side={THREE.DoubleSide} />
        </mesh>
      </RigidBody>

      {/* Car Soccer Goals */}
      <group position={[0, 0, -5]}>
        {/* Goal 1 (Left) */}
        <group position={[-25, 0, 0]}>
          <mesh position={[0, 2, -5]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 4]} />
            <meshStandardMaterial color="#ffffff" roughness={0.6} />
          </mesh>
          <mesh position={[0, 2, 5]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 4]} />
            <meshStandardMaterial color="#ffffff" roughness={0.6} />
          </mesh>
          <mesh position={[0, 4, 0]} rotation={[Math.PI/2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 10]} />
            <meshStandardMaterial color="#ffffff" roughness={0.6} />
          </mesh>
        </group>
        {/* Goal 2 (Right) */}
        <group position={[25, 0, 0]}>
          <mesh position={[0, 2, -5]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 4]} />
            <meshStandardMaterial color="#ffffff" roughness={0.6} />
          </mesh>
          <mesh position={[0, 2, 5]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 4]} />
            <meshStandardMaterial color="#ffffff" roughness={0.6} />
          </mesh>
          <mesh position={[0, 4, 0]} rotation={[Math.PI/2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 10]} />
            <meshStandardMaterial color="#ffffff" roughness={0.6} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ── Lighthouse — new component ───────────────────────────────────
export function Lighthouse() {
  const beaconRef = useRef<THREE.SpotLight>(null);

  useFrame(({ clock }) => {
    if (beaconRef.current) {
      const angle = clock.getElapsedTime() * 1.5;
      beaconRef.current.target.position.set(
        400 + Math.cos(angle) * 100,
        0,
        380 + Math.sin(angle) * 100
      );
      beaconRef.current.target.updateMatrixWorld();
    }
  });

  return (
    <group position={[400, 0, 380]}>
      {/* Tower base — wider cylinder */}
      <mesh position={[0, 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[4, 5, 4, 12]} />
        <meshStandardMaterial color="#e8e0d4" roughness={0.7} flatShading />
      </mesh>
      {/* Tower mid section */}
      <mesh position={[0, 7, 0]} castShadow>
        <cylinderGeometry args={[3.2, 4, 6, 12]} />
        <meshStandardMaterial color="#e8e0d4" roughness={0.7} flatShading />
      </mesh>
      {/* Red stripe */}
      <mesh position={[0, 10.5, 0]} castShadow>
        <cylinderGeometry args={[3, 3.2, 1, 12]} />
        <meshStandardMaterial color="#c44040" roughness={0.7} />
      </mesh>
      {/* Tower upper section */}
      <mesh position={[0, 13, 0]} castShadow>
        <cylinderGeometry args={[2.5, 3, 4, 12]} />
        <meshStandardMaterial color="#e8e0d4" roughness={0.7} flatShading />
      </mesh>
      {/* Lantern room */}
      <mesh position={[0, 15.5, 0]} castShadow>
        <cylinderGeometry args={[2.8, 2.5, 1.5, 8]} />
        <meshStandardMaterial color="#333" roughness={0.5} metalness={0.3} />
      </mesh>
      {/* Glass panels (simplified) */}
      <mesh position={[0, 15.5, 0]}>
        <cylinderGeometry args={[2.6, 2.3, 1.3, 8]} />
        <meshStandardMaterial color="#ffeaa7" roughness={0.1} metalness={0.2} transparent opacity={0.6} />
      </mesh>
      {/* Red cap */}
      <mesh position={[0, 17, 0]} castShadow>
        <coneGeometry args={[3, 2.5, 8]} />
        <meshStandardMaterial color="#c44040" roughness={0.7} flatShading />
      </mesh>

      {/* Rotating beacon light */}
      <spotLight
        ref={beaconRef}
        position={[0, 15.5, 0]}
        angle={0.15}
        penumbra={0.5}
        intensity={8}
        color="#ffeaa7"
        distance={200}
        castShadow
      />

      {/* Keeper's cottage at base */}
      <group position={[-12, 0.5, 8]}>
        <mesh position={[0, 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[8, 4, 6]} />
          <meshStandardMaterial color="#c8b898" roughness={0.85} flatShading />
        </mesh>
        <mesh position={[0, 4.5, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[6, 3, 4]} />
          <meshStandardMaterial color="#6a5a4a" roughness={0.9} flatShading />
        </mesh>
        {/* Door */}
        <mesh position={[0, 1.2, 3.05]}>
          <boxGeometry args={[1.5, 2.4, 0.1]} />
          <meshStandardMaterial color="#5a4020" roughness={0.9} />
        </mesh>
        {/* Window */}
        <mesh position={[3, 2.5, 3.05]}>
          <boxGeometry args={[1.5, 1.2, 0.1]} />
          <meshStandardMaterial color="#a8d8ea" roughness={0.2} metalness={0.3} />
        </mesh>
      </group>

      {/* Low stone wall perimeter */}
      {Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const r = 20;
        return (
          <mesh key={`wall-${i}`} position={[Math.cos(angle) * r, 0.5, Math.sin(angle) * r]} rotation={[0, -angle, 0]} castShadow>
            <boxGeometry args={[8.5, 1.5, 1]} />
            <meshStandardMaterial color="#7a7570" roughness={0.95} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Driftwood Village — new component ────────────────────────────
export function DriftwoodVillage() {
  return (
    <group position={[300, 0, -200]}>
      {/* Packed dirt ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]} receiveShadow>
        <circleGeometry args={[30, 16]} />
        <meshStandardMaterial color="#c4a878" roughness={1} transparent opacity={0.6} />
      </mesh>

      {/* Cottage 1 — seafoam */}
      <group position={[-10, 0, -5]} rotation={[0, 0.3, 0]}>
        <mesh position={[0, 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[6, 4, 5]} />
          <meshStandardMaterial color="#a8dbd0" roughness={0.85} flatShading />
        </mesh>
        <mesh position={[0, 4.5, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[4.5, 2.5, 4]} />
          <meshStandardMaterial color="#6a5a4a" roughness={0.9} flatShading />
        </mesh>
        <mesh position={[0, 1.2, 2.55]}>
          <boxGeometry args={[1.2, 2.2, 0.1]} />
          <meshStandardMaterial color="#5a4020" roughness={0.9} />
        </mesh>
      </group>

      {/* Cottage 2 — butter yellow */}
      <group position={[8, 0, -8]} rotation={[0, -0.4, 0]}>
        <mesh position={[0, 2.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[7, 4.4, 5.5]} />
          <meshStandardMaterial color="#f0dca0" roughness={0.85} flatShading />
        </mesh>
        <mesh position={[0, 5, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[5, 2.5, 4]} />
          <meshStandardMaterial color="#8a6a4a" roughness={0.9} flatShading />
        </mesh>
        <mesh position={[0, 1.5, 2.8]}>
          <boxGeometry args={[1.2, 2.2, 0.1]} />
          <meshStandardMaterial color="#5a4020" roughness={0.9} />
        </mesh>
        <mesh position={[2.5, 2.8, 2.8]}>
          <boxGeometry args={[1.5, 1.2, 0.1]} />
          <meshStandardMaterial color="#a8d8ea" roughness={0.2} metalness={0.3} />
        </mesh>
      </group>

      {/* Cottage 3 — coral */}
      <group position={[-5, 0, 10]} rotation={[0, 0.8, 0]}>
        <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
          <boxGeometry args={[5, 3.6, 4.5]} />
          <meshStandardMaterial color="#e8a888" roughness={0.85} flatShading />
        </mesh>
        <mesh position={[0, 4, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[4, 2, 4]} />
          <meshStandardMaterial color="#7a6a5a" roughness={0.9} flatShading />
        </mesh>
        <mesh position={[0, 1, 2.3]}>
          <boxGeometry args={[1.1, 2, 0.1]} />
          <meshStandardMaterial color="#5a4020" roughness={0.9} />
        </mesh>
      </group>

      {/* Cottage 4 — white with blue trim */}
      <group position={[12, 0, 8]} rotation={[0, -0.2, 0]}>
        <mesh position={[0, 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[5.5, 4, 5]} />
          <meshStandardMaterial color="#e8e4dc" roughness={0.85} flatShading />
        </mesh>
        <mesh position={[0, 3.8, 2.55]}>
          <boxGeometry args={[5.6, 0.4, 0.12]} />
          <meshStandardMaterial color="#4a7a9a" roughness={0.7} />
        </mesh>
        <mesh position={[0, 4.5, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[4.2, 2.2, 4]} />
          <meshStandardMaterial color="#4a7a9a" roughness={0.9} flatShading />
        </mesh>
      </group>

      {/* Wooden dock extending into ocean */}
      <group position={[20, 0, 15]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[3, 0.25, 15]} />
          <meshStandardMaterial color="#78593a" roughness={0.9} />
        </mesh>
        {[0, 3, 6, 9, 12].map(z => (
          <mesh key={`dpost-${z}`} position={[0, -0.6, -7 + z]} castShadow>
            <cylinderGeometry args={[0.15, 0.15, 1.8, 4]} />
            <meshStandardMaterial color="#5a4020" roughness={1} />
          </mesh>
        ))}
      </group>

      {/* Boat hull on shore */}
      <group position={[-15, 0.3, 15]} rotation={[0, 0.6, 0.1]}>
        <mesh castShadow>
          <boxGeometry args={[2, 1, 5]} />
          <meshStandardMaterial color="#6a8aaa" roughness={0.8} flatShading />
        </mesh>
        {/* Boat interior */}
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[1.5, 0.3, 4.5]} />
          <meshStandardMaterial color="#8a7a5a" roughness={0.9} />
        </mesh>
      </group>

      {/* Stacked lobster traps */}
      <group position={[18, 0, -5]}>
        {[0, 0.8, 1.6].map((y, i) => (
          <mesh key={`trap-${i}`} position={[i * 0.3, 0.4 + y, 0]} rotation={[0, i * 0.3, 0]} castShadow>
            <boxGeometry args={[1.5, 0.8, 1]} />
            <meshStandardMaterial color="#7a6a50" roughness={0.9} wireframe={i === 2} />
          </mesh>
        ))}
      </group>

      {/* String lights between buildings */}
      {[[-5, 4, -5], [5, 3.8, 0], [10, 4.2, 5], [0, 3.5, 8]].map(([x, y, z], i) => (
        <pointLight key={`vlight-${i}`} position={[x, y, z]} intensity={0.5} color="#fff5d6" distance={8} decay={2} />
      ))}
    </group>
  );
}

// ── Fences ────────────────────────────────────────────────────────
export function Fences() {
  return (
    <>
      {FENCE_POSITIONS.map((f, fi) => (
        <group key={`fence-${fi}`} position={f.start} rotation={[0, f.angle, 0]}>
          {Array.from({ length: f.segments }, (_, si) => (
            <group key={`seg-${si}`} position={[si * 3, 0, 0]}>
              {/* Posts */}
              <mesh position={[0, 0.6, 0]} castShadow>
                <cylinderGeometry args={[0.08, 0.1, 1.2, 4]} />
                <meshStandardMaterial color="#6a5030" roughness={1} flatShading />
              </mesh>
              <mesh position={[3, 0.6, 0]} castShadow>
                <cylinderGeometry args={[0.08, 0.1, 1.2, 4]} />
                <meshStandardMaterial color="#6a5030" roughness={1} flatShading />
              </mesh>
              {/* Rails */}
              <mesh position={[1.5, 0.9, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <boxGeometry args={[0.08, 3, 0.08]} />
                <meshStandardMaterial color="#7a6040" roughness={1} />
              </mesh>
              <mesh position={[1.5, 0.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
                <boxGeometry args={[0.08, 3, 0.08]} />
                <meshStandardMaterial color="#7a6040" roughness={1} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </>
  );
}

// ── Seagrass ─────────────────────────────────────────────────────
export function Seagrass() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const time = clock.getElapsedTime();
    groupRef.current.children.forEach((child, i) => {
      child.rotation.z = Math.sin(time * 1.5 + i * 0.5) * 0.08;
      child.rotation.x = Math.sin(time * 1.2 + i * 0.7) * 0.05;
    });
  });

  return (
    <group ref={groupRef}>
      {SEAGRASS_POSITIONS.map((sg, i) => (
        <group key={`sg-${i}`} position={sg.pos}>
          {[0, 1, 2].map(j => (
            <mesh key={j} position={[j * 0.3 - 0.3, 0.8 * sg.s, j * 0.2 - 0.2]} castShadow>
              <coneGeometry args={[0.08, 1.6 * sg.s, 3]} />
              <meshStandardMaterial
                color={j === 0 ? "#4a7a3a" : j === 1 ? "#5a8a4a" : "#3a6a2a"}
                roughness={1}
                flatShading
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ── Wildflower Patches ───────────────────────────────────────────
export function WildflowerPatches() {
  return (
    <>
      {WILDFLOWER_CLUSTERS.map((wf, i) => (
        <group key={`wf-${i}`} position={wf.pos}>
          {Array.from({ length: wf.count }, (_, j) => {
            const angle = (j / wf.count) * Math.PI * 2;
            const r = 0.5 + (j % 3) * 0.4;
            return (
              <group key={j} position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}>
                {/* Stem */}
                <mesh position={[0, 0.25, 0]}>
                  <cylinderGeometry args={[0.02, 0.02, 0.5, 3]} />
                  <meshStandardMaterial color="#4a8a3a" roughness={1} />
                </mesh>
                {/* Flower head */}
                <mesh position={[0, 0.5, 0]}>
                  <sphereGeometry args={[0.1 + (j % 2) * 0.05, 5, 4]} />
                  <meshStandardMaterial color={wf.color} roughness={0.8} flatShading />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
    </>
  );
}

// ── Driftwood Scatter ────────────────────────────────────────────
export function DriftwoodScatter() {
  return (
    <>
      {DRIFTWOOD_SCATTER.map((dw, i) => (
        <mesh key={`dws-${i}`} position={dw.pos} rotation={[Math.PI / 2 + (dw.rot?.[0] ?? 0), dw.rot?.[1] ?? 0, dw.rot?.[2] ?? 0]} scale={dw.s} castShadow>
          <cylinderGeometry args={[0.15, 0.3, 3, 6]} />
          <meshStandardMaterial
            color={i % 3 === 0 ? "#8b7355" : i % 3 === 1 ? "#9c876b" : "#7a6345"}
            roughness={1}
            flatShading
          />
        </mesh>
      ))}
    </>
  );
}
