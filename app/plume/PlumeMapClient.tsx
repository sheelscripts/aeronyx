"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import wardGeoJsonRaw from "../../public/wards.json";
import { Factory, Wind, AlertTriangle, Shield, Play, Pause, RefreshCw, MapPin } from "lucide-react";
import { fetchIndustrialSource, fetchWards } from "../services/api";

const wardGeoJson = wardGeoJsonRaw as any;

/* ── Precompute ward polygon centroids from GeoJSON ───────── */
const WARD_CENTERS: Record<string, { lat: number; lng: number }> = {};
wardGeoJson.features.forEach((f: any) => {
  try {
    const ring = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates[0][0] : f.geometry.coordinates[0];
    const lat = ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length;
    const lng = ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length;
    WARD_CENTERS[f.properties.ward_id] = { lat, lng };
  } catch {
    /* malformed feature */
  }
});

/* ── Plume cone edge helper ────────────────────────────────── */
function plumeConeLine(src: any, ward: any, sign: number) {
  const dLat = ward.lat - src.source_lat;
  const dLng = ward.lng - src.source_lon;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng) || 1;
  const spread = dist * 0.22;
  const perpLat = -dLng / dist;
  const perpLng = dLat / dist;
  return [
    [src.source_lat, src.source_lon] as [number, number],
    [ward.lat + perpLat * spread * sign, ward.lng + perpLng * spread * sign] as [number, number],
  ];
}

interface PlumeSimOverlayProps {
  source: { lat: number; lon: number };
  ward: { lat: number; lng: number };
  windSpeed: number;
  active: boolean;
}

/* ── Canvas plume particle simulation ─────────────────────── */
function PlumeSimOverlay({ source, ward, windSpeed, active }: PlumeSimOverlayProps) {
  const map = useMap();
  const stateRef = useRef({ source, ward, windSpeed, active });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const ptsRef = useRef<any[]>([]);

  // Keep latest props in ref so animation loop doesn't need to restart
  useEffect(() => {
    stateRef.current = { source, ward, windSpeed, active };
  });

  useEffect(() => {
    if (!map) return;
    const container = map.getContainer();

    const canvas = document.createElement("canvas");
    canvas.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:400;";
    container.appendChild(canvas);
    canvasRef.current = canvas;

    const resize = () => {
      canvas.width = container.offsetWidth;
      canvas.height = container.offsetHeight;
    };
    resize();
    map.on("resize", resize);

    // Initialise 350 particles spread randomly along the route
    ptsRef.current = Array.from({ length: 350 }, () => ({
      progress: Math.random(),
      speed: 0.0014 + Math.random() * 0.0022,
      spread: (Math.random() - 0.5) * 0.55,
      size: 1.8 + Math.random() * 2.4,
      alpha: 0.45 + Math.random() * 0.55,
    }));

    const draw = () => {
      const { source: src, ward: wrd, windSpeed: ws, active: act } = stateRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (act && src && wrd) {
        const srcPt = map.latLngToContainerPoint([src.lat, src.lon]);
        const wrdPt = map.latLngToContainerPoint([wrd.lat, wrd.lng]);

        const dx = wrdPt.x - srcPt.x;
        const dy = wrdPt.y - srcPt.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len; // crosswind unit vector
        const ny = dx / len;

        ptsRef.current.forEach((p) => {
          p.progress += p.speed * Math.max(0.4, (ws || 2) / 3);
          if (p.progress >= 1) {
            p.progress = 0;
            p.spread = (Math.random() - 0.5) * 0.55;
          }

          // Gaussian spread grows with travel distance
          const spreadPx = p.spread * len * 0.38 * p.progress;
          const x = srcPt.x + dx * p.progress + nx * spreadPx;
          const y = srcPt.y + dy * p.progress + ny * spreadPx;

          const t = p.progress;
          const fade = p.alpha * (1 - t * 0.72);
          const g = Math.round(68 + t * 90);

          ctx.beginPath();
          ctx.arc(x, y, p.size * (1 - t * 0.28), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(239,${g},68,${fade})`;
          ctx.fill();
        });
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      canvas.remove();
      map.off("resize", resize);
    };
  }, [map]); // intentionally only runs once per map mount

  return null;
}

/* ── Auto-fly to ward ─────────────────────────────────────── */
function FlyTo({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 13, { duration: 1.0 });
  }, [center, map]);
  return null;
}

/* ── Severity colour map ─────────────────────────────────── */
const SEV: Record<string, string> = {
  extreme: "#dc2626",
  high: "#f97316",
  medium: "#b45309",
  low: "#ca8a04",
  normal: "#22c55e",
  unknown: "#78716c",
};

/* ── PlumeMapPage ─────────────────────────────────────────── */
export default function PlumeMapClient() {
  const [wardId, setWardId] = useState("ward_1");
  const [wardOptions, setWardOptions] = useState<any[]>([]);
  const [transportHours, setTransportHours] = useState(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [flyCenter, setFlyCenter] = useState<[number, number]>([28.6139, 77.209]);

  useEffect(() => {
    fetchWards()
      .then((res) => {
        const wards = (res?.wards || [])
          .filter((w: any) => w.feature_type === "ward")
          .map((w: any) => ({ id: w.ward_id, name: w.name }))
          .sort((a: any, b: any) => Number(a.id.split("_")[1] || 0) - Number(b.id.split("_")[1] || 0));
        setWardOptions(wards);
        if (wards.length > 0 && !wards.some((w: any) => w.id === wardId)) {
          setWardId(wards[0].id);
        }
      })
      .catch(() => {});
  }, [wardId]);

  const load = useCallback(async () => {
    if (!wardId) return;
    setLoading(true);
    setSimulating(false);
    try {
      const res = await fetchIndustrialSource(wardId, transportHours, 3);
      setData(res);
      if (res?.ward?.lat) {
        setFlyCenter([res.ward.lat, res.ward.lng]);
      } else {
        const c = WARD_CENTERS[wardId];
        if (c) setFlyCenter([c.lat, c.lng]);
      }
    } catch {
      setData(null);
    }
    setLoading(false);
  }, [wardId, transportHours]);

  useEffect(() => {
    load();
  }, [load]);

  const spike = data?.spike || {};
  const wind = data?.wind || {};
  const srcCoords = data?.estimated_source_location;
  const industrial = data?.industrial_source_matches || [];
  const sevColor = SEV[spike.severity] || SEV.unknown;

  const wardCenter = data?.ward?.lat ? { lat: data.ward.lat, lng: data.ward.lng } : WARD_CENTERS[wardId];

  return (
    <div className="plume-page">
      <motion.div
        className="page-header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 20 }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span className="dot" style={{ background: "var(--primary-deep)", width: 6, height: 6, boxShadow: "0 0 8px var(--primary-deep)" }} />
            <span style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--steel)" }}>
              Gaussian plume dispersion model
            </span>
          </div>
          <h2 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--brand-teal-deep)", margin: 0 }}>Industrial plume dispersion</h2>
          <p style={{ color: "var(--steel)", fontSize: "0.9rem", marginTop: 6, margin: 0 }}>visualizing chimney emissions and air pollutant transport pathways</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Ward selector */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.78rem", color: "var(--steel)", fontWeight: 600 }}>Ward:</span>
            <select
              value={wardId}
              onChange={(e) => setWardId(e.target.value)}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.82rem",
                fontWeight: 600,
                padding: "6px 28px 6px 14px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(0,30,43,0.08)",
                background: "#ffffff",
                color: "var(--brand-teal-deep)",
                cursor: "pointer",
                boxShadow: "var(--shadow-sm)",
                outline: "none",
                transition: "all 0.15s ease",
                WebkitAppearance: "none",
                MozAppearance: "none",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='none' stroke='%23001e2b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
                backgroundSize: "14px"
              }}
            >
              {wardOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Transport hours */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.78rem", color: "var(--steel)", fontWeight: 600 }}>Transport:</span>
            <select
              value={transportHours}
              onChange={(e) => setTransportHours(Number(e.target.value))}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.82rem",
                fontWeight: 600,
                padding: "6px 28px 6px 14px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(0,30,43,0.08)",
                background: "#ffffff",
                color: "var(--brand-teal-deep)",
                cursor: "pointer",
                boxShadow: "var(--shadow-sm)",
                outline: "none",
                transition: "all 0.15s ease",
                WebkitAppearance: "none",
                MozAppearance: "none",
                appearance: "none",
                backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='none' stroke='%23001e2b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 8px center",
                backgroundSize: "14px"
              }}
            >
              {[0.5, 1, 2, 3, 4, 6].map((h) => (
                <option key={h} value={h}>
                  {h}h
                </option>
              ))}
            </select>
          </div>

          {/* Simulate toggle */}
          <button
            onClick={() => setSimulating((s) => !s)}
            disabled={!data || loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: "var(--radius-sm)",
              border: simulating ? "1px solid rgba(239,68,68,0.15)" : "1px solid rgba(0,30,43,0.08)",
              cursor: "pointer",
              background: simulating ? "#ef4444" : "#ffffff",
              color: simulating ? "#ffffff" : "var(--brand-teal-deep)",
              fontSize: "0.82rem",
              fontWeight: 600,
              boxShadow: "var(--shadow-sm)",
              transition: "all 0.15s ease",
              opacity: !data || loading ? 0.5 : 1,
            }}
          >
            {simulating ? (
              <>
                <Pause size={14} /> Stop
              </>
            ) : (
              <>
                <Play size={14} /> Simulate Plume
              </>
            )}
          </button>

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(0,30,43,0.08)",
              background: "#ffffff",
              color: "var(--brand-teal-deep)",
              cursor: "pointer",
              fontSize: "0.82rem",
              boxShadow: "var(--shadow-sm)",
              transition: "all 0.15s ease",
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </motion.div>

      {/* ── Map + data panel ───────────────────── */}
      <div className="plume-layout">
        {/* Map */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="plume-map-container"
          style={{ border: "1px solid rgba(0,30,43,0.08)", borderRadius: "var(--radius-lg)", overflow: "hidden", position: "relative" }}
        >
          <MapContainer center={[28.6139, 77.209]} zoom={12} style={{ width: "100%", height: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" opacity={0.65} />

            <FlyTo center={flyCenter} />

            {/* ── Plume cone edges ─── */}
            {srcCoords && wardCenter && (
              <>
                <Polyline
                  positions={[
                    [srcCoords.source_lat, srcCoords.source_lon],
                    [wardCenter.lat, wardCenter.lng],
                  ]}
                  pathOptions={{ color: "#ef4444", weight: 2.5, dashArray: "9 5", opacity: 0.75 }}
                />
                <Polyline positions={plumeConeLine(srcCoords, wardCenter, -1)} pathOptions={{ color: "#ef444445", weight: 1.5, dashArray: "5 7", opacity: 0.6 }} />
                <Polyline positions={plumeConeLine(srcCoords, wardCenter, 1)} pathOptions={{ color: "#ef444445", weight: 1.5, dashArray: "5 7", opacity: 0.6 }} />
              </>
            )}

            {/* ── Ward (receptor) marker ─── */}
            {wardCenter && (
              <CircleMarker
                center={[wardCenter.lat, wardCenter.lng]}
                radius={13}
                pathOptions={{ fillColor: "#0ea5e9", color: "white", weight: 3, fillOpacity: 0.92 }}
              >
                <Popup>
                  <strong>{data?.ward?.name || wardId}</strong>
                  <br />
                  AQI: <strong>{data?.ward?.aqi ?? "—"}</strong>
                  <br />
                  PM2.5: <strong>{data?.ward?.pm25 ?? "—"}</strong> µg/m³
                  <br />
                  Source: {data?.ward?.source_detected ?? "—"}
                </Popup>
              </CircleMarker>
            )}

            {/* ── Estimated source marker ─── */}
            {srcCoords && (
              <CircleMarker
                center={[srcCoords.source_lat, srcCoords.source_lon]}
                radius={14}
                pathOptions={{ fillColor: "#ef4444", color: "white", weight: 3, fillOpacity: 0.88 }}
              >
                <Popup>
                  <strong>Estimated Source Origin</strong>
                  <br />
                  {srcCoords.source_lat}°N, {srcCoords.source_lon}°E<br />
                  {srcCoords.travel_distance_km} km upwind
                  <br />
                  Transport: {srcCoords.transport_hours}h @ {srcCoords.wind_speed} m/s
                </Popup>
              </CircleMarker>
            )}

            {/* ── Industrial source markers ─── */}
            {industrial.map((src: any, i: number) => (
              <CircleMarker
                key={i}
                center={[src.lat, src.lon]}
                radius={7 + Math.min(10, src.pm25_emission * 1.8)}
                pathOptions={{
                  fillColor: i === 0 ? "#8b5cf6" : "#a78bfa",
                  color: "white",
                  weight: 2,
                  fillOpacity: 0.78,
                }}
              >
                <Popup>
                  <strong>Industrial Source #{i + 1}</strong>
                  <br />
                  {src.lat}°N, {src.lon}°E<br />
                  {(src.distance_m / 1000).toFixed(2)} km from estimated origin
                  <br />
                  PM2.5: {src.pm25_emission} t/day
                  <br />
                  NOx: {src.nox_emission} t/day
                  <br />
                  Plume conc: {src.plume_conc_ug_m3?.toExponential(3)} g/m³
                </Popup>
              </CircleMarker>
            ))}

            {/* ── Canvas plume particle animation ─── */}
            {srcCoords && wardCenter && (
              <PlumeSimOverlay
                source={{ lat: srcCoords.source_lat, lon: srcCoords.source_lon }}
                ward={wardCenter}
                windSpeed={wind.wind_speed || 2}
                active={simulating}
              />
            )}
          </MapContainer>

          {/* Map legend */}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              zIndex: 1000,
              background: "#ffffff",
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
              fontSize: "0.74rem",
              border: "1px solid rgba(0,30,43,0.08)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 8, color: "var(--brand-teal-deep)" }}>Legend</div>
            {[
              { color: "#0ea5e9", label: "Ward / receptor", shape: "circle" },
              { color: "#ef4444", label: "Estimated source origin", shape: "circle" },
              { color: "#8b5cf6", label: "Industrial grid cell", shape: "circle" },
              { color: "#ef4444", label: "Plume transport path", shape: "line" },
            ].map(({ color, label, shape }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                {shape === "circle" ? (
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 14, height: 2, background: color, borderRadius: 2, flexShrink: 0 }} />
                )}
                <span style={{ color: "var(--steel)", fontWeight: 500 }}>{label}</span>
              </div>
            ))}
            {simulating && (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, color: "#ef4444", fontWeight: 700 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite" }} />
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>Simulation active</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Data panel ─────────────────────────────── */}
        <div className="plume-sidebar">
          {/* Spike card */}
          <motion.div
            className="glass-card"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            style={{
              padding: "18px",
              background: "#ffffff",
              border: `1px solid ${spike.is_spike ? "rgba(239,68,68,0.2)" : "rgba(0,30,43,0.08)"}`,
              borderRadius: "var(--radius-lg)",
              boxShadow: spike.is_spike
                ? "0 8px 30px -4px rgba(239,68,68,0.06), 0 4px 12px -2px rgba(239,68,68,0.03)"
                : "var(--shadow-sm)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: `${sevColor}08`,
                  border: `1.5px solid ${sevColor}20`,
                  flexShrink: 0,
                }}
              >
                {spike.is_spike ? <AlertTriangle size={18} color={sevColor} /> : <Shield size={18} color={sevColor} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: sevColor, fontSize: "0.9rem" }}>
                  {spike.is_spike ? `Spike · ${(spike.severity || "").toUpperCase()}` : "Normal level"}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--steel)", marginTop: 1 }}>
                  Z‑score: {spike.z_score ?? "—"} &nbsp;·&nbsp; threshold: {spike.threshold_used ?? 2.0}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 700, color: sevColor }}>
                  {data?.ward?.pm25 ?? "—"}
                </div>
                <div style={{ fontSize: "0.65rem", color: "var(--steel)" }}>µg/m³</div>
              </div>
            </div>
            <div
              style={{
                marginTop: 10,
                padding: "8px 12px",
                background: "rgba(0,30,43,0.01)",
                border: "1px solid rgba(0,30,43,0.04)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.72rem",
                color: "var(--steel)",
              }}
            >
              Baseline {spike.mean ?? "—"} ± {spike.std ?? "—"} µg/m³ &nbsp;·&nbsp; {data?.ward?.name || wardId}
            </div>
          </motion.div>

          {/* Wind card */}
          <motion.div
            className="glass-card"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 }}
            style={{
              padding: "18px",
              background: "#ffffff",
              border: "1px solid rgba(0,30,43,0.08)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-sm)"
            }}
          >
            <div className="section-title" style={{ marginBottom: 12, fontSize: "0.9rem", fontWeight: 700, color: "var(--brand-teal-deep)", display: "flex", alignItems: "center", gap: 6 }}>
              <Wind size={14} style={{ color: "var(--primary-deep)" }} />
              <span>Wind & transport</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "Speed", value: `${wind.wind_speed ?? "—"} m/s` },
                { label: "Direction", value: `${wind.wind_direction ?? "—"}°` },
                { label: "Pattern", value: wind.wind_label || "—" },
                { label: "Distance", value: `${srcCoords?.travel_distance_km ?? "—"} km` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: "#ffffff", border: "1px solid rgba(0,30,43,0.05)", borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
                  <div style={{ fontSize: "0.65rem", color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--brand-teal-deep)", fontFamily: "var(--font-display)" }}>{value}</div>
                </div>
              ))}
            </div>
            {srcCoords && (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 12px",
                  background: "rgba(139,92,246,0.04)",
                  border: "1px solid rgba(139,92,246,0.1)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.72rem",
                  color: "#7c3aed",
                }}
              >
                <MapPin size={11} style={{ display: "inline", marginRight: 4, transform: "translateY(-1px)" }} />
                Estimated source origin: {srcCoords.source_lat}°N, {srcCoords.source_lon}°E
              </div>
            )}
          </motion.div>

          {/* Industrial sources */}
          <motion.div
            className="glass-card"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            style={{
              padding: "18px",
              background: "#ffffff",
              border: "1px solid rgba(0,30,43,0.08)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-sm)",
              flex: 1,
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div className="section-title" style={{ marginBottom: 4, fontSize: "0.9rem", fontWeight: 700, color: "var(--brand-teal-deep)", display: "flex", alignItems: "center", gap: 6 }}>
              <Factory size={14} style={{ color: "var(--primary-deep)" }} />
              <span>Industrial chimney matches</span>
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--steel)", marginBottom: 12 }}>
              Zenodo Delhi Database · Stability class PG‑{data?.model_notes?.stability_class || "—"}
            </div>

            {industrial.length === 0 && (
              <div style={{ color: "var(--steel)", fontSize: "0.78rem", padding: "12px 0" }}>
                {loading ? "Loading matches…" : "No matches yet. Select a ward and verify wind trajectories."}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flex: 1, maxHeight: 380, paddingRight: 4 }}>
              {industrial.map((src: any, i: number) => {
                const maxConc = industrial[0]?.plume_conc_ug_m3 || 1;
                const pct = Math.round((src.plume_conc_ug_m3 / maxConc) * 100);
                return (
                  <div
                    key={i}
                    style={{
                      padding: "14px",
                      borderRadius: "var(--radius-md)",
                      background: "#ffffff",
                      border: `1px solid ${i === 0 ? "rgba(139,92,246,0.15)" : "rgba(0,30,43,0.06)"}`,
                      boxShadow: i === 0 ? "0 4px 16px rgba(139,92,246,0.03)" : "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: "50%",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.7rem",
                            fontWeight: 800,
                            background: i === 0 ? "#7c3aed" : "#ffffff",
                            border: i === 0 ? "none" : "1.5px solid rgba(0,30,43,0.08)",
                            color: i === 0 ? "#ffffff" : "var(--brand-teal-deep)",
                          }}
                        >
                          {i + 1}
                        </span>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--brand-teal-deep)" }}>
                          {src.lat}°N, {src.lon}°E
                        </span>
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "var(--steel)", fontWeight: 500 }}>{(src.distance_m / 1000).toFixed(2)} km</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(75px, 1fr))", gap: 4, background: "rgba(0,30,43,0.01)", padding: "8px 10px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(0,30,43,0.03)" }}>
                      {[
                        ["PM2.5", src.pm25_emission],
                        ["NOx", src.nox_emission],
                        ["SO₂", src.so2_emission],
                        ["CO", src.co_emission],
                      ].map(([lbl, val]) => (
                        <div key={lbl} style={{ fontSize: "0.68rem", color: "var(--steel)" }}>
                          <span style={{ fontWeight: 600, color: "var(--charcoal)" }}>{lbl}:</span> {val}
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                      <span style={{ fontSize: "0.68rem", color: "var(--steel)" }}>Plume conc. (Gaussian PG-{src.stability_class})</span>
                      <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#ef4444", fontFamily: "var(--font-code)" }}>{src.plume_conc_ug_m3?.toExponential(3)} g/m³</span>
                    </div>

                    {/* Relative concentration bar */}
                    <div style={{ height: 6, background: "var(--hairline-soft)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          borderRadius: "var(--radius-full)",
                          background: i === 0 ? "#8b5cf6" : "#c4b5fd",
                          width: `${pct}%`,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
