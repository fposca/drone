import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

export function DroneModel() {
  const rotors = useRef<THREE.Mesh[]>([]);

  useFrame((_, dt) => {
    // girar hélices
    for (const r of rotors.current) {
      if (r) r.rotation.y += dt * 25;
    }
  });

  const mats = useMemo(() => {
    return {
      body: new THREE.MeshStandardMaterial({
        color: '#1e1e1e',
        roughness: 0.55,
        metalness: 0.35,
      }),
      arm: new THREE.MeshStandardMaterial({
        color: '#2b2b2b',
        roughness: 0.6,
        metalness: 0.25,
      }),
      rotor: new THREE.MeshStandardMaterial({
        color: '#111111',
        roughness: 0.4,
        metalness: 0.2,
      }),
      glass: new THREE.MeshStandardMaterial({
        color: '#2a8cff',
        roughness: 0.15,
        metalness: 0.2,
        transparent: true,
        opacity: 0.35,
      }),
      accent: new THREE.MeshStandardMaterial({
        color: '#ff6a00',
        roughness: 0.5,
        metalness: 0.2,
      }),
      legs: new THREE.MeshStandardMaterial({
        color: '#1b1b1b',
        roughness: 0.8,
        metalness: 0.05,
      }),
    };
  }, []);

  // offsets de motores (un poquito más separados)
  const motorOffsets: [number, number, number][] = [
    [0.4, 0.05, 0.4],
    [-0.4, 0.05, 0.4],
    [0.4, 0.05, -0.4],
    [-0.4, 0.05, -0.4],
  ];

  return (
    <group>
      {/* cuerpo principal (más alto) */}
      <mesh castShadow material={mats.body}>
        <boxGeometry args={[0.52, 0.26, 0.52]} />
      </mesh>

      {/* “tapa” superior para dar volumen */}
      <mesh castShadow position={[0, 0.16, 0]} material={mats.body}>
        <cylinderGeometry args={[0.18, 0.25, 0.14, 24]} />
      </mesh>

      {/* “cúpula” tipo cámara / vidrio (un poco más arriba) */}
      <mesh castShadow position={[0, 0.18, 0.18]} material={mats.glass}>
        <sphereGeometry args={[0.085, 24, 16]} />
      </mesh>

      {/* detalle naranja */}
      <mesh castShadow position={[0, 0.08, -0.18]} material={mats.accent}>
        <boxGeometry args={[0.20, 0.035, 0.09]} />
      </mesh>

      {/* brazos en X (un toque más gruesos) */}
      <mesh castShadow rotation={[0, Math.PI / 4, 0]} material={mats.arm}>
        <boxGeometry args={[1.05, 0.05, 0.12]} />
      </mesh>
      <mesh castShadow rotation={[0, -Math.PI / 4, 0]} material={mats.arm}>
        <boxGeometry args={[1.05, 0.05, 0.12]} />
      </mesh>

      {/* patitas (para que no se vea chato) */}
      <mesh castShadow position={[0.18, -0.20, 0.18]} material={mats.legs}>
        <cylinderGeometry args={[0.02, 0.02, 0.22, 10]} />
      </mesh>
      <mesh castShadow position={[-0.18, -0.20, 0.18]} material={mats.legs}>
        <cylinderGeometry args={[0.02, 0.02, 0.22, 10]} />
      </mesh>
      <mesh castShadow position={[0.18, -0.20, -0.18]} material={mats.legs}>
        <cylinderGeometry args={[0.02, 0.02, 0.22, 10]} />
      </mesh>
      <mesh castShadow position={[-0.18, -0.20, -0.18]} material={mats.legs}>
        <cylinderGeometry args={[0.02, 0.02, 0.22, 10]} />
      </mesh>

      {/* motores + hélices (hélices más arriba) */}
      {motorOffsets.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          {/* motor */}
          <mesh castShadow material={mats.rotor}>
            <cylinderGeometry args={[0.065, 0.065, 0.06, 24]} />
          </mesh>

          {/* hélice (disco finito) */}
          <mesh
            castShadow
            position={[0, 0.10, 0]} // más arriba para que se note el volumen
            material={mats.rotor}
            ref={(el) => {
              if (el) rotors.current[i] = el;
            }}
          >
            <cylinderGeometry args={[0.19, 0.19, 0.008, 24]} />
          </mesh>

          {/* mini “hub” arriba de la hélice (detalle) */}
          <mesh castShadow position={[0, 0.115, 0]} material={mats.body}>
            <cylinderGeometry args={[0.03, 0.03, 0.02, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
