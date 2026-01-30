import { Html, useProgress } from '@react-three/drei';

export function Loader() {
  const { progress, active, item, loaded, total } = useProgress();

  if (!active) return null;

  return (
    <Html center>
      <div
        style={{
          padding: '14px 16px',
          borderRadius: 14,
          background: 'rgba(0,0,0,0.55)',
          color: 'white',
          fontFamily: 'system-ui',
          minWidth: 260,
          textAlign: 'center',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 18 }}>Cargando Drone Trainer…</div>

        <div style={{ marginTop: 10, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.15)' }}>
          <div
            style={{
              width: `${Math.max(2, Math.floor(progress))}%`,
              height: '100%',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.85)',
              transition: 'width 150ms linear',
            }}
          />
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
          {Math.floor(progress)}% — {loaded}/{total}
        </div>

        {item && (
          <div style={{ marginTop: 6, fontSize: 11, opacity: 0.7 }}>
            {String(item).split('/').slice(-1)[0]}
          </div>
        )}
      </div>
    </Html>
  );
}
