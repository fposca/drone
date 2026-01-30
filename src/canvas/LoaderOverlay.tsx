import { Html, useProgress } from '@react-three/drei';

export function LoaderOverlay() {
  const { progress, active, item, loaded, total } = useProgress();

  // Si querés que se vea SIEMPRE aunque active sea false, borrá este if.
  if (!active) return null;

  const pct = Math.round(progress);

  return (
    <Html center>
      <div
        style={{
          background: 'rgba(0,0,0,0.95)',
          padding: '26px 28px',
          borderRadius: 16,
          color: 'white',
          fontFamily: 'system-ui',
          textAlign: 'center',
          minWidth: 360,
          boxShadow: '0 12px 35px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800 }}>Cargando escena…</div>

        <div style={{ marginTop: 10, fontSize: 34, fontWeight: 900, lineHeight: 1 }}>
          {pct}%
        </div>

        <div style={{ marginTop: 8, opacity: 0.99, fontSize: 12 }}>
          {loaded} / {total}
        </div>

        {item && (
          <div
            style={{
              marginTop: 8,
              opacity: 0.95,
              fontSize: 11,
              maxWidth: 320,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={item}
          >
            {item}
          </div>
        )}

        <div
          style={{
            marginTop: 12,
            height: 8,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.6)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.85)',
              transition: 'width 120ms linear',
            }}
          />
        </div>
      </div>
    </Html>
  );
}
