"use client";

import React, { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const TIME_RANGES = [
  { label: "1H", hours: 1, points: 12 },
  { label: "6H", hours: 6, points: 72 },
  { label: "24H", hours: 24, points: 200 },
  { label: "7D", hours: 168, points: 500 },
];

interface TimeSeriesChartProps {
  data?: any[];
  title?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: any;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(16,185,129,0.15)",
        borderRadius: 12,
        padding: "12px 16px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        fontSize: "0.82rem",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6, color: "#292524" }}>
        {new Date(label).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: p.color }} />
          <span style={{ color: "#78716c" }}>{p.name}:</span>
          <span style={{ fontWeight: 600, color: "#292524" }}>
            {typeof p.value === "number" ? p.value.toFixed(1) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

const METRICS: Record<string, { color: string; name: string; gradient: string[] }> = {
  aqi: { color: "#10b981", name: "AQI", gradient: ["#10b981", "#059669"] },
  pm25: { color: "#f97316", name: "PM 2.5", gradient: ["#f97316", "#ea580c"] },
  co: { color: "#8b5cf6", name: "CO", gradient: ["#8b5cf6", "#7c3aed"] },
  no2: { color: "#0ea5e9", name: "NO₂", gradient: ["#0ea5e9", "#0284c7"] },
};

export default function TimeSeriesChart({ data = [], title = "AQI Trend" }: TimeSeriesChartProps) {
  const [range, setRange] = useState(0); // Default to 1H
  const [metric, setMetric] = useState("aqi");

  const filteredData = useMemo(() => {
    if (!data.length) return [];
    const now = new Date();
    const cutoff = new Date(now.getTime() - TIME_RANGES[range].hours * 60 * 60 * 1000);
    return data.filter((d) => new Date(d.timestamp) >= cutoff).slice(-TIME_RANGES[range].points);
  }, [data, range]);

  const chartData = useMemo(
    () =>
      filteredData.map((d) => ({
        ...d,
        time: new Date(d.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      })),
    [filteredData]
  );

  const m = METRICS[metric];

  return (
    <div className="chart-container">
      <div className="chart-header">
        <div>
          <span className="chart-title">{title}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Metric selector */}
          <div className="chart-tabs">
            {Object.entries(METRICS).map(([key, val]) => (
              <button
                key={key}
                className={`chart-tab ${metric === key ? "active" : ""}`}
                onClick={() => setMetric(key)}
              >
                {val.name}
              </button>
            ))}
          </div>
          {/* Time range */}
          <div className="chart-tabs">
            {TIME_RANGES.map((tr, i) => (
              <button
                key={tr.label}
                className={`chart-tab ${range === i ? "active" : ""}`}
                onClick={() => setRange(i)}
              >
                {tr.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div
          style={{
            height: 220,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--earth-400)",
            fontSize: "0.9rem",
          }}
        >
          Collecting data... Chart will appear once readings are stored.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
            <defs>
              <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={m.gradient[0]} stopOpacity={0.25} />
                <stop offset="95%" stopColor={m.gradient[1]} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: "#a8a29e", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fill: "#a8a29e", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={metric}
              stroke={m.color}
              strokeWidth={2.5}
              fill={`url(#grad-${metric})`}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, fill: "white", stroke: m.color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
