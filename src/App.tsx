import { useState } from 'react';
import { Scene } from './canvas/Scene';
import { StartScreen } from './ui/StartScreen';
import { ShooterMode } from './canvas/ShooterMode';

type Mode = 'menu' | 'beginner' | 'shooter';

export default function App() {
  const [mode, setMode] = useState<Mode>('menu');

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {mode === 'menu' && (
        <StartScreen
          onBeginner={() => setMode('beginner')}
          onShooter={() => setMode('shooter')}
        />
      )}

      {mode === 'beginner' && <Scene />}

      {mode === 'shooter' && (
        <ShooterMode onBack={() => setMode('menu')} />
      )}
    </div>
  );
}
