"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  MapPin,
  Wifi,
  RefreshCw,
  Brain,
  TrendingUp,
  Truck,
  Factory,
  Hammer,
  Flame,
  Cloud,
  HelpCircle,
  CheckCircle,
  XCircle,
  Shield,
  Heart,
  Activity,
  Check,
  X,
  Thermometer,
  Droplets,
  Atom,
  Wind,
  AlertCircle,
  Settings
} from "lucide-react";
import dynamic from "next/dynamic";

import { useLiveData, useHistoryData, useTimeAgo, LiveDataResult } from "./hooks/useData";
import { fetchMLSource, fetchMLForecast, detectSourceLocal } from "./services/api";

const TimeSeriesChart = dynamic(() => import("./components/TimeSeriesChart"), {
  ssr: false,
});

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

const METRICS = [
  { key: "pm25", label: "PM 2.5", unit: "µg/m³", type: "pm25", icon: Wind, color: "#f97316" },
  { key: "co", label: "CO", unit: "ppm", type: "co", icon: Flame, color: "#8b5cf6" },
  { key: "no2", label: "NO₂", unit: "ppm", type: "no2", icon: Cloud, color: "#0ea5e9" },
  { key: "tvoc", label: "TVOC", unit: "ppm", type: "tvoc", icon: Atom, color: "#f59e0b" },
  { key: "temperature", label: "Temperature", unit: "°C", type: "temp", icon: Thermometer, color: "#ef4444" },
  { key: "humidity", label: "Humidity", unit: "%", type: "humidity", icon: Droplets, color: "#38bdf8" },
];

function getAqiDetails(aqi: number) {
  if (aqi <= 50) return { label: "Good", color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.2)" };
  if (aqi <= 100) return { label: "Satisfactory", color: "#84cc16", bg: "rgba(132,204,22,0.08)", border: "rgba(132,204,22,0.2)" };
  if (aqi <= 200) return { label: "Moderate", color: "#b45309", bg: "rgba(180,83,9,0.08)", border: "rgba(180,83,9,0.2)" };
  if (aqi <= 300) return { label: "Poor", color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)" };
  if (aqi <= 400) return { label: "Very Poor", color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)" };
  return { label: "Severe", color: "#7c3aed", bg: "rgba(124,58,237,0.08)", border: "rgba(124,58,237,0.2)" };
}

function getAdvisory(aqi: number) {
  if (aqi <= 50)
    return {
      title: "Excellent Air Quality",
      general: ["Ideal conditions for outdoor recreation.", "Perfect timing for morning walks.", "No protective actions required."],
      vulnerable: ["No special restrictions. Enjoy the clean atmosphere!"],
      mask: false,
      outdoor: true,
    };
  if (aqi <= 100)
    return {
      title: "Acceptable Air Quality",
      general: ["Good for normal outdoor activities.", "Sensitive individuals should monitor breathing.", "Ventilation is generally safe."],
      vulnerable: ["Mild discomfort possible for respiratory conditions.", "Carry rescue medication if asthmatic."],
      mask: false,
      outdoor: true,
    };
  if (aqi <= 200)
    return {
      title: "Moderate Exposure Risk",
      general: ["Limit prolonged outdoor exertion.", "Keep windows closed during traffic peaks.", "Prefer indoor exercise alternatives."],
      vulnerable: ["Children & elderly should limit active outdoor play.", "Asthmatics must carry rescue inhalers."],
      mask: true,
      outdoor: false,
    };
  if (aqi <= 300)
    return {
      title: "Poor Air Quality — Heavy Exposure",
      general: ["Avoid active outdoor exercise.", "Keep all windows closed to prevent ingress.", "Use indoor air purifiers on high speed."],
      vulnerable: ["Remain strictly indoors.", "Monitor respiratory rates closely.", "Seek prompt medical care if distress occurs."],
      mask: true,
      outdoor: false,
    };
  return {
    title: "Severe Atmospheric Emergency",
    general: ["Strictly remain indoors.", "Keep all air filtration devices active.", "Minimize physical exertion even indoors."],
    vulnerable: ["Zero outdoor exposure allowed.", "Inform physician of any distress immediately.", "Ensure access to emergency inhalers."],
    mask: true,
    outdoor: false,
  };
}

const SOURCE_META: Record<string, { icon: React.ComponentType<any>; label: string; color: string }> = {
  vehicle: { icon: Truck, label: "Vehicle Emissions", color: "#f97316" },
  industrial: { icon: Factory, label: "Industrial Activity", color: "#ef4444" },
  construction: { icon: Hammer, label: "Construction Dust", color: "#b45309" },
  biomass: { icon: Flame, label: "Biomass Burning", color: "#a855f7" },
  mixed: { icon: Cloud, label: "Mixed Sources", color: "#6366f1" },
  unknown: { icon: HelpCircle, label: "Unknown", color: "#78716c" },
};

const LOADING_STEPS = [
  { key: "init", label: "Initializing Aeronyx...", pct: 10 },
  { key: "connecting", label: "Connecting to sensor network...", pct: 30 },
  { key: "fetching", label: "Fetching live readings...", pct: 60 },
  { key: "processing", label: "Processing atmospheric data...", pct: 85 },
  { key: "done", label: "Ready", pct: 100 },
];

function LoadingScreen({ step }: { step: string }) {
  const current = LOADING_STEPS.find((s) => s.key === step) || LOADING_STEPS[0];
  return (
    <div
      className="loading-screen"
      style={{
        position: "relative",
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
      }}
    >
      <div className="loading-spinner" />
      <div style={{ textAlign: "center" }}>
        <div className="loading-text" style={{ marginBottom: 12 }}>
          {current.label}
        </div>
        <div style={{ width: 220, height: 6, background: "var(--earth-100)", borderRadius: 3, overflow: "hidden", margin: "0 auto" }}>
          <div
            style={{
              width: `${current.pct}%`,
              height: "100%",
              background: "linear-gradient(90deg, #10b981, #059669)",
              borderRadius: 3,
              transition: "width 0.6s ease",
            }}
          />
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--earth-400)", marginTop: 8 }}>Polling ThingSpeak IoT Cloud + ML Pipeline</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [source, setSource] = useState<string>("real_api");
  const [waqiToken, setWaqiToken] = useState<string>("2762cbe0240a9a00d82cc8e635b8fb10c02cee70");
  const [thingspeakChannel, setThingspeakChannel] = useState<string>("3418865");
  const [thingspeakKey, setThingspeakKey] = useState<string>("HZMI1LP3UUHK2S7O");
  const [showSettings, setShowSettings] = useState(false);

  // Load from localStorage only after mounting to prevent SSR hydration mismatches
  useEffect(() => {
    setSource(localStorage.getItem("aeronyx_data_source") || "real_api");
    setWaqiToken(localStorage.getItem("aeronyx_waqi_token") || "2762cbe0240a9a00d82cc8e635b8fb10c02cee70");
    setThingspeakChannel(localStorage.getItem("aeronyx_thingspeak_channel") || "3418865");
    setThingspeakKey(localStorage.getItem("aeronyx_thingspeak_key") || "HZMI1LP3UUHK2S7O");
  }, []);

  const { data, loading, loadingStep, backendStatus, refetch } = useLiveData(source, waqiToken, thingspeakChannel, thingspeakKey);
  const { data: history } = useHistoryData(300);
  const timeAgo = useTimeAgo(data?.timestamp || "");
  const [mlSource, setMlSource] = useState<any>(null);
  const [mlForecast, setMlForecast] = useState<any>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pre-seed ML source from live data or run client-side detection
  useEffect(() => {
    if (data && !mlSource) {
      if (data.source_detected && data.source_detected !== "unknown") {
        const local = detectSourceLocal(data.pm25 || 0, data.co || 0, data.no2 || 0, data.tvoc || 0);
        setMlSource(local);
      } else {
        setMlSource(detectSourceLocal(data.pm25 || 0, data.co || 0, data.no2 || 0, data.tvoc || 0));
      }
    }
  }, [data, mlSource]);

  useEffect(() => {
    if (!data) return;
    const fetchSource = () => {
      fetchMLSource()
        .then((res) => {
          if (res && res.source && !res.error) setMlSource(res);
          else if (data) setMlSource(detectSourceLocal(data.pm25 || 0, data.co || 0, data.no2 || 0, data.tvoc || 0));
        })
        .catch(() => {
          if (data) setMlSource(detectSourceLocal(data.pm25 || 0, data.co || 0, data.no2 || 0, data.tvoc || 0));
        });
    };
    fetchSource();
    fetchMLForecast(6).then(setMlForecast).catch(() => {});
    const iv = setInterval(() => {
      fetchSource();
      fetchMLForecast(6).then(setMlForecast).catch(() => {});
    }, 60000);
    return () => clearInterval(iv);
  }, [data]);

  // Dynamic Flow Canvas Visualizer
  useEffect(() => {
    if (!canvasRef.current || !data) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", handleResize);

    const aqi = data.aqi || 0;
    const aqiMeta = getAqiDetails(aqi);
    const particleCount = Math.min(50, 12 + Math.floor(aqi / 7));
    const speedFactor = 0.25 + (aqi / 220);

    const particles: Array<{
      x: number;
      y: number;
      radius: number;
      vx: number;
      vy: number;
      alpha: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 0.8 + Math.random() * 2.2,
        vx: (0.4 + Math.random() * 1.2) * speedFactor,
        vy: (Math.random() - 0.5) * 0.15 * speedFactor,
        alpha: 0.15 + Math.random() * 0.35,
      });
    }

    const waveCount = 3;
    const waves: Array<{
      y: number;
      length: number;
      amplitude: number;
      speed: number;
      phase: number;
    }> = [];

    for (let i = 0; i < waveCount; i++) {
      waves.push({
        y: height * (0.25 + i * 0.22),
        length: 0.004 + Math.random() * 0.004,
        amplitude: 6 + Math.random() * 12,
        speed: (0.008 + Math.random() * 0.008) * speedFactor,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Waves
      ctx.lineWidth = 1.2;
      waves.forEach((wave, idx) => {
        ctx.beginPath();
        const hexOpacity = Math.floor((0.08 - idx * 0.02) * 255).toString(16).padStart(2, "0");
        ctx.strokeStyle = `${aqiMeta.color}${hexOpacity}`;
        wave.phase += wave.speed;
        for (let x = 0; x < width; x++) {
          const y = wave.y + Math.sin(x * wave.length + wave.phase) * wave.amplitude;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      // Particles
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = aqiMeta.color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;

        if (p.x > width) {
          p.x = 0;
          p.y = Math.random() * height;
        }
        if (p.y < 0 || p.y > height) {
          p.vy = -p.vy;
        }
      });
      ctx.globalAlpha = 1.0;

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [data]);

  if (loading && !data) {
    return <LoadingScreen step={loadingStep} />;
  }

  const aqi = data?.aqi || 0;
  const aqiMeta = getAqiDetails(aqi);
  const advisory = getAdvisory(aqi);

  return (
    <div className="dashboard-grid" style={{ gap: "28px" }}>
      {/* Page Header */}
      <motion.div className="page-header" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em" }}>Telemetry Dashboard</h2>
            <p style={{ color: "var(--earth-500)", fontSize: "0.9rem", marginTop: 4 }}>Real-time atmospheric diagnostics & localized predictive insights</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Segmented Control Toggle */}
            <div style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(0,30,43,0.04)",
              border: "1px solid var(--hairline-soft)",
              padding: "3px",
              borderRadius: "var(--radius-sm)",
              gap: "2px"
            }}>
              <button
                onClick={() => {
                  localStorage.setItem("aeronyx_data_source", "real_api");
                  setSource("real_api");
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "calc(var(--radius-sm) - 2px)",
                  border: "none",
                  background: source === "real_api" ? "#ffffff" : "transparent",
                  color: source === "real_api" ? "var(--brand-teal-deep)" : "var(--earth-500)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: source === "real_api" ? "var(--shadow-sm)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                Real AQI API
              </button>
              <button
                onClick={() => {
                  localStorage.setItem("aeronyx_data_source", "hardware");
                  setSource("hardware");
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "calc(var(--radius-sm) - 2px)",
                  border: "none",
                  background: source === "hardware" ? "#ffffff" : "transparent",
                  color: source === "hardware" ? "var(--brand-teal-deep)" : "var(--earth-500)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: source === "hardware" ? "var(--shadow-sm)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                IoT Hardware
              </button>
            </div>

            {/* Gear Icon Settings Toggle Button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(0,30,43,0.08)",
                background: showSettings ? "rgba(0,30,43,0.05)" : "#ffffff",
                color: showSettings ? "var(--brand-teal-deep)" : "var(--earth-500)",
                cursor: "pointer",
                boxShadow: "var(--shadow-sm)",
                transition: "all 0.15s ease",
              }}
              title="Configure Keys"
            >
              <Settings size={14} />
            </button>

            {/* Collapsible settings panel */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, width: 0, scale: 0.95 }}
                  animate={{ opacity: 1, width: "auto", scale: 1 }}
                  exit={{ opacity: 0, width: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}
                >
                  {source === "real_api" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <input
                        type="password"
                        placeholder="WAQI Token"
                        value={waqiToken}
                        onChange={(e) => {
                          const token = e.target.value;
                          setWaqiToken(token);
                          localStorage.setItem("aeronyx_waqi_token", token);
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid rgba(0,30,43,0.08)",
                          fontSize: "0.78rem",
                          width: "160px",
                          outline: "none",
                          background: "#ffffff",
                          color: "var(--earth-800)",
                        }}
                      />
                      <a
                        href="https://aqicn.org/data-platform/token/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--primary-deep)",
                          textDecoration: "underline",
                          fontWeight: 600,
                          whiteSpace: "nowrap"
                        }}
                      >
                        Get Key
                      </a>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <input
                        type="text"
                        placeholder="Channel ID"
                        value={thingspeakChannel}
                        onChange={(e) => {
                          const val = e.target.value;
                          setThingspeakChannel(val);
                          localStorage.setItem("aeronyx_thingspeak_channel", val);
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid rgba(0,30,43,0.08)",
                          fontSize: "0.78rem",
                          width: "100px",
                          outline: "none",
                          background: "#ffffff",
                          color: "var(--earth-800)",
                        }}
                      />
                      <input
                        type="password"
                        placeholder="Read Key"
                        value={thingspeakKey}
                        onChange={(e) => {
                          const val = e.target.value;
                          setThingspeakKey(val);
                          localStorage.setItem("aeronyx_thingspeak_key", val);
                        }}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid rgba(0,30,43,0.08)",
                          fontSize: "0.78rem",
                          width: "110px",
                          outline: "none",
                          background: "#ffffff",
                          color: "var(--earth-800)",
                        }}
                      />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {data && (
              <div className="last-updated" style={{ margin: 0, background: "rgba(0,30,43,0.02)", border: "1px solid var(--hairline-soft)", padding: "6px 12px", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", gap: 6 }}>
                <span className="dot" style={{ background: aqiMeta.color, width: 6, height: 6, display: "inline-block", borderRadius: "50%" }} />
                <Clock size={12} style={{ color: "var(--earth-400)" }} />
                <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--earth-600)" }}>Updated {timeAgo}</span>
              </div>
            )}
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
              <motion.div
                animate={loading ? { rotate: 360 } : { rotate: 0 }}
                transition={loading ? { repeat: Infinity, duration: 1.2, ease: "linear" } : { duration: 0.2 }}
                style={{ display: "inline-flex" }}
              >
                <RefreshCw size={13} />
              </motion.div>
              <span>Refresh Readings</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Cold-start status */}
      {backendStatus === "waking" && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(245,158,11,0.05)",
            border: "1px solid rgba(245,158,11,0.15)",
            borderRadius: "var(--radius-md)",
            padding: "10px 16px",
            fontSize: "0.82rem",
            color: "#b45309",
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: "1rem" }}>⚡</span>
          <span>Syncing Live IoT nodes. Analytics database server is warming up (requires ~30s for full prediction model compilation).</span>
        </motion.div>
      )}

      {/* Top Grid: Dynamic Hero Visualizer + Sensor Metrics */}
      <div className="dashboard-top" style={{ gridTemplateColumns: "380px 1fr", gap: "28px" }}>
        {/* Dynamic Atmospheric Flow Card */}
        <motion.div
          className="glass-card"
          style={{
            padding: 0,
            overflow: "hidden",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            minHeight: "330px",
            background: "#ffffff",
            border: "1px solid var(--hairline)",
            boxShadow: `0 4px 24px -10px ${aqiMeta.color}1c`,
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          whileHover={{
            transform: "translateY(-3px)",
            boxShadow: `0 12px 32px -8px ${aqiMeta.color}28`,
          }}
        >
          {/* Animated Wave Background */}
          <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.28, pointerEvents: "none", zIndex: 0 }} />

          <div style={{ padding: "26px 26px 0", zIndex: 1, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="dot" style={{ background: aqiMeta.color, width: 6, height: 6, boxShadow: `0 0 8px ${aqiMeta.color}` }} />
              <span style={{ fontSize: "0.68rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--earth-400)" }}>Atmospheric Ingestion</span>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 18 }}>
              <span style={{ fontSize: "6.5rem", fontWeight: 200, fontFamily: "var(--font-display)", color: "var(--brand-teal-deep)", lineHeight: 0.9, letterSpacing: "-0.05em" }}>{aqi}</span>
              <span style={{ fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", color: "var(--earth-400)", letterSpacing: "0.06em", transform: "translateY(-12px)" }}>AQI</span>
            </div>

            <span
              style={{
                display: "inline-block",
                fontSize: "0.8rem",
                fontWeight: 700,
                color: aqiMeta.color,
                background: aqiMeta.bg,
                border: `1.5px solid ${aqiMeta.border}`,
                padding: "4px 14px",
                borderRadius: "999px",
                marginTop: 4,
                letterSpacing: "0.02em",
              }}
            >
              {aqiMeta.label}
            </span>
          </div>

          <div style={{ marginTop: "auto", padding: "20px 26px", borderTop: "1px solid var(--hairline-soft)", background: "rgba(0,30,43,0.01)", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 1, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "var(--earth-500)", fontWeight: 500 }}>
              <MapPin size={12} style={{ color: "var(--earth-400)" }} />
              <span>Ward 01 Node</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem", color: "var(--earth-500)", fontWeight: 500 }}>
              <Wifi size={12} style={{ color: source === "hardware" ? "var(--primary-deep)" : "#10b981" }} />
              <span>{source === "hardware" ? "ThingSpeak Hardware" : "WAQI Real API"}</span>
            </div>
          </div>
        </motion.div>

        {/* Six Sensor Metrics Grid */}
        <motion.div custom={1} variants={fadeUp} initial="hidden" animate="show" style={{ height: "100%" }}>
          <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "16px" }}>
            {data && METRICS.map(({ key, label, unit, type, icon: Icon, color }) => {
              const value = data[key as keyof LiveDataResult];
              return (
                <motion.div
                  key={key}
                  className="metric-card"
                  data-type={type}
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--hairline)",
                    borderRadius: "var(--radius-lg)",
                    padding: "20px",
                    boxShadow: "var(--shadow-sm)",
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}
                  whileHover={{
                    transform: "translateY(-3px)",
                    boxShadow: "var(--shadow-lg)",
                    borderColor: `${color}40`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                    <div className="metric-icon" style={{ margin: 0 }}>
                      <Icon size={18} />
                    </div>
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--earth-300)", textTransform: "uppercase" }}>Live</span>
                  </div>

                  <div style={{ marginTop: 24 }}>
                    <div className="metric-value" style={{ fontSize: "1.7rem", fontWeight: 600, color: "var(--brand-teal-deep)", letterSpacing: "-0.03em" }}>
                      {typeof value === "number" ? (
                        key === "no2" ? value.toFixed(3) :
                        key === "co" || key === "tvoc" ? value.toFixed(2) :
                        key === "humidity" || value >= 100 ? Math.round(value) :
                        value.toFixed(1)
                      ) : "—"}
                      <span className="metric-unit" style={{ fontSize: "0.75rem", color: "var(--earth-400)", marginLeft: "3px" }}>{unit}</span>
                    </div>
                    <div className="metric-name" style={{ fontSize: "0.7rem", color: "var(--earth-400)", marginTop: 4, letterSpacing: "0.06em", fontWeight: 700 }}>{label}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Middle Grid: TimeSeries History Chart */}
      <motion.div
        custom={2}
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="glass-card"
        style={{
          background: "#ffffff",
          border: "1px solid var(--hairline)",
          padding: "24px",
          boxShadow: "var(--shadow-sm)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <TimeSeriesChart data={history} title="Atmospheric Analytics Trend" />
      </motion.div>

      {/* Bottom Grid: Refined Health Advisory + Edge ML Source Detection */}
      <div className="dashboard-bottom" style={{ gap: "28px" }}>
        {/* Health Advisory & Mitigation Guidelines */}
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="glass-card"
          style={{
            background: "#ffffff",
            border: "1px solid var(--hairline)",
            boxShadow: "var(--shadow-sm)",
            padding: "26px",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--hairline-soft)", paddingBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--earth-400)" }}>Health Guidance</div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--brand-teal-deep)", marginTop: 4, fontFamily: "var(--font-display)" }}>{advisory.title}</h3>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.72rem",
                  padding: "4px 10px",
                  background: advisory.mask ? "rgba(239,68,68,0.05)" : "rgba(34,197,94,0.05)",
                  borderRadius: 999,
                  color: advisory.mask ? "#ef4444" : "#22c55e",
                  fontWeight: 600,
                  border: `1px solid ${advisory.mask ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)"}`,
                }}
              >
                {advisory.mask ? <AlertCircle size={11} /> : <Check size={11} />}
                <span>{advisory.mask ? "Mask Advised" : "Mask Optional"}</span>
              </span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "0.72rem",
                  padding: "4px 10px",
                  background: advisory.outdoor ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)",
                  borderRadius: 999,
                  color: advisory.outdoor ? "#22c55e" : "#ef4444",
                  fontWeight: 600,
                  border: `1px solid ${advisory.outdoor ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)"}`,
                }}
              >
                <Activity size={11} />
                <span>{advisory.outdoor ? "Outdoor Clear" : "Restricted Outdoor"}</span>
              </span>
            </div>
          </div>

          {/* Action Lists */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Recommended Actions */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <CheckCircle size={14} color="var(--primary-deep)" />
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--brand-teal-deep)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Recommended Actions</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {advisory.general.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <Check size={12} color="var(--primary-deep)" style={{ marginTop: 3, flexShrink: 0 }} />
                    <span style={{ fontSize: "0.82rem", color: "var(--charcoal)", lineHeight: 1.4 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions to Avoid */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <XCircle size={14} color="#ef4444" />
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--brand-teal-deep)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Actions to Avoid</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {advisory.vulnerable.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                    <X size={12} color="#ef4444" style={{ marginTop: 3, flexShrink: 0 }} />
                    <span style={{ fontSize: "0.82rem", color: "var(--charcoal)", lineHeight: 1.4 }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Edge ML Source Attribution & Anomaly Forecast */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="glass-card"
          style={{
            background: "#ffffff",
            border: "1px solid var(--hairline)",
            boxShadow: "var(--shadow-sm)",
            padding: "26px",
            borderRadius: "var(--radius-lg)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 20,
          }}
        >
          {/* Header */}
          <div style={{ borderBottom: "1px solid var(--hairline-soft)", paddingBottom: 14 }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--earth-400)" }}>Artificial Intelligence</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Brain size={16} style={{ color: "var(--primary-deep)" }} />
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--brand-teal-deep)", fontFamily: "var(--font-display)" }}>ML Emission Source Attribution</h3>
            </div>
          </div>

          {mlSource && mlSource.source ? (
            (() => {
              const m = SOURCE_META[mlSource.source] || SOURCE_META.unknown;
              const SourceIcon = m.icon;
              const probs = mlSource.probabilities || {};
              const sorted = Object.entries(probs)
                .sort((a: any, b: any) => b[1] - a[1])
                .slice(0, 3);

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Dominant source indicator */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      background: `${m.color}08`,
                      borderRadius: "var(--radius-md)",
                      border: `1px solid ${m.color}15`,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "var(--radius-sm)",
                        background: `${m.color}15`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <SourceIcon size={18} color={m.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "var(--earth-400)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Dominant Profile</div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem", color: "var(--brand-teal-deep)", marginTop: 2 }}>{m.label}</div>
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div style={{ fontSize: "0.72rem", color: "var(--earth-400)" }}>Confidence</div>
                      <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "0.95rem", color: m.color, marginTop: 2 }}>
                        {((mlSource.confidence || 0) * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {/* Probabilities breakdown */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {sorted.map(([src, prob]: any) => {
                      const sm = SOURCE_META[src] || SOURCE_META.unknown;
                      const SmallIcon = sm.icon;
                      return (
                        <div key={src} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${sm.color}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <SmallIcon size={11} color={sm.color} style={{ margin: "auto" }} />
                          </div>
                          <span style={{ fontSize: "0.78rem", color: "var(--charcoal)", width: 85, textTransform: "capitalize", fontWeight: 500 }}>{src}</span>
                          <div style={{ flex: 1, height: 6, background: "rgba(0,30,43,0.03)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
                            <div style={{ width: `${prob * 100}%`, height: "100%", background: sm.color, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--earth-600)", width: 34, textAlign: "right" }}>
                            {(prob * 100).toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 6h Forecast Timeline */}
                  {mlForecast && mlForecast.forecasts && (
                    <div style={{ padding: "10px 14px", background: "rgba(0,30,43,0.01)", border: "1px solid var(--hairline-soft)", borderRadius: "var(--radius-md)", marginTop: 4 }}>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "var(--earth-400)",
                          marginBottom: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        <TrendingUp size={11} style={{ color: "var(--primary-deep)" }} />
                        <span>6-Hour Forecast Trend</span>
                      </div>
                      <div style={{ display: "flex", gap: 4, justifyContent: "space-between" }}>
                        {mlForecast.forecasts.slice(0, 6).map((f: any) => (
                          <div key={f.hour_offset} style={{ textAlign: "center", flex: 1 }}>
                            <div style={{ fontSize: "0.65rem", color: "var(--earth-400)", fontWeight: 500 }}>+{f.hour_offset}h</div>
                            <div style={{ fontFamily: "var(--font-display)", fontSize: "0.85rem", fontWeight: 700, color: f.color, marginTop: 2 }}>
                              {f.predicted_aqi}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 180, color: "var(--earth-400)", fontSize: "0.82rem" }}>
              <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2, marginRight: 8 }} />
              <span>Compiling atmospheric prediction profiles...</span>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
