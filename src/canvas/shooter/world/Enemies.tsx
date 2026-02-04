import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Enemy = {
  id: number;
  pos: THREE.Vector3;
  alive: boolean;
  hp: number;
  fireCooldown: number; // seconds
};

type Props = {
  level: Level;
  runId: number;
  playerPosRef: React.MutableRefObject<THREE.Vector3>; // (por ahora no se usa acá, lo dejamos)
  onEnemyKilled: () => void; // (lo sigue usando tu lógica de score, aunque el kill real lo decide BulletSystem)
};

type Explosion = {
  id: number;
  pos: THREE.Vector3;
  t: number;
  dur: number;
  // mini partículas
  dirs: THREE.Vector3[];
};

export function Enemies({ level, runId }: Props) {
  // Enemies “viven” en un ref global para que BulletSystem los lea
  const enemiesRef = useRef<Enemy[]>([]);
  (globalThis as any).__enemiesRef = enemiesRef;

  // “tick” para forzar re-render cuando BulletSystem muta el ref
  const [, bump] = useState(0);
  useEffect(() => {
    (globalThis as any).__enemiesBump = () => bump((v) => v + 1);
    return () => {
      if ((globalThis as any).__enemiesBump) delete (globalThis as any).__enemiesBump;
    };
  }, []);

  // Explosiones (estado real, para que React renderice)
  const [explosions, setExplosions] = useState<Explosion[]>([]);
  useEffect(() => {
    (globalThis as any).__spawnEnemyExplosion = (p: THREE.Vector3) => {
      const id = Math.floor(Math.random() * 1e9);
      const dirs = Array.from({ length: 10 }, () => {
        const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5);
        return v.normalize().multiplyScalar(1.4 + Math.random() * 1.6);
      });

      setExplosions((arr) => [
        ...arr,
        {
          id,
          pos: p.clone(),
          t: 0,
          dur: 0.45,
          dirs,
        },
      ]);
    };

    return () => {
      if ((globalThis as any).__spawnEnemyExplosion) delete (globalThis as any).__spawnEnemyExplosion;
    };
  }, []);

  // seed estable
  const seed = useMemo(() => 2000 + runId * 333 + level * 17, [runId, level]);

  useEffect(() => {
    const rand = mulberry32(seed);

    const baseCount =
      level === 1 ? 3 :
      level === 2 ? 4 :
      level === 3 ? 5 :
      level === 4 ? 6 :
      level === 5 ? 7 :
      level === 6 ? 8 :
      level === 7 ? 9 : 10;

    const hpBase = level <= 3 ? 1 : level <= 6 ? 2 : 3;

    const list: Enemy[] = [];
    for (let i = 0; i < baseCount; i++) {
      const x = (rand() - 0.5) * 26;
      const y = 2.2 + rand() * 4.5;
      const z = -18 - rand() * 80;

      list.push({
        id: i,
        pos: new THREE.Vector3(x, y, z),
        alive: true,
        hp: hpBase,
        fireCooldown: 0.7 + rand() * 0.6,
      });
    }

    enemiesRef.current = list;

    // limpiamos explosiones al reiniciar run/level
    setExplosions([]);
    // fuerza render
    bump((v) => v + 1);
  }, [seed]);

  // animación de explosiones
  useFrame((_, dt) => {
    if (!explosions.length) return;

    setExplosions((arr) => {
      const next = arr
        .map((e) => ({ ...e, t: e.t + dt }))
        .filter((e) => e.t < e.dur);
      return next;
    });
  });

  return (
    <>
      {/* Enemigos vivos */}
      {enemiesRef.current.map((e) =>
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

            {/* “ojo” */}
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

      {/* Explosiones */}
      {explosions.map((ex) => {
        const a = 1 - ex.t / ex.dur;
        const r = 0.35 + ex.t * 2.2;

        return (
          <group key={ex.id} position={[ex.pos.x, ex.pos.y, ex.pos.z]}>
            {/* flash */}
            <mesh>
              <sphereGeometry args={[r, 16, 12]} />
              <meshBasicMaterial transparent opacity={0.25 * a} toneMapped={false} />
            </mesh>

            {/* partículas */}
            {ex.dirs.map((d, i) => {
              const p = d.clone().multiplyScalar(ex.t * 2.2);
              return (
                <mesh key={i} position={[p.x, p.y, p.z]}>
                  <sphereGeometry args={[0.06, 10, 8]} />
                  <meshBasicMaterial transparent opacity={0.85 * a} toneMapped={false} />
                </mesh>
              );
            })}
          </group>
        );
      })}
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
