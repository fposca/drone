import { RigidBody } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

type BossDroneProps = {
  targetRef: React.MutableRefObject<THREE.Vector3>;
  onHit?: () => void;
  runId?: number; // para respawn en reset
};

export function BossDrone({ targetRef, onHit, runId = 0 }: BossDroneProps) {
  const rbRef = useRef<RapierRigidBody | null>(null);
  const lastHitRef = useRef(0);

  // spawn del boss (lejos del origen)
  const spawn = useRef(new THREE.Vector3(0, 6, -45));

  useFrame((_, dt) => {
    const rb = rbRef.current;
    if (!rb) return;

    // si querés: respawn cuando cambia runId (resetSignal)
    // (simple: lo chequeamos con un ref)
  });

  // perseguir (kinematic suave)
  useFrame((_, dt) => {
    const rb = rbRef.current;
    if (!rb) return;

    const pos = rb.translation();
    const p = new THREE.Vector3(pos.x, pos.y, pos.z);

    // target = drone pos (pero con un offset para que lo persiga “por atrás”)
    const t = targetRef.current;
    const desired = new THREE.Vector3(t.x, Math.max(1.8, t.y + 0.6), t.z - 4.5);

    const dir = desired.sub(p);
    const dist = dir.length();

    // speed depende de distancia para que sea “amenazante” pero no imposible
    dir.normalize();
    const baseSpeed = 3.0;
    const extra = THREE.MathUtils.clamp((dist - 6) * 0.20, 0, 2.6);
    const speed = baseSpeed + extra; // 3..5.6 aprox

    // movimiento suave
    const step = Math.min(dist, speed * dt);
    const next = p.add(dir.multiplyScalar(step));

    rb.setNextKinematicTranslation({ x: next.x, y: next.y, z: next.z });

    // un “look” simple: rotar un poco hacia el objetivo (visual)
    // (si querés, después lo hacemos con quaternion)
  });

  return (
    <RigidBody
      ref={rbRef}
      type="kinematicPosition"
      colliders="ball"
      position={[spawn.current.x, spawn.current.y, spawn.current.z]}
      userData={{ type: 'boss' }}
      onCollisionEnter={(e) => {
        const otherType = (e.other.rigidBodyObject?.userData as any)?.type;
        if (otherType !== 'drone') return;

        const now = performance.now() / 1000;
        if (now - lastHitRef.current < 0.8) return;
        lastHitRef.current = now;

        onHit?.();
      }}
    >
      <group>
        {/* cuerpo */}
        <mesh castShadow>
          <sphereGeometry args={[1.6, 28, 20]} />
          <meshStandardMaterial
            color="#0b0b0f"
            roughness={0.35}
            metalness={0.65}
            emissive="#2b0008"
            emissiveIntensity={0.65}
          />
        </mesh>

        {/* “ojos” */}
        <mesh position={[-0.55, 0.25, 1.25]}>
          <sphereGeometry args={[0.22, 18, 14]} />
          <meshStandardMaterial emissive="#ff0033" emissiveIntensity={2.2} color="#ff0033" />
        </mesh>
        <mesh position={[0.55, 0.25, 1.25]}>
          <sphereGeometry args={[0.22, 18, 14]} />
          <meshStandardMaterial emissive="#ff0033" emissiveIntensity={2.2} color="#ff0033" />
        </mesh>

        {/* “turbinas” laterales */}
        <mesh position={[1.65, 0, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.65, 14]} />
          <meshStandardMaterial color="#111" roughness={0.7} metalness={0.4} />
        </mesh>
        <mesh position={[-1.65, 0, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.65, 14]} />
          <meshStandardMaterial color="#111" roughness={0.7} metalness={0.4} />
        </mesh>

        {/* “pinchos” */}
        {Array.from({ length: 10 }).map((_, i) => {
          const ang = (i / 10) * Math.PI * 2;
          const x = Math.cos(ang) * 1.25;
          const z = Math.sin(ang) * 1.25;
          return (
            <mesh key={i} position={[x, 0.2, z]} rotation={[0, ang, 0]}>
              <coneGeometry args={[0.14, 0.45, 10]} />
              <meshStandardMaterial color="#1a1a1f" metalness={0.6} roughness={0.4} />
            </mesh>
          );
        })}
      </group>
    </RigidBody>
  );
}
