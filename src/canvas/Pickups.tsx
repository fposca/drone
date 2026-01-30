import { RigidBody } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type PickupsProps = {
  onCollect?: () => void;
  level?: number;
  count?: number;
  runId?: number; // ✅ NUEVO: cambia en cada reset / nivel
};

type CoinSpec = {
  id: number;
  base: THREE.Vector3;
  phase: number;
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

function CoinVisual({ spin }: { spin: number }) {
  return (
    <group rotation={[0, spin, 0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.06, 26]} />
        <meshStandardMaterial
          color="#f2c14e"
          roughness={0.25}
          metalness={0.85}
          emissive="#f2c14e"
          emissiveIntensity={0.25}
        />
      </mesh>

      <mesh>
        <torusGeometry args={[0.27, 0.03, 10, 26]} />
        <meshStandardMaterial color="#ffd66b" roughness={0.25} metalness={0.9} />
      </mesh>
    </group>
  );
}

function Coin({ spec, onCollect }: { spec: CoinSpec; onCollect?: () => void }) {
  const rbRef = useRef<RapierRigidBody | null>(null);

  const collectQueuedRef = useRef(false);
  const lastCollectRef = useRef(0);

  const [alive, setAlive] = useState(true);
  const aliveRef = useRef(true);

  const spinRef = useRef(0);

  useFrame(({ clock }, dt) => {
    spinRef.current += dt * 2.2;

    // ✅ ejecutar collect afuera del callback de colisión
    if (collectQueuedRef.current) {
      collectQueuedRef.current = false;
      onCollect?.();
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
      colliders="ball"
      position={[spec.base.x, spec.base.y, spec.base.z]}
      userData={{ type: 'pickup' }}
      onCollisionEnter={(e) => {
        const otherType = (e.other.rigidBodyObject?.userData as any)?.type;
        if (otherType !== 'drone') return;

        const now = performance.now() / 1000;
        if (now - lastCollectRef.current < 0.25) return;
        lastCollectRef.current = now;

        collectQueuedRef.current = true;
      }}
    >
      <CoinVisual spin={spinRef.current} />
    </RigidBody>
  );
}

export function Pickups({ onCollect, level = 1, count = 10, runId = 0 }: PickupsProps) {
  const coins = useMemo<CoinSpec[]>(() => {
    // ✅ seed depende de runId + level para que sea consistente por run
    const rand = seededRandom(9001 + runId * 999 + level * 77);

    const list: CoinSpec[] = [];
    for (let i = 0; i < count; i++) {
      const x = (rand() - 0.5) * 26;
      const z = -6 - rand() * 80;

      const r = rand();
      const y =
        r < 0.35 ? 1.1 + rand() * 0.8 :
        r < 0.75 ? 2.4 + rand() * 2.0 :
                   5.0 + rand() * 4.0;

      list.push({
        id: i,
        base: new THREE.Vector3(x, y, z),
        phase: rand() * 10,
      });
    }
    return list;
  }, [level, count, runId]);

  return (
    <>
      {coins.map((spec) => (
        // ✅ KEY ÚNICA POR PARTIDA + NIVEL + MONEDA
        <Coin key={`${runId}-${level}-${spec.id}`} spec={spec} onCollect={onCollect} />
      ))}
    </>
  );
}
