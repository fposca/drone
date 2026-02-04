import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls, Preload, Sky } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { LoaderOverlay } from '../LoaderOverlay';
import { Ground } from '../Ground';
import { SafePad } from '../SafePad';
import { Obstacles } from '../Obstacles';
import { CloudsDrei } from '../CloudsDrei';

import { AmmoPickups } from './world/AmmoPickups';
import { ShooterDroneRig } from './drone/ShooterDroneRig';
import { Enemies } from './world/Enemies';
import { BulletSystem } from './world/BulletSystem';

import { useShooterInput } from './useShooterInput';

type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

function Moon({ level }: { level: Level }) {
  if (level < 5) return null;
  const scale = level >= 8 ? 2.2 : level >= 7 ? 1.9 : level >= 6 ? 1.6 : 1.3;
  const opacity = level >= 8 ? 1 : 0.85;

  return (
    <group position={[-55, 65, -160]}>
      <mesh scale={scale}>
        <sphereGeometry args={[6, 28, 20]} />
        <meshStandardMaterial
          color="#e8eef7"
          emissive="#c9d6ff"
          emissiveIntensity={0.55}
          roughness={0.9}
          metalness={0.05}
          transparent
          opacity={opacity}
        />
      </mesh>

      <mesh scale={scale * 1.25}>
        <sphereGeometry args={[6.6, 18, 14]} />
        <meshStandardMaterial
          color="#a6b9ff"
          emissive="#a6b9ff"
          emissiveIntensity={0.45}
          transparent
          opacity={0.10}
          roughness={1}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

export function ShooterScene({ onBack }: { onBack: () => void }) {
  // ✅ HIT MARKER (ADENTRO DEL COMPONENTE)
  const [hitMarker, setHitMarker] = useState(false);
  const hitMarkerTO = useRef<number | null>(null);

  const onHitMarker = useCallback(() => {
    setHitMarker(true);
    if (hitMarkerTO.current) window.clearTimeout(hitMarkerTO.current);
    hitMarkerTO.current = window.setTimeout(() => setHitMarker(false), 90);
  }, []);

  useEffect(() => {
    return () => {
      if (hitMarkerTO.current) window.clearTimeout(hitMarkerTO.current);
    };
  }, []);

  // =========================
  // cámara / control
  // =========================
  const [freeLook, setFreeLook] = useState(false);
  const [assistMode, setAssistMode] = useState(true);
  const [cameraMode, setCameraMode] = useState<'chase' | 'cockpit'>('chase');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyC') setFreeLook((v) => !v);
      if (e.code === 'KeyV') setAssistMode((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // =========================
  // flash rojo (hit player)
  // =========================
  const [hitFlash, setHitFlash] = useState(false);
  const hitFlashTimeout = useRef<number | null>(null);

  const onHitFlash = useCallback(() => {
    setHitFlash(true);
    if (hitFlashTimeout.current) window.clearTimeout(hitFlashTimeout.current);
    hitFlashTimeout.current = window.setTimeout(() => setHitFlash(false), 140);
  }, []);

  useEffect(() => {
    return () => {
      if (hitFlashTimeout.current) window.clearTimeout(hitFlashTimeout.current);
    };
  }, []);

  // =========================
  // game state
  // =========================
  const MAX_HITS = 5;
  const MAX_LEVEL = 8 as const;

  const [hitsLeft, setHitsLeft] = useState(MAX_HITS);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [resetSignal, setResetSignal] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  const [level, setLevel] = useState<Level>(1);

  const [ammo, setAmmo] = useState(30);
  const [kills, setKills] = useState(0);

  const killsAtLevelStart = useRef(0);
  const levelUpTimeoutRef = useRef<number | null>(null);

  const KILLS_REQUIRED = useMemo<Record<Level, number>>(
    () => ({ 1: 3, 2: 4, 3: 5, 4: 6, 5: 7, 6: 8, 7: 9, 8: 12 }),
    []
  );

  const killsRequired = KILLS_REQUIRED[level];
  const [levelCleared, setLevelCleared] = useState(false);
  const [nextLevel, setNextLevel] = useState<Level>(2);

  // pose del drone
  const dronePosRef = useRef(new THREE.Vector3(0, 2, 0));
  const droneQuatRef = useRef(new THREE.Quaternion());
  const droneForwardRef = useRef(new THREE.Vector3(0, 0, -1));

  const visuals = useMemo(() => {
    const v: Record<
      Level,
      { bg: string; fog: string; env: any; skyOn: boolean; clouds: boolean; ambient: number; dir: number }
    > = {
      1: { bg: '#87ceeb', fog: '#87ceeb', env: 'sunset', skyOn: true, clouds: true, ambient: 0.35, dir: 1.2 },
      2: { bg: '#6f7f91', fog: '#6f7f91', env: 'sunset', skyOn: true, clouds: true, ambient: 0.3, dir: 1.0 },
      3: { bg: '#4c5a6b', fog: '#4c5a6b', env: 'sunset', skyOn: true, clouds: true, ambient: 0.24, dir: 0.9 },
      4: { bg: '#2b3340', fog: '#2b3340', env: 'night', skyOn: true, clouds: false, ambient: 0.18, dir: 0.75 },
      5: { bg: '#1b1f2a', fog: '#1b1f2a', env: 'night', skyOn: true, clouds: false, ambient: 0.14, dir: 0.65 },
      6: { bg: '#11131a', fog: '#11131a', env: 'night', skyOn: true, clouds: false, ambient: 0.12, dir: 0.55 },
      7: { bg: '#080a10', fog: '#080a10', env: 'night', skyOn: false, clouds: false, ambient: 0.1, dir: 0.45 },
      8: { bg: '#000000', fog: '#000000', env: 'night', skyOn: false, clouds: false, ambient: 0.08, dir: 0.38 },
    };
    return v[level];
  }, [level]);

  const restartAll = useCallback(() => {
    if (levelUpTimeoutRef.current) {
      window.clearTimeout(levelUpTimeoutRef.current);
      levelUpTimeoutRef.current = null;
    }

    setHitsLeft(MAX_HITS);
    setStatus('playing');
    setResetSignal((s) => s + 1);
    setHasStarted(true);

    setLevel(1);
    setAmmo(30);
    setKills(0);
    killsAtLevelStart.current = 0;

    setLevelCleared(false);
    setNextLevel(2);
    setCameraMode('chase');
  }, [MAX_HITS]);

  const onHit = useCallback(() => {
    if (status !== 'playing') return;
    onHitFlash();

    setHitsLeft((h) => {
      const next = h - 1;
      if (next <= 0) setStatus('lost');
      return Math.max(0, next);
    });
  }, [status, onHitFlash]);

  const onAmmoCollect = useCallback((amount: number) => {
    setAmmo((a) => Math.min(999, a + amount));
  }, []);

  const onEnemyKilled = useCallback(() => {
    setKills((k) => k + 1);
  }, []);

  // input
  const shooterInput = useShooterInput();

  // toggle cockpit con X
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code !== 'KeyX') return;

      if (!hasStarted) return;
      if (status !== 'playing') return;
      if (levelCleared) return;

      setCameraMode((m) => (m === 'chase' ? 'cockpit' : 'chase'));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasStarted, status, levelCleared]);

  // Enter start/restart
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Enter') return;
      if (!hasStarted) return restartAll();
      if (status === 'lost') return restartAll();
      if (status === 'won') return restartAll();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasStarted, status, restartAll]);

  // level up
  useEffect(() => {
    if (!hasStarted) return;
    if (status !== 'playing') return;
    if (levelCleared) return;

    const killsThisLevel = kills - killsAtLevelStart.current;
    if (killsThisLevel < killsRequired) return;
    if (levelUpTimeoutRef.current) return;

    const to = Math.min(level + 1, MAX_LEVEL) as Level;
    setNextLevel(to);
    setLevelCleared(true);

    levelUpTimeoutRef.current = window.setTimeout(() => {
      if (level === 8) {
        setStatus('won');
        setLevelCleared(false);
        levelUpTimeoutRef.current = null;
        return;
      }

      setLevel(to);
      setHitsLeft(MAX_HITS);
      setStatus('playing');
      setResetSignal((s) => s + 1);
      setLevelCleared(false);

      killsAtLevelStart.current = kills;
      setAmmo((a) => Math.max(a, 20));

      levelUpTimeoutRef.current = null;
    }, 1200);
  }, [hasStarted, status, levelCleared, kills, killsRequired, level, MAX_LEVEL, MAX_HITS]);

  useEffect(() => {
    return () => {
      if (levelUpTimeoutRef.current) window.clearTimeout(levelUpTimeoutRef.current);
    };
  }, []);

  const killsThisLevel = hasStarted ? kills - killsAtLevelStart.current : 0;

  return (
    <>
      {/* HUD */}
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
          minWidth: 280,
        }}
      >
        <div>❤️ Energía: <b>{hitsLeft}</b> / {MAX_HITS}</div>
        <div>🎮 Estado: <b>{hasStarted ? status : 'intro'}</b></div>

        <div style={{ marginTop: 6 }}>🧭 Nivel: <b>{level}</b> / 8</div>
        <div style={{ marginTop: 6 }}>🎯 Kills: <b>{killsThisLevel}</b> / {killsRequired}</div>
        <div style={{ marginTop: 6 }}>🔫 Ammo: <b>{ammo}</b></div>

        <div style={{ marginTop: 6 }}>
          🧠 Control: <b>{assistMode ? 'Asistido (cámara)' : 'Real (drone)'}</b>
        </div>
        <div style={{ marginTop: 6 }}>
          📷 Cámara: <b>{cameraMode === 'cockpit' ? 'Cockpit' : 'Chase'}</b>
        </div>

        <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12 }}>
          Enter: {!hasStarted ? 'Empezar' : status !== 'playing' ? 'Reiniciar' : '—'} — C: Free look — V: Control — X: Cockpit — Space/R1: Disparar — ESC: Menú
        </div>

        <div style={{ marginTop: 10 }}>
          <button
            onClick={onBack}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            Volver
          </button>
        </div>
      </div>
        {/* Crosshair (solo cockpit) */}
    {cameraMode === 'cockpit' && hasStarted && status === 'playing' && !levelCleared && (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 12,
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'system-ui',
        }}
      >
        <div style={{ position: 'relative', width: 24, height: 24 }}>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              bottom: 0,
              width: 2,
              transform: 'translateX(-50%)',
              background: 'rgba(255,255,255,0.75)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: 2,
              transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.75)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 6,
              height: 6,
              borderRadius: 999,
              transform: 'translate(-50%,-50%)',
              border: '2px solid rgba(255,255,255,0.8)',
            }}
          />
        </div>
      </div>
    )}

     

      {/* HIT MARKER (cuando pegás a un enemigo) */}
      {hitMarker && cameraMode === 'cockpit' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 13,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div style={{ position: 'relative', width: 18, height: 18 }}>
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, transform: 'translateX(-50%) rotate(45deg)', background: 'rgba(255,255,255,0.95)' }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, transform: 'translateX(-50%) rotate(-45deg)', background: 'rgba(255,255,255,0.95)' }} />
          </div>
        </div>
      )}

      {/* Flash rojo */}
      {hitFlash && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,0,0,0.18)',
            zIndex: 50,
            pointerEvents: 'none',
          }}
        />
      )}
{/* LEVEL CLEARED */}
{levelCleared && status === 'playing' && (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'grid',
      placeItems: 'center',
      zIndex: 40,
      pointerEvents: 'none',
      fontFamily: 'system-ui',
      color: 'white',
      textShadow: '0 2px 12px rgba(0,0,0,0.6)',
      background: 'rgba(0,0,0,0.35)',
    }}
  >
    <div
      style={{
        background: 'rgba(0,0,0,0.55)',
        padding: '18px 22px',
        borderRadius: 16,
        textAlign: 'center',
        minWidth: 340,
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 900 }}>✅ NIVEL COMPLETADO</div>
      <div style={{ marginTop: 10, opacity: 0.9, fontSize: 14 }}>
        Preparando <b>Nivel {nextLevel}</b>…
      </div>
    </div>
  </div>
)}

{/* START */}
{!hasStarted && (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'grid',
      placeItems: 'center',
      zIndex: 30,
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
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 800 }}>🚁 Drone Shooter</div>
      <div style={{ marginTop: 8, opacity: 0.9 }}>
        Flechas mover — R/F subir/bajar — Q/E girar — Space disparar — X cockpit
      </div>
      <div style={{ marginTop: 12, fontSize: 16, fontWeight: 700 }}>
        Presioná{' '}
        <span style={{ padding: '2px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.15)' }}>
          Enter
        </span>{' '}
        para empezar
      </div>
    </div>
  </div>
)}

{/* GAME OVER */}
{hasStarted && status === 'lost' && (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'grid',
      placeItems: 'center',
      zIndex: 60, // 👈 bien arriba de todo
      pointerEvents: 'none',
      fontFamily: 'system-ui',
      color: 'white',
      textShadow: '0 2px 12px rgba(0,0,0,0.5)',
      background: 'rgba(0,0,0,0.25)',
    }}
  >
    <div
      style={{
        background: 'rgba(0,0,0,0.55)',
        padding: '22px 26px',
        borderRadius: 18,
        textAlign: 'center',
        minWidth: 340,
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 900 }}>💥 GAME OVER</div>
      <div style={{ marginTop: 10, opacity: 0.9 }}>
        Presioná <b>Enter</b> para reiniciar
      </div>
    </div>
  </div>
)}

{/* WON */}
{hasStarted && status === 'won' && (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'grid',
      placeItems: 'center',
      zIndex: 60,
      pointerEvents: 'none',
      fontFamily: 'system-ui',
      color: 'white',
      textShadow: '0 2px 12px rgba(0,0,0,0.7)',
      background: 'rgba(0,0,0,0.55)',
    }}
  >
    <div
      style={{
        background: 'rgba(0,0,0,0.7)',
        padding: '22px 26px',
        borderRadius: 18,
        textAlign: 'center',
        minWidth: 380,
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 950 }}>🏁 COMPLETADO</div>
      <div style={{ marginTop: 10, opacity: 0.9 }}>
        Terminaste el <b>Nivel 8</b>.
      </div>
      <div style={{ marginTop: 12, opacity: 0.95 }}>
        Presioná <b>Enter</b> para reiniciar todo
      </div>
    </div>
  </div>
)}
      <Canvas camera={{ position: [0, 3, 8], fov: 60 }} shadows>
        <color attach="background" args={[visuals.bg]} />
        <fog attach="fog" args={[visuals.fog, 25, 180]} />

        <Suspense fallback={<LoaderOverlay />}>
          {visuals.clouds && (
            <>
              <CloudsDrei height={20} opacity={0.26} />
              <CloudsDrei height={32} opacity={0.15} />
            </>
          )}

          {visuals.skyOn && (
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
          )}

          <Moon level={level} />

          <ambientLight intensity={visuals.ambient} />
          <directionalLight
            position={[10, 25, 10]}
            intensity={visuals.dir}
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

          <Environment preset={visuals.env} />

          <Physics gravity={[0, -9.81, 0]} timeStep="vary" maxCcdSubsteps={16}>
            <Ground />
            <SafePad />

            <Obstacles level={Math.min(3, level)} onHit={onHit} />

            <AmmoPickups level={level} runId={resetSignal} onCollect={onAmmoCollect} />

            <Enemies level={level} runId={resetSignal} playerPosRef={dronePosRef} onEnemyKilled={onEnemyKilled} />

            <BulletSystem
              runId={resetSignal}
              level={level}
              disabled={!hasStarted || status !== 'playing' || levelCleared}
              playerPosRef={dronePosRef}
              playerQuatRef={droneQuatRef}
              playerForwardRef={droneForwardRef}
              ammo={ammo}
              onEnemyHit={onHitMarker} // ✅ acá
              onConsumeAmmo={() => setAmmo((a) => Math.max(0, a - 1))}
              onHitPlayer={onHit}
              onEnemyKilled={onEnemyKilled}
              shooterInput={shooterInput}
            />

            <ShooterDroneRig
              freeLook={freeLook}
              resetSignal={resetSignal}
              disabled={!hasStarted || status !== 'playing' || levelCleared}
              windLevel={level}
              freeze={levelCleared || status === 'won'}
              assistMode={assistMode}
              cameraMode={cameraMode}
              onHit={onHit}
              onHitFlash={onHitFlash}
              onPose={(p, q, fwd) => {
                dronePosRef.current.copy(p);
                droneQuatRef.current.copy(q);
                droneForwardRef.current.copy(fwd);
              }}
            />
          </Physics>

          <OrbitControls enabled={freeLook} enablePan={false} maxPolarAngle={Math.PI / 2} minDistance={3} maxDistance={30} />
          <Preload all />
        </Suspense>
      </Canvas>
    </>
  );
}
