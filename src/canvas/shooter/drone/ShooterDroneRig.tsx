import { RigidBody } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import React, { useCallback, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { usePlayerInput } from '../../../input/usePlayerInput';
import { WarDroneModel } from './WarDroneModel';

type Props = {
  freeLook?: boolean;
  onHit?: () => void;
  onHitFlash?: () => void;
  resetSignal?: number;
  disabled?: boolean;
  windLevel?: number;
  freeze?: boolean;
  assistMode?: boolean;
  cameraMode?: 'chase' | 'cockpit';
  onPose?: (pos: THREE.Vector3, quat: THREE.Quaternion, forward: THREE.Vector3) => void;
  enabledRotations?: [boolean, boolean, boolean];
};

export function ShooterDroneRig({
  freeLook = false,
  onHit,
  onHitFlash,
  resetSignal = 0,
  disabled = false,
  windLevel = 1,
  freeze = false,
  assistMode = true,
  cameraMode = 'chase',
  onPose,
  enabledRotations = [false, true, false],
}: Props) {
  const rbRef = useRef<RapierRigidBody | null>(null);
  const input = usePlayerInput();
  const { camera } = useThree();

  const camOffset = useRef(new THREE.Vector3(0, 2, 6));
  const camPos = useRef(new THREE.Vector3());
  const camTarget = useRef(new THREE.Vector3());

  const lastResetSeen = useRef(resetSignal);

  const lastHitRef = useRef(0);
  const HIT_COOLDOWN = 0.6;

  const tmpPos = useRef(new THREE.Vector3());
  const qNow = useRef(new THREE.Quaternion());
  const qYaw = useRef(new THREE.Quaternion());
  const qCorr = useRef(new THREE.Quaternion());
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const move = useRef(new THREE.Vector3());
  const axis = useRef(new THREE.Vector3());
  const upBody = useRef(new THREE.Vector3());
  const upWorld = useRef(new THREE.Vector3(0, 1, 0));
  const force = useRef(new THREE.Vector3());

  const setRigidBody = useCallback((rb: RapierRigidBody | null) => {
    rbRef.current = rb;
  }, []);

  useFrame((_, dt) => {
    // poll input
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

    // FREEZE
    if (freeze) {
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      rb.setTranslation({ x: 0, y: 2, z: 0 }, true);
      rb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      return;
    }

    if (disabled) return;

    const pos = rb.translation();

    // pose output
    const rot = rb.rotation();
    qNow.current.set(rot.x, rot.y, rot.z, rot.w);
    forward.current.set(0, 0, -1).applyQuaternion(qNow.current).normalize();

    if (onPose) {
      tmpPos.current.set(pos.x, pos.y, pos.z);
      onPose(tmpPos.current, qNow.current, forward.current);
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

    // YAW
    const yaw = Math.abs((input as any).yaw ?? 0) > 0.06 ? ((input as any).yaw ?? 0) : 0;
    if (yaw !== 0) {
      const YAW_SPEED = 2.3;
      qYaw.current.setFromAxisAngle(upWorld.current, yaw * YAW_SPEED * dt);
      qYaw.current.multiply(qNow.current);
      rb.setRotation({ x: qYaw.current.x, y: qYaw.current.y, z: qYaw.current.z, w: qYaw.current.w }, true);

      // refresh qNow
      qNow.current.copy(qYaw.current);
      forward.current.set(0, 0, -1).applyQuaternion(qNow.current).normalize();
    }

    // AUTO-LEVEL
    if (!freeLook) {
      upBody.current.set(0, 1, 0).applyQuaternion(qNow.current).normalize();
      const angle = Math.acos(THREE.MathUtils.clamp(upBody.current.dot(upWorld.current), -1, 1));
      if (angle > 0.0001) {
        axis.current.crossVectors(upBody.current, upWorld.current).normalize();
        const LEVEL_STRENGTH = 6.5;
        const t = 1 - Math.exp(-LEVEL_STRENGTH * dt);
        qCorr.current.setFromAxisAngle(axis.current, angle * t);
        qCorr.current.multiply(qNow.current);
        rb.setRotation({ x: qCorr.current.x, y: qCorr.current.y, z: qCorr.current.z, w: qCorr.current.w }, true);

        const av = rb.angvel();
        const DAMP = 0.92;
        rb.setAngvel({ x: av.x * DAMP, y: av.y, z: av.z * DAMP }, true);

        // refresh qNow
        const r2 = rb.rotation();
        qNow.current.set(r2.x, r2.y, r2.z, r2.w);
        forward.current.set(0, 0, -1).applyQuaternion(qNow.current).normalize();
      }
    }

    // Movement
    const v = rb.linvel();

    // vertical
    const MAX_UP = 3.2;
    const MAX_DOWN = -2.6;
    const ACCEL_Y = 3.5;

    const lift = input.lift ?? 0;
    let vyTarget = 0;
    if (lift > 0.05) vyTarget = MAX_UP * lift;
    if (lift < -0.05) vyTarget = MAX_DOWN * (-lift);
    if (lift < -0.05 && pos.y <= minY + 0.001) vyTarget = 0;

    const ay = (vyTarget - v.y) * ACCEL_Y;

    // horizontal
    const MAX_H_SPEED = input.boost ? 4.2 : 3.0;
    const ACCEL_H = 2.2;

    const mx = input.moveX ?? 0;
    const mz = input.moveZ ?? 0;
    const forwardScale = -mz;

    if (assistMode) {
      forward.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
      forward.current.y = 0;
      forward.current.normalize();
      right.current.crossVectors(forward.current, upWorld.current).normalize();
    } else {
      forward.current.set(0, 0, -1).applyQuaternion(qNow.current).normalize();
      right.current.set(1, 0, 0).applyQuaternion(qNow.current).normalize();
    }

    move.current.copy(right.current).multiplyScalar(mx).addScaledVector(forward.current, forwardScale);

    if (Math.abs(mx) + Math.abs(mz) < 0.001) {
      move.current.set(0, 0, 0);
    } else {
      move.current.normalize();
    }

    const vxTarget = move.current.x * MAX_H_SPEED;
    const vzTarget = move.current.z * MAX_H_SPEED;

    const ax = (vxTarget - v.x) * ACCEL_H;
    const az = (vzTarget - v.z) * ACCEL_H;

    const m = rb.mass();
    force.current.set(m * ax, m * ay, m * az);
    rb.addForce({ x: force.current.x, y: force.current.y, z: force.current.z }, true);

    // Wind
    const tNow = performance.now() / 1000;
    let windStrength = 0;
    if (windLevel === 2) windStrength = 0.18;
    if (windLevel >= 3) windStrength = 0.28;

    if (windStrength > 0) {
      const gust = 0.6 + 0.4 * Math.sin(tNow * 0.25);
      const wx = Math.sin(tNow * 0.35) * windStrength * gust;
      const wz = Math.cos(tNow * 0.28) * windStrength * 0.55 * gust;
      rb.addForce({ x: wx, y: 0, z: wz }, true);

      const vNow = rb.linvel();
      const maxWindSpeed = windLevel <= 2 ? 3.0 : 3.4;
      rb.setLinvel(
        {
          x: THREE.MathUtils.clamp(vNow.x, -maxWindSpeed, maxWindSpeed),
          y: vNow.y,
          z: THREE.MathUtils.clamp(vNow.z, -maxWindSpeed, maxWindSpeed),
        },
        true
      );
    }

    // Camera follow / cockpit
    if (!freeLook) {
      if (cameraMode === 'cockpit') {
        // cockpit: dentro del drone mirando hacia forward
        const p = tmpPos.current.set(pos.x, pos.y, pos.z);
        const camInside = camPos.current.copy(p);

        // offsets (tuneados para tu DroneModel/WarDrone)
        camInside.addScaledVector(upWorld.current, 0.20);
        camInside.addScaledVector(forward.current, 0.28);

        camera.position.lerp(camInside, 0.35);

        camTarget.current.copy(camera.position).addScaledVector(forward.current, 8);
        camera.lookAt(camTarget.current);
      } else {
        // chase: igual al trainer, con assist vs real
        if (assistMode) {
          const offset = camOffset.current.clone().applyQuaternion(qNow.current);
          camPos.current.set(pos.x, pos.y, pos.z).add(offset);
        } else {
          camPos.current.set(pos.x, pos.y, pos.z).add(camOffset.current);
        }
        camera.position.lerp(camPos.current, 0.12);
        camTarget.current.set(pos.x, pos.y, pos.z);
        camera.lookAt(camTarget.current);
      }
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
      enabledRotations={enabledRotations}
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
        <WarDroneModel />
      </group>
    </RigidBody>
  );
}
