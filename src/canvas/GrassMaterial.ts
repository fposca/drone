import * as THREE from 'three';

export function makeGrassTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;

  // base
  ctx.fillStyle = '#2f5e2f';
  ctx.fillRect(0, 0, size, size);

  // ruido “pasto”
  for (let i = 0; i < 30000; i++) {
    const x = (Math.random() * size) | 0;
    const y = (Math.random() * size) | 0;
    const g = 120 + (Math.random() * 80) | 0;
    const a = Math.random() * 0.25;
    ctx.fillStyle = `rgba(30, ${g}, 30, ${a})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // algunas “pajas” claras
  for (let i = 0; i < 2000; i++) {
    const x = (Math.random() * size) | 0;
    const y = (Math.random() * size) | 0;
    ctx.fillStyle = `rgba(180, 210, 140, ${Math.random() * 0.18})`;
    ctx.fillRect(x, y, 1, 2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(25, 25);
  tex.anisotropy = 8;
  tex.needsUpdate = true;

  return tex;
}
