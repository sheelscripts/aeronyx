"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

// ── AQI → color gradient (CPCB breakpoints) ──────────────────
function aqiToGradientColor(aqi: number, alpha = 0.7) {
  const stops = [
    { aqi: 0, r: 34, g: 197, b: 94 },
    { aqi: 50, r: 34, g: 197, b: 94 },
    { aqi: 100, r: 132, g: 204, b: 22 },
    { aqi: 150, r: 250, g: 204, b: 21 },
    { aqi: 200, r: 249, g: 115, b: 22 },
    { aqi: 300, r: 239, g: 68, b: 68 },
    { aqi: 400, r: 185, g: 28, b: 28 },
    { aqi: 500, r: 127, g: 29, b: 29 },
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    if (aqi <= stops[i + 1].aqi) {
      const t = (aqi - stops[i].aqi) / (stops[i + 1].aqi - stops[i].aqi);
      const r = Math.round(stops[i].r + t * (stops[i + 1].r - stops[i].r));
      const g = Math.round(stops[i].g + t * (stops[i + 1].g - stops[i].g));
      const b = Math.round(stops[i].b + t * (stops[i + 1].b - stops[i].b));
      return `rgba(${r},${g},${b},${alpha})`;
    }
  }
  return `rgba(127,29,29,${alpha})`;
}

// ── Particle class ────────────────────────────────────────────
class WindParticle {
  x!: number;
  y!: number;
  age!: number;
  maxAge!: number;
  prevX!: number;
  prevY!: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.maxAge = 60 + Math.random() * 80;
    this.reset(canvasWidth, canvasHeight, true);
  }

  reset(cw: number, ch: number, randomAge = false) {
    this.x = Math.random() * cw;
    this.y = Math.random() * ch;
    this.maxAge = 60 + Math.random() * 80;
    this.age = randomAge ? Math.random() * this.maxAge : 0;
    this.prevX = this.x;
    this.prevY = this.y;
  }
}

interface WindOverlayProps {
  field?: any[];
  wardData?: any[];
  visible?: boolean;
  particleCount?: number;
}

// ── Main component ────────────────────────────────────────────
export default function WindOverlay({ field = [], wardData = [], visible = false, particleCount = 800 }: WindOverlayProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const particlesRef = useRef<WindParticle[]>([]);

  useEffect(() => {
    if (!visible || !map) return;

    // Create canvas overlay
    const container = map.getContainer();
    const canvas = document.createElement("canvas");
    canvas.className = "wind-particle-canvas";
    canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;z-index:450;pointer-events:none;";
    container.appendChild(canvas);
    canvasRef.current = canvas;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    // Handle resize
    function resize() {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * (window.devicePixelRatio || 1);
      canvas.height = rect.height * (window.devicePixelRatio || 1);
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Build spatial index for wind vectors
    function buildWindGrid() {
      if (!field.length) return null;
      return field.map((p) => {
        const pt = map.latLngToContainerPoint([p.lat, p.lon]);
        return {
          px: pt.x,
          py: pt.y,
          u: p.u || 0,
          v: p.v || 0,
          speed: p.wind_speed || 0,
        };
      });
    }

    // Build ward AQI spatial lookup
    function buildAqiGrid() {
      return wardData
        .filter((w) => w.feature_type === "ward" && w.aqi)
        .map((w) => {
          const pt = map.latLngToContainerPoint([w.lat, w.lng]);
          return { px: pt.x, py: pt.y, aqi: w.aqi };
        });
    }

    // Find nearest wind vector using IDW
    function getWindAt(x: number, y: number, grid: any[] | null) {
      if (!grid || !grid.length) return { u: 0.5, v: 0 };

      let totalW = 0,
        uSum = 0,
        vSum = 0;
      for (const p of grid) {
        const dx = x - p.px;
        const dy = y - p.py;
        const d2 = dx * dx + dy * dy;
        if (d2 < 4) return { u: p.u, v: p.v };
        const w = 1 / d2;
        totalW += w;
        uSum += w * p.u;
        vSum += w * p.v;
      }
      return { u: uSum / totalW, v: vSum / totalW };
    }

    // Find nearest AQI
    function getAqiAt(x: number, y: number, aqiGrid: any[]) {
      if (!aqiGrid.length) return 150;
      let minD = Infinity,
        nearAqi = 150;
      for (const p of aqiGrid) {
        const d = (x - p.px) ** 2 + (y - p.py) ** 2;
        if (d < minD) {
          minD = d;
          nearAqi = p.aqi;
        }
      }
      return nearAqi;
    }

    // Initialize particles
    const rect = container.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    const count = Math.min(particleCount, 1200);
    particlesRef.current = Array.from({ length: count }, () => new WindParticle(cw, ch));

    // Animation loop
    let windGrid = buildWindGrid();
    let aqiGrid = buildAqiGrid();

    // Rebuild grids on map move
    function onMapMove() {
      windGrid = buildWindGrid();
      aqiGrid = buildAqiGrid();
    }
    map.on("moveend", onMapMove);
    map.on("zoomend", onMapMove);

    function animate() {
      const rect2 = container.getBoundingClientRect();
      const w = rect2.width;
      const h = rect2.height;

      // Fade previous frame
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "rgba(0,0,0,0.90)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";

      const zoom = map.getZoom();
      const speedScale = Math.max(0.15, Math.min(2.5, (zoom - 8) * 0.3 + 0.6));

      for (const p of particlesRef.current) {
        if (p.age >= p.maxAge) {
          p.reset(w, h);
          continue;
        }

        const wind = getWindAt(p.x, p.y, windGrid);
        const aqi = getAqiAt(p.x, p.y, aqiGrid);

        // Update position: u = east component, v = north component
        // On screen: east = +x, north = -y
        const moveX = wind.u * speedScale * 1.2;
        const moveY = -wind.v * speedScale * 1.2;

        p.prevX = p.x;
        p.prevY = p.y;
        p.x += moveX;
        p.y += moveY;
        p.age++;

        // Wrap around
        if (p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10) {
          p.reset(w, h);
          continue;
        }

        // Draw trail
        const lifeRatio = p.age / p.maxAge;
        const alpha = Math.sin(lifeRatio * Math.PI) * 0.75; // Fade in and out
        const lineWidth = 1.0 + (1 - lifeRatio) * 1.2;

        ctx.beginPath();
        ctx.moveTo(p.prevX, p.prevY);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = aqiToGradientColor(aqi, alpha);
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      map.off("moveend", onMapMove);
      map.off("zoomend", onMapMove);
      ro.disconnect();
      if (canvasRef.current && canvasRef.current.parentNode) {
        canvasRef.current.parentNode.removeChild(canvasRef.current);
      }
    };
  }, [visible, field, wardData, map, particleCount]);

  return null; // Renders via canvas, not React DOM
}
