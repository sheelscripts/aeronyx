"use client";

import React from "react";

const SOURCE_LABELS: Record<string, string> = {
  vehicular: "Vehicular",
  vehicle: "Vehicular",
  industrial: "Industrial",
  biomass: "Biomass",
  construction: "Construction",
  dust: "Dust",
  regional: "Regional",
  mixed: "Mixed",
};

const SOURCE_COLORS: Record<string, string> = {
  vehicular: "#0ea5e9",
  vehicle: "#0ea5e9",
  industrial: "#8b5cf6",
  biomass: "#f97316",
  construction: "#b45309",
  dust: "#a16207",
  regional: "#64748b",
  mixed: "#78716c",
};

interface Attribution {
  scores?: Record<string, number>;
  confidence?: string;
  dominant_source?: string;
  dominant?: string;
}

interface AttributionPanelProps {
  attribution?: Attribution | null;
}

export default function AttributionPanel({ attribution }: AttributionPanelProps) {
  if (!attribution || !attribution.scores) {
    return (
      <div className="glass-card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Source Attribution</div>
        <div style={{ fontSize: "0.82rem", color: "var(--earth-400)" }}>Select a ward to view source breakdown.</div>
      </div>
    );
  }

  const entries = Object.entries(attribution.scores).sort((a, b) => b[1] - a[1]);
  const dominant = attribution.dominant_source || attribution.dominant || "mixed";

  return (
    <div className="glass-card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700, color: "var(--forest-800)" }}>Source Attribution</div>
        <div style={{ fontSize: "0.75rem", color: "var(--earth-400)" }}>
          Confidence: <b>{attribution.confidence || "medium"}</b>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.map(([k, v]) => (
          <div key={k}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: 4 }}>
              <span style={{ color: "var(--earth-700)" }}>{SOURCE_LABELS[k] || k}</span>
              <span style={{ color: "var(--earth-500)" }}>{Math.round(v * 100)}%</span>
            </div>
            <div style={{ background: "rgba(148,163,184,0.2)", borderRadius: 999, height: 8, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.round(v * 100)}%`,
                  background: SOURCE_COLORS[k] || "#64748b",
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, fontSize: "0.74rem", color: "var(--earth-400)" }}>
        Dominant: <b style={{ color: "var(--forest-700)" }}>{SOURCE_LABELS[dominant] || dominant}</b>
      </div>
    </div>
  );
}
