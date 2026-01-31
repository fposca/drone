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
  enabledRotations?: [boolean, boolean, boolean]; // [x,y,z]
  assistMode?: boolean;
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
  enabledRotations = [false, true, false],
   assistMode = false,
}: DroneRigProps) {
  const rbRef = useRef<RapierRigidBody | null>(null);

  // ✅ input unificado (teclado + joystick)
  const input = usePlayerInput();

  const { camera } = useThree();

  // cámara (offset detrás/arriba) — se rota con el yaw del drone
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

  // ===== Refs para evitar allocs =====
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

  useFrame((_, dt) => {
    // si tu hook requiere "poll" por frame
    const readRef = (input as any).__read as React.MutableRefObject<() => void> | undefined;
    readRef?.current?.();

    const rb = rbRef.current;
    if (!rb) return;

    // ===== RESET =====
    if (lastResetSeen.current !== resetSignal) {
      lastResetSeen.current = resetSignal;
      rb.setTranslation({ x: 0, y: 2, z: 0 }, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      rb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    }

    // ===== FREEZE (nivel completado) =====
    if (freeze) {
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      rb.setTranslation({ x: 0, y: 2, z: 0 }, true);
      rb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      return;
    }

    if (disabled) return;

    const pos = rb.translation();

    // ✅ reportar posición al Scene (sin alloc por frame)
    if (onPosition) {
      tmpPos.current.set(pos.x, pos.y, pos.z);
      onPosition(tmpPos.current);
    }

    // =========================
    // Ground clamp
    // =========================
    const GROUND_Y = 0;
    const DRONE_HALF_HEIGHT = 0.2;
    const GROUND_EPS = 0.01;
    const minY = GROUND_Y + DRONE_HALF_HEIGHT + GROUND_EPS;

    if (pos.y <= minY) {
      rb.setTranslation({ x: pos.x, y: minY, z: pos.z }, true);
      const vNow = rb.linvel();
      if (vNow.y < 0) rb.setLinvel({ x: vNow.x, y: 0, z: vNow.z }, true);
    }

    // =========================
    // YAW (giro sobre Y)
    // =========================
    // input.yaw: -1..1 (izq..der)
    const yaw = Math.abs((input as any).yaw ?? 0) > 0.06 ? ((input as any).yaw ?? 0) : 0;

    if (yaw !== 0) {
      const rot = rb.rotation();
      qNow.current.set(rot.x, rot.y, rot.z, rot.w);

      const YAW_SPEED = 2.3; // rad/seg
      qYaw.current.setFromAxisAngle(upWorld.current, yaw * YAW_SPEED * dt);

      // qNew = qYaw * qNow
      qYaw.current.multiply(qNow.current);

      rb.setRotation(
        { x: qYaw.current.x, y: qYaw.current.y, z: qYaw.current.z, w: qYaw.current.w },
        true
      );
    }

    // =========================
    // AUTO-LEVEL (endereza pitch/roll) - SIN allocs
    // =========================
    if (!freeLook) {
      const rot = rb.rotation();
      qNow.current.set(rot.x, rot.y, rot.z, rot.w);

      // up del drone en mundo
      upBody.current.set(0, 1, 0).applyQuaternion(qNow.current).normalize();

      const angle = Math.acos(
        THREE.MathUtils.clamp(upBody.current.dot(upWorld.current), -1, 1)
      );

      if (angle > 0.0001) {
        axis.current.crossVectors(upBody.current, upWorld.current).normalize();

        const LEVEL_STRENGTH = 6.5;
        const t = 1 - Math.exp(-LEVEL_STRENGTH * dt);

        qCorr.current.setFromAxisAngle(axis.current, angle * t);
        qCorr.current.multiply(qNow.current);

        rb.setRotation(
          { x: qCorr.current.x, y: qCorr.current.y, z: qCorr.current.z, w: qCorr.current.w },
          true
        );

        // amortiguar rotación angular en X/Z
        const av = rb.angvel();
        const DAMP = 0.92;
        rb.setAngvel({ x: av.x * DAMP, y: av.y, z: av.z * DAMP }, true);
      }
    }

    // =========================
    // Movimiento (en ejes LOCALES)
    // ✅ ACÁ VA el bloque que preguntaste
    // =========================
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

    // orientación actual
    {
      const rot = rb.rotation();
      qNow.current.set(rot.x, rot.y, rot.z, rot.w);
    }

  // ===== referencia de movimiento: DRONE (real) o CÁMARA (asistido) =====
const mx = input.moveX ?? 0; // -1..1
const mz = input.moveZ ?? 0; // -1..1  (en tu hook: adelante = -1)

// Queremos que "adelante" sea consistente:
// si tu input.moveZ es -1 al apretar adelante, entonces forwardScale = -mz
const forwardScale = -mz;

if (assistMode) {
  // --- Asistido: según cámara ---
  // forward de cámara proyectado en el piso (XZ)
  forward.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
  forward.current.y = 0;
  forward.current.normalize();

  // right = perpendicular
  right.current.crossVectors(forward.current, upWorld.current).normalize();


} else {
  // --- Real: según drone ---
  const rot = rb.rotation();
  qNow.current.set(rot.x, rot.y, rot.z, rot.w);

  forward.current.set(0, 0, -1).applyQuaternion(qNow.current).normalize();
  right.current.set(1, 0, 0).applyQuaternion(qNow.current).normalize();
}

// armado del vector deseado
// armado del vector deseado
move.current
  .copy(right.current).multiplyScalar(mx)
  .addScaledVector(forward.current, forwardScale);

// si no hay input, no normalices (evita NaN/temblores)
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

    // =========================
    // Viento (capado)
    // =========================
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

 // =========================
// Cámara follow
// - assistMode: cámara "detrás del dron" (rota con el dron) => controles se sienten "normales" para aprender
// - realMode: cámara NO rota con el dron => si el dron gira 180°, se siente invertido respecto a cámara (como querés)
// =========================
if (!freeLook) {
  if (assistMode) {
    // cámara detrás del dron (rota con el yaw del dron)
    const offset = camOffset.current.clone().applyQuaternion(qNow.current);
    camPos.current.set(pos.x, pos.y, pos.z).add(offset);
  } else {
    // REAL: cámara en offset de mundo (NO rota con el dron)
    camPos.current.set(pos.x, pos.y, pos.z).add(camOffset.current);
  }

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
      enabledRotations={enabledRotations} // ✅ ahora sí aplicado
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
