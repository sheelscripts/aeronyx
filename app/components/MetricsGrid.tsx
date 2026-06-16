"use client";

import React from "react";
import { Wind, Flame, CloudRain, Thermometer, Droplets, Atom } from "lucide-react";
import { motion } from "framer-motion";

interface MetricsGridProps {
  data?: Record<string, any> | null;
}

const METRICS = [
  { key: "pm25", label: "PM 2.5", unit: "µg/m³", type: "pm25", icon: Wind, thresholds: [30, 60, 90, 120, 250] },
  { key: "co", label: "CO", unit: "ppm", type: "co", icon: Flame, thresholds: [1, 2, 10, 17, 34] },
  { key: "no2", label: "NO₂", unit: "ppm", type: "no2", icon: CloudRain, thresholds: [40, 80, 180, 280, 400] },
  { key: "tvoc", label: "TVOC", unit: "ppm", type: "tvoc", icon: Atom, thresholds: [10, 25, 50, 75, 100] },
  { key: "temperature", label: "Temperature", unit: "°C", type: "temp", icon: Thermometer, thresholds: [15, 25, 35, 40, 50] },
  { key: "humidity", label: "Humidity", unit: "%", type: "humidity", icon: Droplets, thresholds: [30, 50, 70, 85, 95] },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const } },
};

export default function MetricsGrid({ data }: MetricsGridProps) {
  if (!data) return null;

  return (
    <motion.div className="metrics-grid" variants={container} initial="hidden" animate="show">
      {METRICS.map(({ key, label, unit, type, icon: Icon }) => {
        const value = data[key];
        return (
          <motion.div key={key} className="metric-card" data-type={type} variants={item}>
            <div className="metric-icon">
              <Icon size={20} />
            </div>
            <div className="metric-value">
              {typeof value === "number" ? (
                value >= 100 ? Math.round(value) : value.toFixed(1)
              ) : "—"}
              <span className="metric-unit">{unit}</span>
            </div>
            <div className="metric-name">{label}</div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
