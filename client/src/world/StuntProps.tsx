import { RigidBody } from '@react-three/rapier';
import { getTerrainHeight } from './constants';

interface RampProps {
  position: [number, number, number];
  rotation: [number, number, number];
}

export function WoodenRamp({ position, rotation }: RampProps) {
  // Adjust the Y position based on terrain height so it sits nicely on the ground
  const terrainY = getTerrainHeight(position[0], position[2]);
  
  return (
    <RigidBody type="fixed" colliders="cuboid" position={[position[0], terrainY + 1.2, position[2]]} rotation={rotation}>
      <group rotation={[-0.3, 0, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[4, 0.4, 10]} />
          <meshStandardMaterial color="#8b7355" roughness={1} />
        </mesh>
        {/* Ramp supports */}
        <mesh position={[-1.8, -1.2, -4]} castShadow>
          <boxGeometry args={[0.2, 2.4, 0.2]} />
          <meshStandardMaterial color="#5a4020" roughness={1} />
        </mesh>
        <mesh position={[1.8, -1.2, -4]} castShadow>
          <boxGeometry args={[0.2, 2.4, 0.2]} />
          <meshStandardMaterial color="#5a4020" roughness={1} />
        </mesh>
        <mesh position={[-1.8, -0.6, 0]} castShadow>
          <boxGeometry args={[0.2, 1.2, 0.2]} />
          <meshStandardMaterial color="#5a4020" roughness={1} />
        </mesh>
        <mesh position={[1.8, -0.6, 0]} castShadow>
          <boxGeometry args={[0.2, 1.2, 0.2]} />
          <meshStandardMaterial color="#5a4020" roughness={1} />
        </mesh>
      </group>
    </RigidBody>
  );
}

export function StuntProps() {
  return (
    <group>
      {/* Ramps scattered around the map - Temporarily removed as they obstruct the road and have physics issues */}
      {/* 
      <WoodenRamp position={[80, 0, -38]} rotation={[0, 1.85, 0]} />
      <WoodenRamp position={[320, 0, -155]} rotation={[0, 2.62, 0]} />
      <WoodenRamp position={[-175, 0, 180]} rotation={[0, 0.89, 0]} />
      <WoodenRamp position={[180, 0, 225]} rotation={[0, 1.32, 0]} />
      */}
    </group>
  );
}
