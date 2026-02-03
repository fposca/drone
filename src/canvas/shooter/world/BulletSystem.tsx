import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ShooterInput } from './useShooterInput';

type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

type Bullet = {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  ttl: number;
  kind: 'player' | 'enemy';
};

type Enemy = {
  id: number;
  pos: THREE.Vector3;
  alive: boolean;
  hp: number;
  fireCooldown: number;
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
}: Props) {
  // bullets pool
  const MAX_BULLETS = 260; // total player+enemy
  const bulletsRef = useRef<Bullet[]>([]);
  const nextIdxRef = useRef(0);

  // instanced mesh for bullets
  const instRef = useRef<THREE.InstancedMesh | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // enemies ref “global”
  const enemiesRef = (globalThis as any).__enemiesRef as React.MutableRefObject<Enemy[]> | undefined;

  // per-level difficulty
  const enemyFireRate = level <= 2 ? 1.1 : level <= 4 ? 0.85 : level <= 6 ? 0.70 : 0.55;
  const enemyBulletSpeed = level <= 3 ? 10 : level <= 6 ? 12 : 14;

  const playerBulletSpeed = 16;

  // init / reset pool
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

  // helper spawn
  const spawnBullet = (kind: 'player' | 'enemy', origin: THREE.Vector3, dir: THREE.Vector3, speed: number) => {
    const arr = bulletsRef.current;
    let idx = nextIdxRef.current;

    // buscar slot libre (circular)
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
    b.ttl = kind === 'player' ? 1.6 : 2.2;

    nextIdxRef.current = (idx + 1) % arr.length;
  };

  // timers for enemy firing (no alloc)
  const enemyTimersRef = useRef<number[]>([]);
  useEffect(() => {
    enemyTimersRef.current = [];
  }, [runId, level]);

  // collision radii
  const PLAYER_R = 0.55;
  const ENEMY_R = 0.65;

  // scratch
  const tmpDir = useRef(new THREE.Vector3());
  const tmpPos = useRef(new THREE.Vector3());
  const tmpA = useRef(new THREE.Vector3());
  const tmpB = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    // poll shooterInput
    const read = (shooterInput as any).__read as (() => void) | undefined;
    read?.();
    if (shooterInput.firePressed) {
  console.log('FIRE!', ammo);
}

    if (disabled) {
      // igual actualizamos instancias para “ocultar” balas activas lejos si querés,
      // pero por simplicidad, no hacemos nada.
      return;
    }

    // ===== PLAYER FIRE =====
    if (shooterInput.firePressed && ammo > 0) {
      onConsumeAmmo();

      const p = playerPosRef.current;
      const f = playerForwardRef.current;

      // origen: un poco adelante y arriba
      tmpPos.current.copy(p).addScaledVector(f, 0.75).add(new THREE.Vector3(0, 0.15, 0));

      // dir = forward
      tmpDir.current.copy(f).normalize();

      spawnBullet('player', tmpPos.current, tmpDir.current, playerBulletSpeed);
    }

    // ===== ENEMY FIRE =====
    const enemies = enemiesRef?.current ?? [];
    if (enemies.length) {
      // aseguro timers por enemy
      if (enemyTimersRef.current.length !== enemies.length) {
        enemyTimersRef.current = enemies.map((e) => e.fireCooldown);
      }

      const playerP = playerPosRef.current;

      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        if (!e.alive) continue;

        enemyTimersRef.current[i] -= dt;
        if (enemyTimersRef.current[i] <= 0) {
          enemyTimersRef.current[i] = enemyFireRate + (Math.random() * 0.15);

          // dir hacia player
          tmpDir.current.copy(playerP).sub(e.pos).normalize();

          // origen del enemigo
          tmpPos.current.copy(e.pos).addScaledVector(tmpDir.current, 0.8);

          spawnBullet('enemy', tmpPos.current, tmpDir.current, enemyBulletSpeed);
        }
      }
    }

    // ===== UPDATE BULLETS + COLLISIONS =====
    const arr = bulletsRef.current;
    const playerP = playerPosRef.current;

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

      // player bounds (evitar ir infinito)
      if (b.pos.y < -2 || b.pos.y > 60 || b.pos.z < -220 || b.pos.z > 30) {
        b.active = false;
        b.pos.set(0, -9999, 0);
        continue;
      }

      if (b.kind === 'enemy') {
        // hit player
        if (b.pos.distanceToSquared(playerP) < (PLAYER_R * PLAYER_R)) {
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

          if (b.pos.distanceToSquared(e.pos) < (ENEMY_R * ENEMY_R)) {
            b.active = false;
            b.pos.set(0, -9999, 0);

            e.hp -= 1;
            if (e.hp <= 0) {
              e.alive = false;
              onEnemyKilled();
            }
            break;
          }
        }
      }
    }

    // ===== UPDATE INSTANCED MESH =====
    const inst = instRef.current;
    if (!inst) return;

    let n = 0;
    for (let i = 0; i < arr.length; i++) {
      const b = arr[i];
      if (!b.active) continue;

      dummy.position.copy(b.pos);
      dummy.scale.setScalar(b.kind === 'player' ? 0.14 : 0.11);
      dummy.updateMatrix();
      inst.setMatrixAt(n, dummy.matrix);
      n++;
      if (n >= inst.count) break;
    }

    // relleno el resto “fuera”
    for (let i = n; i < inst.count; i++) {
      dummy.position.set(0, -9999, 0);
      dummy.scale.setScalar(0.001);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }

    inst.instanceMatrix.needsUpdate = true;
  });

return (
  <instancedMesh
    ref={instRef}
    args={[undefined as any, undefined as any, 220]}
    frustumCulled={false} // ✅ CLAVE: que no desaparezcan por culling
  >
    <sphereGeometry args={[1, 12, 10]} />
    <meshBasicMaterial
      color="#ffffff"
      toneMapped={false} // ✅ evita que la corrección de tono “apague” el brillo
      transparent
      opacity={0.95}
    />
  </instancedMesh>
);

}
