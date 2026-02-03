import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

type Enemy = {
  id: number;
  pos: THREE.Vector3;
  alive: boolean;
  hp: number;
  fireCooldown: number; // seconds
};

type Props = {
  level: Level;
  runId: number;
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  onEnemyKilled: () => void;
};

// Este componente SOLO renderiza y mantiene un registro de enemigos.
// La lógica de disparo / colisiones va en BulletSystem (para centralizar).
export function Enemies({ level, runId, onEnemyKilled }: Props) {
  const enemiesRef = (globalThis as any).__enemiesRef as React.MutableRefObject<Enemy[]> | undefined;

  // Creamos un ref global “privado” para que BulletSystem pueda leerlo sin prop drilling.
  // Si no te gusta, después lo pasamos como prop normal.
  const localRef = useRef<Enemy[]>([]);
  (globalThis as any).__enemiesRef = localRef;

  // seed simple
  const seed = useMemo(() => 2000 + runId * 333 + level * 17, [runId, level]);

  useEffect(() => {
    // respawn por runId/level
    const rand = mulberry32(seed);

    const baseCount = level === 1 ? 3 : level === 2 ? 4 : level === 3 ? 5 : level === 4 ? 6 : level === 5 ? 7 : level === 6 ? 8 : level === 7 ? 9 : 10;

    const list: Enemy[] = [];
    for (let i = 0; i < baseCount; i++) {
      const x = (rand() - 0.5) * 26;
      const y = 2.2 + rand() * 4.5;
      const z = -18 - rand() * 80;

      list.push({
        id: i,
        pos: new THREE.Vector3(x, y, z),
        alive: true,
        hp: 1,
        fireCooldown: 0.7 + rand() * 0.6,
      });
    }

    localRef.current = list;
  }, [seed]);

  // Render simple (sin rapier): meshes en posiciones del ref.
  // Si después querés rapier para enemigos, lo hacemos en una iteración.
  return (
    <>
      {localRef.current.map((e) =>
        e.alive ? (
          <group key={`${runId}-${level}-${e.id}`} position={[e.pos.x, e.pos.y, e.pos.z]}>
            <mesh castShadow>
              <sphereGeometry args={[0.55, 22, 16]} />
              <meshStandardMaterial
                color="#0f1410"
                roughness={0.65}
                metalness={0.25}
                emissive="#0b250f"
                emissiveIntensity={0.25}
              />
            </mesh>

            <mesh position={[0, 0.15, 0.45]}>
              <sphereGeometry args={[0.12, 16, 12]} />
              <meshStandardMaterial emissive="#00ff66" emissiveIntensity={2.0} color="#00ff66" />
            </mesh>

            <mesh position={[0, -0.35, 0]} castShadow>
              <cylinderGeometry args={[0.12, 0.22, 0.32, 14]} />
              <meshStandardMaterial color="#1c1f1c" roughness={0.75} metalness={0.12} />
            </mesh>
          </group>
        ) : null
      )}
    </>
  );
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
