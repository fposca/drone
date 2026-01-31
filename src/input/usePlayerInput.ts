import { useEffect, useRef } from 'react';

export type PlayerInput = {
  // Analógicos: -1..1
  moveX: number;     // izquierda(-) / derecha(+)
  moveZ: number;     // adelante(-) / atrás(+)
  lift: number;      // subir(+) / bajar(-)

  yaw: number;       // ✅ giro izquierda(-) / derecha(+)

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
    yaw: 0,     // ✅
    boost: false,
  });

  // Estado teclado (flechas + R/F + Q/E)
  const keys = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    r: false,
    f: false,
    q: false,      // ✅
    e: false,      // ✅
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

        case 'KeyQ': keys.current.q = true; break; // ✅ yaw left
        case 'KeyE': keys.current.e = true; break; // ✅ yaw right

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

        case 'KeyQ': keys.current.q = false; break; // ✅
        case 'KeyE': keys.current.e = false; break; // ✅

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
  const read = () => {
    const k = keys.current;

    // ---- teclado -> digital a analógico
    const kx = (k.right ? 1 : 0) + (k.left ? -1 : 0);
    const kz = (k.down ? 1 : 0) + (k.up ? -1 : 0); // up = adelante => z negativo
    const klift = (k.r ? 1 : 0) + (k.f ? -1 : 0);

    // ✅ yaw teclado (Q/E)
    const kyaw = (k.e ? 1 : 0) + (k.q ? -1 : 0);

    // ---- gamepad
    let gx = 0;
    let gz = 0;
    let glift = 0;
    let gyaw = 0;     // ✅
    let gboost = false;

    const pads = navigator.getGamepads?.() ?? [];
    const gp = pads.find((p) => p && p.connected);

    if (gp) {
      // left stick
      const ax0 = deadzone(gp.axes[0] ?? 0);
      const ax1 = deadzone(gp.axes[1] ?? 0);
      gx = ax0;
      gz = ax1; // arriba=-1 (sirve)

      // ✅ yaw: right stick X (mapeo estándar suele ser axes[2])
      const ax2 = deadzone(gp.axes[2] ?? 0);
      gyaw = ax2;

      // lift: RT/LT estándar (7/6)
      const lt = gp.buttons[6]?.value ?? 0;
      const rt = gp.buttons[7]?.value ?? 0;
      glift = clamp(rt - lt, -1, 1);

      // boost: Cross/A o L3
      gboost = !!gp.buttons[0]?.pressed || !!gp.buttons[10]?.pressed;
    }

    // prioriza gamepad si está moviéndose/rotando o usando lift
    const useGamepad =
      Math.abs(gx) + Math.abs(gz) + Math.abs(glift) + Math.abs(gyaw) > 0.001;

    ref.current.moveX = clamp(useGamepad ? gx : kx, -1, 1);
    ref.current.moveZ = clamp(useGamepad ? gz : kz, -1, 1);
    ref.current.lift = clamp(useGamepad ? glift : klift, -1, 1);

    // ✅ yaw final
    ref.current.yaw = clamp(useGamepad ? gyaw : kyaw, -1, 1);

    ref.current.boost = useGamepad ? gboost : k.shift;
  };

  const readRef = useRef(read);
  readRef.current = read;

  (ref.current as any).__read = readRef;

  return ref.current;
}
