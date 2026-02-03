import React, { useEffect } from 'react';
import { ShooterScene } from './shooter/ShooterScene';

export function ShooterMode({ onBack }: { onBack: () => void }) {
  // ESC para volver al menú
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ShooterScene onBack={onBack} />
    </div>
  );
}
