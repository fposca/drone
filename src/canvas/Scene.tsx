import { Canvas } from '@react-three/fiber';
import { Sky, Environment, OrbitControls, Preload } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import { LoaderOverlay } from './LoaderOverlay';
import { DroneRig } from '../drone/DroneRig';
import { Ground } from './Ground';
import { CloudsDrei } from './CloudsDrei';
import { SafePad } from './SafePad';
import { Obstacles } from './Obstacles';
import { Pickups } from './Pickups';
import { BossDrone } from './BossDrone';

type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

function Moon({ level }: { level: Level }) {
  // desde lvl 5 aparece la luna
  if (level < 5) return null;

  // a medida que sube el nivel, la luna se ve más grande/brillante
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

      {/* glow fake */}
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

export function Scene() {
  // =========================
  // Cámara free look
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
  // Flash rojo (hit)
  // =========================
  const [hitFlash, setHitFlash] = useState(false);
  const hitFlashTimeout = useRef<number | null>(null);

  const onHitFlash = useCallback(() => {
    setHitFlash(true);
    if (hitFlashTimeout.current) window.clearTimeout(hitFlashTimeout.current);
    hitFlashTimeout.current = window.setTimeout(() => setHitFlash(false), 140);
  }, []);
  const [assistMode, setAssistMode] = useState(true); // arrancá en asistido si querés

  useEffect(() => {
    return () => {
      if (hitFlashTimeout.current) window.clearTimeout(hitFlashTimeout.current);
    };
  }, []);

  // =========================
  // Game state
  // =========================
  const MAX_HITS = 5;

  const [hitsLeft, setHitsLeft] = useState(MAX_HITS);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const [resetSignal, setResetSignal] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const MAX_LEVEL = 8 as const;
  type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

  const levelUpTimeoutRef = useRef<number | null>(null);


  const [level, setLevel] = useState<Level>(1);
  const [score, setScore] = useState(0);

  const COINS_PER_LEVEL = useMemo<Record<Level, number>>(
    () => ({
      1: 2,
      2: 6,
      3: 8,
      4: 10,  // desde acá se pone oscuro
      5: 10,  // aparece luna
      6: 12,
      7: 14,
      8: 16,  // boss + coins
    }),
    []
  );

  const coinsTotal = COINS_PER_LEVEL[level];

  // transición nivel
  const [levelCleared, setLevelCleared] = useState(false);
  const [nextLevel, setNextLevel] = useState<Level>(2);

  // posición del drone (para boss)
  const dronePosRef = useRef(new THREE.Vector3(0, 2, 0));

  // =========================
  // Visuales por nivel
  // =========================
  const visuals = useMemo(() => {
    const v: Record<Level, { bg: string; fog: string; env: any; skyOn: boolean; clouds: boolean; ambient: number; dir: number }> = {
      1: { bg: '#87ceeb', fog: '#87ceeb', env: 'sunset', skyOn: true, clouds: true, ambient: 0.35, dir: 1.2 },
      2: { bg: '#6f7f91', fog: '#6f7f91', env: 'sunset', skyOn: true, clouds: true, ambient: 0.30, dir: 1.0 },
      3: { bg: '#4c5a6b', fog: '#4c5a6b', env: 'sunset', skyOn: true, clouds: true, ambient: 0.24, dir: 0.9 },
      4: { bg: '#2b3340', fog: '#2b3340', env: 'night', skyOn: true, clouds: false, ambient: 0.18, dir: 0.75 },
      5: { bg: '#1b1f2a', fog: '#1b1f2a', env: 'night', skyOn: true, clouds: false, ambient: 0.14, dir: 0.65 },
      6: { bg: '#11131a', fog: '#11131a', env: 'night', skyOn: true, clouds: false, ambient: 0.12, dir: 0.55 },
      7: { bg: '#080a10', fog: '#080a10', env: 'night', skyOn: false, clouds: false, ambient: 0.10, dir: 0.45 },
      8: { bg: '#000000', fog: '#000000', env: 'night', skyOn: false, clouds: false, ambient: 0.08, dir: 0.38 },
    };
    return v[level];
  }, [level]);

  // =========================
  // Actions
  // =========================
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
    setScore(0);
    setLevelCleared(false);
    setNextLevel(2);
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

  const onCollect = useCallback(() => {
    if (levelCleared) return;
    setScore((s) => Math.min(coinsTotal, s + 1));
  }, [levelCleared, coinsTotal]);

  // ✅ avanzar nivel al juntar todas las monedas
  useEffect(() => {
    if (!hasStarted) return;
    if (status !== 'playing') return;
    if (levelCleared) return;
    if (score < coinsTotal) return;

    // si ya hay un timeout en curso, no reprogramar
    if (levelUpTimeoutRef.current) return;

    const to = (Math.min(level + 1, MAX_LEVEL) as Level);

    setNextLevel(to);
    setLevelCleared(true);

    levelUpTimeoutRef.current = window.setTimeout(() => {
      setLevel(to);
      setScore(0);
      setHitsLeft(MAX_HITS);
      setStatus('playing');
      setResetSignal((s) => s + 1);
      setLevelCleared(false);

      levelUpTimeoutRef.current = null;
    }, 1200);
  }, [hasStarted, status, levelCleared, score, coinsTotal, level, MAX_HITS]);
  useEffect(() => {
    return () => {
      if (levelUpTimeoutRef.current) {
        window.clearTimeout(levelUpTimeoutRef.current);
        levelUpTimeoutRef.current = null;
      }
    };
  }, []);
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'KeyV') setAssistMode(v => !v); // V cambia modo
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, []);

  // Enter start / restart
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
          minWidth: 250,
        }}
      >
        <div>❤️ Energía: <b>{hitsLeft}</b> / {MAX_HITS}</div>
        <div>🎮 Estado: <b>{hasStarted ? status : 'intro'}</b></div>
        <div style={{ marginTop: 6 }}>🧭 Nivel: <b>{level}</b> / 8</div>
        <div style={{ marginTop: 6 }}>🪙 Monedas: <b>{score}</b> / {coinsTotal}</div>
        <div style={{ marginTop: 6 }}>
  🧠 Control: <b>{assistMode ? 'Asistido (cámara)' : 'Real (drone)'}</b>
</div>

        <div style={{ marginTop: 8, opacity: 0.85, fontSize: 12 }}>
          C: Free look — V: Cambiar control  Enter:{' '}
          {!hasStarted ? 'Empezar' : status === 'lost' ? 'Reiniciar' : status === 'won' ? 'Reiniciar' : '—'}
        </div>
      </div>

      {/* Nivel completado */}
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

      {/* Start */}
      {!hasStarted && (
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
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 800 }}>🚁 Drone Trainer</div>
            <div style={{ marginTop: 8, opacity: 0.9 }}>
              WASD mover — R/F subir/bajar — C free look
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

      {/* Game Over */}
      {hasStarted && status === 'lost' && (
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
              background: 'rgba(0,0,0,0.45)',
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
              Terminaste el <b>Nivel 8</b> (boss).
            </div>
            <div style={{ marginTop: 12, opacity: 0.95 }}>
              Presioná <b>Enter</b> para reiniciar todo
            </div>
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

            <Pickups
              level={level}
              count={coinsTotal}
              runId={resetSignal} // importante para que regenere bien por nivel
              onCollect={onCollect}
            />

            <Obstacles level={level} onHit={onHit} />

            {/* Boss solo en nivel 8 */}
            {level === 8 && (
              <BossDrone
                runId={resetSignal}
                targetRef={dronePosRef}
                onHit={onHit}
              />
            )}

            <DroneRig
              freeLook={freeLook}
              onHit={onHit}
              onHitFlash={onHitFlash}
              resetSignal={resetSignal}
              disabled={!hasStarted || status !== 'playing' || levelCleared}
              windLevel={level} // podés hacer: viento leve 2..7, fuerte 8
              freeze={levelCleared || status === 'won'}
              assistMode={assistMode}
              onPosition={(p) => {
                dronePosRef.current.copy(p);
              }}
            />
          </Physics>

          <OrbitControls
            enabled={freeLook}
            enablePan={false}
            maxPolarAngle={Math.PI / 2}
            minDistance={3}
            maxDistance={30}
          />

          <Preload all />
        </Suspense>
      </Canvas>
    </>
  );
}
