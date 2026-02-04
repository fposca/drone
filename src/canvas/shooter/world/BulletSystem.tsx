import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ShooterInput } from '../useShooterInput'; // 👈 ajustá path si está en otro lado
import type { Enemy } from './Enemies';

type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

type Bullet = {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  ttl: number;
  kind: 'player' | 'enemy';
};

type Props = {
  runId: number;
  level: Level;
  disabled: boolean;

  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  playerQuatRef: React.MutableRefObject<THREE.Quaternion>;
  playerForwardRef: React.MutableRefObject<THREE.Vector3>;

  ammo: number;
  onConsumeAmmo: () => void;

  onHitPlayer: () => void;
  onEnemyKilled: () => void;

  shooterInput: ShooterInput;

  onEnemyHit?: () => void; // ✅ hit marker
};

export function BulletSystem({
  runId,
  level,
  disabled,
  playerPosRef,
  playerForwardRef,
  ammo,
  onConsumeAmmo,
  onHitPlayer,
  onEnemyKilled,
  shooterInput,
  onEnemyHit,
}: Props) {
  // bullets pool
  const MAX_BULLETS = 260;
  const bulletsRef = useRef<Bullet[]>([]);
  const nextIdxRef = useRef(0);

  // 2 instanced meshes (player/enemy) para distinguir y evitar lío
  const instPlayerRef = useRef<THREE.InstancedMesh | null>(null);
  const instEnemyRef = useRef<THREE.InstancedMesh | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // enemies ref “global”
  const enemiesRef = (globalThis as any).__enemiesRef as React.MutableRefObject<Enemy[]> | undefined;

  // per-level difficulty
  const enemyFireRate = level <= 2 ? 1.1 : level <= 4 ? 0.85 : level <= 6 ? 0.70 : 0.55;
  const enemyBulletSpeed = level <= 3 ? 10 : level <= 6 ? 12 : 14;

  const playerBulletSpeed = 18;

  useEffect(() => {
    const arr: Bullet[] = [];
    for (let i = 0; i < MAX_BULLETS; i++) {
      arr.push({
        active: false,
        pos: new THREE.Vector3(0, -9999, 0),
        vel: new THREE.Vector3(),
        ttl: 0,
        kind: 'player',
      });
    }
    bulletsRef.current = arr;
    nextIdxRef.current = 0;
  }, [runId]);

  const spawnBullet = (kind: 'player' | 'enemy', origin: THREE.Vector3, dir: THREE.Vector3, speed: number) => {
    const arr = bulletsRef.current;
    let idx = nextIdxRef.current;

    for (let tries = 0; tries < arr.length; tries++) {
      const b = arr[idx];
      if (!b.active) break;
      idx = (idx + 1) % arr.length;
    }

    const b = arr[idx];
    b.active = true;
    b.kind = kind;
    b.pos.copy(origin);
    b.vel.copy(dir).multiplyScalar(speed);
    b.ttl = kind === 'player' ? 1.4 : 2.0;

    nextIdxRef.current = (idx + 1) % arr.length;
  };

  const enemyTimersRef = useRef<number[]>([]);
  useEffect(() => {
    enemyTimersRef.current = [];
  }, [runId, level]);

  const PLAYER_R = 0.55;
  const ENEMY_R = 0.70;

  const tmpDir = useRef(new THREE.Vector3());
  const tmpPos = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    // ✅ leer input 1 vez por frame (edge flags)
    shooterInput.__read?.();

    if (disabled) return;

    const enemies = enemiesRef?.current ?? [];

    // ===== PLAYER FIRE =====
    if (shooterInput.firePressed && ammo > 0) {
      onConsumeAmmo();

      const p = playerPosRef.current;
      const f = playerForwardRef.current;

      tmpPos.current.copy(p).addScaledVector(f, 0.9);
      tmpPos.current.y += 0.15;

      tmpDir.current.copy(f).normalize();

      spawnBullet('player', tmpPos.current, tmpDir.current, playerBulletSpeed);
    }

    // ===== ENEMY FIRE =====
    if (enemies.length) {
      if (enemyTimersRef.current.length !== enemies.length) {
        enemyTimersRef.current = enemies.map((e) => e.fireCooldown);
      }

      const playerP = playerPosRef.current;

      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.alive) continue;

        enemyTimersRef.current[i] -= dt;
        if (enemyTimersRef.current[i] <= 0) {
          enemyTimersRef.current[i] = enemyFireRate + Math.random() * 0.15;

          tmpDir.current.copy(playerP).sub(e.pos).normalize();
          tmpPos.current.copy(e.pos).addScaledVector(tmpDir.current, 0.8);

          spawnBullet('enemy', tmpPos.current, tmpDir.current, enemyBulletSpeed);
        }
      }
    }

    // ===== UPDATE BULLETS + COLLISIONS =====
    const arr = bulletsRef.current;
    const playerP = playerPosRef.current;

    let didMutateEnemies = false;

    for (let i = 0; i < arr.length; i++) {
      const b = arr[i];
      if (!b.active) continue;

      b.ttl -= dt;
      if (b.ttl <= 0) {
        b.active = false;
        b.pos.set(0, -9999, 0);
        continue;
      }

      b.pos.addScaledVector(b.vel, dt);

      // bounds
      if (b.pos.y < -2 || b.pos.y > 60 || b.pos.z < -240 || b.pos.z > 40) {
        b.active = false;
        b.pos.set(0, -9999, 0);
        continue;
      }

      if (b.kind === 'enemy') {
        // hit player
        if (b.pos.distanceToSquared(playerP) < PLAYER_R * PLAYER_R) {
          b.active = false;
          b.pos.set(0, -9999, 0);
          onHitPlayer();
          continue;
        }
      } else {
        // hit enemy
        for (let j = 0; j < enemies.length; j++) {
          const e = enemies[j];
          if (!e.alive) continue;

          if (b.pos.distanceToSquared(e.pos) < ENEMY_R * ENEMY_R) {
            b.active = false;
            b.pos.set(0, -9999, 0);

            // ✅ feedback hit-marker
            onEnemyHit?.();

            // ✅ damage
            e.hp -= 1;
            didMutateEnemies = true;

            if (e.hp <= 0) {
              e.alive = false;

              // ✅ explosión
              const spawnExpl = (globalThis as any).__spawnEnemyExplosion as ((p: THREE.Vector3) => void) | undefined;
              spawnExpl?.(e.pos);

              // ✅ score
              onEnemyKilled();
            }

            break;
          }
        }
      }
    }

    // ✅ si tocamos enemigos, forzamos re-render del componente Enemies
    if (didMutateEnemies) {
      const bumpEnemies = (globalThis as any).__enemiesBump as (() => void) | undefined;
      bumpEnemies?.();
    }

    // ===== UPDATE INSTANCED MESHES =====
    const instP = instPlayerRef.current;
    const instE = instEnemyRef.current;
    if (!instP || !instE) return;

    let np = 0;
    let ne = 0;

    for (let i = 0; i < arr.length; i++) {
      const b = arr[i];
      if (!b.active) continue;

      dummy.position.copy(b.pos);
      dummy.scale.setScalar(b.kind === 'player' ? 0.14 : 0.12);
      dummy.updateMatrix();

      if (b.kind === 'player') {
        if (np < instP.count) instP.setMatrixAt(np++, dummy.matrix);
      } else {
        if (ne < instE.count) instE.setMatrixAt(ne++, dummy.matrix);
      }
    }

    // fill rest offscreen
    for (let i = np; i < instP.count; i++) {
      dummy.position.set(0, -9999, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      instP.setMatrixAt(i, dummy.matrix);
    }

    for (let i = ne; i < instE.count; i++) {
      dummy.position.set(0, -9999, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      instE.setMatrixAt(i, dummy.matrix);
    }

    instP.instanceMatrix.needsUpdate = true;
    instE.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      {/* Player bullets */}
      <instancedMesh
        ref={instPlayerRef}
        args={[undefined as any, undefined as any, 140]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 12, 10]} />
        <meshBasicMaterial transparent opacity={0.95} toneMapped={false} />
      </instancedMesh>

      {/* Enemy bullets */}
      <instancedMesh
        ref={instEnemyRef}
        args={[undefined as any, undefined as any, 140]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 12, 10]} />
        <meshBasicMaterial transparent opacity={0.85} toneMapped={false} />
      </instancedMesh>
    </>
  );
}
