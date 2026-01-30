import { Canvas } from '@react-three/fiber';
import { Sky, Environment, OrbitControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { useEffect, useState } from 'react';

import { DroneRig } from '../drone/DroneRig';
import { Ground } from './Ground';
import { CloudsDrei } from './CloudsDrei';

export function Scene() {
  const [freeLook, setFreeLook] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyC') setFreeLook((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Canvas camera={{ position: [0, 3, 8], fov: 60 }} shadows>
      {/* Fondo + neblina para profundidad */}
      <color attach="background" args={['#87ceeb']} />
      <fog attach="fog" args={['#87ceeb', 25, 180]} />

      {/* Nubes (2 capas suelen quedar mejor que 4) */}
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

      {/* Iluminación “linda” adicional */}
      <Environment preset="sunset" />

      {/* Física */}
      <Physics gravity={[0, -9.81, 0]} timeStep="vary" maxCcdSubsteps={16}>
        <Ground />
        <DroneRig freeLook={freeLook} />
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
  );
}
