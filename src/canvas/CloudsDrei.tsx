import { Clouds, Cloud } from '@react-three/drei';

type CloudsDreiProps = {
  height?: number;
  opacity?: number;
};

export function CloudsDrei({ height = 18, opacity = 0.35 }: CloudsDreiProps) {
  return (
    <Clouds limit={10}>
      {/* izquierda */}
      <Cloud position={[-30, height, -90]} speed={0.15} opacity={opacity} />
      <Cloud position={[-10, height + 2, -110]} speed={0.12} opacity={opacity * 0.9} />

      {/* centro */}
      <Cloud position={[20, height + 3, -120]} speed={0.10} opacity={opacity * 0.85} />

      {/* derecha */}
      <Cloud position={[70, height + 1, -130]} speed={0.08} opacity={opacity * 0.75} />
    </Clouds>
  );
}
