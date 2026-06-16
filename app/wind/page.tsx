"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Wind, Compass, Activity, Gauge, RefreshCw, Truck, Factory, Flame, Hammer, HelpCircle, Clock } from "lucide-react";
import { fetchWindCurrent, fetchCityAttribution, fetchWindHistory } from "../services/api";

const SOURCE_COLORS: Record<string, string> = {
  vehicular: "#f97316",
  vehicle: "#f97316",
  industrial: "#ef4444",
  biomass: "#a855f7",
  construction: "#b45309",
  dust: "#78716c",
  regional: "#6366f1",
};

const SOURCE_ICONS: Record<string, React.ComponentType<any>> = {
  vehicular: Truck,
  vehicle: Truck,
  industrial: Factory,
  biomass: Flame,
  construction: Hammer,
  dust: Wind,
  regional: Wind,
  unknown: HelpCircle,
};

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

function cardinalFromDegrees(deg = 0) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round((deg % 360) / 45) % 8;
  return dirs[idx];
}

function SpeedSparkline({ values = [] }: { values: number[] }) {
  if (!values.length) {
    return <div style={{ fontSize: "0.78rem", color: "var(--steel)", padding: "12px 0" }}>No trend data available</div>;
  }

  const w = 400;
  const h = 80;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.001, max - min);

  const points = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * (w - 12) + 6;
      const y = h - ((v - min) / span) * (h - 20) - 10;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="88" role="img" aria-label="Wind speed trend" style={{ display: "block" }}>
      <defs>
        <linearGradient id="windSparkGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.2} />
          <stop offset="50%" stopColor="#10b981" stopOpacity={0.8} />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity={1} />
        </linearGradient>
      </defs>
      {/* Background grid lines for laboratory theme */}
      <line x1="0" y1={h / 2} x2={w} y2={h / 2} stroke="rgba(0,30,43,0.03)" strokeWidth={1} strokeDasharray="3 3" />
      <line x1="0" y1={h - 10} x2={w} y2={h - 10} stroke="rgba(0,30,43,0.03)" strokeWidth={1} />
      <line x1="0" y1="10" x2={w} y2="10" stroke="rgba(0,30,43,0.03)" strokeWidth={1} />

      <polyline fill="none" stroke="url(#windSparkGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
      {/* Dynamic Endpoint dots */}
      {values.length > 0 && (() => {
        const lastX = w - 6;
        const lastY = h - ((values[values.length - 1] - min) / span) * (h - 20) - 10;
        return (
          <>
            <circle cx={lastX} cy={lastY} r={5} fill="#0ea5e9" opacity={0.3} />
            <circle cx={lastX} cy={lastY} r={2.5} fill="#0ea5e9" />
          </>
        );
      })()}
    </svg>
  );
}

export default function WindPage() {
  const [wind, setWind] = useState<any>(null);
  const [city, setCity] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [w, c, h] = await Promise.all([fetchWindCurrent(), fetchCityAttribution(), fetchWindHistory(6)]);
        if (!cancelled) {
          setWind(w);
          setCity(c);
          setHistory(h?.history || []);
        }
      } catch {
        if (!cancelled) {
          setWind(null);
          setCity(null);
          setHistory([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  const topStations = useMemo(
    () => [...(wind?.stations || [])].sort((a, b) => (b.wind_speed || 0) - (a.wind_speed || 0)).slice(0, 8),
    [wind]
  );

  const cityScores = city?.scores ? Object.entries(city.scores).sort((a: any, b: any) => b[1] - a[1]) : [];
  const dominantStation = topStations[0];
  const dominantDir = dominantStation?.wind_direction ?? wind?.dominant_direction ?? 0;
  const avgSpeed = topStations.length
    ? (topStations.reduce((s, st) => s + (st.wind_speed || 0), 0) / topStations.length).toFixed(1)
    : "0.0";

  const speedSeries = useMemo(() => {
    const snapshots = history.slice(-24);
    return snapshots.map((snap) => {
      const stations = snap.stations || [];
      if (!stations.length) return 0;
      return stations.reduce((s: number, st: any) => s + (st.wind_speed || 0), 0) / stations.length;
    });
  }, [history]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header */}
      <motion.div className="page-header" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span className="dot" style={{ background: "var(--primary-deep)", width: 6, height: 6, boxShadow: "0 0 8px var(--primary-deep)" }} />
              <span style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--steel)" }}>
                Wind vector & attribution telemetry
              </span>
            </div>
            <h2 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--brand-teal-deep)", margin: 0 }}>Wind dynamics</h2>
            <p style={{ color: "var(--steel)", fontSize: "0.9rem", marginTop: 6, margin: 0 }}>Live atmospheric flow vectors, station telemetry, and source attribution</p>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(0,30,43,0.08)",
              background: "#ffffff",
              color: "var(--brand-teal-deep)",
              fontSize: "0.82rem",
              fontWeight: 600,
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <RefreshCw size={13} style={{ animation: loading ? "spin 1.2s linear infinite" : "none" }} />
            <span>{wind?.timestamp ? `Sync: ${new Date(wind.timestamp).toLocaleTimeString()}` : "Syncing..."}</span>
          </div>
        </div>
      </motion.div>

      {/* Primary Highlights Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <motion.div
          className="glass-card"
          initial="hidden"
          animate="show"
          custom={0}
          variants={fadeUp}
          whileHover={{ transform: "translateY(-3px)", boxShadow: "var(--shadow-md)" }}
          style={{
            padding: "24px",
            background: "#ffffff",
            border: "1px solid rgba(0,30,43,0.08)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            transition: "all 0.25s var(--ease-smooth)",
          }}
        >
          <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--steel)" }}>Dominant Wind</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
            <span style={{ fontSize: "2.2rem", fontWeight: 700, color: "var(--brand-teal-deep)", fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
              {wind?.dominant_label || "—"}
            </span>
            <Compass size={18} style={{ color: "var(--primary-deep)" }} />
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--steel)", marginTop: 6, fontWeight: 500 }}>
            Vector: {cardinalFromDegrees(dominantDir)} · {Math.round(dominantDir)}° Directional Heading
          </div>
        </motion.div>

        <motion.div
          className="glass-card"
          initial="hidden"
          animate="show"
          custom={1}
          variants={fadeUp}
          whileHover={{ transform: "translateY(-3px)", boxShadow: "var(--shadow-md)" }}
          style={{
            padding: "24px",
            background: "#ffffff",
            border: "1px solid rgba(0,30,43,0.08)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            transition: "all 0.25s var(--ease-smooth)",
          }}
        >
          <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--steel)" }}>Average Vector Velocity</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
            <span style={{ fontSize: "2.2rem", fontWeight: 700, color: "var(--brand-teal-deep)", fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
              {avgSpeed}
            </span>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--steel)" }}>m/s</span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--steel)", marginTop: 6, fontWeight: 500 }}>
            Telemetry aggregated across {wind?.station_count ?? 0} active IoT sensors
          </div>
        </motion.div>

        <motion.div
          className="glass-card"
          initial="hidden"
          animate="show"
          custom={2}
          variants={fadeUp}
          whileHover={{ transform: "translateY(-3px)", boxShadow: "var(--shadow-md)" }}
          style={{
            padding: "24px",
            background: "#ffffff",
            border: "1px solid rgba(0,30,43,0.08)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            transition: "all 0.25s var(--ease-smooth)",
          }}
        >
          <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--steel)" }}>Dominant emission Source</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 12 }}>
            <span style={{ fontSize: "2.2rem", fontWeight: 700, color: "var(--brand-teal-deep)", fontFamily: "var(--font-display)", textTransform: "capitalize", letterSpacing: "-0.02em" }}>
              {city?.dominant_source || "—"}
            </span>
            <Activity size={18} style={{ color: "#ef4444" }} />
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--steel)", marginTop: 6, fontWeight: 500 }}>
            Model Confidence: {city?.confidence_score ? `${Math.round(city.confidence_score * 100)}%` : "—"}
          </div>
        </motion.div>
      </div>

      {/* Visual Analytics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24 }} className="comparison-grid">
        {/* Precision Compass Widget */}
        <motion.div
          className="glass-card"
          initial="hidden"
          animate="show"
          custom={3}
          variants={fadeUp}
          whileHover={{ transform: "translateY(-3px)", boxShadow: "var(--shadow-md)" }}
          style={{
            padding: "24px",
            background: "#ffffff",
            border: "1px solid rgba(0,30,43,0.08)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            transition: "all 0.25s var(--ease-smooth)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--hairline-soft)", paddingBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--brand-teal-deep)", fontFamily: "var(--font-display)" }}>Dominant Compass Orientation</span>
            <span style={{ fontSize: "0.78rem", color: "var(--steel)", fontWeight: 600, fontFamily: "var(--font-code)" }}>
              {cardinalFromDegrees(dominantDir)} · {Math.round(dominantDir)}°
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, alignItems: "center" }} className="comparison-grid">
            <div style={{ display: "grid", placeItems: "center" }}>
              <div
                style={{
                  width: 170,
                  height: 170,
                  borderRadius: "50%",
                  border: "1.5px solid rgba(0, 30, 43, 0.08)",
                  background: "#ffffff",
                  position: "relative",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                {/* Compass Bezel Markers */}
                <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", fontSize: "0.7rem", fontWeight: 800, color: "var(--brand-teal-deep)" }}>N</div>
                <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", fontSize: "0.7rem", fontWeight: 800, color: "var(--brand-teal-deep)" }}>S</div>
                <div style={{ position: "absolute", top: "50%", left: 10, transform: "translateY(-50%)", fontSize: "0.7rem", fontWeight: 800, color: "var(--brand-teal-deep)" }}>W</div>
                <div style={{ position: "absolute", top: "50%", right: 10, transform: "translateY(-50%)", fontSize: "0.7rem", fontWeight: 800, color: "var(--brand-teal-deep)" }}>E</div>

                {/* Grid Crosshairs */}
                <div style={{ position: "absolute", left: "50%", top: "10%", width: 1, height: "80%", background: "rgba(0,30,43,0.03)" }} />
                <div style={{ position: "absolute", top: "50%", left: "10%", height: 1, width: "80%", background: "rgba(0,30,43,0.03)" }} />
                
                {/* Pointer Needle */}
                <motion.div
                  animate={{ rotate: dominantDir + 180 }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: 3,
                    height: 60,
                    background: "linear-gradient(180deg, var(--primary-deep), var(--brand-teal))",
                    transformOrigin: "50% 90%",
                    borderRadius: 999,
                    translate: "-50% -90%",
                    boxShadow: "0 0 8px rgba(0, 181, 69, 0.2)",
                  }}
                />
                
                {/* Center cap */}
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "var(--brand-teal-deep)",
                    border: "2px solid #ffffff",
                    boxShadow: "var(--shadow-sm)",
                  }}
                />
              </div>
            </div>

            {/* Micro details panel */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", border: "1px solid rgba(0,30,43,0.05)", background: "#ffffff" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Velocity</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--brand-teal-deep)", marginTop: 2, fontFamily: "var(--font-display)" }}>{avgSpeed} <span style={{ fontSize: "0.68rem", color: "var(--steel)", fontWeight: 500 }}>m/s</span></div>
              </div>
              <div style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", border: "1px solid rgba(0,30,43,0.05)", background: "#ffffff" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Sensors</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--brand-teal-deep)", marginTop: 2, fontFamily: "var(--font-display)" }}>{wind?.station_count ?? 0} <span style={{ fontSize: "0.68rem", color: "var(--primary-deep)", fontWeight: 700 }}>Live</span></div>
              </div>
              <div style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", border: "1px solid rgba(0,30,43,0.05)", background: "#ffffff", gridColumn: "1 / -1" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Dominant Station</div>
                <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--brand-teal-deep)", marginTop: 2 }}>{dominantStation?.station || "—"}</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Source Attribution Bars */}
        <motion.div
          className="glass-card"
          initial="hidden"
          animate="show"
          custom={4}
          variants={fadeUp}
          whileHover={{ transform: "translateY(-3px)", boxShadow: "var(--shadow-md)" }}
          style={{
            padding: "24px",
            background: "#ffffff",
            border: "1px solid rgba(0,30,43,0.08)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            transition: "all 0.25s var(--ease-smooth)",
          }}
        >
          <div style={{ borderBottom: "1px solid var(--hairline-soft)", paddingBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--brand-teal-deep)", fontFamily: "var(--font-display)" }}>City Source Attribution</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {cityScores.map(([k, v]: any) => {
              const Icon = SOURCE_ICONS[k] || SOURCE_ICONS.unknown;
              const color = SOURCE_COLORS[k] || "#0ea5e9";
              return (
                <div key={k}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 20, height: 20, display: "flex", justifyContent: "center", alignItems: "center", borderRadius: "50%", background: `${color}08`, border: `1px solid ${color}15` }}>
                        <Icon size={11} color={color} />
                      </span>
                      <span style={{ textTransform: "capitalize", fontWeight: 600, color: "var(--charcoal)" }}>{k}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: "var(--brand-teal-deep)", fontFamily: "var(--font-display)" }}>{Math.round(v * 100)}%</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(0,30,43,0.03)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(v * 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      style={{
                        height: "100%",
                        borderRadius: "var(--radius-full)",
                        background: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Sparkline & Station Snapshots */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24 }} className="comparison-grid">
        {/* Trend Sparkline */}
        <motion.div
          className="glass-card"
          initial="hidden"
          animate="show"
          custom={5}
          variants={fadeUp}
          whileHover={{ transform: "translateY(-3px)", boxShadow: "var(--shadow-md)" }}
          style={{
            padding: "24px",
            background: "#ffffff",
            border: "1px solid rgba(0,30,43,0.08)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            transition: "all 0.25s var(--ease-smooth)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid var(--hairline-soft)", paddingBottom: 12 }}>
            <Wind size={15} style={{ color: "var(--primary-deep)" }} />
            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--brand-teal-deep)", fontFamily: "var(--font-display)" }}>Velocity Sparkline (6h Snapshots)</span>
          </div>
          
          <div style={{ margin: "10px 0" }}>
            <SpeedSparkline values={speedSeries} />
          </div>
          
          <div style={{ fontSize: "0.75rem", color: "var(--steel)", lineHeight: 1.5, borderTop: "1px solid var(--hairline-soft)", paddingTop: 12, marginTop: 4 }}>
            The vector curve represents real-time velocities resolved from active meteorological data streams.
          </div>
        </motion.div>

        {/* Stations Table */}
        <motion.div
          className="glass-card"
          initial="hidden"
          animate="show"
          custom={6}
          variants={fadeUp}
          whileHover={{ transform: "translateY(-3px)", boxShadow: "var(--shadow-md)" }}
          style={{
            padding: "24px",
            background: "#ffffff",
            border: "1px solid rgba(0,30,43,0.08)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            transition: "all 0.25s var(--ease-smooth)",
          }}
        >
          <div style={{ borderBottom: "1px solid var(--hairline-soft)", paddingBottom: 12 }}>
            <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--brand-teal-deep)", fontFamily: "var(--font-display)" }}>Station Snapshots</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
            {topStations.length === 0 ? (
              <div style={{ fontSize: "0.82rem", color: "var(--steel)", textAlign: "center", padding: "20px 0" }}>No stations active</div>
            ) : (
              topStations.map((s: any) => (
                <div
                  key={s.station}
                  style={{
                    border: "1px solid rgba(0,30,43,0.06)",
                    borderRadius: "var(--radius-md)",
                    padding: "12px 14px",
                    background: "#ffffff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "border-color 0.2s ease"
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--brand-teal-deep)" }}>{s.station}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--steel)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                      Vector: {cardinalFromDegrees(s.wind_direction)} · {Math.round(s.wind_direction)}°
                    </div>
                  </div>
                  <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--primary-deep)", fontFamily: "var(--font-display)" }}>
                    {s.wind_speed} <span style={{ fontSize: "0.7rem", fontWeight: 500, color: "var(--steel)" }}>m/s</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
