"use client";

import React from "react";

interface AQIGaugeProps {
  aqi?: number;
  category?: string;
  color?: string;
}

/**
 * AQI Gauge — Circular ring gauge with animated fill
 * Inspired by Awwwards-style data visualization
 */
export default function AQIGauge({ aqi = 0, category = "", color = "#22c55e" }: AQIGaugeProps) {
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.min(aqi / 500, 1);
  const offset = circumference * (1 - percent);

  return (
    <div className="aqi-gauge-container" style={{ background: "var(--canvas)", borderRadius: "var(--radius-lg)" }}>
      <div className="aqi-gauge-ring">
        <svg viewBox="0 0 200 200">
          <circle cx="100" cy="100" r={radius} className="gauge-bg" />
          <circle
            cx="100"
            cy="100"
            r={radius}
            className="gauge-fill"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div style={{ textAlign: "center", zIndex: 1 }}>
          <div className="aqi-value" style={{ color }}>{aqi}</div>
          <div className="aqi-label" style={{ color: "var(--earth-500)" }}>AQI</div>
        </div>
      </div>

      <div
        className="aqi-category"
        style={{
          background: `${color}18`,
          color,
          border: `1px solid ${color}30`,
        }}
      >
        {category}
      </div>
    </div>
  );
}
