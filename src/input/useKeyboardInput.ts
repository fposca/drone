import { useEffect, useRef } from 'react';

export type KeyboardState = {
  throttleUp: boolean;   // R
  throttleDown: boolean; // F
    forward: boolean;   // W
  back: boolean;      // S
  left: boolean;      // A
  right: boolean;     // D
};

const initial: KeyboardState = {
  throttleUp: false,
  throttleDown: false,
  forward: false,
  back: false,
  left: false,
  right: false,
};

export function useKeyboardInput(): KeyboardState {
  const stateRef = useRef<KeyboardState>({ ...initial });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      switch (e.code) {
        case 'KeyR':
          stateRef.current.throttleUp = true;
          break;
        case 'KeyF':
          stateRef.current.throttleDown = true;
          break;
          case 'KeyW': stateRef.current.forward = true; break;
case 'KeyS': stateRef.current.back = true; break;
case 'KeyA': stateRef.current.left = true; break;
case 'KeyD': stateRef.current.right = true; break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyR':
          stateRef.current.throttleUp = false;
          break;
        case 'KeyF':
          stateRef.current.throttleDown = false;
          break;
          case 'KeyW': stateRef.current.forward = false; break;
case 'KeyS': stateRef.current.back = false; break;
case 'KeyA': stateRef.current.left = false; break;
case 'KeyD': stateRef.current.right = false; break;

      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return stateRef.current;
}
