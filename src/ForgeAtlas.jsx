import React, { useEffect, useRef } from 'react';

// Real-time procedural 3D sliced-torus sculpture inspired by the Codegrill Forge Atlas artwork.
// Renders depth-sorted parametric orange slices with evolving sinusoidal waves and smooth 3D rotation.
export function ForgeAtlas({ className = 'atlas-art', variant = 'dark' }) {
  const canvasRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const SLICES = 76;
    const RING_STEPS = 44;

    let frameId = 0;
    let startTime = performance.now();

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(240, Math.round(rect.width || 420));
      const height = Math.max(180, Math.round(rect.height || 300));
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width, height };
    }

    function drawFrame(now) {
      const { width, height } = resize();
      const t = prefersReduced ? 1.2 : (now - startTime) * 0.00075;

      ctx.clearRect(0, 0, width, height);

      const cx = width * 0.5;
      const cy = height * 0.5;
      const scale = Math.min(width, height) * 0.34;

      const rotY = t * 0.62 + pointerRef.current.x * 0.35;
      const rotX = 0.52 + Math.sin(t * 0.45) * 0.16 + pointerRef.current.y * 0.25;
      const rotZ = Math.sin(t * 0.28) * 0.12;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosZ = Math.cos(rotZ);
      const sinZ = Math.sin(rotZ);

      const majorR = 0.92;
      const baseMinorR = 0.42;

      const projectedSlices = [];

      for (let i = 0; i < SLICES; i += 1) {
        const u = (i / SLICES) * Math.PI * 2;
        // Leave a subtle sculptural slit like the reference artwork
        if (Math.abs(Math.sin(u * 0.5)) < 0.045) continue;

        const cosU = Math.cos(u);
        const sinU = Math.sin(u);

        // Evolving organic wave modulation along the torus circumference
        const wave = 1 + 0.22 * Math.sin(3 * u + t * 1.35) + 0.12 * Math.cos(5 * u - t * 0.9);
        const minorR = baseMinorR * wave;

        const points = [];
        let zSum = 0;

        for (let j = 0; j < RING_STEPS; j += 1) {
          const v = (j / RING_STEPS) * Math.PI * 2;
          // Elliptical ribbon cross-section with gentle ripple
          const ripple = 1 + 0.09 * Math.sin(2 * v + u * 2 + t * 1.1);
          const rx = minorR * 0.46 * Math.cos(v) * ripple;
          const ry = minorR * 1.18 * Math.sin(v) * ripple;

          const r = majorR + rx;
          let x = r * cosU;
          let y = ry;
          let z = r * sinU;

          // Rotate Z
          const xz = x * cosZ - y * sinZ;
          const yz = x * sinZ + y * cosZ;
          x = xz;
          y = yz;

          // Rotate Y
          const xy = x * cosY + z * sinY;
          const zy = -x * sinY + z * cosY;
          x = xy;
          z = zy;

          // Rotate X
          const yx = y * cosX - z * sinX;
          const zx = y * sinX + z * cosX;
          y = yx;
          z = zx;

          const perspective = 3.2 / (3.2 - z * 0.55);
          points.push([cx + x * scale * perspective, cy + y * scale * perspective]);
          zSum += z;
        }

        const avgZ = zSum / RING_STEPS;
        projectedSlices.push({ points, avgZ, u });
      }

      // Painter's algorithm: draw farthest slices first
      projectedSlices.sort((a, b) => a.avgZ - b.avgZ);

      const strokeColor = variant === 'hero' ? '#2a140a' : '#1b110c';

      for (const slice of projectedSlices) {
        const depthNorm = Math.max(0, Math.min(1, (slice.avgZ + 1.4) / 2.8));
        // Subtle warm orange tonal shading from deep terracotta in back to glowing persimmon in front
        const lightness = variant === 'hero'
          ? 52 + depthNorm * 14
          : 50 + depthNorm * 16;
        ctx.fillStyle = `hsl(15, 96%, ${lightness.toFixed(1)}%)`;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.2;

        ctx.beginPath();
        const pts = slice.points;
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let k = 1; k < pts.length; k += 1) {
          ctx.lineTo(pts[k][0], pts[k][1]);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      if (!prefersReduced) {
        frameId = requestAnimationFrame(drawFrame);
      }
    }

    frameId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(frameId);
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      className={`forge-atlas-canvas ${className}`}
      aria-hidden="true"
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        pointerRef.current = {
          x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
          y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
        };
      }}
      onPointerLeave={() => {
        pointerRef.current = { x: 0, y: 0 };
      }}
    />
  );
}
