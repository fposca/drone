import { RigidBody } from '@react-three/rapier';

export function SafePad() {
  return (
    <RigidBody
      type="fixed"
      colliders="cuboid"
      userData={{ type: 'safe-ground' }}
    >
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <cylinderGeometry args={[2, 2, 0.02, 32]} />
        <meshStandardMaterial color="#2b2b2b" />
      </mesh>
    </RigidBody>
  );
}
