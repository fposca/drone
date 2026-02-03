// src/canvas/shooter/useShooterInput.ts
import { useEffect, useRef, useState } from 'react';

export type ShooterInput = {
  // disparo
  fireHeld: boolean;        // apretado
  firePressed: boolean;     // “edge” (solo 1 frame)
  // alias por si venías usando otros nombres
  shootHeld: boolean;
  shootPressed: boolean;

  // cámara
  toggleCockpitPressed: boolean;

  // opcional: recargar
  reloadPressed: boolean;
};

export function useShooterInput(): ShooterInput {
  const held = useRef({
    fire: false,
  });

  const pressedFrame = useRef({
    fire: false,
    toggleCockpit: false,
    reload: false,
  });

  // estado “tickeado” para que React re-renderice cuando hay pressed
  const [, force] = useState(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (e.code === 'Space') {
        if (!held.current.fire) pressedFrame.current.fire = true;
        held.current.fire = true;
        force((n) => n + 1);
      }

      if (e.code === 'KeyX') {
        pressedFrame.current.toggleCockpit = true;
        force((n) => n + 1);
      }

      if (e.code === 'KeyR') {
        pressedFrame.current.reload = true;
        force((n) => n + 1);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') held.current.fire = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // consumir flags “pressed” (1 frame)
  const firePressed = pressedFrame.current.fire;
  const toggleCockpitPressed = pressedFrame.current.toggleCockpit;
  const reloadPressed = pressedFrame.current.reload;

  // reset para el próximo render
  pressedFrame.current.fire = false;
  pressedFrame.current.toggleCockpit = false;
  pressedFrame.current.reload = false;

  const fireHeld = held.current.fire;

  return {
    fireHeld,
    firePressed,
    shootHeld: fireHeld,
    shootPressed: firePressed,
    toggleCockpitPressed,
    reloadPressed,
  };
}
