import { useEffect, useRef } from 'react';

export type PlayerInput = {
  // Analógicos: -1..1
  moveX: number;     // izquierda(-) / derecha(+)
  moveZ: number;     // adelante(-) / atrás(+)
  lift: number;      // subir(+) / bajar(-)

  // Digitales por si los querés
  boost: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const deadzone = (v: number, dz = 0.12) => (Math.abs(v) < dz ? 0 : v);

export function usePlayerInput(): PlayerInput {
  const ref = useRef<PlayerInput>({
    moveX: 0,
    moveZ: 0,
    lift: 0,
    boost: false,
  });

  // Estado teclado (flechas + R/F)
  const keys = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    r: false,
    f: false,
    shift: false,
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      switch (e.code) {
        case 'ArrowUp': keys.current.up = true; break;
        case 'ArrowDown': keys.current.down = true; break;
        case 'ArrowLeft': keys.current.left = true; break;
        case 'ArrowRight': keys.current.right = true; break;
        case 'KeyR': keys.current.r = true; break;
        case 'KeyF': keys.current.f = true; break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.shift = true;
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp': keys.current.up = false; break;
        case 'ArrowDown': keys.current.down = false; break;
        case 'ArrowLeft': keys.current.left = false; break;
        case 'ArrowRight': keys.current.right = false; break;
        case 'KeyR': keys.current.r = false; break;
        case 'KeyF': keys.current.f = false; break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keys.current.shift = false;
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Actualización “por frame” (sin state React)
  // Lo va a leer DroneRig en cada frame.
  const read = () => {
    // ---- teclado -> digital a analógico
    const k = keys.current;

    const kx = (k.right ? 1 : 0) + (k.left ? -1 : 0);
    const kz = (k.down ? 1 : 0) + (k.up ? -1 : 0); // up = adelante => z negativo
    const klift = (k.r ? 1 : 0) + (k.f ? -1 : 0);

    // ---- gamepad (si existe)
    let gx = 0;
    let gz = 0;
    let glift = 0;
    let gboost = false;

    const pads = navigator.getGamepads?.() ?? [];
    const gp = pads.find((p) => p && p.connected);

    if (gp) {
      // Sticks estándar:
      // axes[0] = left stick X
      // axes[1] = left stick Y (arriba=-1)
      const ax0 = deadzone(gp.axes[0] ?? 0);
      const ax1 = deadzone(gp.axes[1] ?? 0);

      gx = ax0;        // izquierda/derecha
      gz = ax1;        // adelante/atrás (arriba=-1 ya sirve)

      // Lift: gatillos o stick derecho (depende del control)
      // Intento: RT/LT (buttons 7 y 6 en mapeo estándar)
      const lt = gp.buttons[6]?.value ?? 0;
      const rt = gp.buttons[7]?.value ?? 0;
      glift = clamp(rt - lt, -1, 1); // RT sube, LT baja

      // Boost: A/Cross (button 0) o L3 (button 10)
      gboost = !!gp.buttons[0]?.pressed || !!gp.buttons[10]?.pressed;
    }

    // Mix: si hay input de joystick, prioriza joystick; si no, teclado.
    // (Si querés sumarlos, cambiá esta lógica)
    const useGamepad = Math.abs(gx) + Math.abs(gz) + Math.abs(glift) > 0.001;

    ref.current.moveX = clamp(useGamepad ? gx : kx, -1, 1);
    ref.current.moveZ = clamp(useGamepad ? gz : kz, -1, 1);
    ref.current.lift = clamp(useGamepad ? glift : klift, -1, 1);
    ref.current.boost = useGamepad ? gboost : k.shift;
  };

  // Guardamos la función en el ref para evitar re-renders
  // DroneRig va a llamar `inputRefRead.current()` por frame.
  const readRef = useRef(read);
  readRef.current = read;

  // Truco: exponemos un getter “vivo” y DroneRig llama a readRef.current()
  // Sin enganchar estado React.
  (ref.current as any).__read = readRef;

  return ref.current;
}
