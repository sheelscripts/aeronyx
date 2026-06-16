"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  Database,
  Wifi,
  WifiOff,
  Activity,
  BarChart3,
  Shield,
  Zap,
  RefreshCw,
  Download,
  Terminal,
  Server,
  Cpu,
  TrendingUp,
  Eye,
  Send,
  ChevronRight,
  Check,
  X,
  Info,
  Wind,
  Truck,
  Factory,
  Hammer,
  Flame,
  Cloud,
  HelpCircle
} from "lucide-react";
import { useLiveData, useHistoryData, LiveDataResult } from "../hooks/useData";
import { fetchHealth, fetchAlertStats, fetchAlertRules, fetchWards } from "../services/api";

const SOURCES = ["construction", "vehicle", "biomass", "industrial", "unknown"];

interface ActionItem {
  p: "high" | "medium" | "low" | string;
  action: string;
  auth: string;
  dept: string;
}

interface PolicySource {
  icon: React.ComponentType<any>;
  label: string;
  actions: ActionItem[];
}

const POLICY_DATA: Record<string, PolicySource> = {
  construction: {
    icon: Hammer,
    label: "Construction Dust",
    actions: [
      { p: "high",   action: "Issue immediate stop-work order for all active construction sites in the affected ward", auth: "Municipal Commissioner", dept: "Building Dept" },
      { p: "high",   action: "Deploy water-sprinkler tankers at all active construction sites within 2 hours", auth: "Ward Officer", dept: "Public Works" },
      { p: "medium", action: "Mandate dust-suppression nets on buildings under construction — 24hr compliance window", auth: "Building Dept", dept: "Construction Regulation" },
      { p: "medium", action: "Issue fines to violators under Environment Protection Act Section 5", auth: "Pollution Control Board", dept: "Legal Cell" },
      { p: "low",    action: "Schedule road-sweeping machines in affected wards — twice daily", auth: "Sanitation Dept", dept: "Sanitation" },
      { p: "low",    action: "Post advisory notices on all active construction sites", auth: "Ward Officer", dept: "Administration" },
    ],
  },
  vehicle: {
    icon: Truck,
    label: "Vehicle Exhaust",
    actions: [
      { p: "high",   action: "Activate odd-even traffic policy for affected ward corridors immediately", auth: "Traffic Police", dept: "Transport" },
      { p: "high",   action: "Set up mobile pollution-checking camps at ward entry points", auth: "Transport Dept", dept: "Vehicle Inspection" },
      { p: "medium", action: "Increase public transport frequency on routes through affected ward by 40%", auth: "Delhi Transport Corp", dept: "City Transport" },
      { p: "medium", action: "Restrict heavy diesel vehicles (Euro III and below) during 6am–10pm", auth: "Traffic Police", dept: "Traffic Management" },
      { p: "low",    action: "Activate parking restrictions to reduce idling near residential zones", auth: "Municipal Authority", dept: "Parking Cell" },
      { p: "low",    action: "Issue advisory to promote EV use and carpooling in affected ward", auth: "Smart City Mission", dept: "Green Mobility" },
    ],
  },
  biomass: {
    icon: Flame,
    label: "Biomass Burning",
    actions: [
      { p: "high",   action: "Issue emergency biomass burning ban order — zero tolerance for open burning", auth: "District Magistrate", dept: "Administration" },
      { p: "high",   action: "Deploy patrol teams with authority to impose on-spot fines ₹5,000+", auth: "Fire Department", dept: "Enforcement" },
      { p: "medium", action: "Notify surrounding wards — coordinate with neighbouring ward officers", auth: "Zone Commissioner", dept: "Inter-ward Coordination" },
      { p: "medium", action: "Provide free waste collection to remove burning incentive for 72 hours", auth: "Sanitation Dept", dept: "Waste Management" },
      { p: "low",    action: "Launch community awareness drive on health effects of biomass burning", auth: "Health Dept", dept: "Public Health" },
    ],
  },
  industrial: {
    icon: Factory,
    label: "Industrial Emission",
    actions: [
      { p: "high",   action: "Conduct surprise emission audit of all factories within 3km — immediate", auth: "CPCB / DPCC", dept: "Pollution Board" },
      { p: "high",   action: "Temporarily halt operations of non-compliant industrial units pending inspection", auth: "Industry Dept", dept: "Industrial Safety" },
      { p: "medium", action: "Issue show-cause notices to all units without valid emission certificates", auth: "Pollution Control Board", dept: "Legal Cell" },
      { p: "medium", action: "Verify pollution-control equipment (bag filters, scrubbers) compliance", auth: "Industrial Safety", dept: "Technical Cell" },
      { p: "low",    action: "Mandate real-time Continuous Emission Monitoring Systems (CEMS) installation", auth: "Environment Ministry", dept: "Env Compliance" },
    ],
  },
  unknown: {
    icon: HelpCircle,
    label: "Unidentified Source",
    actions: [
      { p: "medium", action: "Deploy field investigation team with portable sensors to identify source", auth: "Environment Cell", dept: "Field Team" },
      { p: "medium", action: "Pull satellite NDVI / thermal imagery for affected ward boundary", auth: "GIS Department", dept: "Remote Sensing" },
      { p: "medium", action: "Cross-check ThingSpeak data with SAFAR / CPCB reference station in zone", auth: "Data Analytics", dept: "AQM Cell" },
      { p: "low",    action: "Install additional IoT monitoring nodes in the affected area", auth: "Smart City Mission", dept: "IoT Cell" },
    ],
  },
};

interface PriorityBadgeProps {
  priority: string;
}

function PriorityBadge({ priority }: PriorityBadgeProps) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    high:   { bg: "rgba(239,68,68,0.08)",   color: "#ef4444", border: "rgba(239,68,68,0.2)" },
    medium: { bg: "rgba(245,158,11,0.08)",  color: "#f59e0b", border: "rgba(245,158,11,0.2)" },
    low:    { bg: "rgba(16,185,129,0.08)",  color: "#10b981", border: "rgba(16,185,129,0.2)" },
  };
  const c = colors[priority] || colors.low;
  return (
    <span style={{
      display: "inline-flex", padding: "2px 10px", borderRadius: 999,
      fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {priority}
    </span>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: ok ? "#22c55e" : "#ef4444",
      boxShadow: ok ? "0 0 6px #22c55e88" : "0 0 6px #ef444488",
    }} />
  );
}

interface SystemHealthProps {
  liveData: LiveDataResult | null;
}

interface HealthInfo {
  thingspeak?: string;
  websocket_clients?: number;
  [key: string]: any;
}

interface AlertStatsInfo {
  critical: number;
  total: number;
  [key: string]: any;
}

interface WardsInfo {
  count: number;
  [key: string]: any;
}

function SystemHealth({ liveData }: SystemHealthProps) {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [alertStats, setAlertStats] = useState<AlertStatsInfo | null>(null);
  const [wardData, setWardData] = useState<WardsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, as, wd] = await Promise.all([fetchHealth(), fetchAlertStats(), fetchWards()]);
      setHealth(h);
      setAlertStats(as);
      setWardData(wd);
      setLastRefresh(new Date());
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const cardStyle = {
    background: "var(--canvas)",
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--hairline)",
    padding: "16px 20px",
    boxShadow: "var(--shadow-sm)",
  };

  const metrics = [
    { label: "API Server",      ok: !!health,                         val: health ? "Online" : "Offline",    icon: Server },
    { label: "ThingSpeak",      ok: health?.thingspeak === "connected", val: health?.thingspeak || "—",       icon: Wifi },
    { label: "WebSocket",       ok: health?.websocket_clients !== undefined && health.websocket_clients >= 0, val: `${health?.websocket_clients || 0} clients`, icon: Activity },
    { label: "Sensor Feed",     ok: !!liveData,                       val: liveData ? "Receiving" : "No Data", icon: Zap },
    { label: "Ward API",        ok: !!wardData,                       val: wardData ? `${wardData.count} zones` : "—", icon: Database },
    { label: "Active Alerts",   ok: alertStats ? alertStats.critical === 0 : true, val: alertStats ? `${alertStats.total} total` : "—", icon: Shield },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "0.78rem", color: "#9ca3af" }}>
          {lastRefresh ? `Last checked: ${lastRefresh.toLocaleTimeString()}` : "Loading..."}
        </div>
        <button onClick={load} disabled={loading} style={{
          display: "flex", alignItems: "center", gap: 5, padding: "5px 12px",
          borderRadius: 8, border: "1px solid rgba(16,185,129,0.2)",
          background: "rgba(16,185,129,0.06)", cursor: "pointer",
          fontSize: "0.78rem", fontWeight: 600, color: "#065f46",
        }}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 10 }}>
        {metrics.map(({ label, ok, val, icon: Icon }) => (
          <div key={label} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ padding: 8, borderRadius: 10, background: ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", flexShrink: 0 }}>
              <Icon size={16} color={ok ? "#22c55e" : "#ef4444"} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <StatusDot ok={ok} />
                <span style={{ fontSize: "0.72rem", color: "#9ca3af", fontWeight: 600 }}>{label}</span>
              </div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: ok ? "#064e3b" : "#ef4444" }}>{val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Live sensor snapshot */}
      {liveData && (
        <div style={{ ...cardStyle, background: "rgba(16,185,129,0.04)" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
            Live Sensor Snapshot
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
            {[
              { label: "AQI",         val: liveData.aqi,         unit: "",       color: "#10b981" },
              { label: "PM 2.5",      val: liveData.pm25,        unit: "µg/m³",  color: "#f97316" },
              { label: "CO",          val: liveData.co,          unit: "mg/m³",  color: "#8b5cf6" },
              { label: "NO₂",         val: liveData.no2,         unit: "ppm",    color: "#0ea5e9" },
              { label: "TVOC",        val: liveData.tvoc,        unit: "ppm",    color: "#b45309" },
              { label: "Temperature", val: liveData.temperature, unit: "°C",     color: "#ef4444" },
              { label: "Humidity",    val: liveData.humidity,    unit: "%",      color: "#38bdf8" },
            ].map(({ label, val, unit, color }) => (
              <div key={label} style={{
                background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "10px 12px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "1.15rem", fontWeight: 800, color }}>{val}</div>
                <div style={{ fontSize: "0.65rem", color: "#9ca3af", marginTop: 2 }}>{label} {unit && `(${unit})`}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: "0.72rem", color: "#9ca3af", marginTop: 10 }}>
            Category: <b style={{ color: "#065f46" }}>{liveData.aqi_category}</b> &nbsp;·&nbsp;
            Source: <b style={{ color: "#065f46" }}>{liveData.source_detected || "Unknown"}</b> &nbsp;·&nbsp;
            Updated: {new Date(liveData.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}

interface PolicyPanelProps {
  liveAqi?: number;
}

function PolicyPanel({ liveAqi }: PolicyPanelProps) {
  const [selectedSource, setSelectedSource] = useState("vehicle");
  const [selectedAqi, setSelectedAqi]       = useState(() => liveAqi || 150);
  const [dispatched, setDispatched]         = useState<Record<number, boolean>>({});

  const aqi = selectedAqi;
  const policySource = POLICY_DATA[selectedSource];

  const getVisibleActions = () => {
    if (!policySource) return [];
    if (aqi <= 100) return policySource.actions.filter(a => a.p === "low");
    if (aqi <= 200) return policySource.actions.filter(a => a.p !== "high");
    return policySource.actions;
  };

  const handleDispatch = (i: number) => {
    setDispatched(d => ({ ...d, [i]: !d[i] }));
  };

  const cardStyle = {
    background: "var(--canvas)",
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--hairline)",
    boxShadow: "var(--shadow-sm)",
  };

  const aqiColor = aqi <= 50 ? "#22c55e" : aqi <= 100 ? "#84cc16" : aqi <= 200 ? "#b45309" : aqi <= 300 ? "#f97316" : "#ef4444";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Source tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {SOURCES.map(source => {
          const p = POLICY_DATA[source];
          return (
            <button key={source} onClick={() => setSelectedSource(source)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "9px 16px",
              borderRadius: 12, cursor: "pointer", fontWeight: 600, fontSize: "0.84rem",
              border: "none", transition: "all 0.2s",
              background: selectedSource === source
                ? "linear-gradient(135deg, #065f46, #047857)"
                : "rgba(255,255,255,0.7)",
              color: selectedSource === source ? "#fff" : "#6b7280",
              boxShadow: selectedSource === source ? "0 4px 12px rgba(6,95,70,0.2)" : "0 1px 4px rgba(0,0,0,0.04)",
            }}>
              {React.createElement(p.icon, { size: 14 })} {p.label}
            </button>
          );
        })}
      </div>

      {/* AQI Slider */}
      <div style={{ ...cardStyle, padding: "18px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: "0.83rem", fontWeight: 600, color: "#6b7280" }}>Simulate AQI Level</span>
          <span style={{ fontFamily: "var(--font-display)", fontSize: "1.2rem", fontWeight: 800, color: aqiColor }}>{selectedAqi}</span>
        </div>
        <input type="range" min="0" max="500" step="10" value={selectedAqi}
          onChange={e => setSelectedAqi(parseInt(e.target.value))}
          style={{ width: "100%", height: 6, borderRadius: 4, appearance: "none", outline: "none", cursor: "pointer",
            background: "linear-gradient(90deg, #22c55e, #a3e635, #b45309, #f97316, #ef4444, #991b1b)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "#9ca3af", marginTop: 4 }}>
          {["Good","Satisfactory","Moderate","Poor","Very Poor","Severe"].map(l => <span key={l}>{l}</span>)}
        </div>
        {liveAqi !== undefined && (
          <div style={{ marginTop: 10, fontSize: "0.78rem", color: "#9ca3af" }}>
            <Info size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
            Live sensor AQI is <b style={{ color: aqiColor }}>{liveAqi}</b> — slider overrides for simulation
          </div>
        )}
      </div>

      {/* Action list */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            {getVisibleActions().length} Recommended Actions
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {["high","medium","low"].map(p => <PriorityBadge key={p} priority={p} />)}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <AnimatePresence>
            {getVisibleActions().map((action, i) => (
              <motion.div key={`${selectedSource}-${i}`}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }} transition={{ delay: i * 0.04 }}
                style={{
                  ...cardStyle, padding: "16px 20px",
                  display: "flex", alignItems: "flex-start", gap: 16,
                  opacity: dispatched[i] ? 0.6 : 1,
                }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <PriorityBadge priority={action.p} />
                    <span style={{ fontSize: "0.72rem", color: "#9ca3af" }}>→ {action.dept}</span>
                  </div>
                  <div style={{ fontWeight: 600, color: "#1c1917", fontSize: "0.88rem", lineHeight: 1.5, marginBottom: 4 }}>
                    {action.action}
                  </div>
                  <div style={{ fontSize: "0.74rem", color: "#78716c" }}>
                    Authority: <b style={{ color: "#065f46" }}>{action.auth}</b>
                  </div>
                </div>
                <button onClick={() => handleDispatch(i)} style={{
                  flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 9, cursor: "pointer", fontWeight: 600, fontSize: "0.78rem",
                  border: dispatched[i] ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(16,185,129,0.25)",
                  background: dispatched[i] ? "rgba(34,197,94,0.1)" : "rgba(16,185,129,0.06)",
                  color: dispatched[i] ? "#15803d" : "#065f46",
                  transition: "all 0.2s",
                }}>
                  {dispatched[i] ? <><Check size={12} /> Dispatched</> : <><Send size={12} /> Dispatch</>}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

interface RuleItem {
  rule_id: string;
  name: string;
  metric: string;
  operator: string;
  threshold: number;
  zone: string;
  severity: string;
  enabled: boolean;
}

function AlertRulesPanel() {
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlertRules().then(d => { setRules(d.rules || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const severityColor: Record<string, string> = { critical: "#ef4444", warning: "#f97316" };

  return (
    <div>
      {loading ? (
        <div style={{ textAlign: "center", padding: 32, color: "#9ca3af", fontSize: "0.85rem" }}>Loading rules...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rules.map(rule => (
            <div key={rule.rule_id} style={{
              background: "var(--canvas)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--hairline)",
              boxShadow: "var(--shadow-sm)",
              padding: "14px 20px", display: "flex", alignItems: "center", gap: 16,
              opacity: rule.enabled ? 1 : 0.5,
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: "50%", flexShrink: 0,
                background: rule.enabled ? (severityColor[rule.severity] || "#10b981") : "#d1d5db",
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "0.87rem", color: "#064e3b" }}>{rule.name}</div>
                <div style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: 3 }}>
                  {rule.metric.toUpperCase()} {rule.operator === "gt" ? ">" : "<"} {rule.threshold} &nbsp;·&nbsp;
                  Zone: {rule.zone === "all" ? "All Zones" : rule.zone} &nbsp;·&nbsp;
                  <span style={{ color: severityColor[rule.severity] || "#10b981", fontWeight: 600 }}>
                    {rule.severity.toUpperCase()}
                  </span>
                </div>
              </div>
              <span style={{
                fontSize: "0.7rem", padding: "3px 10px", borderRadius: 8, fontWeight: 700,
                background: rule.enabled ? "rgba(34,197,94,0.08)" : "rgba(156,163,175,0.1)",
                color: rule.enabled ? "#15803d" : "#9ca3af",
              }}>
                {rule.enabled ? "ACTIVE" : "PAUSED"}
              </span>
            </div>
          ))}
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <Link href="/alerts" style={{
              fontSize: "0.82rem", color: "#065f46", fontWeight: 600, textDecoration: "none",
            }}>
              Manage all alert rules on Alerts page →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

interface ActivityLogProps {
  liveData: LiveDataResult | null;
}

function ActivityLog({ liveData }: ActivityLogProps) {
  const { data: history } = useHistoryData(50);
  const recent = (history || []).slice(0, 12);

  const aqiColor = (aqi: number) => {
    if (aqi <= 50) return "#22c55e";
    if (aqi <= 100) return "#84cc16";
    if (aqi <= 200) return "#b45309";
    if (aqi <= 300) return "#f97316";
    return "#ef4444";
  };

  return (
    <div style={{
      background: "rgba(15,23,42,0.96)", borderRadius: 16, padding: "18px 20px",
      fontFamily: "monospace", maxHeight: 360, overflowY: "auto",
    }}>
      <div style={{ fontSize: "0.72rem", color: "#4ade80", fontWeight: 700, marginBottom: 12, letterSpacing: "0.1em" }}>
        [AERONYX] SYSTEM LOG — SENSOR NODE 01 — DELHI
      </div>
      {recent.length === 0 && (
        <div style={{ color: "#6b7280", fontSize: "0.78rem" }}>Waiting for data...</div>
      )}
      {recent.map((entry, i) => {
        const t = new Date(entry.timestamp).toLocaleTimeString();
        const color = aqiColor(entry.aqi);
        return (
          <div key={i} style={{ fontSize: "0.75rem", marginBottom: 6, display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ color: "#6b7280", flexShrink: 0 }}>{t}</span>
            <span style={{ color: "#94a3b8" }}>
              AQI: <span style={{ color, fontWeight: 700 }}>{entry.aqi}</span>
              {" "}<span style={{ color: "#64748b" }}>({entry.aqi_category})</span>
              {" "}PM2.5: <span style={{ color: "#f97316" }}>{entry.pm25}</span>
              {" "}CO: <span style={{ color: "#a78bfa" }}>{entry.co}</span>
              {" "}NO₂: <span style={{ color: "#38bdf8" }}>{entry.no2}</span>
            </span>
          </div>
        );
      })}
      {liveData && (
        <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8,
          fontSize: "0.72rem", color: "#4ade80" }}>
          ▶ LIVE — AQI {liveData.aqi} · {liveData.aqi_category} · Source: {liveData.source_detected || "detecting..."}
        </div>
      )}
    </div>
  );
}

const TABS = [
  { key: "system",  label: "System Health", icon: Server },
  { key: "policy",  label: "Policy Actions", icon: FileText },
  { key: "rules",   label: "Alert Rules",   icon: Shield },
  { key: "log",     label: "Activity Log",  icon: Terminal },
];

export default function AdminPanel() {
  const { data: liveData } = useLiveData();
  const [tab, setTab] = useState("system");

  const cardStyle = {
    background: "var(--canvas)",
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--hairline)",
    boxShadow: "var(--shadow-sm)",
    padding: "24px 28px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "clamp(12px, 4vw, 32px)", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h2 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em" }}>Operations Admin Panel</h2>
          <p style={{ color: "var(--earth-500)", fontSize: "0.9rem", marginTop: 4 }}>System health monitoring, policy execution, and sensor network configurations</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {liveData && (
            <div className="last-updated" style={{ margin: 0, background: "rgba(0,30,43,0.02)", border: "1px solid var(--hairline-soft)", padding: "6px 12px", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", gap: 6 }}>
              <span className="dot" style={{ background: "var(--primary-deep)" }} />
              <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--earth-600)" }}>Live · AQI {liveData.aqi} — {liveData.aqi_category}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Quick stats */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: 12 }}>
        {[
          { label: "Current AQI",  val: liveData?.aqi || "—",           color: "#10b981", icon: Activity },
          { label: "PM 2.5",       val: liveData ? `${liveData.pm25} µg` : "—", color: "#f97316", icon: Wind },
          { label: "Source",       val: liveData?.source_detected || "—", color: "#8b5cf6", icon: Eye },
          { label: "Temp",         val: liveData ? `${liveData.temperature}°C` : "—", color: "#ef4444", icon: TrendingUp },
        ].map(({ label, val, color, icon: Icon }) => (
          <div key={label} style={{ ...cardStyle, padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ padding: 7, borderRadius: 9, background: `${color}18` }}>
                <Icon size={15} color={color} />
              </div>
              <span style={{ fontSize: "0.72rem", color: "#9ca3af", fontWeight: 600 }}>{label}</span>
            </div>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, color, lineHeight: 1 }}>{val}</div>
          </div>
        ))}
      </motion.div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 18px",
              borderRadius: 12, cursor: "pointer", fontWeight: 600, fontSize: "0.85rem",
              background: tab === key ? "var(--brand-teal-deep)" : "var(--canvas)",
              color: tab === key ? "#fff" : "var(--slate)",
              border: tab === key ? "none" : "1px solid var(--hairline)",
              boxShadow: "var(--shadow-sm)",
              transition: "all 0.2s",
            }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div style={tab === "log" ? {} : cardStyle}>
              {tab === "system" && <SystemHealth liveData={liveData} />}
              {tab === "policy" && <PolicyPanel liveAqi={liveData?.aqi} />}
              {tab === "rules"  && <AlertRulesPanel />}
              {tab === "log"    && <ActivityLog liveData={liveData} />}
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>

    </div>
  );
}
