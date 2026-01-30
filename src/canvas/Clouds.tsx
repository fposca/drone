import { useMemo } from 'react';
import * as THREE from 'three';

type CloudsProps = {
  offset?: [number, number, number];
  height?: number;
  opacity?: number;
  spread?: number;
};

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function Clouds({
  offset = [0, 0, 0],
  height = 18,        // ✅ default más arriba
  opacity = 0.22,     // ✅ más suave
  spread = 1.8,       // ✅ más grandes/lejanas
}: CloudsProps) {
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 'white',
        transparent: true,
        opacity,
        roughness: 1,
        metalness: 0,
        depthWrite: false,
      }),
    [opacity]
  );

  // “centros” de nubes: x, y, z, scale
  const cloudCenters: [number, number, number, number][] = useMemo(
    () => [
      [-30 * spread, 0 + height, -90 * spread, 7.0],
      [ 10 * spread, 2 + height, -110 * spread, 8.5],
      [ 55 * spread, -1 + height, -120 * spread, 6.5],
      [ 95 * spread, 1 + height, -130 * spread, 7.8],
    ],
    [height, spread]
  );

  // generamos “puffs” alrededor de cada centro
  const clusters = useMemo(() => {
    const out: Array<
      Array<{ x: number; y: number; z: number; s: number }>
    > = [];

    cloudCenters.forEach(([cx, cy, cz, baseS], idx) => {
      const rand = mulberry32(1234 + idx * 999);
      const puffs: Array<{ x: number; y: number; z: number; s: number }> = [];

      const puffCount = 10 + Math.floor(rand() * 6); // 10–15 puffs
      for (let i = 0; i < puffCount; i++) {
        const a = rand() * Math.PI * 2;
        const r = (0.6 + rand() * 1.2) * (baseS * 0.35);

        // nube “aplastada”: variación más en XZ que en Y
        const px = cx + Math.cos(a) * r;
        const pz = cz + Math.sin(a) * r;
        const py = cy + (rand() - 0.5) * (baseS * 0.12);

        const s = baseS * (0.22 + rand() * 0.28); // tamaño de puff

        puffs.push({ x: px, y: py, z: pz, s });
      }

      out.push(puffs);
    });

    return out;
  }, [cloudCenters]);

  // geometría más suave (más segmentos)
  const geo = useMemo(() => new THREE.SphereGeometry(1, 28, 20), []);

  return (
    <group position={offset}>
      {clusters.map((puffs, ci) => (
        <group key={ci}>
          {puffs.map((p, i) => (
            <mesh
              key={i}
              material={mat}
              geometry={geo}
              position={[p.x, p.y, p.z]}
              // ✅ aplastadas: nube más “plana”
              scale={[p.s * 1.35, p.s * 0.75, p.s * 1.15]}
            />
          ))}
        </group>
      ))}
    </group>
  );
}
