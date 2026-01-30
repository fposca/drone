import { RigidBody } from '@react-three/rapier';

export function Obstacles() {
  const items = [
    [4, 3, -10],
    [-3, 4, -14],
    [7, 5, -20],
    [-6, 3.5, -26],
  ] as [number, number, number][];

  return (
    <>
      {items.map(([x, y, z], i) => (
        <RigidBody
          key={i}
          type="fixed"
          colliders="cuboid"
          userData={{ type: 'obstacle' }}
        >
          <mesh position={[x, y, z]} castShadow>
            <boxGeometry args={[1.5, 1.5, 1.5]} />
            <meshStandardMaterial color="#c94b4b" />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}
