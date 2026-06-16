"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, AlertTriangle, AlertCircle, CheckCircle, Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw, Shield, Activity, X } from "lucide-react";
import { fetchAlerts, fetchAlertStats, fetchAlertRules, createAlertRule, updateAlertRule, deleteAlertRule, clearAlerts } from "../services/api";

const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string; icon: any }> = {
  critical: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", text: "#ef4444", icon: AlertCircle },
  warning: { bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.2)", text: "#f97316", icon: AlertTriangle },
  info: { bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.2)", text: "#10b981", icon: CheckCircle },
};

const METRICS = [
  { key: "aqi", label: "AQI (Overall)", unit: "" },
  { key: "pm25", label: "PM2.5 (µg/m³)", unit: "µg/m³" },
  { key: "co", label: "CO (mg/m³)", unit: "mg/m³" },
  { key: "no2", label: "NO₂ (ppm)", unit: "ppm" },
  { key: "tvoc", label: "TVOC (ppm)", unit: "ppm" },
  { key: "temperature", label: "Temperature (°C)", unit: "°C" },
];

const ZONES = [
  "all",
  "Central Zone",
  "South Zone",
  "Shahdara North Zone",
  "Shahdara South Zone",
  "City SP Zone",
  "Civil Lines Zone",
  "Karol Bagh Zone",
  "Najafgarh Zone",
  "Narela Zone",
  "Rohini Zone",
  "West Zone",
  "Keshavpuram Zone",
];

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

interface AddRuleModalProps {
  onClose: () => void;
  onCreated: (rule: any) => void;
}

function AddRuleModal({ onClose, onCreated }: AddRuleModalProps) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    metric: "aqi",
    threshold: "",
    operator: "gt",
    zone: "all",
    severity: "warning",
    enabled: true,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.threshold) return;
    setSaving(true);
    try {
      const rule = await createAlertRule(form);
      onCreated(rule);
      onClose();
    } catch (_) {}
    setSaving(false);
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: "0.85rem",
    border: "1px solid rgba(16,185,129,0.2)",
    background: "rgba(16,185,129,0.03)",
    outline: "none",
    color: "#1c1917",
    boxSizing: "border-box" as const,
  };
  const labelStyle = { fontSize: "0.78rem", fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(6px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: 28,
          width: "92%",
          maxWidth: 480,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "1.1rem", color: "#064e3b" }}>New Alert Rule</h3>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: "#9ca3af" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Rule Name *</label>
              <input style={inputStyle} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Severe PM2.5 Alert" required />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <input style={inputStyle} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional description" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <div>
                <label style={labelStyle}>Metric</label>
                <select style={inputStyle} value={form.metric} onChange={(e) => set("metric", e.target.value)}>
                  {METRICS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Threshold *</label>
                <input
                  style={inputStyle}
                  type="number"
                  step="any"
                  value={form.threshold}
                  onChange={(e) => set("threshold", e.target.value)}
                  placeholder="e.g. 200"
                  required
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <div>
                <label style={labelStyle}>Condition</label>
                <select style={inputStyle} value={form.operator} onChange={(e) => set("operator", e.target.value)}>
                  <option value="gt">Greater than (&gt;)</option>
                  <option value="lt">Less than (&lt;)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Severity</label>
                <select style={inputStyle} value={form.severity} onChange={(e) => set("severity", e.target.value)}>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Zone (or All Zones)</label>
              <select style={inputStyle} value={form.zone} onChange={(e) => set("zone", e.target.value)}>
                {ZONES.map((z) => (
                  <option key={z} value={z}>
                    {z === "all" ? "All Zones" : z}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: 10,
                border: "1px solid rgba(16,185,129,0.2)",
                background: "transparent",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.85rem",
                color: "#6b7280",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 2,
                padding: "10px",
                borderRadius: 10,
                border: "none",
                background: "linear-gradient(135deg, #065f46, #047857)",
                color: "#fff",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.85rem",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Creating..." : "Create Rule"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function AlertsPage() {
  const [tab, setTab] = useState("history");
  const [alerts, setAlerts] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ah, rl, st] = await Promise.all([fetchAlerts(100), fetchAlertRules(), fetchAlertStats()]);
      setAlerts(ah.alerts || []);
      setRules(rl.rules || []);
      setStats(st);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 20000);
    return () => clearInterval(iv);
  }, [load]);

  const handleToggleRule = async (rule: any) => {
    try {
      const updated = await updateAlertRule(rule.rule_id, { enabled: !rule.enabled });
      setRules((rs) => rs.map((r) => (r.rule_id === rule.rule_id ? { ...r, ...updated } : r)));
    } catch (_) {}
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await deleteAlertRule(ruleId);
      setRules((rs) => rs.filter((r) => r.rule_id !== ruleId));
    } catch (_) {}
  };

  const handleClearHistory = async () => {
    setClearing(true);
    try {
      await clearAlerts();
      setAlerts([]);
      setStats((s: any) => ({ ...s, total: 0, critical: 0, warning: 0, affected_zones: [] }));
    } catch (_) {}
    setClearing(false);
  };

  const fade = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0 } };

  const cardStyle = (extra = {}) => ({
    background: "rgba(255,255,255,0.7)",
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: "1px solid rgba(16,185,129,0.1)",
    boxShadow: "0 2px 16px rgba(0,0,0,0.04)",
    ...extra,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <motion.div
        variants={fade}
        initial="hidden"
        animate="visible"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}
      >
        <div>
          <h2 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em" }}>Alert Notification Center</h2>
          <p style={{ color: "var(--earth-500)", fontSize: "0.9rem", marginTop: 4 }}>Real-time threshold monitoring across all 12 municipal corporation zones</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={load}
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
            <RefreshCw size={13} />
            <span>Refresh Logs</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "var(--brand-teal-deep)",
              color: "#fff",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "var(--shadow-sm)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--brand-teal)";
              e.currentTarget.style.boxShadow = "var(--shadow-md)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--brand-teal-deep)";
              e.currentTarget.style.boxShadow = "var(--shadow-sm)";
            }}
          >
            <Plus size={13} />
            <span>Configure Rule</span>
          </button>
        </div>
      </motion.div>

      {/* Stats row */}
      {stats && (
        <motion.div
          variants={fade}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.05 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 24 }}
        >
          {[
            { label: "Total Alerts", value: stats.total, icon: Bell, color: "#10b981" },
            { label: "Critical", value: stats.critical, icon: AlertCircle, color: "#ef4444" },
            { label: "Warnings", value: stats.warning, icon: AlertTriangle, color: "#f97316" },
            { label: "Active Rules", value: stats.active_rules, icon: Shield, color: "#0ea5e9" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{ ...cardStyle(), padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ padding: 8, borderRadius: 10, background: `${color}18` }}>
                  <Icon size={18} color={color} />
                </div>
                <div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1c1917", lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 3 }}>{label}</div>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {[
          { key: "history", label: "Alert History", icon: Activity },
          { key: "rules", label: `Rules (${rules.length})`, icon: Shield },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "9px 18px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.85rem",
              background: tab === key ? "linear-gradient(135deg, #065f46, #047857)" : "rgba(255,255,255,0.7)",
              color: tab === key ? "#fff" : "#6b7280",
              backdropFilter: "blur(8px)",
              boxShadow: tab === key ? "0 4px 12px rgba(6,95,70,0.2)" : "none",
              transition: "all 0.2s",
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
        {tab === "history" && alerts.length > 0 && (
          <button
            onClick={handleClearHistory}
            disabled={clearing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 14px",
              borderRadius: 10,
              border: "1px solid rgba(239,68,68,0.2)",
              background: "rgba(239,68,68,0.06)",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "#ef4444",
              marginLeft: "auto",
            }}
          >
            <Trash2 size={13} /> {clearing ? "Clearing..." : "Clear History"}
          </button>
        )}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {tab === "history" && (
          <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {loading ? (
              <div style={{ ...cardStyle(), padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading alerts...</div>
            ) : alerts.length === 0 ? (
              <div style={{ ...cardStyle(), padding: 50, textAlign: "center" }}>
                <CheckCircle size={40} color="#d1fae5" style={{ marginBottom: 12 }} />
                <div style={{ fontWeight: 600, color: "#065f46", fontSize: "1rem" }}>All Clear</div>
                <div style={{ color: "#9ca3af", fontSize: "0.85rem", marginTop: 6 }}>No alerts triggered. All zones within thresholds.</div>
              </div>
            ) : (
              <div style={{ ...cardStyle(), overflow: "hidden" }}>
                {alerts.map((alert, i) => {
                  const sc = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info;
                  const Icon = sc.icon;
                  return (
                    <motion.div
                      key={alert.alert_id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 14,
                        padding: "14px 20px",
                        borderBottom: i < alerts.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                        background: i % 2 === 0 ? "transparent" : "rgba(16,185,129,0.018)",
                      }}
                    >
                      <div
                        style={{
                          padding: 8,
                          borderRadius: 10,
                          background: sc.bg,
                          border: `1px solid ${sc.border}`,
                          flexShrink: 0,
                          marginTop: 2,
                        }}
                      >
                        <Icon size={16} color={sc.text} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: "0.87rem", color: sc.text }}>{alert.zone}</span>
                            <span
                              style={{
                                marginLeft: 8,
                                fontSize: "0.7rem",
                                padding: "2px 8px",
                                borderRadius: 6,
                                background: sc.bg,
                                color: sc.text,
                                fontWeight: 600,
                              }}
                            >
                              {alert.severity.toUpperCase()}
                            </span>
                          </div>
                          <span style={{ fontSize: "0.75rem", color: "#9ca3af", whiteSpace: "nowrap", marginLeft: 12 }}>
                            {timeAgo(alert.timestamp)}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.82rem", color: "#6b7280", marginTop: 4 }}>{alert.message}</div>
                        <div style={{ fontSize: "0.73rem", color: "#9ca3af", marginTop: 3 }}>
                          Rule: {alert.rule_name} · ID: {alert.alert_id}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {tab === "rules" && (
          <motion.div key="rules" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rules.length === 0 ? (
              <div style={{ ...cardStyle(), padding: 40, textAlign: "center", color: "#9ca3af" }}>No rules configured. Click "New Rule" to get started.</div>
            ) : (
              rules.map((rule, i) => (
                <motion.div
                  key={rule.rule_id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  style={{
                    ...cardStyle(),
                    padding: "16px 20px",
                    opacity: rule.enabled ? 1 : 0.55,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: "0.92rem", color: "#064e3b" }}>{rule.name}</span>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontWeight: 600,
                          background: rule.severity === "critical" ? "rgba(239,68,68,0.1)" : "rgba(249,115,22,0.1)",
                          color: rule.severity === "critical" ? "#ef4444" : "#f97316",
                        }}
                      >
                        {rule.severity.toUpperCase()}
                      </span>
                      {!rule.enabled && (
                        <span
                          style={{
                            fontSize: "0.7rem",
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "rgba(156,163,175,0.12)",
                            color: "#9ca3af",
                            fontWeight: 600,
                          }}
                        >
                          PAUSED
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: 4 }}>
                      {rule.description || `${rule.metric.toUpperCase()} ${rule.operator === "gt" ? ">" : "<"} ${rule.threshold}`}
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: "0.75rem", color: "#9ca3af", flexWrap: "wrap" }}>
                      <span>
                        Metric: <b style={{ color: "#065f46" }}>{rule.metric.toUpperCase()}</b>
                      </span>
                      <span>
                        Threshold:{" "}
                        <b style={{ color: "#065f46" }}>
                          {rule.operator === "gt" ? ">" : "<"} {rule.threshold}
                        </b>
                      </span>
                      <span>
                        Zone: <b style={{ color: "#065f46" }}>{rule.zone === "all" ? "All Zones" : rule.zone}</b>
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => handleToggleRule(rule)}
                      style={{
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        color: rule.enabled ? "#10b981" : "#9ca3af",
                        padding: 6,
                      }}
                      title={rule.enabled ? "Pause rule" : "Enable rule"}
                    >
                      {rule.enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.rule_id)}
                      style={{
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        color: "#ef444488",
                        padding: 6,
                      }}
                      title="Delete rule"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Rule Modal */}
      <AnimatePresence>
        {showModal && <AddRuleModal onClose={() => setShowModal(false)} onCreated={(rule) => setRules((rs) => [...rs, rule])} />}
      </AnimatePresence>
    </div>
  );
}
