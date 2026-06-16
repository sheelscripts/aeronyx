"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ComposedChart,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { BarChart3, TrendingUp, Activity, Clock, Zap, Download } from "lucide-react";
import { useHistoryData, useLiveData } from "../hooks/useData";

function exportToCSV(data: any[]) {
  if (!data || !data.length) return;
  const keys = ["timestamp", "aqi", "aqi_category", "pm25", "co", "no2", "tvoc", "temperature", "humidity"];
  const header = keys.join(",");
  const rows = data.map((r) =>
    keys
      .map((k) => {
        const v = r[k] ?? "";
        return typeof v === "string" && v.includes(",") ? `"${v}"` : v;
      })
      .join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aeronyx_data_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const POLLUTANTS = [
  { key: "aqi", name: "Overall AQI", color: "#10b981", max: 500 },
  { key: "pm25", name: "PM 2.5", color: "#f97316", max: 250 },
  { key: "co", name: "CO", color: "#8b5cf6", max: 10 },
  { key: "no2", name: "NO₂", color: "#0ea5e9", max: 0.2 },
  { key: "tvoc", name: "TVOC", color: "#b45309", max: 1 },
  { key: "temperature", name: "Temp", color: "#ef4444", max: 50 },
  { key: "humidity", name: "Humidity", color: "#38bdf8", max: 100 },
];

const TIME_PRESETS = [
  { label: "1H", hours: 1 },
  { label: "6H", hours: 6 },
  { label: "12H", hours: 12 },
  { label: "24H", hours: 24 },
  { label: "3D", hours: 72 },
  { label: "7D", hours: 168 },
];

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
          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#292524" }}>
            {typeof p.value === "number" ? p.value.toFixed(2) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Pollutant Radar Chart ─────────────────────────── */
function PollutantRadar({ data }: { data: any }) {
  if (!data) return null;
  const radarData = POLLUTANTS.filter((p) => !["temperature", "humidity"].includes(p.key)).map((p) => ({
    name: p.name,
    value: Math.min(100, ((data[p.key] || 0) / p.max) * 100),
    actual: data[p.key],
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid stroke="rgba(0,0,0,0.04)" />
        <PolarAngleAxis dataKey="name" tick={{ fill: "#78716c", fontSize: 11, fontWeight: 500 }} />
        <PolarRadiusAxis tick={false} axisLine={false} />
        <Radar name="Current" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
        <Tooltip
          content={({ payload }) => {
            if (!payload?.length) return null;
            const item = payload[0].payload;
            return (
              <div
                style={{
                  background: "rgba(255,255,255,0.95)",
                  borderRadius: 10,
                  padding: "8px 12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  border: "1px solid rgba(16,185,129,0.12)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#292524" }}>{item.name}</div>
                <div style={{ fontSize: "0.78rem", color: "#78716c" }}>Value: {item.actual?.toFixed(2)}</div>
              </div>
            );
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/* ── Correlation Heatmap ───────────────────────────── */
function CorrelationHeatmap({ history }: { history: any[] }) {
  const keys = ["pm25", "co", "no2", "tvoc", "temperature", "humidity"];
  const labels = ["PM2.5", "CO", "NO₂", "TVOC", "Temp", "Humidity"];

  const correlations = useMemo(() => {
    if (history.length < 5) return null;
    const n = history.length;
    const matrix = [];

    for (let i = 0; i < keys.length; i++) {
      const row = [];
      for (let j = 0; j < keys.length; j++) {
        if (i === j) {
          row.push(1);
          continue;
        }
        const x = history.map((d) => d[keys[i]] || 0);
        const y = history.map((d) => d[keys[j]] || 0);
        const meanX = x.reduce((a, b) => a + b) / n;
        const meanY = y.reduce((a, b) => a + b) / n;
        let num = 0,
          denX = 0,
          denY = 0;
        for (let k = 0; k < n; k++) {
          const dx = x[k] - meanX;
          const dy = y[k] - meanY;
          num += dx * dy;
          denX += dx * dx;
          denY += dy * dy;
        }
        const r = denX && denY ? num / Math.sqrt(denX * denY) : 0;
        row.push(Math.round(r * 100) / 100);
      }
      matrix.push(row);
    }
    return matrix;
  }, [history]);

  if (!correlations) return <div style={{ color: "var(--earth-400)", padding: 20, textAlign: "center" }}>Need more data...</div>;

  const cellColor = (r: number) => {
    if (r >= 0.7) return "rgba(16,185,129,0.5)";
    if (r >= 0.4) return "rgba(16,185,129,0.25)";
    if (r >= 0) return `rgba(16,185,129,${Math.max(0.03, r * 0.3)})`;
    if (r >= -0.4) return `rgba(239,68,68,${Math.abs(r) * 0.25})`;
    return `rgba(239,68,68,${Math.abs(r) * 0.5})`;
  };

  return (
    <div>
      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: `60px repeat(${keys.length}, 1fr)`, gap: 2, marginBottom: 2 }}>
        <div />
        {labels.map((l) => (
          <div key={l} style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--earth-500)", textAlign: "center", padding: "4px 0" }}>
            {l}
          </div>
        ))}
      </div>
      {/* Rows */}
      {correlations.map((row, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: `60px repeat(${keys.length}, 1fr)`, gap: 2, marginBottom: 2 }}>
          <div
            style={{
              fontSize: "0.68rem",
              fontWeight: 600,
              color: "var(--earth-500)",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: 8,
            }}
          >
            {labels[i]}
          </div>
          {row.map((val, j) => (
            <div
              key={j}
              className="heatmap-cell"
              style={{ background: cellColor(val), color: Math.abs(val) > 0.5 ? "white" : "var(--earth-700)" }}
              title={`${labels[i]} vs ${labels[j]}: r=${val}`}
            >
              {val.toFixed(2)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Hourly Distribution Bar Chart ─────────────── */
function HourlyDistribution({ history }: { history: any[] }) {
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${String(i).padStart(2, "0")}:00`,
      aqi: 0,
      count: 0,
    }));
    history.forEach((d) => {
      const h = new Date(d.timestamp).getHours();
      hours[h].aqi += d.aqi || 0;
      hours[h].count += 1;
    });
    return hours.map((h) => ({ ...h, aqi: h.count ? Math.round(h.aqi / h.count) : 0 }));
  }, [history]);

  const getBarColor = (aqi: number) => {
    if (aqi <= 50) return "#22c55e";
    if (aqi <= 100) return "#84cc16";
    if (aqi <= 200) return "#b45309";
    if (aqi <= 300) return "#f97316";
    return "#ef4444";
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={hourlyData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
        <XAxis dataKey="hour" tick={{ fill: "#a8a29e", fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
        <YAxis tick={{ fill: "#a8a29e", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="aqi" name="Avg AQI" radius={[4, 4, 0, 0]}>
          {hourlyData.map((entry, i) => (
            <Cell key={i} fill={getBarColor(entry.aqi)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── Main Analytics Component ───────────────────────────── */
export default function AnalyticsClient() {
  const { data: history, loading } = useHistoryData(500);
  const { data: live } = useLiveData();
  const [selectedKeys, setSelectedKeys] = useState(["aqi", "pm25"]);
  const [timeRange, setTimeRange] = useState(0); // 1H

  // Filter by time range
  const filteredHistory = useMemo(() => {
    if (!history.length) return [];
    const cutoff = new Date(Date.now() - TIME_PRESETS[timeRange].hours * 3600000);
    return history.filter((d) => new Date(d.timestamp) >= cutoff);
  }, [history, timeRange]);

  const chartData = filteredHistory.map((d) => ({
    ...d,
    time: new Date(d.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  }));

  // Stats for selected pollutants
  const stats = selectedKeys.map((key) => {
    const values = filteredHistory.map((d) => d[key]).filter((v) => typeof v === "number");
    if (!values.length) return { key, avg: "0", max: "0", min: "0", current: "0", trend: "0" };
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const current = values[values.length - 1] || 0;
    const slice = Math.max(1, Math.floor(values.length * 0.1));
    const earlyAvg = values.slice(0, slice).reduce((a, b) => a + b, 0) / slice;
    const lateAvg = values.slice(-slice).reduce((a, b) => a + b, 0) / slice;
    const trend = earlyAvg > 0 ? ((lateAvg - earlyAvg) / earlyAvg) * 100 : 0;
    return {
      key,
      avg: avg.toFixed(1),
      max: Math.max(...values).toFixed(1),
      min: Math.min(...values).toFixed(1),
      current: current.toFixed(1),
      trend: trend.toFixed(1),
    };
  });

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <motion.div className="page-header" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em" }}>Historical Analytics</h2>
            <p style={{ color: "var(--earth-500)", fontSize: "0.9rem", marginTop: 4 }}>Deep-dive into historical trends, correlations, and pollutant patterns</p>
          </div>
          <button
            onClick={() => exportToCSV(history)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(0,30,43,0.08)",
              background: "#ffffff",
              color: "var(--earth-700)",
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
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </motion.div>

      {/* Time Range + Pollutant selector */}
      <motion.div className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={14} style={{ color: "var(--earth-400)" }} />
            <div className="chart-tabs">
              {TIME_PRESETS.map((t, i) => (
                <button key={t.label} className={`chart-tab ${timeRange === i ? "active" : ""}`} onClick={() => setTimeRange(i)}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ borderLeft: "1px solid var(--earth-200)", height: 24 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Activity size={14} style={{ color: "var(--earth-400)" }} />
            {POLLUTANTS.map((p) => (
              <button
                key={p.key}
                onClick={() => toggleKey(p.key)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 999,
                  border: `1.5px solid ${selectedKeys.includes(p.key) ? p.color : "var(--earth-200)"}`,
                  background: selectedKeys.includes(p.key) ? `${p.color}12` : "transparent",
                  color: selectedKeys.includes(p.key) ? p.color : "var(--earth-500)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Multi-line chart */}
        {loading || !chartData.length ? (
          <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--earth-400)" }}>
            {loading ? "Loading..." : "No data for this range."}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <defs>
                {selectedKeys.map((key) => {
                  const p = POLLUTANTS.find((pl) => pl.key === key);
                  return (
                    <linearGradient key={key} id={`analytics-grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={p?.color} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={p?.color} stopOpacity={0.01} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: "#a8a29e", fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "#a8a29e", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "0.78rem", paddingTop: 8 }} />
              {selectedKeys.map((key) => {
                const p = POLLUTANTS.find((pl) => pl.key === key);
                return (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={p?.name || key}
                    stroke={p?.color || "#10b981"}
                    strokeWidth={2}
                    fill={`url(#analytics-grad-${key})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, fill: "white" }}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* Stats cards with trend indicator */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {stats.map(({ key, avg, max, min, current, trend }) => {
          const p = POLLUTANTS.find((pl) => pl.key === key);
          const trendUp = Number(trend) > 0;
          return (
            <motion.div key={key} className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: p?.color }} />
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.95rem" }}>{p?.name}</span>
                </div>
                {trend !== "0.0" && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 2,
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: trendUp ? "#ef4444" : "#22c55e",
                      background: trendUp ? "rgba(239,68,68,0.08)" : "rgba(34,197,94,0.08)",
                      padding: "2px 8px",
                      borderRadius: 999,
                    }}
                  >
                    <TrendingUp size={10} style={{ transform: trendUp ? "none" : "rotate(180deg)" }} />
                    {Math.abs(Number(trend))}%
                  </span>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "Current", value: current },
                  { label: "Average", value: avg },
                  { label: "Maximum", value: max },
                  { label: "Minimum", value: min },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: "0.7rem", color: "var(--earth-400)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 700, color: "var(--earth-800)" }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Bottom row: Radar + Correlation */}
      <div className="comparison-grid">
        <motion.div className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="section-title">
            <Zap size={16} /> Pollutant Profile
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--earth-400)", marginBottom: 4 }}>
            Current pollutant levels normalized to their max thresholds
          </p>
          <PollutantRadar data={live} />
        </motion.div>

        <motion.div className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <div className="section-title">
            <BarChart3 size={16} /> Pollutant Correlations
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--earth-400)", marginBottom: 12 }}>
            Pearson correlation between pollutant pairs (green = positive, red = negative)
          </p>
          <CorrelationHeatmap history={filteredHistory} />
        </motion.div>
      </div>

      {/* Hourly distribution */}
      <motion.div className="glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="section-title">
          <Clock size={16} /> Hourly AQI Distribution
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--earth-400)", marginBottom: 8 }}>
          Average AQI by hour of day — identifies rush-hour pollution peaks
        </p>
        <HourlyDistribution history={filteredHistory} />
      </motion.div>
    </div>
  );
}
