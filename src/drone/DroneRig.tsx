import { RigidBody } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { usePlayerInput } from '../input/usePlayerInput';
import { DroneModel } from './DroneModel';

type DroneRigProps = {
  freeLook?: boolean;
  onHit?: () => void;
  onHitFlash?: () => void;
  resetSignal?: number;
  disabled?: boolean;
  windLevel?: number;
  freeze?: boolean;
  onPosition?: (p: THREE.Vector3) => void;
};

export function DroneRig({
  freeLook = false,
  onHit,
  onHitFlash,
  resetSignal = 0,
  disabled = false,
  windLevel = 1,
  freeze = false,
  onPosition,
}: DroneRigProps) {
  const rbRef = useRef<RapierRigidBody | null>(null);

  // ✅ Nuevo input unificado teclado+joystick
  const input = usePlayerInput();

  // Cámara follow
  const { camera } = useThree();
  const camOffset = useRef(new THREE.Vector3(0, 2, 6));
  const camPos = useRef(new THREE.Vector3());
  const camTarget = useRef(new THREE.Vector3());
  const lastResetSeen = useRef(resetSignal);

  // cooldown hits
  const lastHitRef = useRef(0);
  const HIT_COOLDOWN = 0.6;

  const setRigidBody = useCallback((rb: RapierRigidBody | null) => {
    rbRef.current = rb;
  }, []);

  // Auto-level helpers
  const q = useRef(new THREE.Quaternion());
  const qTarget = useRef(new THREE.Quaternion());
  const upWorld = useRef(new THREE.Vector3(0, 1, 0));
  const upBody = useRef(new THREE.Vector3());
  const axis = useRef(new THREE.Vector3());

  const tmpPos = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    // ✅ refrescar input (teclado + joystick)
    const readRef = (input as any).__read as React.MutableRefObject<() => void> | undefined;
    readRef?.current?.();

    const rb = rbRef.current;
    if (!rb) return;

    // RESET
    if (lastResetSeen.current !== resetSignal) {
      lastResetSeen.current = resetSignal;

      rb.setTranslation({ x: 0, y: 2, z: 0 }, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      rb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    }

    // FREEZE (nivel completado)
    if (freeze) {
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      rb.setTranslation({ x: 0, y: 2, z: 0 }, true);
      rb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      return;
    }

    if (disabled) return;

    const pos = rb.translation();

    // reportar posición
    if (onPosition) {
      tmpPos.current.set(pos.x, pos.y, pos.z);
      onPosition(tmpPos.current);
    }

    // Ground clamp
    const GROUND_Y = 0;
    const DRONE_HALF_HEIGHT = 0.2;
    const GROUND_EPS = 0.01;
    const minY = GROUND_Y + DRONE_HALF_HEIGHT + GROUND_EPS;

    if (pos.y <= minY) {
      rb.setTranslation({ x: pos.x, y: minY, z: pos.z }, true);

      const vNow = rb.linvel();
      if (vNow.y < 0) rb.setLinvel({ x: vNow.x, y: 0, z: vNow.z }, true);
    }

    // AUTO-LEVEL
    if (!freeLook) {
      const rot = rb.rotation();
      q.current.set(rot.x, rot.y, rot.z, rot.w);

      upBody.current.set(0, 1, 0).applyQuaternion(q.current).normalize();

      const angle = Math.acos(
        THREE.MathUtils.clamp(upBody.current.dot(upWorld.current), -1, 1)
      );

      if (angle > 0.0001) {
        axis.current.crossVectors(upBody.current, upWorld.current).normalize();

        const LEVEL_STRENGTH = 6.5;
        const t = 1 - Math.exp(-LEVEL_STRENGTH * dt);

        qTarget.current.setFromAxisAngle(axis.current, angle * t);
        qTarget.current.multiply(q.current);

        rb.setRotation(
          { x: qTarget.current.x, y: qTarget.current.y, z: qTarget.current.z, w: qTarget.current.w },
          true
        );

        const av = rb.angvel();
        const DAMP = 0.92;
        rb.setAngvel({ x: av.x * DAMP, y: av.y, z: av.z * DAMP }, true);
      }
    }

    // MOVIMIENTO (ahora analógico)
    const v = rb.linvel();

    // lift: input.lift => +1 subir, -1 bajar
    const MAX_UP = 3.2;
    const MAX_DOWN = -2.6;
    const ACCEL = 3.5;

    let vyTarget = 0;
    if (input.lift > 0.05) vyTarget = MAX_UP * input.lift;
    if (input.lift < -0.05) vyTarget = MAX_DOWN * (-input.lift);

    if (input.lift < -0.05 && pos.y <= minY + 0.001) vyTarget = 0;

    const ay = (vyTarget - v.y) * ACCEL;

    // horizontal: moveX/moveZ
    const MAX_H_SPEED = input.boost ? 4.2 : 3.0;
    const H_ACCEL = 2.2;

    const vxTarget = input.moveX * MAX_H_SPEED;

    // ojo: moveZ (adelante=-1) => queremos vz negativo para ir “adelante”
    const vzTarget = input.moveZ * MAX_H_SPEED;

    const ax = (vxTarget - v.x) * H_ACCEL;
    const az = (vzTarget - v.z) * H_ACCEL;

    const m = rb.mass();
    rb.addForce({ x: m * ax, y: m * ay, z: m * az }, true);

    // VIENTO
    const tNow = performance.now() / 1000;

    let windStrength = 0;
    if (windLevel === 2) windStrength = 0.22;
    if (windLevel >= 3) windStrength = 0.38;

    const gust = 0.6 + 0.4 * Math.sin(tNow * 0.25);
    const windX = Math.sin(tNow * 0.35) * windStrength * gust;
    const windZ = Math.cos(tNow * 0.28) * windStrength * 0.55 * gust;

    if (windStrength > 0) {
      rb.addForce({ x: windX, y: 0, z: windZ }, true);

      const vNow = rb.linvel();
      const maxWindSpeed = windLevel === 2 ? 3.2 : 3.8;

      rb.setLinvel(
        {
          x: THREE.MathUtils.clamp(vNow.x, -maxWindSpeed, maxWindSpeed),
          y: vNow.y,
          z: THREE.MathUtils.clamp(vNow.z, -maxWindSpeed, maxWindSpeed),
        },
        true
      );
    }

    // cámara follow
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

        if (otherType === 'danger-ground' || otherType === 'obstacle') {
          const now = performance.now() / 1000;
          if (now - lastHitRef.current < HIT_COOLDOWN) return;
          lastHitRef.current = now;

          onHit?.();
          onHitFlash?.();
        }
      }}
    >
      <group>
        <DroneModel />
      </group>
    </RigidBody>
  );
}
