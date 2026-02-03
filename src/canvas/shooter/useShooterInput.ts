import { useMemo, useEffect, useRef } from 'react';

export type ShooterInput = {
  fireHeld: boolean;              // Space apretado
  firePressed: boolean;           // edge: true SOLO 1 frame

  toggleCockpitPressed: boolean;  // X (edge)
  reloadPressed: boolean;         // R (edge)

  // opcional: para debug
  lastKey?: string;

  // interno: se llama 1 vez por frame (BulletSystem ya lo hace)
  __read: () => void;
};

export function useShooterInput(): ShooterInput {
  // estados “held”
  const heldRef = useRef({
    fire: false,
  });

  // flags “pressed” (edge) que se levantan en keydown y se consumen en __read()
  const pressedRef = useRef({
    fire: false,
    toggle: false,
    reload: false,
  });

  // el objeto que se pasa por props (estable)
  const out = useMemo<ShooterInput>(() => {
    return {
      fireHeld: false,
      firePressed: false,
      toggleCockpitPressed: false,
      reloadPressed: false,
      lastKey: undefined,
      __read: () => {
        // 1) copiar held
        out.fireHeld = heldRef.current.fire;

        // 2) consumir edges (1 frame)
        out.firePressed = pressedRef.current.fire;
        out.toggleCockpitPressed = pressedRef.current.toggle;
        out.reloadPressed = pressedRef.current.reload;

        // 3) reset edges
        pressedRef.current.fire = false;
        pressedRef.current.toggle = false;
        pressedRef.current.reload = false;

        // 4) opcional: gamepad simple (R1 / RB para disparar)
        // Si no querés gamepad ahora, podés borrar esto.
        const gp = navigator.getGamepads?.()?.[0];
        if (gp) {
          const R1 = gp.buttons?.[5]?.pressed; // RB (Xbox) / R1 (muchos pads)
          if (R1 && !heldRef.current.fire) {
            pressedRef.current.fire = true; // edge
          }
          heldRef.current.fire = !!R1 || heldRef.current.fire; // si apretó R1, sostené
          // Nota: esto lo hace “sticky”; si querés que suelte cuando no está, reemplazá por:
          // heldRef.current.fire = !!R1;
          // (y agregá lógica edge similar)
        }
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      out.lastKey = e.code;

      if (e.code === 'Space') {
        if (!heldRef.current.fire) pressedRef.current.fire = true; // edge
        heldRef.current.fire = true; // held
      }

      if (e.code === 'KeyX') pressedRef.current.toggle = true;
      if (e.code === 'KeyR') pressedRef.current.reload = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      out.lastKey = e.code;

      if (e.code === 'Space') {
        heldRef.current.fire = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [out]);

  return out;
}
