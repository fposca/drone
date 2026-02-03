import { RigidBody } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import React, { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

type Props = {
  level: Level;
  runId: number;
  onCollect: (amount: number) => void;
};

type AmmoSpec = {
  id: number;
  base: THREE.Vector3;
  phase: number;
  amount: number;
};

function seededRandom(seed: number) {
  let t = seed + 0x6d2b79f5;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function AmmoVisual({ spin }: { spin: number }) {
  return (
    <group rotation={[0, spin, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.26, 0.18, 0.18]} />
        <meshStandardMaterial color="#2c3a2c" roughness={0.7} metalness={0.15} />
      </mesh>

      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.20, 0.06, 0.12]} />
        <meshStandardMaterial
          color="#7a8f2a"
          emissive="#7a8f2a"
          emissiveIntensity={0.35}
          roughness={0.6}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}

function AmmoBox({ spec, onCollect }: { spec: AmmoSpec; onCollect: (amount: number) => void }) {
  const rbRef = useRef<RapierRigidBody | null>(null);
  const collectQueuedRef = useRef(false);
  const lastCollectRef = useRef(0);

  const [alive, setAlive] = useState(true);
  const aliveRef = useRef(true);

  const spinRef = useRef(0);

  useFrame(({ clock }, dt) => {
    spinRef.current += dt * 1.8;

    if (collectQueuedRef.current) {
      collectQueuedRef.current = false;
      onCollect(spec.amount);
      aliveRef.current = false;
      setAlive(false);
    }

    const rb = rbRef.current;
    if (!rb || !aliveRef.current) return;

    const t = clock.getElapsedTime();
    const y = spec.base.y + Math.sin(t * 1.6 + spec.phase) * 0.15;

    const p = rb.translation();
    rb.setTranslation({ x: p.x, y, z: p.z }, true);
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
  });

  if (!alive) return null;

  return (
    <RigidBody
      ref={rbRef}
      type="kinematicPosition"
      colliders="cuboid"
      position={[spec.base.x, spec.base.y, spec.base.z]}
      userData={{ type: 'ammo' }}
      onCollisionEnter={(e) => {
        const otherType = (e.other.rigidBodyObject?.userData as any)?.type;
        if (otherType !== 'drone') return;

        const now = performance.now() / 1000;
        if (now - lastCollectRef.current < 0.25) return;
        lastCollectRef.current = now;

        collectQueuedRef.current = true;
      }}
    >
      <AmmoVisual spin={spinRef.current} />
    </RigidBody>
  );
}

export function AmmoPickups({ level, runId, onCollect }: Props) {
  const countByLevel: Record<Level, number> = useMemo(
    () => ({
      1: 3,
      2: 3,
      3: 3,
      4: 4,
      5: 4,
      6: 4,
      7: 5,
      8: 6,
    }),
    []
  );

  const ammoBoxes = useMemo<AmmoSpec[]>(() => {
    const rand = seededRandom(5000 + runId * 777 + level * 91);
    const count = countByLevel[level];

    const list: AmmoSpec[] = [];
    for (let i = 0; i < count; i++) {
      const x = (rand() - 0.5) * 24;
      const z = -8 - rand() * 78;
      const y = 1.2 + rand() * 3.2;
      const amount = 12 + Math.floor(rand() * 10); // 12..21

      list.push({
        id: i,
        base: new THREE.Vector3(x, y, z),
        phase: rand() * 10,
        amount,
      });
    }
    return list;
  }, [level, runId, countByLevel]);

  return (
    <>
      {ammoBoxes.map((spec) => (
        <AmmoBox key={`${runId}-${level}-${spec.id}`} spec={spec} onCollect={onCollect} />
      ))}
    </>
  );
}
