import axios from "axios";
import { getWindHistory as dbGetWindHistory, insertWindSnapshot } from "../db/database";

const OWM_API_KEY = process.env.OPENWEATHER_API_KEY || "";
const OWM_BASE_URL = "https://api.openweathermap.org/data/2.5/weather";

export const ZONE_WEATHER_STATIONS: Record<string, { lat: number; lon: number }> = {
  Central: { lat: 28.635, lon: 77.228 },
  South: { lat: 28.53, lon: 77.22 },
  "Shahdara North": { lat: 28.695, lon: 77.295 },
  "Shahdara South": { lat: 28.635, lon: 77.305 },
  "City SP": { lat: 28.658, lon: 77.215 },
  "Civil Lines": { lat: 28.687, lon: 77.22 },
  "Karol Bagh": { lat: 28.648, lon: 77.19 },
  Najafgarh: { lat: 28.57, lon: 77.07 },
  Narela: { lat: 28.785, lon: 77.1 },
  Rohini: { lat: 28.72, lon: 77.125 },
  West: { lat: 28.655, lon: 77.16 },
  Keshavpuram: { lat: 28.685, lon: 77.15 },
};

export const SEASONAL_WIND: Record<number, { dir: number; speed: number; label: string }> = {
  1: { dir: 315, speed: 2.5, label: "NW (Winter)" },
  2: { dir: 315, speed: 3.0, label: "NW (Late Winter)" },
  3: { dir: 270, speed: 3.5, label: "W (Pre-Summer)" },
  4: { dir: 270, speed: 4.0, label: "W (Spring)" },
  5: { dir: 270, speed: 4.5, label: "W (Summer)" },
  6: { dir: 225, speed: 4.0, label: "SW (Pre-Monsoon)" },
  7: { dir: 135, speed: 5.0, label: "SE (Monsoon)" },
  8: { dir: 135, speed: 5.5, label: "SE (Peak Monsoon)" },
  9: { dir: 135, speed: 4.0, label: "SE (Late Monsoon)" },
  10: { dir: 315, speed: 2.0, label: "NW (Post-Monsoon)" },
  11: { dir: 315, speed: 1.5, label: "NW (Early Winter)" },
  12: { dir: 315, speed: 2.0, label: "NW (Winter)" },
};

// In-memory cache for the server session (resets on serverless cold starts)
let _windCache: Record<string, any> = {};
let _cacheTimestamp: Date | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0;
  const dlat = ((lat2 - lat1) * Math.PI) / 180;
  const dlon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dlon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Simple deterministic gauss noise
function getGaussianNoise(mean = 0, std = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
  return mean + std * randStdNormal;
}

export function generateDemoWind(stationName: string, dateObj?: Date): any {
  const now = dateObj || new Date();
  const month = now.getMonth() + 1; // 1-indexed
  const hour = now.getHours() + now.getMinutes() / 60.0;

  const seasonal = SEASONAL_WIND[month] || SEASONAL_WIND[1];
  const baseDir = seasonal.dir;
  const baseSpeed = seasonal.speed;

  const diurnalFactor = Math.max(0.3, 0.6 + 0.4 * Math.sin(((hour - 6) * Math.PI) / 12));

  // Determine a stable random seed offset based on station name
  let hashVal = 0;
  for (let i = 0; i < stationName.length; i++) {
    hashVal = stationName.charCodeAt(i) + ((hashVal << 5) - hashVal);
  }
  const stationHash = Math.abs(hashVal % 100) / 100.0;
  const stationVar = 0.8 + 0.4 * stationHash;

  const speed = Math.max(0.2, baseSpeed * diurnalFactor * stationVar + getGaussianNoise(0, 0.5));
  const direction = (baseDir + getGaussianNoise(0, 15) + 10 * Math.sin((hour * Math.PI) / 6)) % 360;

  const stationCoords = ZONE_WEATHER_STATIONS[stationName];
  return {
    station: stationName,
    lat: stationCoords.lat,
    lon: stationCoords.lon,
    wind_speed: Math.round(speed * 100) / 100,
    wind_direction: Math.round(((direction + 360) % 360) * 10) / 10,
    wind_label: seasonal.label,
    temperature: Math.round((28 + 5 * Math.sin(((hour - 14) * Math.PI) / 12) + getGaussianNoise(0, 1)) * 10) / 10,
    pressure: Math.round((1013 + getGaussianNoise(0, 2)) * 10) / 10,
    timestamp: now.toISOString(),
  };
}

async function fetchRealWindFromOwm(lat: number, lon: number): Promise<any | null> {
  if (!OWM_API_KEY) return null;
  try {
    const response = await axios.get(OWM_BASE_URL, {
      params: {
        lat,
        lon,
        appid: OWM_API_KEY,
        units: "metric",
      },
      timeout: 5000,
    });
    if (response.status !== 200) return null;
    const data = response.data;
    return {
      wind_speed: data?.wind?.speed || 0,
      wind_direction: data?.wind?.deg || 0,
      temperature: data?.main?.temp || 28,
      pressure: data?.main?.pressure || 1013,
    };
  } catch (err) {
    console.error("OWM Fetch error:", err);
    return null;
  }
}

export async function updateWindCache(forced = false) {
  const now = new Date();
  if (
    !forced &&
    _cacheTimestamp &&
    now.getTime() - _cacheTimestamp.getTime() < CACHE_TTL_MS &&
    Object.keys(_windCache).length > 0
  ) {
    return;
  }

  for (const stationName of Object.keys(ZONE_WEATHER_STATIONS)) {
    const coords = ZONE_WEATHER_STATIONS[stationName];
    const realData = await fetchRealWindFromOwm(coords.lat, coords.lon);

    if (realData) {
      _windCache[stationName] = {
        station: stationName,
        lat: coords.lat,
        lon: coords.lon,
        wind_speed: realData.wind_speed,
        wind_direction: realData.wind_direction,
        temperature: realData.temperature,
        pressure: realData.pressure,
        timestamp: now.toISOString(),
        source: "openweathermap",
      };
    } else {
      _windCache[stationName] = {
        ...generateDemoWind(stationName, now),
        source: "simulated",
      };
    }
  }

  _cacheTimestamp = now;
}

export async function getAllStationWinds(): Promise<any[]> {
  await updateWindCache();
  if (Object.keys(_windCache).length === 0) {
    // Fallback if update failed entirely
    for (const name of Object.keys(ZONE_WEATHER_STATIONS)) {
      _windCache[name] = {
        ...generateDemoWind(name),
        source: "simulated",
      };
    }
  }
  return Object.values(_windCache);
}

export async function interpolateWind(targetLat: number, targetLon: number): Promise<{
  wind_speed: number;
  wind_direction: number;
  station?: string;
}> {
  const stations = await getAllStationWinds();
  if (stations.length === 0) {
    return { wind_speed: 0, wind_direction: 0 };
  }

  const weights: number[] = [];
  const uComponents: number[] = [];
  const vComponents: number[] = [];

  for (const s of stations) {
    const dist = haversine(s.lat, s.lon, targetLat, targetLon);
    if (dist < 0.05) {
      return {
        wind_speed: s.wind_speed,
        wind_direction: s.wind_direction,
        station: s.station,
      };
    }

    const w = 1.0 / dist ** 2;
    weights.push(w);

    const dirRad = (s.wind_direction * Math.PI) / 180;
    uComponents.push(s.wind_speed * Math.sin(dirRad));
    vComponents.push(s.wind_speed * Math.cos(dirRad));
  }

  const totalW = weights.reduce((a, b) => a + b, 0);
  if (totalW === 0) return { wind_speed: 0, wind_direction: 0 };

  const uAvg = uComponents.map((u, i) => u * weights[i]).reduce((a, b) => a + b, 0) / totalW;
  const vAvg = vComponents.map((v, i) => v * weights[i]).reduce((a, b) => a + b, 0) / totalW;

  const speed = Math.sqrt(uAvg ** 2 + vAvg ** 2);
  const direction = ((Math.atan2(uAvg, vAvg) * 180) / Math.PI + 360) % 360;

  return {
    wind_speed: Math.round(speed * 100) / 100,
    wind_direction: Math.round(direction * 10) / 10,
  };
}

export async function getWindFieldGrid(
  latMin = 28.4,
  latMax = 28.85,
  lonMin = 76.85,
  lonMax = 77.35,
  gridSize = 12
): Promise<any[]> {
  const grid: any[] = [];
  const latStep = (latMax - latMin) / gridSize;
  const lonStep = (lonMax - lonMin) / gridSize;

  for (let i = 0; i <= gridSize; i++) {
    for (let j = 0; j <= gridSize; j++) {
      const lat = latMin + i * latStep;
      const lon = lonMin + j * lonStep;
      const wind = await interpolateWind(lat, lon);

      const dirRad = (wind.wind_direction * Math.PI) / 180;
      grid.push({
        lat: Math.round(lat * 10000) / 10000,
        lon: Math.round(lon * 10000) / 10000,
        wind_speed: wind.wind_speed,
        wind_direction: wind.wind_direction,
        u: Math.round(wind.wind_speed * Math.sin(dirRad) * 1000) / 1000,
        v: Math.round(wind.wind_speed * Math.cos(dirRad) * 1000) / 1000,
      });
    }
  }

  return grid;
}

export async function getUpwindWards(
  targetLat: number,
  targetLon: number,
  allWards: any[],
  radiusKm = 5.0
): Promise<any[]> {
  const wind = await interpolateWind(targetLat, targetLon);
  const windDir = wind.wind_direction;
  const upwindBearing = windDir; // Bearing direction FROM which wind blows

  const upwind: any[] = [];
  for (const ward of allWards) {
    const lat = ward.lat || ward.latitude;
    const lon = ward.lng || ward.longitude || ward.lon;
    if (lat === undefined || lon === undefined) continue;

    const dist = haversine(lat, lon, targetLat, targetLon);
    if (dist > radiusKm || dist < 0.05) continue;

    const dlat = ((lat - targetLat) * Math.PI) / 180;
    const dlon = ((lon - targetLon) * Math.PI) / 180;
    const y = Math.sin(dlon) * Math.cos((lat * Math.PI) / 180);
    const x =
      Math.cos((targetLat * Math.PI) / 180) * Math.sin((lat * Math.PI) / 180) -
      Math.sin((targetLat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.cos(dlon);
    
    const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

    let angleDiff = Math.abs(bearing - upwindBearing);
    if (angleDiff > 180) {
      angleDiff = 360 - angleDiff;
    }

    if (angleDiff < 60) {
      upwind.push({
        ward_id: ward.ward_id || ward.id,
        name: ward.name || "",
        zone: ward.zone || "",
        distance_km: Math.round(dist * 100) / 100,
        bearing: Math.round(bearing * 10) / 10,
        angle_from_wind: Math.round(angleDiff * 10) / 10,
      });
    }
  }

  return upwind.sort((a, b) => a.distance_km - b.distance_km);
}

export async function recordWindSnapshot() {
  const stations = await getAllStationWinds();
  const snapshot = {
    timestamp: new Date().toISOString(),
    stations,
  };
  await insertWindSnapshot(snapshot);
}

export async function getWindHistoryData(hours = 24): Promise<any[]> {
  try {
    const list = await dbGetWindHistory(hours);
    if (list.length > 0) {
      return list;
    }
  } catch (err) {
    console.error("Error reading wind history from database:", err);
  }

  // Generate fallback demo snapshots if database history is empty
  const now = Date.now();
  const fallbackList: any[] = [];
  const intervalMs = 15 * 60 * 1000; // 15 mins
  const totalSnapshots = (hours * 60) / 15;

  for (let i = 0; i < totalSnapshots; i++) {
    const time = new Date(now - (totalSnapshots - i) * intervalMs);
    const stations = Object.keys(ZONE_WEATHER_STATIONS).map((name) =>
      generateDemoWind(name, time)
    );
    fallbackList.push({
      timestamp: time.toISOString(),
      stations,
    });
  }

  return fallbackList;
}
