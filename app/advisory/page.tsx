"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Heart, AlertTriangle, Wind, Activity, Baby, UserCheck, Dumbbell, XCircle, CheckCircle, Info, RefreshCw, CloudRain, Atom, Leaf, AlertCircle, ShieldAlert, Truck, Factory, Hammer, Flame, Cloud, HelpCircle, Check, X } from "lucide-react";
import { useLiveData } from "../hooks/useData";

/* ── AQI data ─────────────────────────────────────── */
const AQI_LEVELS = [
  { max: 50, label: "Good", color: "#22c55e", bg: "rgba(34,197,94,0.04)", border: "rgba(34,197,94,0.15)", icon: Leaf, text: "#15803d" },
  { max: 100, label: "Satisfactory", color: "#84cc16", bg: "rgba(132,204,22,0.04)", border: "rgba(132,204,22,0.15)", icon: Activity, text: "#4d7c0f" },
  { max: 200, label: "Moderate", color: "#b45309", bg: "rgba(234,179,8,0.04)", border: "rgba(234,179,8,0.15)", icon: AlertTriangle, text: "#92400e" },
  { max: 300, label: "Poor", color: "#f97316", bg: "rgba(249,115,22,0.04)", border: "rgba(249,115,22,0.15)", icon: AlertCircle, text: "#c2410c" },
  { max: 400, label: "Very Poor", color: "#ef4444", bg: "rgba(239,68,68,0.04)", border: "rgba(239,68,68,0.15)", icon: XCircle, text: "#b91c1c" },
  { max: 999, label: "Severe", color: "#7c3aed", bg: "rgba(124,58,237,0.04)", border: "rgba(124,58,237,0.15)", icon: ShieldAlert, text: "#5b21b6" },
];

function getLevel(aqi: number) {
  return AQI_LEVELS.find((l) => aqi <= l.max) || AQI_LEVELS[AQI_LEVELS.length - 1];
}

/* ── Activity cards ──────────────────────────────── */
const ACTIVITIES = [
  { label: "Running", icon: Activity, okUpto: 100 },
  { label: "Cycling", icon: Wind, okUpto: 100 },
  { label: "Walking", icon: UserCheck, okUpto: 200 },
  { label: "Children Outdoors", icon: Baby, okUpto: 150 },
  { label: "Gym Outdoors", icon: Dumbbell, okUpto: 100 },
  { label: "Schools Open", icon: Shield, okUpto: 200 },
];

/* ── Profiles ───────────────────────────────────── */
const PROFILES = [
  { key: "general", label: "General", icon: Shield },
  { key: "children", label: "Children", icon: Baby },
  { key: "elderly", label: "Elderly", icon: Heart },
  { key: "athlete", label: "Athletes", icon: Dumbbell },
  { key: "asthma", label: "Asthma/COPD", icon: Wind },
  { key: "pregnant", label: "Pregnant", icon: UserCheck },
];

const PROFILE_ADVICE: Record<string, any[]> = {
  general: [
    { max: 50, dos: ["Enjoy outdoor activities freely", "Open windows for ventilation", "Great time for morning walks"], donts: [] },
    {
      max: 100,
      dos: ["Moderate outdoor activity is fine", "Monitor for unusual symptoms", "Keep windows open"],
      donts: ["Avoid prolonged strenuous exercise if sensitive"],
    },
    { max: 200, dos: ["Stay indoors during peak hours", "Use air purifiers if available", "Stay hydrated"], donts: ["Avoid prolonged outdoor exertion", "Do not exercise near roads"] },
    {
      max: 300,
      dos: ["Wear N95 mask outdoors", "Keep all windows/doors shut", "Use air purifiers", "Check indoor AQI"],
      donts: ["Avoid outdoor exercise", "Do not open windows", "Avoid busy roads"],
    },
    {
      max: 999,
      dos: ["Seal gaps around windows with damp cloth", "Stay in rooms with air purifiers", "Wear N95 even indoors if possible"],
      donts: ["DO NOT go outdoors", "Avoid any physical exertion", "Do not open windows or doors"],
    },
  ],
  children: [
    { max: 50, dos: ["Outdoor play is safe and encouraged", "Physical education can proceed", "Parks and playgrounds are fine"], donts: [] },
    {
      max: 100,
      dos: ["Outdoor play is generally fine", "Shorter sessions outdoors preferred", "Monitor if child has allergies"],
      donts: ["Avoid long outdoor sports if child has asthma"],
    },
    { max: 200, dos: ["Move play indoors", "Keep school windows closed", "Ensure sufficient water intake"], donts: ["No outdoor PE classes", "Avoid playgrounds near roads", "Do not allow long outdoor sessions"] },
    {
      max: 300,
      dos: ["School should cancel all outdoor activities", "Use air purifiers in classrooms", "Face masks for any outdoor exposure"],
      donts: ["No outdoor activities of any kind", "Avoid opening school windows", "No sports events"],
    },
    {
      max: 999,
      dos: ["Keep children strictly indoors", "Use HEPA air purifiers continuously", "Emergency medications readily available"],
      donts: ["NO outdoor exposure", "Schools should close or go online", "No outdoor travel"],
    },
  ],
  elderly: [
    { max: 50, dos: ["Light outdoor walks recommended", "Morning exercises are safe", "Enjoy the fresh air"], donts: [] },
    { max: 100, dos: ["Light activities are fine", "Keep medications handy as precaution", "Short walks are okay"], donts: ["Avoid strenuous outdoor exercise"] },
    {
      max: 200,
      dos: ["Stay primarily indoors", "Take regular breaks in fresh indoor air", "Stay well hydrated"],
      donts: ["Avoid outdoor exercise", "Do not walk near traffic", "Avoid peak pollution hours (8–10am, 6–9pm)"],
    },
    {
      max: 300,
      dos: ["Remain indoors entirely", "Use air purifiers", "Wear N95 if any outdoor need is unavoidable", "Have emergency contacts handy"],
      donts: ["No outdoor exposure", "Avoid exertion even indoors", "Do not travel by road without N95"],
    },
    {
      max: 999,
      dos: ["Health emergency protocol", "Contact doctor or hospital if breathing difficulty", "Use supplemental oxygen if prescribed"],
      donts: ["Absolutely no outdoor exposure", "No strenuous activity", "Do not delay medical attention"],
    },
  ],
  athlete: [
    { max: 50, dos: ["Peak training conditions", "All outdoor workouts are safe", "Best time for long runs or rides"], donts: [] },
    { max: 100, dos: ["Moderate outdoor training is fine", "Warm up properly", "Stay hydrated"], donts: ["Avoid maximum intensity intervals outdoors"] },
    {
      max: 200,
      dos: ["Move training indoors", "Use gym or indoor tracks", "Maintain hydration and recovery focus"],
      donts: ["No outdoor intense workouts", "Avoid running near roads", "Skip races or outdoor events"],
    },
    {
      max: 300,
      dos: ["Indoor training only with air purification", "Reduce training load", "Focus on recovery and strength"],
      donts: ["No outdoor workouts", "No competitions", "Avoid HIIT outdoors"],
    },
    { max: 999, dos: ["Rest completely", "Focus on nutrition and recovery", "Indoor stretching only if needed"], donts: ["No training of any kind outdoors", "Avoid cardio even indoors if air is ingressing", "Skip all outdoor events"] },
  ],
  asthma: [
    { max: 50, dos: ["Normal outdoor activity is safe", "Carry inhaler as routine", "Great conditions for breathing"], donts: [] },
    {
      max: 100,
      dos: ["Light-moderate outdoor activity is fine", "Always carry rescue inhaler", "Monitor peak flow if available"],
      donts: ["Avoid prolonged outdoor exertion", "Avoid areas with smoke or dust"],
    },
    {
      max: 200,
      dos: ["Use prescribed controller medications", "Keep reliever inhaler accessible at all times", "Use air purifier at home", "Monitor symptoms closely"],
      donts: ["No outdoor exercise", "Avoid allergen-rich areas", "Do not skip any scheduled doses"],
    },
    {
      max: 300,
      dos: ["Stay strictly indoors", "Use nebulizer or spacer if prescribed", "Contact doctor if symptoms worsen", "Air purifier running continuously"],
      donts: ["No outdoor exposure", "Avoid any physical exertion", "Do not go near smoke, dust, or chemical sources"],
    },
    {
      max: 999,
      dos: ["Medical emergency preparedness", "Have emergency plan in place", "Go to hospital if rescue inhaler not controlling symptoms", "Call doctor proactively"],
      donts: ["ZERO outdoor exposure", "No physical activity", "Do not ignore any deterioration in breathing"],
    },
  ],
  pregnant: [
    { max: 50, dos: ["Light outdoor walks are beneficial", "Prenatal yoga outdoors is fine", "Fresh air is good for you and baby"], donts: [] },
    { max: 100, dos: ["Short gentle walks are okay", "Stay in green/park areas away from traffic", "Stay well hydrated"], donts: ["Avoid traffic-heavy areas", "No prolonged outdoor exercise in heat"] },
    {
      max: 200,
      dos: ["Limit outdoor time significantly", "Use indoor exercise alternatives", "Wear light mask if going out", "Check with your OB-GYN if concerned"],
      donts: ["No outdoor physical exercise", "Avoid areas near construction or traffic", "Do not walk in peak hours"],
    },
    {
      max: 300,
      dos: ["Stay indoors entirely", "Air purifier in sleeping/living area", "N95 mask if any outdoor travel is necessary", "Inform your OB-GYN about exposure"],
      donts: ["No outdoor activities", "Avoid any pollution exposure", "Do not travel by road without protection"],
    },
    {
      max: 999,
      dos: ["Consult OB-GYN immediately if any respiratory symptoms", "HEPA air purifiers in all rooms", "Seek hospital-grade advice on air quality exposure"],
      donts: ["Absolutely no outdoor exposure", "Avoid travel during severe episode", "Do not ignore any symptoms"],
    },
  ],
};

function getProfileAdvice(profile: string, aqi: number) {
  const levels = PROFILE_ADVICE[profile];
  return levels.find((l) => aqi <= l.max) || levels[levels.length - 1];
}

/* ── Pollutant health info ───────────────────────── */
const POLLUTANT_INFO = [
  {
    key: "pm25",
    label: "PM 2.5",
    unit: "µg/m³",
    safe: 25,
    moderate: 60,
    severe: 120,
    color: "#f97316",
    health: "Fine particles penetrate deep into lungs, causing inflammation, reduced lung function, and cardiovascular stress.",
    tips: ["Wear N95 masks (not surgical) which filter PM2.5", "HEPA air purifiers are highly effective against PM2.5", "Avoid outdoor exercise when levels are elevated"],
  },
  {
    key: "co",
    label: "Carbon Monoxide",
    unit: "ppm",
    safe: 1.0,
    moderate: 3.0,
    severe: 6.0,
    color: "#8b5cf6",
    health: "CO binds to haemoglobin, reducing oxygen delivery to organs. High levels cause headache, dizziness and in extreme cases, fatality.",
    tips: ["Ensure gas appliances are serviced regularly", "Never run engines in enclosed spaces", "CO detectors are essential for indoor monitoring"],
  },
  {
    key: "no2",
    label: "Nitrogen Dioxide",
    unit: "ppm",
    safe: 0.04,
    moderate: 0.08,
    severe: 0.15,
    color: "#0ea5e9",
    health: "NO₂ irritates airways, aggravates asthma and can cause chronic lung disease with long-term exposure.",
    tips: ["Avoid staying near roads during traffic peaks", "Keep car windows up in traffic jams", "Indoor plants like spider plants can help absorb some NO₂"],
  },
  {
    key: "tvoc",
    label: "VOC (TVOC)",
    unit: "ppm",
    safe: 0.2,
    moderate: 0.5,
    severe: 1.0,
    color: "#b45309",
    health: "Volatile organic compounds cause eye, nose and throat irritation. Long-term exposure links to liver damage and some cancers.",
    tips: ["Ventilate rooms after using paints, adhesives or cleaning products", "Avoid freshly painted rooms for 48 hours", "Activated carbon filters help with TVOC indoors"],
  },
];

interface PollutantBarProps {
  value: number;
  safe: number;
  moderate: number;
  severe: number;
  color: string;
}

function PollutantBar({ value, safe, moderate, severe, color }: PollutantBarProps) {
  const max = severe * 1.5;
  const pct = Math.min(100, (value / max) * 100);
  const status = value <= safe ? "Safe" : value <= moderate ? "Elevated" : "High";
  const statusColor = value <= safe ? "#22c55e" : value <= moderate ? "#b45309" : "#ef4444";
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: 5 }}>
        <span style={{ color: "var(--steel)" }}>
          Current: <b style={{ color }}>{value}</b>
        </span>
        <span style={{ fontWeight: 700, color: statusColor }}>{status}</span>
      </div>
      <div style={{ height: 6, borderRadius: "var(--radius-full)", background: "var(--hairline-soft)", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            borderRadius: "var(--radius-full)",
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}aa, ${color})`,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--steel)", marginTop: 3 }}>
        <span>Safe ≤{safe}</span>
        <span>Moderate ≤{moderate}</span>
        <span>High &gt;{moderate}</span>
      </div>
    </div>
  );
}

/* ── Source info ─────────────────────────────────── */
const SOURCE_INFO: Record<string, { icon: React.ComponentType<any>; color: string; title: string; tips: string[] }> = {
  vehicle: {
    icon: Truck,
    color: "#f97316",
    title: "Vehicle exhaust dominant",
    tips: [
      "Avoid walking along busy roads",
      "Use side streets or parks for outdoor activity",
      "Close car windows in heavy traffic",
      "Prefer metro/bus over 2-wheelers during peak hours",
    ],
  },
  industrial: {
    icon: Factory,
    color: "#ef4444",
    title: "Industrial emissions detected",
    tips: [
      "Stay away from factory-adjacent areas",
      "Report unusual smoke or chemical smell to CPCB helpline (1800-11-4999)",
      "Keep windows closed facing industrial direction",
      "Avoid evening walks downwind of industrial zones",
    ],
  },
  construction: {
    icon: Hammer,
    color: "#b45309",
    title: "Construction dust elevated",
    tips: [
      "Avoid passing through active construction zones",
      "Wear N95 mask near building sites",
      "Keep windows shut in dust-prone areas",
      "Wash face and rinse nose after outdoor exposure",
    ],
  },
  biomass: {
    icon: Flame,
    color: "#a855f7",
    title: "Biomass burning detected",
    tips: [
      "Avoid areas with visible smoke or haze",
      "Biomass burning peaks in evenings — limit outdoor time then",
      "Do not add to burning (waste, leaves)",
      "Report crop/waste burning to pollution control authorities",
    ],
  },
  mixed: {
    icon: Cloud,
    color: "#6366f1",
    title: "Mixed pollution sources",
    tips: [
      "Multiple sources contributing — limit outdoor exposure",
      "HEPA air purifier highly recommended indoors",
      "Check CPCB-SAFAR for hourly zone updates",
      "Mask recommended for outdoor trips even short ones",
    ],
  },
};

/* ── AQI Gauge ── */
function AqiGaugeLocal({ aqi }: { aqi: number }) {
  const level = getLevel(aqi);
  const pct = Math.min(100, (aqi / 500) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          background: `conic-gradient(${level.color} ${pct * 3.6}deg, rgba(0,30,43,0.05) 0deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            background: "#ffffff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(0,30,43,0.04)"
          }}
        >
          <span style={{ fontSize: "1.85rem", fontWeight: 700, color: level.color, lineHeight: 1, fontFamily: "var(--font-display)" }}>{aqi}</span>
          <span style={{ fontSize: "0.68rem", color: "var(--steel)", fontWeight: 700, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>AQI</span>
        </div>
      </div>
      <span style={{ fontWeight: 700, fontSize: "0.95rem", color: level.text }}>{level.label}</span>
    </div>
  );
}

export default function AdvisoryPage() {
  const { data, refetch } = useLiveData();
  const [profile, setProfile] = useState("general");

  const aqi = data?.aqi || 0;
  const source = data?.source_detected || null;
  const level = getLevel(aqi);
  const advice = getProfileAdvice(profile, aqi);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span className="dot" style={{ background: "var(--primary-deep)", width: 6, height: 6, boxShadow: "0 0 8px var(--primary-deep)" }} />
            <span style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--steel)" }}>
              Personalized health guidance matrix
            </span>
          </div>
          <h2 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--brand-teal-deep)", margin: 0 }}>Health advisory guidelines</h2>
          <p style={{ color: "var(--steel)", fontSize: "0.9rem", marginTop: 6, margin: 0 }}>Personalised health recommendations and precautions based on real-time sensor streams</p>
        </div>
        <button
          onClick={refetch}
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
          <span>Refresh Guidelines</span>
        </button>
      </motion.div>

      {/* AQI Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{
          background: "#ffffff",
          border: `1.5px solid ${level.border}`,
          borderRadius: "var(--radius-lg)",
          boxShadow: `0 8px 30px -4px ${level.color}0a, 0 4px 12px -2px ${level.color}03`,
          padding: "24px 28px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
          <AqiGaugeLocal aqi={aqi} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "1.35rem", fontWeight: 700, color: level.text, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
              {React.createElement(level.icon, { size: 24, style: { color: level.color } })}
              <span>
                {aqi <= 50
                  ? "Air quality is excellent today"
                  : aqi <= 100
                  ? "Air quality is acceptable"
                  : aqi <= 200
                  ? "Moderate — reduce outdoor exposure"
                  : aqi <= 300
                  ? "Poor — avoid outdoor activities"
                  : aqi <= 400
                  ? "Very poor — health risk for everyone"
                  : "Severe — health emergency"}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
              {[
                { ok: aqi <= 200, yes: "No Mask Needed", no: "N95 Mask Required" },
                { ok: aqi <= 100, yes: "Outdoor Safe", no: "Stay Indoors" },
                { ok: aqi <= 150, yes: "Open Windows", no: "Keep Windows Shut" },
              ].map(({ ok, yes, no }, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 14px",
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    background: ok ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                    color: ok ? "#22c55e" : "#ef4444",
                    border: `1px solid ${ok ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`,
                  }}
                >
                  {ok ? <CheckCircle size={13} /> : <XCircle size={13} />}
                  {ok ? yes : no}
                </span>
              ))}
            </div>
            {data && (
              <div style={{ marginTop: 14, fontSize: "0.74rem", color: "var(--steel)", borderTop: "1px solid var(--hairline-soft)", paddingTop: 12 }}>
                Sync telemetry: {new Date(data.timestamp).toLocaleTimeString()} &nbsp;·&nbsp; PM2.5:{" "}
                <b style={{ color: "#f97316" }}>{data.pm25} µg/m³</b> &nbsp;·&nbsp; CO: <b style={{ color: "#8b5cf6" }}>{data.co} ppm</b> &nbsp;·&nbsp; NO₂:{" "}
                <b style={{ color: "#0ea5e9" }}>{data.no2} ppm</b>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Profile Selector */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
          Select profile filter
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", background: "rgba(0,30,43,0.015)", padding: 6, borderRadius: "var(--radius-md)", border: "1px solid rgba(0,30,43,0.03)" }}>
          {PROFILES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setProfile(key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 16px",
                borderRadius: "var(--radius-sm)",
                border: profile === key ? "1px solid var(--brand-teal-deep)" : "1px solid transparent",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.84rem",
                background: profile === key ? "var(--brand-teal-deep)" : "transparent",
                color: profile === key ? "#ffffff" : "var(--steel)",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={14} style={{ color: profile === key ? "var(--primary)" : "inherit" }} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Recommended Actions & Actions to Avoid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${profile}-${aqi}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.05 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}
        >
          {/* Recommended Actions */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid rgba(0,30,43,0.08)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-sm)",
              padding: "24px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <CheckCircle size={16} color="var(--primary-deep)" />
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--brand-teal-deep)", fontFamily: "var(--font-display)" }}>Recommended Actions</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {advice.dos.length === 0 ? (
                <p style={{ color: "var(--steel)", fontSize: "0.85rem" }}>No special precautions needed.</p>
              ) : (
                advice.dos.map((item: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <Check size={14} color="var(--primary-deep)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: "0.84rem", color: "var(--charcoal)", lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          {/* Actions to Avoid */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid rgba(0,30,43,0.08)",
              borderRadius: "var(--radius-lg)",
              boxShadow: "var(--shadow-sm)",
              padding: "24px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <XCircle size={16} color="#ef4444" />
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--brand-teal-deep)", fontFamily: "var(--font-display)" }}>Actions to Avoid</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {advice.donts.length === 0 ? (
                <p style={{ color: "var(--steel)", fontSize: "0.85rem" }}>No restrictions — enjoy the clean air!</p>
              ) : (
                advice.donts.map((item: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <X size={14} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: "0.84rem", color: "var(--charcoal)", lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Activity Safety */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          Activity safety guidelines
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12 }}>
          {ACTIVITIES.map(({ label, icon: Icon, okUpto }) => {
            const safe = aqi <= okUpto;
            return (
              <div
                key={label}
                style={{
                  background: "#ffffff",
                  border: "1px solid rgba(0,30,43,0.08)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-sm)",
                  padding: "20px 16px",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: safe ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={20} color={safe ? "#22c55e" : "#ef4444"} />
                </div>
                <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "var(--brand-teal-deep)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", width: "100%" }}>{label}</div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: safe ? "#22c55e" : "#ef4444",
                    background: safe ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                    border: `1px solid ${safe ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`,
                    padding: "3px 10px",
                    borderRadius: 999,
                    display: "inline-block",
                    marginTop: 2
                  }}
                >
                  {safe ? "Safe Mode" : "Avoid"}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Pollutant Breakdown */}
      {data && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Pollutant health impact reports
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {POLLUTANT_INFO.map((p) => (
              <div
                key={p.key}
                style={{
                  background: "#ffffff",
                  border: "1px solid rgba(0,30,43,0.08)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-sm)",
                  padding: "20px"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: "0.9rem", color: p.color }}>{p.label}</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--steel)", fontWeight: 500 }}>{p.unit}</span>
                </div>
                <PollutantBar value={data[p.key as "pm25" | "co" | "no2" | "tvoc"] || 0} safe={p.safe} moderate={p.moderate} severe={p.severe} color={p.color} />
                <p style={{ fontSize: "0.78rem", color: "var(--charcoal)", margin: "12px 0 10px", lineHeight: 1.5 }}>{p.health}</p>
                <div style={{ borderTop: "1px solid rgba(0,30,43,0.05)", paddingTop: 8 }}>
                  {p.tips.map((t, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "flex-start" }}>
                      <span style={{ color: p.color, flexShrink: 0, fontSize: "0.85rem", transform: "translateY(-1px)" }}>·</span>
                      <span style={{ fontSize: "0.74rem", color: "var(--steel)", lineHeight: 1.4 }}>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Source-specific panel */}
      {source && source !== "unknown" && SOURCE_INFO[source] && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <div
            style={{
              background: "#ffffff",
              border: `1px solid ${SOURCE_INFO[source].color}25`,
              borderRadius: "var(--radius-lg)",
              boxShadow: `0 8px 30px -4px ${SOURCE_INFO[source].color}14, 0 4px 12px -2px ${SOURCE_INFO[source].color}08`,
              padding: "24px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: `${SOURCE_INFO[source].color}10`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                {React.createElement(SOURCE_INFO[source].icon, { size: 18, color: SOURCE_INFO[source].color })}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1rem", color: SOURCE_INFO[source].color }}>{SOURCE_INFO[source].title}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--steel)", marginTop: 2 }}>Detected by ML model · Source-specific advice below</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {SOURCE_INFO[source].tips.map((tip, i) => (
                <div
                  key={i}
                  style={{
                    background: "#ffffff",
                    border: "1px solid rgba(0,30,43,0.04)",
                    boxShadow: "var(--shadow-sm)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    fontSize: "0.82rem",
                    color: "var(--charcoal)",
                    lineHeight: 1.5,
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <Info size={13} color={SOURCE_INFO[source].color} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* CPCB AQI Scale reference */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--steel)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
          CPCB National AQI Scale reference
        </div>
        <div
          style={{
            background: "#ffffff",
            border: "1px solid rgba(0,30,43,0.08)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            padding: "16px 20px",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {AQI_LEVELS.map((l) => (
            <div
              key={l.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 10,
                background: l.bg,
                border: `1px solid ${l.border}`,
                flex: "1 1 140px",
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.8rem", color: l.text }}>{l.label}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--steel)" }}>≤{l.max === 999 ? "500+" : l.max}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
