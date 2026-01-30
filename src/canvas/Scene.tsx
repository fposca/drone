import { Canvas } from '@react-three/fiber';
import { Sky, Environment, OrbitControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { useEffect, useState } from 'react';

import { DroneRig } from '../drone/DroneRig';
import { Ground } from './Ground';
import { CloudsDrei } from './CloudsDrei';
import { SafePad } from './SafePad';
import { Obstacles } from './Obstacles';

export function Scene() {
  // =========================
  // Cámara: free look toggle
  // =========================
  const [freeLook, setFreeLook] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyC') setFreeLook((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // =========================
  // Game State (MVP)
  // =========================
  const MAX_HITS = 5;

  const [hitsLeft, setHitsLeft] = useState(MAX_HITS);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [resetSignal, setResetSignal] = useState(0);

  const restart = () => {
    setHitsLeft(MAX_HITS);
    setStatus('playing');
    setResetSignal((s) => s + 1);
  };

  const onHit = () => {
    if (status !== 'playing') return;

    setHitsLeft((h) => {
      const next = h - 1;
      if (next <= 0) setStatus('lost');
      return Math.max(0, next);
    });
  };

  // Enter para reiniciar (si querés, también sirve mientras jugás)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter') restart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <>
      {/* HUD simple (por ahora sin componente aparte) */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          padding: 12,
          borderRadius: 12,
          background: 'rgba(0,0,0,0.35)',
          color: 'white',
          fontFamily: 'system-ui',
          userSelect: 'none',
          zIndex: 10,
          minWidth: 220,
        }}
      >
        <div>
          ❤️ Energía: <b>{hitsLeft}</b> / {MAX_HITS}
        </div>
        <div>
          🎮 Estado: <b>{status}</b>
        </div>
        <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12 }}>
          C: Free look — Enter: Reiniciar
        </div>

        {status !== 'playing' && (
          <div style={{ marginTop: 10, fontWeight: 700 }}>
            {status === 'lost' ? '💥 Game Over' : '🏁 Ganaste'}
          </div>
        )}
      </div>
{/* Overlay Start / GameOver */}
{status === 'playing' && resetSignal === 0 && (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'grid',
      placeItems: 'center',
      zIndex: 20,
      pointerEvents: 'none',
      fontFamily: 'system-ui',
      color: 'white',
      textShadow: '0 2px 12px rgba(0,0,0,0.5)',
    }}
  >
    <div
      style={{
        background: 'rgba(0,0,0,0.35)',
        padding: '18px 22px',
        borderRadius: 16,
        textAlign: 'center',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 800 }}>🚁 Drone Trainer</div>
      <div style={{ marginTop: 8, opacity: 0.9 }}>
        WASD mover — R/F subir/bajar — C free look
      </div>
      <div style={{ marginTop: 12, fontSize: 16, fontWeight: 700 }}>
        Presioná <span style={{ padding: '2px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.15)' }}>Enter</span> para empezar
      </div>
    </div>
  </div>
)}

{status === 'lost' && (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'grid',
      placeItems: 'center',
      zIndex: 30,
      fontFamily: 'system-ui',
      color: 'white',
      textShadow: '0 2px 12px rgba(0,0,0,0.5)',
    }}
  >
    <div
      style={{
        background: 'rgba(0,0,0,0.45)',
        padding: '22px 26px',
        borderRadius: 18,
        textAlign: 'center',
        minWidth: 320,
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 900 }}>💥 GAME OVER</div>
      <div style={{ marginTop: 10, opacity: 0.9 }}>
        Presioná <b>Enter</b> para reiniciar en la base
      </div>
    </div>
  </div>
)}

      <Canvas camera={{ position: [0, 3, 8], fov: 60 }} shadows>
        {/* Fondo + neblina para profundidad */}
        <color attach="background" args={['#87ceeb']} />
        <fog attach="fog" args={['#87ceeb', 25, 180]} />

        {/* Nubes */}
        <CloudsDrei height={20} opacity={0.30} />
        <CloudsDrei height={32} opacity={0.18} />

        {/* Cielo */}
        <Sky
          distance={450000}
          sunPosition={[1, 0.45, 0.2]}
          inclination={0.45}
          azimuth={0.25}
          turbidity={8}
          rayleigh={2}
          mieCoefficient={0.006}
          mieDirectionalG={0.8}
        />

        {/* Luces */}
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[10, 25, 10]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={160}
          shadow-camera-left={-45}
          shadow-camera-right={45}
          shadow-camera-top={45}
          shadow-camera-bottom={-45}
        />

        {/* Iluminación adicional */}
        <Environment preset="sunset" />

        {/* Física */}
        <Physics gravity={[0, -9.81, 0]} timeStep="vary" maxCcdSubsteps={16}>
          <Ground />
          <SafePad />
          <Obstacles />
          {/* 🔥 Game hooks: onHit + resetSignal */}
          <DroneRig
            freeLook={freeLook}
            onHit={onHit}
            resetSignal={resetSignal}
            disabled={status !== 'playing'} // opcional: frenamos control si perdiste
          />
        </Physics>

        {/* Mouse orbit SOLO en modo freeLook */}
        <OrbitControls
          enabled={freeLook}
          enablePan={false}
          maxPolarAngle={Math.PI / 2}
          minDistance={3}
          maxDistance={30}
        />
      </Canvas>
    </>
  );
}
