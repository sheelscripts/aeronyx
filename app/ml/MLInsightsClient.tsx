"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Brain, Zap, AlertTriangle, TrendingUp, Shield, Flame, Wind, CloudRain, Atom, Factory, Eye, RefreshCw, Truck, Hammer, Cloud, HelpCircle, Clock } from "lucide-react";
import { fetchMLSource, fetchMLForecast, fetchMLAnomaly, fetchIndustrialSource, fetchWards, detectSourceLocal } from "../services/api";
import { useLiveData } from "../hooks/useData";

const SOURCE_META: Record<string, { icon: React.ComponentType<any>; label: string; color: string; desc: string }> = {
  vehicle: { icon: Truck, label: "Vehicle Emissions", color: "#f97316", desc: "Traffic exhaust & brake dust" },
  industrial: { icon: Factory, label: "Industrial Activity", color: "#ef4444", desc: "Factory emissions & chemical processing" },
  construction: { icon: Hammer, label: "Construction Dust", color: "#b45309", desc: "Excavation, demolition & cement work" },
  biomass: { icon: Flame, label: "Biomass Burning", color: "#a855f7", desc: "Crop stubble, waste & cooking fuel fires" },
  mixed: { icon: Cloud, label: "Mixed Sources", color: "#6366f1", desc: "Multiple overlapping pollution drivers" },
  unknown: { icon: HelpCircle, label: "Unknown", color: "#78716c", desc: "Insufficient data for classification" },
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: any }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(16,185,129,0.12)",
        borderRadius: 12,
        padding: "12px 16px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: 6, color: "#292524" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: p.color }} />
          <span style={{ fontSize: "0.8rem", color: "#78716c" }}>{p.name}:</span>
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#292524" }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Source Detection Card ────────────────────────── */
function SourceDetectionCard({ data, loading }: { data: any; loading: boolean }) {
  if (loading)
    return (
      <div
        className="glass-card"
        style={{
          minHeight: 280,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          background: "#ffffff",
          border: "1px solid rgba(0,30,43,0.08)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          color: "var(--steel)"
        }}
      >
        <RefreshCw size={24} className="animate-spin" style={{ color: "var(--primary-deep)" }} />
        <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>Analyzing pollution signatures...</span>
      </div>
    );
  if (!data) return null;

  const meta = SOURCE_META[data.source] || SOURCE_META.unknown;
  const probs = data.probabilities || {};
  const sortedProbs = Object.entries(probs).sort((a: any, b: any) => b[1] - a[1]);

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ transform: "translateY(-3px)", boxShadow: "var(--shadow-md)" }}
      style={{
        background: "#ffffff",
        border: "1px solid rgba(0,30,43,0.08)",
        borderRadius: "var(--radius-lg)",
        padding: "24px",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        transition: "all 0.25s var(--ease-smooth)",
      }}
    >
      <div>
        <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.95rem", fontWeight: 700, color: "var(--brand-teal-deep)", marginBottom: 4 }}>
          <Brain size={16} style={{ color: "var(--primary-deep)" }} />
          <span>Source fingerprint classification</span>
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--steel)", margin: 0 }}>Random Forest classifier resolving multi-sensor pollutant ratios</p>
      </div>

      {/* Dominant source hero with glowing border */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "18px 20px",
          background: "#ffffff",
          borderRadius: "var(--radius-lg)",
          border: `1px solid ${meta.color}25`,
          boxShadow: `0 8px 30px -4px ${meta.color}14, 0 4px 12px -2px ${meta.color}08`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "var(--radius-md)",
            background: `${meta.color}10`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}
        >
          {React.createElement(meta.icon, { size: 22, color: meta.color })}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--steel)" }}>Dominant Profile</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "1.25rem", color: "var(--brand-teal-deep)", marginTop: 2 }}>{meta.label}</div>
          <div style={{ fontSize: "0.76rem", color: "var(--steel)", marginTop: 1 }}>{meta.desc}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.68rem", color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Confidence</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 700, color: meta.color }}>
            {((data.confidence || 0) * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Probability breakdown */}
      <div>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--steel)", marginBottom: 12 }}>Probability breakdown</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sortedProbs.map(([src, prob]: any) => {
            const m = SOURCE_META[src] || SOURCE_META.unknown;
            return (
              <div key={src} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 20, height: 20, display: "flex", justifyContent: "center", alignItems: "center", borderRadius: "50%", background: `${m.color}08`, border: `1px solid ${m.color}15` }}>
                  {React.createElement(m.icon, { size: 12, color: m.color })}
                </span>
                <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--charcoal)", width: 110 }}>{m.label}</span>
                <div style={{ flex: 1, height: 6, background: "var(--hairline-soft)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${prob * 100}%` }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    style={{ height: "100%", background: m.color, borderRadius: "var(--radius-full)" }}
                  />
                </div>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--charcoal)", width: 45, textAlign: "right", fontFamily: "var(--font-display)" }}>
                  {(prob * 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Input readings tabular grid */}
      {data.reading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 4 }}>
          {[
            { label: "PM2.5", value: data.reading.pm25, unit: "µg/m³", icon: Wind, color: "#f97316" },
            { label: "CO", value: data.reading.co, unit: "ppm", icon: Flame, color: "#8b5cf6" },
            { label: "NO₂", value: data.reading.no2, unit: "ppm", icon: CloudRain, color: "#0ea5e9" },
            { label: "TVOC", value: data.reading.tvoc, unit: "ppm", icon: Atom, color: "#f59e0b" },
          ].map(({ label, value, unit, icon: Icon, color }) => (
            <div
              key={label}
              style={{
                background: "#ffffff",
                border: "1px solid rgba(0,30,43,0.06)",
                borderRadius: "var(--radius-md)",
                padding: "10px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 4
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Icon size={12} style={{ color }} />
                <span style={{ fontSize: "0.7rem", color: "var(--steel)", fontWeight: 500 }}>{label}</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--brand-teal-deep)", fontFamily: "var(--font-display)" }}>{value}</span>
                <span style={{ fontSize: "0.65rem", color: "var(--steel)", fontWeight: 500 }}>{unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ── Forecast Chart Card ──────────────────────────── */
interface ForecastCardProps {
  data: any;
  loading: boolean;
  horizon: number;
  setHorizon: (h: number) => void;
}

function ForecastCard({ data, loading, horizon, setHorizon }: ForecastCardProps) {
  if (loading)
    return (
      <div
        className="glass-card"
        style={{
          minHeight: 380,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          background: "#ffffff",
          border: "1px solid rgba(0,30,43,0.08)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          color: "var(--steel)"
        }}
      >
        <RefreshCw size={24} className="animate-spin" style={{ color: "var(--primary-deep)" }} />
        <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>Computing forward predictions...</span>
      </div>
    );
  if (!data) return null;

  const forecasts: any[] = data.forecasts || [];
  const chartData = forecasts.map((f) => ({
    time: new Date(f.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    aqi: f.predicted_aqi,
    category: f.category,
    color: f.color,
  }));

  // Find peak and low
  const peak = forecasts.reduce((max, f) => (f.predicted_aqi > max.predicted_aqi ? f : max), forecasts[0] || { predicted_aqi: 0 });
  const minF = forecasts.reduce((min, f) => (f.predicted_aqi < min.predicted_aqi ? f : min), forecasts[0] || { predicted_aqi: 0 });

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      whileHover={{ transform: "translateY(-3px)", boxShadow: "var(--shadow-md)" }}
      style={{
        background: "#ffffff",
        border: "1px solid rgba(0,30,43,0.08)",
        borderRadius: "var(--radius-lg)",
        padding: "24px",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        transition: "all 0.25s var(--ease-smooth)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.95rem", fontWeight: 700, color: "var(--brand-teal-deep)", marginBottom: 4 }}>
            <TrendingUp size={16} style={{ color: "var(--primary-deep)" }} />
            <span>Atmospheric AQI forecast</span>
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--steel)", margin: 0 }}>XGBoost regression model mapping local and regional trans-boundary pollution vectors</p>
        </div>
        <div className="chart-tabs">
          {[6, 12, 24, 48].map((h) => (
            <button key={h} className={`chart-tab ${horizon === h ? "active" : ""}`} onClick={() => setHorizon(h)}>
              {h}h horizon
            </button>
          ))}
        </div>
      </div>

      {/* Mini stats row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[
          { label: "Current AQI", value: data.current_aqi, color: "var(--primary-deep)", bg: "var(--surface-feature)", border: "rgba(0,237,100,0.1)" },
          { label: "Predicted Peak", value: peak.predicted_aqi, color: "#ef4444", bg: "rgba(239,68,68,0.04)", border: "rgba(239,68,68,0.08)" },
          { label: "Predicted Low", value: minF.predicted_aqi, color: "#22c55e", bg: "rgba(34,197,94,0.04)", border: "rgba(34,197,94,0.08)" },
        ].map(({ label, value, color, bg, border }) => (
          <div
            key={label}
            style={{
              flex: 1,
              minWidth: "120px",
              padding: "14px 18px",
              background: "#ffffff",
              border: "1px solid rgba(0,30,43,0.06)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              flexDirection: "column",
              gap: 4
            }}
          >
            <span style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--steel)" }}>{label}</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: 700, color }}>
                {value}
              </span>
              <span style={{ fontSize: "0.72rem", fontWeight: 500, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Index</span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ width: "100%", height: 280, marginTop: 4 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 15, bottom: 5, left: -25 }}>
            <defs>
              <linearGradient id="forecast-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
            <XAxis dataKey="time" tick={{ fill: "#a8b3bc", fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fill: "#a8b3bc", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, "auto"]} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              y={100}
              strokeDasharray="4 4"
              stroke="#b45309"
              strokeWidth={1.2}
              label={{ value: "Moderate limit (100)", position: "insideBottomRight", fontSize: 10, fill: "#b45309", fontWeight: 500 }}
            />
            <ReferenceLine
              y={200}
              strokeDasharray="4 4"
              stroke="#ef4444"
              strokeWidth={1.2}
              label={{ value: "Poor limit (200)", position: "insideBottomRight", fontSize: 10, fill: "#ef4444", fontWeight: 500 }}
            />
            <Area
              type="monotone"
              dataKey="aqi"
              name="Predicted AQI"
              stroke="#10b981"
              strokeWidth={2.5}
              fill="url(#forecast-grad)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, fill: "white", stroke: "#10b981" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

/* ── Anomaly Detection Card ───────────────────────── */
function AnomalyCard({ data, loading }: { data: any; loading: boolean }) {
  if (loading)
    return (
      <div
        className="glass-card"
        style={{
          minHeight: 280,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          background: "#ffffff",
          border: "1px solid rgba(0,30,43,0.08)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          color: "var(--steel)"
        }}
      >
        <RefreshCw size={24} className="animate-spin" style={{ color: "var(--primary-deep)" }} />
        <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>Scanning sensor anomalies...</span>
      </div>
    );
  if (!data) return null;

  const isAnomaly = data.is_anomaly;
  const score = data.anomaly_score || 0;
  const activeSegments = Math.max(0, Math.min(10, Math.round(score * 10)));

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
      whileHover={{ transform: "translateY(-3px)", boxShadow: "var(--shadow-md)" }}
      style={{
        background: "#ffffff",
        border: "1px solid rgba(0,30,43,0.08)",
        borderRadius: "var(--radius-lg)",
        padding: "24px",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        transition: "all 0.25s var(--ease-smooth)",
      }}
    >
      <div>
        <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.95rem", fontWeight: 700, color: "var(--brand-teal-deep)", marginBottom: 4 }}>
          <AlertTriangle size={16} style={{ color: isAnomaly ? "var(--aqi-verypoor)" : "var(--primary-deep)" }} />
          <span>Anomaly scanning engine</span>
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--steel)", margin: 0 }}>Isolation Forest algorithm analyzing multidimensional drift signatures</p>
      </div>

      {/* Laboratory sensor readout panel */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "18px 20px",
          background: "#ffffff",
          borderRadius: "var(--radius-lg)",
          border: `1px solid ${isAnomaly ? "rgba(239,68,68,0.2)" : "rgba(34,197,94,0.15)"}`,
          boxShadow: isAnomaly
            ? "0 8px 30px -4px rgba(239,68,68,0.08), 0 4px 12px -2px rgba(239,68,68,0.04)"
            : "0 8px 30px -4px rgba(34,197,94,0.06), 0 4px 12px -2px rgba(34,197,94,0.03)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: isAnomaly ? "rgba(239,68,68,0.06)" : "rgba(34,197,94,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1.5px solid ${isAnomaly ? "#ef4444" : "#22c55e"}`,
            flexShrink: 0,
            position: "relative"
          }}
        >
          {isAnomaly ? <AlertTriangle size={20} color="#ef4444" /> : <Shield size={20} color="#22c55e" />}
          {/* Pulsing indicator light */}
          <span
            className="animate-pulse"
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isAnomaly ? "#ef4444" : "#22c55e",
              boxShadow: `0 0 8px ${isAnomaly ? "#ef4444" : "#22c55e"}`
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--steel)" }}>System State</div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "1.25rem",
              color: isAnomaly ? "#ef4444" : "var(--brand-teal-deep)",
              marginTop: 2
            }}
          >
            {isAnomaly ? "Deviation Detected" : "Nominal Scan"}
          </div>
          <div style={{ fontSize: "0.76rem", color: "var(--steel)", marginTop: 1 }}>
            {isAnomaly ? "Sensor values deviate significantly from baseline signatures" : "All multi-sensor values conform to expected limits"}
          </div>
        </div>
      </div>

      {/* Segmented VU meter for anomaly score */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--steel)" }}>Anomaly score index</span>
          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--brand-teal-deep)", fontFamily: "var(--font-code)" }}>{score.toFixed(3)}</span>
        </div>

        <div style={{ display: "flex", gap: 4, height: 10, marginTop: 4 }}>
          {Array.from({ length: 10 }).map((_, i) => {
            const active = i < activeSegments;
            let segColor = "rgba(0,30,43,0.05)";
            if (active) {
              if (i < 4) segColor = "#22c55e"; // Good green
              else if (i < 7) segColor = "#f97316"; // Suspicious orange
              else segColor = "#ef4444"; // Critical red
            }
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: "100%",
                  background: segColor,
                  borderRadius: "2px",
                  transition: "background-color 0.3s ease"
                }}
              />
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.04em" }}>Nominal</span>
          <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.04em" }}>Suspicious</span>
          <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.04em" }}>Critical</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Industrial Source Attribution Card ──────────── */
const SEVERITY_META: Record<string, { color: string; label: string; bg: string }> = {
  extreme: { color: "#dc2626", label: "Extreme Spike", bg: "rgba(220,38,38,0.07)" },
  high: { color: "#f97316", label: "High Spike", bg: "rgba(249,115,22,0.07)" },
  medium: { color: "#b45309", label: "Medium Spike", bg: "rgba(180,83,9,0.06)" },
  low: { color: "#ca8a04", label: "Low Spike", bg: "rgba(202,138,4,0.06)" },
  normal: { color: "#22c55e", label: "Normal", bg: "rgba(34,197,94,0.06)" },
  unknown: { color: "#78716c", label: "Unknown", bg: "rgba(120,113,108,0.05)" },
};

interface IndustrialSourceCardProps {
  data: any;
  loading: boolean;
  wardId: string;
  setWardId: (id: string) => void;
  wardOptions: any[];
}

function IndustrialSourceCard({ data, loading, wardId, setWardId, wardOptions }: IndustrialSourceCardProps) {
  if (loading)
    return (
      <div
        className="glass-card"
        style={{
          minHeight: 280,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          background: "#ffffff",
          border: "1px solid rgba(0,30,43,0.08)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
          color: "var(--steel)"
        }}
      >
        <RefreshCw size={24} className="animate-spin" style={{ color: "var(--primary-deep)" }} />
        <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>Tracing industrial sources...</span>
      </div>
    );
  if (!data) return null;

  const spike = data.spike || {};
  const sev = SEVERITY_META[spike.severity] || SEVERITY_META.unknown;
  const sources: any[] = data.industrial_source_matches || [];
  const srcCoords = data.estimated_source_location || {};
  const wind = data.wind || {};

  return (
    <motion.div
      className="glass-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      whileHover={{ transform: "translateY(-3px)", boxShadow: "var(--shadow-md)" }}
      style={{
        background: "#ffffff",
        border: "1px solid rgba(0,30,43,0.08)",
        borderRadius: "var(--radius-lg)",
        padding: "24px",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        transition: "all 0.25s var(--ease-smooth)",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.95rem", fontWeight: 700, color: "var(--brand-teal-deep)", marginBottom: 4 }}>
            <Factory size={16} style={{ color: "var(--primary-deep)" }} />
            <span>Industrial source attribution</span>
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--steel)", margin: 0 }}>Back-trajectory wind mapping integrated with industrial database matching</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.78rem", color: "var(--steel)", fontWeight: 600 }}>Active telemetry ward:</span>
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
      </div>

      {/* Spike status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "16px 20px",
          background: "#ffffff",
          borderRadius: "var(--radius-lg)",
          border: `1px solid ${sev.color}25`,
          boxShadow: `0 8px 30px -4px ${sev.color}10, 0 4px 12px -2px ${sev.color}04`,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `${sev.color}08`,
            border: `1.5px solid ${sev.color}20`,
            flexShrink: 0,
          }}
        >
          {spike.is_spike ? <AlertTriangle size={20} color={sev.color} /> : <Shield size={20} color={sev.color} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: sev.color }}>
            {spike.is_spike ? `Anomaly detected — ${sev.label}` : "Atmospheric level stable"}
          </div>
          <div style={{ fontSize: "0.76rem", color: "var(--steel)", marginTop: 2 }}>
            Z-score deviation: <strong>{spike.z_score ?? "—"}</strong> &nbsp;·&nbsp; PM2.5 baseline mean:{" "}
            <strong>
              {spike.mean ?? "—"} ± {spike.std ?? "—"} µg/m³
            </strong>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.68rem", color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Ward PM2.5</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: 700, color: sev.color }}>
            {data.ward?.pm25 ?? "—"}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--steel)" }}>µg/m³</div>
        </div>
      </div>

      {/* Wind + estimated source coords */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div
          style={{
            padding: "14px 18px",
            background: "#ffffff",
            borderRadius: "var(--radius-md)",
            border: "1px solid rgba(0,30,43,0.06)",
          }}
        >
          <span style={{ fontSize: "0.68rem", color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Wind vector</span>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--brand-teal-deep)", fontFamily: "var(--font-display)", marginTop: 4 }}>
            {wind.wind_speed ?? "—"} m/s · {wind.wind_direction ?? "—"}°
          </div>
          <div style={{ fontSize: "0.74rem", color: "var(--steel)", marginTop: 2 }}>Directional heading: {wind.wind_label || ""}</div>
        </div>
        <div
          style={{
            padding: "14px 18px",
            background: "#ffffff",
            borderRadius: "var(--radius-md)",
            border: "1px solid rgba(0,30,43,0.06)",
          }}
        >
          <span style={{ fontSize: "0.68rem", color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Calculated plume source</span>
          <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--brand-teal-deep)", fontFamily: "var(--font-display)", marginTop: 4 }}>
            {srcCoords.source_lat ?? "—"}°N, {srcCoords.source_lon ?? "—"}°E
          </div>
          <div style={{ fontSize: "0.74rem", color: "var(--steel)", marginTop: 2 }}>
            {srcCoords.travel_distance_km ?? "—"} km upwind · {srcCoords.transport_hours ?? "—"}h transport delay
          </div>
        </div>
      </div>

      {/* Industrial source matches */}
      {sources.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--steel)" }}>
            Nearest Industrial sources (Zenodo Delhi 2020)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sources.map((src, i) => (
              <div
                key={i}
                style={{
                  padding: "16px",
                  borderRadius: "var(--radius-md)",
                  background: "#ffffff",
                  border: `1px solid ${i === 0 ? "rgba(239,68,68,0.15)" : "rgba(0,30,43,0.06)"}`,
                  boxShadow: i === 0 ? "0 4px 16px rgba(239,68,68,0.03)" : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        background: i === 0 ? "#ef4444" : "#ffffff",
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
                  <span style={{ fontSize: "0.74rem", color: "var(--steel)", fontWeight: 500 }}>{(src.distance_m / 1000).toFixed(2)} km distance heading</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 8, background: "rgba(0,30,43,0.01)", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid rgba(0,30,43,0.03)" }}>
                  {[
                    { label: "PM2.5", value: src.pm25_emission, unit: "t/d" },
                    { label: "NOx", value: src.nox_emission, unit: "t/d" },
                    { label: "SO₂", value: src.so2_emission, unit: "t/d" },
                    { label: "CO", value: src.co_emission, unit: "t/d" },
                  ].map(({ label, value, unit }) => (
                    <div key={label} style={{ fontSize: "0.74rem", color: "var(--steel)" }}>
                      <span style={{ fontWeight: 600, color: "var(--charcoal)" }}>{label}:</span> {value} {unit}
                    </div>
                  ))}
                </div>

                {src.plume_conc_ug_m3 != null && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--steel)" }}>Plume concentration at ward (Gaussian PG-{src.stability_class})</span>
                      <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#ef4444", fontFamily: "var(--font-code)" }}>{src.plume_conc_ug_m3.toExponential(3)} g/m³</span>
                    </div>
                    <div style={{ height: 6, background: "var(--hairline-soft)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          borderRadius: "var(--radius-full)",
                          background: i === 0 ? "#ef4444" : "#f97316",
                          width: `${Math.min(
                            100,
                            i === 0
                              ? 100
                              : sources[0].plume_conc_ug_m3 > 0
                              ? (src.plume_conc_ug_m3 / sources[0].plume_conc_ug_m3) * 100
                              : 0
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: "0.68rem", color: "var(--steel)", textAlign: "right", borderTop: "1px solid var(--hairline-soft)", paddingTop: 12, marginTop: 4 }}>
        Dataset: Zenodo Delhi Domain 2020 · Model: Pasquill-Gifford Gaussian Plume
      </div>
    </motion.div>
  );
}

/* ── Main ML Insights Component ─────────────────────── */
export default function MLInsightsClient() {
  const [sourceData, setSourceData] = useState<any>(null);
  const [forecastData, setForecastData] = useState<any>(null);
  const [anomalyData, setAnomalyData] = useState<any>(null);
  const [industrialData, setIndustrialData] = useState<any>(null);
  const [industrialWardId, setIndustrialWardId] = useState("ward_1");
  const [wardOptions, setWardOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState({ source: true, forecast: true, anomaly: true, industrial: true });
  const [horizon, setHorizon] = useState(24);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { data: liveData } = useLiveData();

  useEffect(() => {
    fetchWards()
      .then((res) => {
        const wards = (res?.wards || [])
          .filter((w: any) => w.feature_type === "ward")
          .map((w: any) => ({ id: w.ward_id, name: w.name }))
          .sort((a: any, b: any) => Number(a.id.split("_")[1] || 0) - Number(b.id.split("_")[1] || 0));
        setWardOptions(wards);
        if (wards.length > 0 && !wards.some((w: any) => w.id === industrialWardId)) {
          setIndustrialWardId(wards[0].id);
        }
      })
      .catch(() => {});
  }, [industrialWardId]);

  const fetchAll = useCallback(async () => {
    if (!industrialWardId) return;
    setLoading({ source: true, forecast: true, anomaly: true, industrial: true });
    try {
      const [src, fc, an, ind] = await Promise.all([
        fetchMLSource().catch(() => null),
        fetchMLForecast(horizon).catch(() => null),
        fetchMLAnomaly().catch(() => null),
        fetchIndustrialSource(industrialWardId).catch(() => null),
      ]);
      // Use API result or client-side fallback for source
      if (src && src.source && src.source !== "unknown") {
        setSourceData(src);
      } else if (liveData) {
        setSourceData(detectSourceLocal(liveData.pm25 || 0, liveData.co || 0, liveData.no2 || 0, liveData.tvoc || 0));
      }
      setForecastData(fc);
      setAnomalyData(an);
      setIndustrialData(ind);
      setLastUpdated(new Date());
    } catch (e) {
      /* swallow */
    }
    setLoading({ source: false, forecast: false, anomaly: false, industrial: false });
  }, [horizon, liveData, industrialWardId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Refresh forecast when horizon changes
  useEffect(() => {
    setLoading((l) => ({ ...l, forecast: true }));
    fetchMLForecast(horizon)
      .then((d) => {
        setForecastData(d);
        setLoading((l) => ({ ...l, forecast: false }));
      })
      .catch(() => setLoading((l) => ({ ...l, forecast: false })));
  }, [horizon]);

  // Re-fetch industrial data when ward changes
  useEffect(() => {
    if (!industrialWardId) return;
    setLoading((l) => ({ ...l, industrial: true }));
    fetchIndustrialSource(industrialWardId)
      .then((d) => {
        setIndustrialData(d);
        setLoading((l) => ({ ...l, industrial: false }));
      })
      .catch(() => setLoading((l) => ({ ...l, industrial: false })));
  }, [industrialWardId]);

  // Auto-refresh every 60s
  useEffect(() => {
    const iv = setInterval(fetchAll, 60000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <motion.div className="page-header" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span className="dot" style={{ background: "var(--primary-deep)", width: 6, height: 6, boxShadow: "0 0 8px var(--primary-deep)" }} />
              <span style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--steel)" }}>
                Predictive telemetry matrix
              </span>
            </div>
            <h2 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--brand-teal-deep)", margin: 0 }}>
              Machine learning insights
            </h2>
            <p style={{ color: "var(--steel)", fontSize: "0.9rem", marginTop: 6, margin: 0 }}>
              Real-time predictive intelligence, anomaly detection, and source classification
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {lastUpdated && (
              <div className="last-updated" style={{ margin: 0, background: "rgba(0,30,43,0.01)", border: "1px solid var(--hairline-soft)", padding: "8px 14px", borderRadius: "var(--radius-sm)" }}>
                <span className="dot" style={{ background: "var(--primary-deep)" }} />
                <Clock size={12} style={{ color: "var(--steel)" }} />
                <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--charcoal)" }}>Updated {lastUpdated.toLocaleTimeString()}</span>
              </div>
            )}
            <button
              onClick={fetchAll}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(0,30,43,0.08)",
                background: "#ffffff",
                color: "var(--brand-teal-deep)",
                fontSize: "0.82rem",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "var(--shadow-sm)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "var(--shadow-md)";
                e.currentTarget.style.borderColor = "rgba(0,30,43,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "var(--shadow-sm)";
                e.currentTarget.style.borderColor = "rgba(0,30,43,0.08)";
              }}
            >
              <RefreshCw size={13} />
              <span>Refresh Predictions</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Model info badges */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          { label: "Source Classifier", model: "Random Forest", icon: Brain, color: "#8b5cf6" },
          { label: "AQI Forecaster", model: "XGBoost", icon: TrendingUp, color: "#10b981" },
          { label: "Anomaly Detector", model: "Isolation Forest", icon: Eye, color: "#f97316" },
          { label: "Industrial Plume", model: "Gaussian PG", icon: Factory, color: "#ef4444" },
        ].map(({ label, model, icon: Icon, color }) => (
          <motion.div
            key={label}
            whileHover={{ scale: 1.02, boxShadow: "var(--shadow-md)" }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              background: "#ffffff",
              border: "1px solid rgba(0,30,43,0.08)",
              borderRadius: 999,
              boxShadow: "var(--shadow-sm)",
              cursor: "default",
              transition: "box-shadow 0.2s ease"
            }}
          >
            <Icon size={13} style={{ color }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--brand-teal-deep)" }}>{label}</span>
            <span style={{ fontSize: "0.68rem", fontFamily: "var(--font-code)", color: "var(--steel)", fontWeight: 500 }}>({model})</span>
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#00ed64",
                boxShadow: "0 0 6px #00ed64",
                flexShrink: 0
              }}
            />
          </motion.div>
        ))}
      </div>

      {/* Source + Anomaly side-by-side */}
      <div className="comparison-grid">
        <SourceDetectionCard data={sourceData} loading={loading.source} />
        <AnomalyCard data={anomalyData} loading={loading.anomaly} />
      </div>

      {/* Forecast full-width */}
      <ForecastCard data={forecastData} loading={loading.forecast} horizon={horizon} setHorizon={setHorizon} />

      {/* Industrial Source Attribution full-width */}
      <IndustrialSourceCard
        data={industrialData}
        loading={loading.industrial}
        wardId={industrialWardId}
        setWardId={setIndustrialWardId}
        wardOptions={wardOptions}
      />
    </div>
  );
}
