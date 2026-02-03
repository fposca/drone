import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export function WarDroneModel() {
  const rotors = useRef<THREE.Mesh[]>([]);

  useFrame((_, dt) => {
    for (const r of rotors.current) if (r) r.rotation.y += dt * 28;
  });

  const mats = useMemo(() => {
    return {
      body: new THREE.MeshStandardMaterial({ color: '#2a2f2a', roughness: 0.75, metalness: 0.15 }),
      body2: new THREE.MeshStandardMaterial({ color: '#3a3f34', roughness: 0.78, metalness: 0.10 }),
      arm: new THREE.MeshStandardMaterial({ color: '#1f221f', roughness: 0.85, metalness: 0.10 }),
      rotor: new THREE.MeshStandardMaterial({ color: '#0f1010', roughness: 0.6, metalness: 0.2 }),
      glass: new THREE.MeshStandardMaterial({ color: '#1b2f3a', roughness: 0.2, metalness: 0.25, transparent: true, opacity: 0.25 }),
      accent: new THREE.MeshStandardMaterial({ color: '#7a8f2a', roughness: 0.65, metalness: 0.05 }),
    };
  }, []);

  const motorOffsets: [number, number, number][] = [
    [0.42, 0.05, 0.42],
    [-0.42, 0.05, 0.42],
    [0.42, 0.05, -0.42],
    [-0.42, 0.05, -0.42],
  ];

  return (
    <group>
      <mesh castShadow material={mats.body}>
        <boxGeometry args={[0.56, 0.28, 0.56]} />
      </mesh>

      <mesh castShadow position={[0, 0.17, 0]} material={mats.body2}>
        <cylinderGeometry args={[0.20, 0.28, 0.15, 24]} />
      </mesh>

      <mesh castShadow position={[0, 0.19, 0.20]} material={mats.glass}>
        <sphereGeometry args={[0.09, 24, 16]} />
      </mesh>

      {/* “panel camo” */}
      <mesh castShadow position={[0, 0.05, -0.20]} material={mats.accent}>
        <boxGeometry args={[0.28, 0.04, 0.10]} />
      </mesh>

      <mesh castShadow rotation={[0, Math.PI / 4, 0]} material={mats.arm}>
        <boxGeometry args={[1.10, 0.055, 0.13]} />
      </mesh>
      <mesh castShadow rotation={[0, -Math.PI / 4, 0]} material={mats.arm}>
        <boxGeometry args={[1.10, 0.055, 0.13]} />
      </mesh>

      {motorOffsets.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh castShadow material={mats.rotor}>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 24]} />
          </mesh>

          <mesh
            castShadow
            position={[0, 0.11, 0]}
            material={mats.rotor}
            ref={(el) => {
              if (el) rotors.current[i] = el;
            }}
          >
            <cylinderGeometry args={[0.20, 0.20, 0.008, 24]} />
          </mesh>

          <mesh castShadow position={[0, 0.125, 0]} material={mats.body2}>
            <cylinderGeometry args={[0.032, 0.032, 0.02, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
