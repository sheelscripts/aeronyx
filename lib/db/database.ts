import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const isSupabaseConfigured = !!(supabaseUrl && supabaseServiceKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Paths for local JSON database fallback
const LOCAL_DB_DIR = path.join(process.cwd(), "data");
const READINGS_FILE = path.join(LOCAL_DB_DIR, "sensor_readings.json");
const RULES_FILE = path.join(LOCAL_DB_DIR, "alert_rules.json");
const ALERTS_FILE = path.join(LOCAL_DB_DIR, "alert_history.json");
const WIND_HISTORY_FILE = path.join(LOCAL_DB_DIR, "wind_history.json");

// Default Alert Rules
const DEFAULT_RULES = [
  {
    rule_id: "rule_default_severe",
    name: "Severe AQI Alert",
    description: "Alert when AQI exceeds 400 (Severe)",
    metric: "aqi",
    threshold: 400,
    operator: "gt",
    zone: "all",
    severity: "critical",
    enabled: true,
    created_at: new Date().toISOString(),
  },
  {
    rule_id: "rule_default_very_poor",
    name: "Very Poor AQI Alert",
    description: "Alert when AQI exceeds 300 (Very Poor)",
    metric: "aqi",
    threshold: 300,
    operator: "gt",
    zone: "all",
    severity: "critical",
    enabled: true,
    created_at: new Date().toISOString(),
  },
  {
    rule_id: "rule_default_poor",
    name: "Poor AQI Warning",
    description: "Alert when AQI exceeds 200 (Poor)",
    metric: "aqi",
    threshold: 200,
    operator: "gt",
    zone: "all",
    severity: "warning",
    enabled: true,
    created_at: new Date().toISOString(),
  },
  {
    rule_id: "rule_default_moderate",
    name: "Moderate AQI Notice",
    description: "Alert when AQI exceeds 150",
    metric: "aqi",
    threshold: 150,
    operator: "gt",
    zone: "all",
    severity: "info",
    enabled: true,
    created_at: new Date().toISOString(),
  },
  {
    rule_id: "rule_default_pm25",
    name: "High PM2.5",
    description: "Alert when PM2.5 exceeds 120 µg/m³ (Unhealthy)",
    metric: "pm25",
    threshold: 120,
    operator: "gt",
    zone: "all",
    severity: "warning",
    enabled: true,
    created_at: new Date().toISOString(),
  },
  {
    rule_id: "rule_default_pm25_severe",
    name: "Severe PM2.5",
    description: "Alert when PM2.5 exceeds 250 µg/m³ (Hazardous)",
    metric: "pm25",
    threshold: 250,
    operator: "gt",
    zone: "all",
    severity: "critical",
    enabled: true,
    created_at: new Date().toISOString(),
  },
  {
    rule_id: "rule_default_co",
    name: "High CO Level",
    description: "Alert when CO exceeds 6.0 mg/m³",
    metric: "co",
    threshold: 6.0,
    operator: "gt",
    zone: "all",
    severity: "critical",
    enabled: true,
    created_at: new Date().toISOString(),
  },
];

// Helper to ensure files exist
function ensureLocalDb() {
  if (!fs.existsSync(LOCAL_DB_DIR)) {
    fs.mkdirSync(LOCAL_DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(READINGS_FILE)) {
    fs.writeFileSync(READINGS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(RULES_FILE)) {
    fs.writeFileSync(RULES_FILE, JSON.stringify(DEFAULT_RULES));
  }
  if (!fs.existsSync(ALERTS_FILE)) {
    fs.writeFileSync(ALERTS_FILE, JSON.stringify([]));
  }
  if (!fs.existsSync(WIND_HISTORY_FILE)) {
    fs.writeFileSync(WIND_HISTORY_FILE, JSON.stringify([]));
  }
}

// Read JSON Helper
function readJsonFile(filePath: string): any[] {
  try {
    ensureLocalDb();
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content || "[]");
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return [];
  }
}

// Write JSON Helper
function writeJsonFile(filePath: string, data: any[]) {
  try {
    ensureLocalDb();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error writing to ${filePath}:`, err);
  }
}

// Database Interfaces
export interface SensorReading {
  id?: number;
  timestamp: string;
  temperature: number;
  humidity: number;
  pm25: number;
  tvoc: number;
  no2: number;
  co: number;
  aqi: number;
  aqi_category: string;
  source_detected: string;
  ward_id: string;
}

export interface AlertRule {
  rule_id: string;
  name: string;
  description: string;
  metric: string;
  threshold: number;
  operator: string;
  zone: string;
  severity: string;
  enabled: boolean;
  created_at: string;
}

export interface AlertLog {
  alert_id: string;
  rule_id: string;
  rule_name: string;
  zone: string;
  ward_id: string;
  metric: string;
  value: number;
  threshold: number;
  severity: string;
  message: string;
  timestamp: string;
}

// DATABASE OPERATIONS

export async function initDb() {
  if (isSupabaseConfigured && supabase) {
    console.log("Supabase configured. Tables should be created in Supabase dashboard.");
    // Pre-populate default rules in Supabase if empty
    try {
      const { data, error } = await supabase.from("alert_rules").select("rule_id").limit(1);
      if (!error && (!data || data.length === 0)) {
        await supabase.from("alert_rules").insert(DEFAULT_RULES);
        console.log("Pre-populated default alert rules in Supabase.");
      }
    } catch (e) {
      console.warn("Could not check/insert rules in Supabase:", e);
    }
  } else {
    ensureLocalDb();
    console.log("Local offline JSON database initialized.");
  }
}

// Sensor Readings
export async function getSensorReadings(hours = 24, wardId = "ward_01"): Promise<SensorReading[]> {
  if (isSupabaseConfigured && supabase) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("sensor_readings")
      .select("*")
      .eq("ward_id", wardId)
      .gte("timestamp", cutoff)
      .order("timestamp", { ascending: true });

    if (error) {
      console.error("Error fetching readings from Supabase:", error);
      return [];
    }
    return data || [];
  } else {
    const list = readJsonFile(READINGS_FILE) as SensorReading[];
    const cutoffMs = Date.now() - hours * 60 * 60 * 1000;
    return list
      .filter(
        (r) =>
          r.ward_id === wardId &&
          new Date(r.timestamp).getTime() >= cutoffMs
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
}

export async function insertSensorReading(reading: SensorReading): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("sensor_readings").insert([reading]);
    if (error) {
      console.error("Error inserting reading into Supabase:", error);
      return false;
    }
    return true;
  } else {
    const list = readJsonFile(READINGS_FILE);
    // Prevent duplicates by timestamp
    if (list.some((r) => r.timestamp === reading.timestamp)) {
      return true;
    }
    list.push({ ...reading, id: Date.now() + Math.floor(Math.random() * 1000) });
    // Keep last 1000 readings locally
    if (list.length > 1000) {
      list.shift();
    }
    writeJsonFile(READINGS_FILE, list);
    return true;
  }
}

// Alert Rules
export async function getAlertRules(): Promise<AlertRule[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("alert_rules").select("*");
    if (error) {
      console.error("Error fetching rules from Supabase:", error);
      return [];
    }
    return data || [];
  } else {
    return readJsonFile(RULES_FILE) as AlertRule[];
  }
}

export async function createAlertRule(rule: AlertRule): Promise<AlertRule | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase.from("alert_rules").insert([rule]).select();
    if (error || !data) {
      console.error("Error creating rule in Supabase:", error);
      return null;
    }
    return data[0] as AlertRule;
  } else {
    const list = readJsonFile(RULES_FILE) as AlertRule[];
    list.push(rule);
    writeJsonFile(RULES_FILE, list);
    return rule;
  }
}

export async function updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("alert_rules")
      .update(updates)
      .eq("rule_id", ruleId)
      .select();
    if (error || !data) {
      console.error("Error updating rule in Supabase:", error);
      return null;
    }
    return data[0] as AlertRule;
  } else {
    const list = readJsonFile(RULES_FILE) as AlertRule[];
    const idx = list.findIndex((r) => r.rule_id === ruleId);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates };
    writeJsonFile(RULES_FILE, list);
    return list[idx];
  }
}

export async function deleteAlertRule(ruleId: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("alert_rules").delete().eq("rule_id", ruleId);
    if (error) {
      console.error("Error deleting rule in Supabase:", error);
      return false;
    }
    return true;
  } else {
    const list = readJsonFile(RULES_FILE) as AlertRule[];
    const filtered = list.filter((r) => r.rule_id !== ruleId);
    writeJsonFile(RULES_FILE, filtered);
    return true;
  }
}

// Alert Logs (History)
export async function getAlertHistory(limit = 50): Promise<AlertLog[]> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);
    if (error) {
      console.error("Error fetching alerts from Supabase:", error);
      return [];
    }
    return data || [];
  } else {
    const list = readJsonFile(ALERTS_FILE) as AlertLog[];
    return list
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
}

export async function insertAlerts(alerts: AlertLog[]): Promise<boolean> {
  if (alerts.length === 0) return true;
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("alerts").insert(alerts);
    if (error) {
      console.error("Error inserting alerts into Supabase:", error);
      return false;
    }
    return true;
  } else {
    const list = readJsonFile(ALERTS_FILE);
    list.unshift(...alerts);
    // Keep last 200 alerts locally
    if (list.length > 200) {
      list.length = 200;
    }
    writeJsonFile(ALERTS_FILE, list);
    return true;
  }
}

export async function clearAlertHistory(): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from("alerts").delete().neq("id", -1);
    if (error) {
      console.error("Error clearing alert history in Supabase:", error);
      return false;
    }
    return true;
  } else {
    writeJsonFile(ALERTS_FILE, []);
    return true;
  }
}

// Wind History Cache (in-memory/file backend)
export interface WindSnapshot {
  timestamp: string;
  stations: any[];
}

export async function getWindHistory(hours = 24): Promise<WindSnapshot[]> {
  if (isSupabaseConfigured && supabase) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("wind_history")
      .select("*")
      .gte("timestamp", cutoff)
      .order("timestamp", { ascending: true });
    if (error) {
      // Wind history table might be optional
      return [];
    }
    return data || [];
  } else {
    const list = readJsonFile(WIND_HISTORY_FILE) as WindSnapshot[];
    const cutoffMs = Date.now() - hours * 60 * 60 * 1000;
    return list
      .filter((w) => new Date(w.timestamp).getTime() >= cutoffMs)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
}

export async function insertWindSnapshot(snapshot: WindSnapshot): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from("wind_history").insert([snapshot]);
    } catch {
      // Ignore if table doesn't exist
    }
    return true;
  } else {
    const list = readJsonFile(WIND_HISTORY_FILE);
    list.push(snapshot);
    if (list.length > 288) {
      list.shift(); // Keep last 24h at 5-min intervals
    }
    writeJsonFile(WIND_HISTORY_FILE, list);
    return true;
  }
}
