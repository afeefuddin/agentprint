"use client";

import { useEffect, useRef } from "react";
import createGlobe from "cobe";

const markers = [
  { location: [37.7749, -122.4194] as [number, number], size: 0.055 },
  { location: [40.7128, -74.006] as [number, number], size: 0.04 },
  { location: [51.5072, -0.1276] as [number, number], size: 0.055 },
  { location: [12.9716, 77.5946] as [number, number], size: 0.065 },
  { location: [35.6762, 139.6503] as [number, number], size: 0.045 },
  { location: [-33.8688, 151.2093] as [number, number], size: 0.045 },
  { location: [-23.5505, -46.6333] as [number, number], size: 0.045 },
  { location: [-33.9249, 18.4241] as [number, number], size: 0.04 }
];

const arcs = [
  { from: markers[0].location, to: markers[2].location },
  { from: markers[2].location, to: markers[3].location },
  { from: markers[3].location, to: markers[4].location },
  { from: markers[4].location, to: markers[5].location },
  { from: markers[1].location, to: markers[6].location }
];

export function ShareGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let phi = 0.2;
    let frame = 0;
    let size = Math.max(320, Math.round(canvas.getBoundingClientRect().width));

    const globe = createGlobe(canvas, {
      width: size * Math.min(window.devicePixelRatio, 2),
      height: size * Math.min(window.devicePixelRatio, 2),
      devicePixelRatio: Math.min(window.devicePixelRatio, 2),
      phi,
      theta: 0.1,
      dark: 0,
      diffuse: 1.35,
      mapSamples: 18000,
      mapBrightness: 2.2,
      mapBaseBrightness: 0.02,
      baseColor: [0.95, 0.965, 1],
      markerColor: [0.18, 0.4, 0.86],
      glowColor: [0.93, 0.96, 1],
      markers,
      arcs,
      arcColor: [0.2, 0.42, 0.86],
      arcWidth: 0.45,
      arcHeight: 0.22,
      markerElevation: 0.025,
      opacity: 0.86
    });

    const resize = () => {
      size = Math.max(320, Math.round(canvas.getBoundingClientRect().width));
      const dpr = Math.min(window.devicePixelRatio, 2);
      globe.update({ width: size * dpr, height: size * dpr, devicePixelRatio: dpr });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const animate = () => {
      if (!reducedMotion) phi += 0.0022;
      globe.update({ phi });
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      globe.destroy();
    };
  }, []);

  return <canvas ref={canvasRef} className="share-globe-canvas" aria-hidden="true" />;
}
