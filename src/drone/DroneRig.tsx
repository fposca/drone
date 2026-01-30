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
  onHitFlash?: () => void; // ✅ nuevo (para pantalla roja)
  resetSignal?: number;
  disabled?: boolean;
  windLevel?: number; // ✅ por si querés agregar viento
  freeze?: boolean; // ✅ nuevo (para congelar el drone)
};

export function DroneRig({
  freeLook = false,
  onHit,
  onHitFlash,
  resetSignal = 0,
  disabled = false,
  windLevel = 1,
  freeze = false,


}: DroneRigProps) {
  const rbRef = useRef<RapierRigidBody | null>(null);
  const keys = useKeyboardInput();

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

  // ===== Auto-level helpers =====
  const q = useRef(new THREE.Quaternion());
  const qTarget = useRef(new THREE.Quaternion());
  const upWorld = useRef(new THREE.Vector3(0, 1, 0));
  const upBody = useRef(new THREE.Vector3());
  const axis = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
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

     // ✅ CONGELADO durante "Nivel completado"
  if (freeze) {
    // importantísimo: matar toda inercia
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, true);

    // opcional: mantenerlo en la base mientras se muestra el cartel
    rb.setTranslation({ x: 0, y: 2, z: 0 }, true);
    rb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    return;
  }
    // si está disabled (game over / intro), no aplicar controles ni auto-level
    if (disabled) return;

    const pos = rb.translation();

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
    // AUTO-LEVEL (endereza suave)
    // - mantiene yaw (giro sobre Y)
    // - corrige pitch/roll
    // =========================
    if (!freeLook) {
      const rot = rb.rotation(); // {x,y,z,w}
      q.current.set(rot.x, rot.y, rot.z, rot.w);

      // up del drone en mundo
      upBody.current.set(0, 1, 0).applyQuaternion(q.current).normalize();

      // cuánto está inclinado (ángulo entre up del drone y up mundo)
      const angle = Math.acos(
        THREE.MathUtils.clamp(upBody.current.dot(upWorld.current), -1, 1)
      );

      // si está inclinado, armamos una corrección sobre el eje perpendicular
      if (angle > 0.0001) {
        axis.current.crossVectors(upBody.current, upWorld.current).normalize();

        // fuerza de auto-level (ajustá)
        const LEVEL_STRENGTH = 6.5; // más alto = endereza más rápido
        const t = 1 - Math.exp(-LEVEL_STRENGTH * dt); // smoothing estable por dt

        // rotación de corrección parcial
        qTarget.current.setFromAxisAngle(axis.current, angle * t);

        // aplicamos: qNew = qCorrection * q
        qTarget.current.multiply(q.current);

        rb.setRotation(
          { x: qTarget.current.x, y: qTarget.current.y, z: qTarget.current.z, w: qTarget.current.w },
          true
        );

        // opcional: amortiguar rotación angular para que no “siga girando”
        const av = rb.angvel();
        const DAMP = 0.92; // 0.9–0.98
        rb.setAngvel({ x: av.x * DAMP, y: av.y, z: av.z * DAMP }, true);
      }
    }

    // =========================
    // Movimiento
    // =========================
    const v = rb.linvel();

    // vertical
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

    // horizontal
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
    // =========================
    // Viento (nivel 2+)
    // =========================
    const t = performance.now() / 1000;

let windStrength = 0;
if (windLevel === 2) windStrength = 0.22;  // ✅ MUCHO más bajo
if (windLevel >= 3) windStrength = 0.38;

// ráfagas suaves
const gust = 0.6 + 0.4 * Math.sin(t * 0.25);
const windX = Math.sin(t * 0.35) * windStrength * gust;
const windZ = Math.cos(t * 0.28) * windStrength * 0.55 * gust;

if (windStrength > 0) {
  rb.addForce({ x: windX, y: 0, z: windZ }, true);

  // ✅ clamp extra para que no te arrastre infinito
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
          onHitFlash?.(); // ✅ pantalla roja
        }
      }}
    >
      <group>
        <DroneModel />
      </group>
    </RigidBody>
  );
}
