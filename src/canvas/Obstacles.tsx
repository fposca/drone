import { RigidBody } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type ObstaclesProps = {
  onHit?: () => void;
  level?: number; // ✅ 1..3
};

type MineSpec = {
  id: number;
  base: THREE.Vector3;
  phase: number;
  amp: number;
  speed: number;
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

function Explosion({ at }: { at: THREE.Vector3 }) {
  const tRef = useRef(0);
  const [alive, setAlive] = useState(true);

  useFrame((_, dt) => {
    tRef.current += dt;
    if (tRef.current > 0.65) setAlive(false);
  });

  if (!alive) return null;

  const t = tRef.current;
  const s = THREE.MathUtils.lerp(0.2, 1.9, t / 0.65);
  const alpha = 1 - t / 0.65;

  return (
    <group position={at}>
      <mesh scale={s}>
        <sphereGeometry args={[0.7, 18, 14]} />
        <meshStandardMaterial
          transparent
          opacity={0.65 * alpha}
          emissive="#ff2a2a"
          emissiveIntensity={2.6}
          color="#ff2a2a"
        />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]} scale={s * 1.15}>
        <torusGeometry args={[0.65, 0.09, 10, 28]} />
        <meshStandardMaterial
          transparent
          opacity={0.55 * alpha}
          emissive="#ff7a7a"
          emissiveIntensity={1.8}
          color="#ff7a7a"
        />
      </mesh>
    </group>
  );
}

function MineVisual({ pulse }: { pulse: number }) {
  const emissive = 0.25 + pulse * 1.8;

  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[0.55, 24, 18]} />
        <meshStandardMaterial color="#1b1b1f" roughness={0.55} metalness={0.35} />
      </mesh>

      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.46, 0, Math.sin(a) * 0.46]}
            rotation={[0, a, Math.PI / 2]}
            castShadow
          >
            <coneGeometry args={[0.08, 0.32, 10]} />
            <meshStandardMaterial color="#2a2a2f" roughness={0.8} />
          </mesh>
        );
      })}

      <mesh position={[0, 0.15, 0]}>
        <sphereGeometry args={[0.09, 14, 12]} />
        <meshStandardMaterial
          color="#ff2a2a"
          emissive="#ff2a2a"
          emissiveIntensity={emissive}
        />
      </mesh>
    </group>
  );
}

function MineObstacle({
  spec,
  onHit,
}: {
  spec: MineSpec;
  onHit?: () => void;
}) {
  const rbRef = useRef<RapierRigidBody | null>(null);

  // ✅ cola segura (evita setState dentro del callback de física)
  const hitQueuedRef = useRef(false);
  const hitPosRef = useRef(new THREE.Vector3());
  const lastHitRef = useRef(0);

  const [explosions, setExplosions] = useState<THREE.Vector3[]>([]);
  const [alive, setAlive] = useState(true);
  const aliveRef = useRef(true);

  // ✅ hooks SIEMPRE arriba, sin returns antes
  const pulseRef = useRef(0);

  useFrame(({ clock }) => {
    const rb = rbRef.current;

    // pulso visual
    pulseRef.current =
      (Math.sin(clock.getElapsedTime() * 3.2 + spec.phase) + 1) / 2;

    // procesar hit en frame (seguro)
    if (hitQueuedRef.current) {
      hitQueuedRef.current = false;

      onHit?.();
      setExplosions((arr) => [...arr, hitPosRef.current.clone()]);

      aliveRef.current = false;
      setAlive(false);
    }

    if (!rb) return;
    if (!aliveRef.current) return;

    const t = clock.getElapsedTime();

    const targetX =
      spec.base.x + Math.cos(t * spec.speed + spec.phase) * spec.amp * 0.65;
    const targetY =
      spec.base.y + Math.sin(t * (spec.speed * 1.05) + spec.phase) * spec.amp * 0.55;
    const targetZ =
      spec.base.z + Math.sin(t * (spec.speed * 0.9) + spec.phase) * spec.amp * 0.65;

    const pos = rb.translation();
    const vel = rb.linvel();

    const k = 2.0;
    const damp = 2.2;

    const fx = (targetX - pos.x) * k - vel.x * damp;
    const fy = (targetY - pos.y) * k - vel.y * damp;
    const fz = (targetZ - pos.z) * k - vel.z * damp;

    rb.addForce({ x: fx, y: fy, z: fz }, true);

    const maxV = 1.1;
    rb.setLinvel(
      {
        x: THREE.MathUtils.clamp(vel.x, -maxV, maxV),
        y: THREE.MathUtils.clamp(vel.y, -maxV, maxV),
        z: THREE.MathUtils.clamp(vel.z, -maxV, maxV),
      },
      true
    );

    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
  });

  return (
    <>
      {alive && (
        <RigidBody
          ref={rbRef}
          type="dynamic"
          colliders="ball"
          position={[spec.base.x, spec.base.y, spec.base.z]}
          gravityScale={0}
          linearDamping={2.6}
          angularDamping={4.0}
          restitution={0.25}
          friction={0.2}
          mass={1.0}
          userData={{ type: 'obstacle' }}
          ccd
          onCollisionEnter={(e) => {
            const otherType = (e.other.rigidBodyObject?.userData as any)?.type;
            if (otherType !== 'drone') return;
            if (!aliveRef.current) return;

            const now = performance.now() / 1000;
            if (now - lastHitRef.current < 0.6) return;
            lastHitRef.current = now;

            const rb = rbRef.current;
            if (!rb) return;

            const p = rb.translation();
            hitPosRef.current.set(p.x, p.y, p.z);
            hitQueuedRef.current = true;
          }}
        >
          <MineVisual pulse={pulseRef.current} />
        </RigidBody>
      )}

      {explosions.map((p, idx) => (
        <Explosion key={idx} at={p} />
      ))}
    </>
  );
}

export function Obstacles({ onHit, level = 1 }: ObstaclesProps) {
  const mines = useMemo<MineSpec[]>(() => {
    const rand = seededRandom(2025 + level * 111);

    const count = level === 1 ? 16 : level === 2 ? 26 : 34;
    const speedMul = level === 1 ? 1 : level === 2 ? 1.45 : 1.9;

    const list: MineSpec[] = [];

    for (let i = 0; i < count; i++) {
      const x = (rand() - 0.5) * 22;
      const y = 2.0 + rand() * 7.0;
      const z = -10 - rand() * 70;

      list.push({
        id: i,
        base: new THREE.Vector3(x, y, z),
        phase: rand() * 10,
        amp: 0.45 + rand() * 0.55,
        speed: (0.08 + rand() * 0.10) * speedMul,
      });
    }

    return list;
  }, [level]);

  return (
    <>
      {mines.map((spec) => (
        <MineObstacle key={spec.id} spec={spec} onHit={onHit} />
      ))}
    </>
  );
}
