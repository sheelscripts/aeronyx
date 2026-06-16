import axios from "axios";

// Since it's Next.js, we call relative paths on the same host
const API_BASE = "";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

// --- Core API Functions ---
export const fetchLiveData = () => api.get("/api/live").then((r) => r.data);
export const fetchHistory = (hours = 24) => api.get(`/api/history?hours=${hours}`).then((r) => r.data);
export const fetchAdvisory = () => api.get("/api/advisory").then((r) => r.data);
export const fetchPolicy = (source: string, aqi: number) =>
  api.get("/api/policy", { params: { source, aqi } }).then((r) => r.data);
export const fetchHealth = () => api.get("/api/health").then((r) => r.data);
export const fetchWards = () => api.get("/api/wards").then((r) => r.data);
export const fetchWard = (wardId: string) => api.get(`/api/wards/${wardId}`).then((r) => r.data);

// --- Wind + Plume + Attribution APIs ---
export const fetchWindCurrent = () => api.get("/api/wind/current").then((r) => r.data);
export const fetchWindField = (gridSize = 12) =>
  api.get(`/api/wind/field?grid_size=${gridSize}`).then((r) => r.data);
export const fetchWindHistory = (hours = 24) =>
  api.get(`/api/wind/history?hours=${hours}`).then((r) => r.data);
export const fetchTrajectory = (wardId: string, hours = 3) =>
  api.get(`/api/plume/trajectory/${wardId}?hours=${hours}`).then((r) => r.data);
export const fetchUpwind = (wardId: string, radiusKm = 6) =>
  api.get(`/api/plume/upwind/${wardId}?radius_km=${radiusKm}`).then((r) => r.data);
export const fetchFlowChain = (zoneId: string) =>
  api.get(`/api/plume/flow-chain/${zoneId}`).then((r) => r.data);
export const fetchAttribution = (wardId: string) =>
  api.get(`/api/attribution/ward/${wardId}`).then((r) => r.data);
export const fetchZoneAttribution = (zoneId: string) =>
  api.get(`/api/attribution/zone/${zoneId}`).then((r) => r.data);
export const fetchCityAttribution = () => api.get("/api/attribution/city").then((r) => r.data);

// --- Alerts API ---
export const fetchAlerts = (limit = 50) => api.get(`/api/alerts?limit=${limit}`).then((r) => r.data);
export const fetchAlertStats = () => api.get("/api/alerts/stats").then((r) => r.data);
export const fetchAlertRules = () => api.get("/api/alerts/rules").then((r) => r.data);
export const createAlertRule = (rule: any) => api.post("/api/alerts/rules", rule).then((r) => r.data);
export const updateAlertRule = (id: string, updates: any) =>
  api.put(`/api/alerts/rules/${id}`, updates).then((r) => r.data);
export const deleteAlertRule = (id: string) => api.delete(`/api/alerts/rules/${id}`).then((r) => r.data);
export const clearAlerts = () => api.delete("/api/alerts").then((r) => r.data);

// --- ML Predictions API ---
export const fetchMLSource = () => api.get("/api/ml/source").then((r) => r.data);
export const fetchMLForecast = (horizon = 24) =>
  api.get(`/api/ml/forecast?horizon=${horizon}`).then((r) => r.data);
export const fetchMLAnomaly = () => api.get("/api/ml/anomaly").then((r) => r.data);
export const fetchMLSummary = () => api.get("/api/ml/summary").then((r) => r.data);

// --- Industrial Source Matching ---
export const fetchIndustrialSource = (wardId = "ward_1", transportHours = 1, topSources = 3) =>
  api.get(`/api/plume/industrial-source/${wardId}`, {
    params: { transport_hours: transportHours, top_sources: topSources },
  }).then((r) => r.data);

// --- Direct ThingSpeak fallback (if backend routing isn't waking up) ---
const THINGSPEAK_CHANNEL = "3316545";
const THINGSPEAK_API_KEY = "GFGLEQFXSC40CFOO";
const THINGSPEAK_BASE = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL}`;

function safeFloat(val: any) {
  return val ? parseFloat(val) || 0 : 0;
}
function safeInt(val: any) {
  return val ? parseInt(val, 10) || 0 : 0;
}

export function detectSourceLocal(pm25: number, co: number, no2: number, tvoc: number) {
  const pmCo = pm25 / Math.max(co, 0.01);
  const scores: Record<string, number> = { vehicle: 0, industrial: 0, construction: 0, biomass: 0, mixed: 0.05 };

  if (pmCo > 30 && no2 > 0.08) scores.vehicle += 0.45;
  if (pmCo > 20) scores.vehicle += 0.15;
  if (co > 2.0 && co <= 5.0) scores.vehicle += 0.1;

  if (no2 > 0.15 && co > 4.0) scores.industrial += 0.45;
  if (no2 > 0.1) scores.industrial += 0.15;
  if (tvoc > 0.5 && no2 > 0.12) scores.industrial += 0.1;

  if (co > 5.0 && tvoc > 0.8) scores.biomass += 0.45;
  if (co > 4.0) scores.biomass += 0.1;
  if (tvoc > 0.6) scores.biomass += 0.1;

  if (tvoc > 1.0 && pm25 > 180) scores.construction += 0.45;
  if (pm25 > 150) scores.construction += 0.1;
  if (tvoc > 0.8) scores.construction += 0.05;

  const total = Object.values(scores).reduce((s, v) => s + v, 0) || 1;
  const probabilities: Record<string, number> = {};
  for (const k of Object.keys(scores)) {
    probabilities[k] = Math.round((scores[k] / total) * 1000) / 1000;
  }

  const sorted = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
  return { source: sorted[0][0], confidence: sorted[0][1], probabilities };
}

function getAqiCategoryColor(aqi: number) {
  if (aqi <= 50) return { category: "Good", color: "#22c55e" };
  if (aqi <= 100) return { category: "Satisfactory", color: "#a3e635" };
  if (aqi <= 200) return { category: "Moderate", color: "#b45309" };
  if (aqi <= 300) return { category: "Poor", color: "#f97316" };
  if (aqi <= 400) return { category: "Very Poor", color: "#ef4444" };
  return { category: "Severe", color: "#991b1b" };
}

function parseThingSpeakFeed(feed: any) {
  const pm25 = safeFloat(feed.field3);
  const tvoc = safeFloat(feed.field4);
  const no2 = safeFloat(feed.field5);
  const co = safeFloat(feed.field6);
  const aqi = safeInt(feed.field7);
  const cat = getAqiCategoryColor(aqi);
  const src = detectSourceLocal(pm25, co, no2, tvoc);
  return {
    timestamp: feed.created_at,
    temperature: safeFloat(feed.field1),
    humidity: safeFloat(feed.field2),
    pm25,
    tvoc,
    no2,
    co,
    aqi,
    aqi_category: cat.category,
    aqi_color: cat.color,
    source_detected: src.source,
    status: "online",
  };
}

export async function fetchThingSpeakLive() {
  const resp = await axios.get(`${THINGSPEAK_BASE}/feeds/last.json`, { params: { api_key: THINGSPEAK_API_KEY } });
  return parseThingSpeakFeed(resp.data);
}

export async function fetchThingSpeakHistory(results = 100) {
  const resp = await axios.get(`${THINGSPEAK_BASE}/feeds.json`, { params: { api_key: THINGSPEAK_API_KEY, results } });
  const feeds = resp.data.feeds || [];
  return feeds.filter((f: any) => f.created_at).map(parseThingSpeakFeed);
}

export async function getLiveData() {
  try {
    const data = await fetchLiveData();
    if (data && data.status !== "offline") return { ...data, _source: "backend" };
  } catch {
    // Ignore error
  }
  try {
    const ts = await fetchThingSpeakLive();
    return { ...ts, _source: "thingspeak" };
  } catch {
    return null;
  }
}

export async function getHistoryData(results = 200) {
  try {
    const data = await fetchHistory(24);
    if (data.data && data.data.length > 0) return data.data;
  } catch {
    // Ignore error
  }
  try {
    return await fetchThingSpeakHistory(results);
  } catch {
    return [];
  }
}

export async function pingBackend() {
  try {
    const resp = await axios.get(`${API_BASE}/api/health`, { timeout: 5000 });
    return resp.status === 200;
  } catch {
    return false;
  }
}

export default api;
