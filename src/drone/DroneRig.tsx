import { RigidBody } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useKeyboardInput } from '../input/useKeyboardInput';
import { DroneModel } from './DroneModel';

type DroneRigProps = {
  freeLook?: boolean;
};

export function DroneRig({ freeLook = false }: DroneRigProps) {
  const rbRef = useRef<RapierRigidBody | null>(null);
  const keys = useKeyboardInput();

  // Cámara follow
  const { camera } = useThree();
  const camOffset = useRef(new THREE.Vector3(0, 2, 6));
  const camPos = useRef(new THREE.Vector3());
  const camTarget = useRef(new THREE.Vector3());

  const setRigidBody = useCallback((rb: RapierRigidBody | null) => {
    rbRef.current = rb;
  }, []);

  useFrame(() => {
    const rb = rbRef.current;
    if (!rb) return;

    // Posición actual (una sola vez)
    const pos = rb.translation();

    // =========================
    // Ground clamp (no atraviesa)
    // =========================
    const GROUND_Y = 0; // cara superior del piso (si tu box está centrado en -0.5 y mide 1)
    // 🚨 tu drone ahora es más alto que 0.15, así que subimos el half height
    // Ajustalo si agrandás más el modelo:
    const DRONE_HALF_HEIGHT = 0.20; // ✅ más realista con tu modelo actual
    const GROUND_EPS = 0.01;
    const minY = GROUND_Y + DRONE_HALF_HEIGHT + GROUND_EPS;

    if (pos.y <= minY) {
      rb.setTranslation({ x: pos.x, y: minY, z: pos.z }, true);

      const vNow = rb.linvel();
      if (vNow.y < 0) {
        rb.setLinvel({ x: vNow.x, y: 0, z: vNow.z }, true);
      }
    }

    // Velocidad actual
    const v = rb.linvel();

    // =========================
    // Control vertical tipo DJI (R/F)
    // =========================
    const up = keys.throttleUp;
    const down = keys.throttleDown;

    const MAX_UP = 3.2;      // ✅ más lento (antes 5.8 era bastante)
    const MAX_DOWN = -2.6;   // ✅ bajada más controlada
    const ACCEL = 3.5;       // ✅ respuesta suave

    let vyTarget = 0;
    if (up) vyTarget = MAX_UP;
    if (down) vyTarget = MAX_DOWN;

    // si está en el piso, anulá el down
    if (down && pos.y <= minY + 0.001) {
      vyTarget = 0;
    }

    const ay = (vyTarget - v.y) * ACCEL;

    // =========================
    // Avance lateral WASD (DJI beginner)
    // =========================
    const ix = (keys.right ? 1 : 0) + (keys.left ? -1 : 0);
    const iz = (keys.back ? 1 : 0) + (keys.forward ? -1 : 0);

    const MAX_H_SPEED = 3.0; // ✅ más controlado
    const H_ACCEL = 2.2;

    const vxTarget = ix * MAX_H_SPEED;
    const vzTarget = iz * MAX_H_SPEED;

    const ax = (vxTarget - v.x) * H_ACCEL;
    const az = (vzTarget - v.z) * H_ACCEL;

    // =========================
    // Aplicamos fuerzas (vertical + horizontal)
    // =========================
    const m = rb.mass();
    rb.addForce({ x: m * ax, y: m * ay, z: m * az }, true);

    // =========================
    // Clamp hard de velocidad total (usando la vel actualizada)
    // =========================
    const v2 = rb.linvel(); // ✅ leer después de aplicar fuerzas

    const CLAMP_VX = 5;
    const CLAMP_VY = 4;
    const CLAMP_VZ = 5;

    rb.setLinvel(
      {
        x: Math.max(-CLAMP_VX, Math.min(CLAMP_VX, v2.x)),
        y: Math.max(-CLAMP_VY, Math.min(CLAMP_VY, v2.y)),
        z: Math.max(-CLAMP_VZ, Math.min(CLAMP_VZ, v2.z)),
      },
      true
    );

    // =========================
    // Cámara follow estilo DJI (solo si NO está freeLook)
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
    >
      <group>
        <DroneModel />
      </group>
    </RigidBody>
  );
}
