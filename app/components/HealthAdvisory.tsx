"use client";

import React from "react";
import { Shield, Heart, AlertTriangle, AlertCircle, Leaf, Activity, Check, Home } from "lucide-react";
import { motion } from "framer-motion";

interface HealthAdvisoryProps {
  aqi?: number;
  source?: string | null;
}

function getCategoryClass(aqi: number) {
  if (aqi <= 50) return "good";
  if (aqi <= 100) return "satisfactory";
  if (aqi <= 200) return "moderate";
  if (aqi <= 300) return "poor";
  if (aqi <= 400) return "verypoor";
  return "severe";
}

interface AdvisoryData {
  title: string;
  general: string[];
  vulnerable: string[];
  mask: boolean;
  outdoor: boolean;
}

function getAdvisory(aqi: number): AdvisoryData {
  if (aqi <= 50)
    return {
      title: "Air Quality is Excellent",
      general: ["Perfect conditions for outdoor activities", "Great day to go for a walk or jog", "No precautions needed"],
      vulnerable: ["No restrictions. Enjoy the fresh air!"],
      mask: false,
      outdoor: true,
    };
  if (aqi <= 100)
    return {
      title: "Air Quality is Acceptable",
      general: [
        "Air quality is acceptable for most people",
        "Sensitive individuals should watch for symptoms",
        "Good day for moderate outdoor activity",
      ],
      vulnerable: ["People with respiratory conditions may experience mild discomfort", "Monitor breathing if you have asthma"],
      mask: false,
      outdoor: true,
    };
  if (aqi <= 200)
    return {
      title: "Moderate — Reduce Outdoor Exposure",
      general: [
        "Reduce prolonged outdoor exertion",
        "Keep windows closed during peak pollution hours",
        "Consider indoor exercise instead",
        "Stay hydrated",
      ],
      vulnerable: ["Children & elderly should limit outdoor activity", "Asthmatics should carry inhalers", "Use air purifiers at home if available"],
      mask: true,
      outdoor: false,
    };
  if (aqi <= 300)
    return {
      title: "Poor — Avoid Outdoor Activities",
      general: [
        "Avoid outdoor exercise and physical labour",
        "Wear N95 mask if going outside",
        "Keep all windows and doors shut",
        "Use air purifiers at home",
      ],
      vulnerable: [
        "Stay indoors entirely",
        "Keep emergency medications accessible",
        "Schools should cancel outdoor PE classes",
        "Seek medical help if breathing difficulty occurs",
      ],
      mask: true,
      outdoor: false,
    };
  return {
    title: "SEVERE — Health Emergency",
    general: [
      "STAY INDOORS — This is a health emergency",
      "Wear N95 mask if any outdoor exposure unavoidable",
      "Avoid all physical exertion outdoors",
      "Seal windows with wet cloth to prevent dust entry",
    ],
    vulnerable: ["DO NOT go outdoors under any circumstances", "Seek medical help for breathing difficulty", "Schools must remain closed", "Emergency medical services on alert"],
    mask: true,
    outdoor: false,
  };
}

function AdvisoryHeaderIcon({ aqi }: { aqi: number }) {
  if (aqi <= 50) return <Leaf size={20} color="var(--aqi-good)" />;
  if (aqi <= 100) return <Activity size={20} color="var(--aqi-satisfactory)" />;
  if (aqi <= 200) return <AlertTriangle size={20} color="var(--aqi-moderate)" />;
  if (aqi <= 300) return <AlertCircle size={20} color="var(--aqi-poor)" />;
  return <AlertCircle size={20} color="var(--aqi-verypoor)" />;
}

export default function HealthAdvisory({ aqi = 0, source = null }: HealthAdvisoryProps) {
  const advisory = getAdvisory(aqi);
  const catClass = getCategoryClass(aqi);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card"
      style={{ height: "100%", display: "flex", flexDirection: "column", gap: 18 }}
    >
      {/* Header section inside the single card */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--hairline)", paddingBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }} className="advisory-title">
          <AdvisoryHeaderIcon aqi={aqi} />
          <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>{advisory.title}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: "0.75rem",
              padding: "4px 10px",
              background: advisory.mask ? "rgba(239,68,68,0.06)" : "rgba(34,197,94,0.06)",
              borderRadius: 999,
              color: advisory.mask ? "#ef4444" : "#22c55e",
              fontWeight: 600,
              border: `1px solid ${advisory.mask ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)"}`
            }}
          >
            {advisory.mask ? <AlertCircle size={12} /> : <Check size={12} />}
            <span>{advisory.mask ? "Mask Recommended" : "No Mask Needed"}</span>
          </span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: "0.75rem",
              padding: "4px 10px",
              background: advisory.outdoor ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
              borderRadius: 999,
              color: advisory.outdoor ? "#22c55e" : "#ef4444",
              fontWeight: 600,
              border: `1px solid ${advisory.outdoor ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)"}`
            }}
          >
            {advisory.outdoor ? <Check size={12} /> : <Home size={12} />}
            <span>{advisory.outdoor ? "Outdoor Safe" : "Stay Indoors"}</span>
          </span>
        </div>
      </div>

      {/* Grid columns */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, flex: 1 }}>
        {/* General population */}
        <div>
          <div className="section-title" style={{ fontSize: "0.95rem", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Shield size={16} /> General Population
          </div>
          <ul className="advisory-list" style={{ paddingLeft: 0 }}>
            {advisory.general.map((item, i) => (
              <li key={i} style={{ fontSize: "0.85rem", padding: "4px 0" }}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Vulnerable groups */}
        <div>
          <div className="section-title" style={{ fontSize: "0.95rem", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <Heart size={16} style={{ color: "#ef4444" }} /> Vulnerable Groups
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--earth-400)", marginBottom: 8 }}>
            Children · Elderly · Asthma/COPD
          </div>
          <ul className="advisory-list" style={{ paddingLeft: 0 }}>
            {advisory.vulnerable.map((item, i) => (
              <li key={i} style={{ fontSize: "0.85rem", padding: "4px 0" }}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Source-specific */}
      {source && source !== "unknown" && (
        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 14, marginTop: 4 }}>
          <div className="section-title" style={{ fontSize: "0.9rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={15} style={{ color: "var(--aqi-moderate)" }} /> Source-Specific Warning
          </div>
          <p style={{ fontSize: "0.82rem", color: "var(--earth-600)", lineHeight: 1.45 }}>
            {(source === "construction" || source === "dust") && "Construction and dust hazards are elevated in your area. Avoid walking near building sites and keep windows shut."}
            {source === "vehicle" && "Vehicle exhaust is the primary pollution source. Avoid busy roads and consider public transport."}
            {source === "biomass" && "Biomass burning detected nearby. Avoid areas with visible smoke or haze, especially in the evening."}
            {source === "industrial" && "Industrial emissions detected. Stay away from factory zones and report unusual smoke or odour."}
          </p>
        </div>
      )}
    </motion.div>
  );
}
