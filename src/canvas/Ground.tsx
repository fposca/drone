import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

export function Ground() {
  const [colorMap, normalMap, roughnessMap] = useTexture([
    '/texture/grass/grass_diffuse.jpg',
    '/texture/grass/grass_normal.jpg',
    '/texture/grass/grass_roughness.jpg',
  ]);

  // repetir la textura muchas veces para que no se estire
  [colorMap, normalMap, roughnessMap].forEach((t) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(60, 60);
    t.anisotropy = 16;
  });

  colorMap.colorSpace = THREE.SRGBColorSpace;

  return (
    <RigidBody type="fixed">
      {/* collider físico */}
      <CuboidCollider args={[100, 0.5, 100]} position={[0, -0.5, 0]} />

      {/* piso visual */}
      <mesh receiveShadow position={[0, -0.5, 0]}>
        <boxGeometry args={[200, 1, 200]} />
        <meshStandardMaterial
          map={colorMap}
          normalMap={normalMap}
          roughnessMap={roughnessMap}
          roughness={1}
          metalness={0}
        />
      </mesh>
    </RigidBody>
  );
}
