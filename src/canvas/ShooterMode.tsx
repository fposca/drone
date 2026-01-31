import React from 'react';

export function ShooterMode({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', color: '#fff', padding: 24 }}>
      <h2 style={{ marginTop: 0 }}>Modo Shooter</h2>
      <p>Acá vamos a armar el modo shooter después.</p>
      <button
        onClick={onBack}
        style={{
          padding: '10px 14px',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(255,255,255,0.08)',
          color: '#fff',
          cursor: 'pointer',
          fontWeight: 700,
        }}
      >
        Volver al menú
      </button>
    </div>
  );
}
