import { RigidBody } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useKeyboardInput } from '../input/useKeyboardInput';
import { DroneModel } from './DroneModel';

type DroneRigProps = {
   freeLook?: boolean;
  onHit?: () => void;
  resetSignal?: number;
  disabled?: boolean;    // ✅ nuevo
};

export function DroneRig({ freeLook = false, onHit, resetSignal = 0, disabled = false }: DroneRigProps) {

  const rbRef = useRef<RapierRigidBody | null>(null);
  const keys = useKeyboardInput();

  // Cámara follow
  const { camera } = useThree();
  const camOffset = useRef(new THREE.Vector3(0, 2, 6));
  const camPos = useRef(new THREE.Vector3());
  const camTarget = useRef(new THREE.Vector3());
  const lastResetSeen = useRef(resetSignal);

  // ✅ cooldown para que no reste 5 vidas de una
  const lastHitRef = useRef(0);
  const HIT_COOLDOWN = 0.6; // segundos

  const setRigidBody = useCallback((rb: RapierRigidBody | null) => {
    rbRef.current = rb;
  }, []);

 useFrame(() => {
  const rb = rbRef.current;
  if (!rb) return;

  if (lastResetSeen.current !== resetSignal) {
    lastResetSeen.current = resetSignal;

    rb.setTranslation({ x: 0, y: 2, z: 0 }, true);
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      rb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  }

  // si el juego está en Game Over, no aplicar controles
  if (disabled) return;

  const pos = rb.translation();

    // =========================
    // Ground clamp (no atraviesa)
    // =========================
    const GROUND_Y = 0;
    const DRONE_HALF_HEIGHT = 0.20;
    const GROUND_EPS = 0.01;
    const minY = GROUND_Y + DRONE_HALF_HEIGHT + GROUND_EPS;

    if (pos.y <= minY) {
      rb.setTranslation({ x: pos.x, y: minY, z: pos.z }, true);

      const vNow = rb.linvel();
      if (vNow.y < 0) rb.setLinvel({ x: vNow.x, y: 0, z: vNow.z }, true);
    }

    const v = rb.linvel();

    // =========================
    // Control vertical tipo DJI (R/F)
    // =========================
    const up = keys.throttleUp;
    const down = keys.throttleDown;

    const MAX_UP = 3.2;
    const MAX_DOWN = -2.6;
    const ACCEL = 3.5;

    let vyTarget = 0;
    if (up) vyTarget = MAX_UP;
    if (down) vyTarget = MAX_DOWN;
    if (down && pos.y <= minY + 0.001) vyTarget = 0;

    const ay = (vyTarget - v.y) * ACCEL;

    // =========================
    // Avance lateral WASD
    // =========================
    const ix = (keys.right ? 1 : 0) + (keys.left ? -1 : 0);
    const iz = (keys.back ? 1 : 0) + (keys.forward ? -1 : 0);

    const MAX_H_SPEED = 3.0;
    const H_ACCEL = 2.2;

    const vxTarget = ix * MAX_H_SPEED;
    const vzTarget = iz * MAX_H_SPEED;

    const ax = (vxTarget - v.x) * H_ACCEL;
    const az = (vzTarget - v.z) * H_ACCEL;

    const m = rb.mass();
    rb.addForce({ x: m * ax, y: m * ay, z: m * az }, true);

    const v2 = rb.linvel();
    rb.setLinvel(
      {
        x: Math.max(-5, Math.min(5, v2.x)),
        y: Math.max(-4, Math.min(4, v2.y)),
        z: Math.max(-5, Math.min(5, v2.z)),
      },
      true
    );

    // =========================
    // Cámara follow
    // =========================
    if (!freeLook) {
      camPos.current.set(pos.x, pos.y, pos.z).add(camOffset.current);
      camera.position.lerp(camPos.current, 0.12);
      camTarget.current.set(pos.x, pos.y, pos.z);
      camera.lookAt(camTarget.current);
    }
  });

  return (
    <RigidBody
      ref={setRigidBody}
      position={[0, 1, 0]}
      mass={1}
      linearDamping={3}
      angularDamping={3}
      colliders="cuboid"
      ccd
      userData={{ type: 'drone' }}
      onCollisionEnter={(e) => {
        const otherType = (e.other.rigidBodyObject?.userData as any)?.type;

        // ✅ por ahora: si toca el piso peligroso o un obstáculo, resta vida
        if (otherType === 'danger-ground' || otherType === 'obstacle') {
          const now = performance.now() / 1000;
          if (now - lastHitRef.current < HIT_COOLDOWN) return;
          lastHitRef.current = now;

          onHit?.();
        }
      }}
    >
      <group>
        <DroneModel />
      </group>
    </RigidBody>
  );
}
