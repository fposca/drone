import React from 'react';

type StartScreenProps = {
  onBeginner: () => void;
  onShooter: () => void;
};

export function StartScreen({ onBeginner, onShooter }: StartScreenProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        background:
          'radial-gradient(ellipse at top, rgba(90,120,255,0.25) 0%, rgba(0,0,0,0.92) 55%, #000 100%)',
        color: '#fff',
        fontFamily: 'system-ui',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 'min(820px, 94vw)',
          borderRadius: 18,
          border: '1px solid rgba(255,255,255,0.14)',
          background: 'rgba(0,0,0,0.45)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.65)',
          padding: 24,
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 38, letterSpacing: 0.5 }}>🚁 Drone Trainer</h1>
          <span
            style={{
              fontSize: 12,
              opacity: 0.85,
              border: '1px solid rgba(255,255,255,0.18)',
              padding: '4px 10px',
              borderRadius: 999,
            }}
          >
            alpha
          </span>
        </div>

        <p style={{ marginTop: 12, lineHeight: 1.55, opacity: 0.92 }}>
          Un minijuego para <b>aprender a volar</b>: control de altura, precisión, viento y riesgo.
          Pasás niveles juntando monedas y evitando obstáculos.
        </p>

        <div style={{ marginTop: 12, opacity: 0.85, fontSize: 14, lineHeight: 1.6 }}>
          <div><b>Teclado:</b> Flechas = mover, <b>R/F</b> = subir/bajar, <b>C</b> = free look.</div>
          <div><b>Joystick:</b> stick izq = mover, gatillos = subir/bajar (según mapeo).</div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 22, flexWrap: 'wrap' }}>
          <button
            onClick={onBeginner}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.18)',
              background: 'rgba(255,255,255,0.10)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            Jugar (Principiantes)
          </button>

          <button
            onClick={onShooter}
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid rgba(255,0,140,0.35)',
              background: 'rgba(255,0,140,0.12)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            Modo Shooter
          </button>
        </div>

        <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
          * El modo Shooter te lleva a otro componente (lo armamos después).
        </div>
      </div>
    </div>
  );
}
