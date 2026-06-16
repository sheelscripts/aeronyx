import fs from "fs";
import path from "path";
import { interpolateWind, haversine } from "./windService";

// Pasquill stability parameters for σy = a * x^b, σz = a * x^b (x in meters)
export const STABILITY_PARAMS: Record<
  string,
  { sy_a: number; sy_b: number; sz_a: number; sz_b: number; label: string }
> = {
  A: { sy_a: 0.22, sy_b: 0.94, sz_a: 0.2, sz_b: 1.0, label: "Very Unstable" },
  B: { sy_a: 0.16, sy_b: 0.92, sz_a: 0.12, sz_b: 0.95, label: "Unstable" },
  C: { sy_a: 0.11, sy_b: 0.91, sz_a: 0.08, sz_b: 0.85, label: "Slightly Unstable" },
  D: { sy_a: 0.08, sy_b: 0.89, sz_a: 0.06, sz_b: 0.8, label: "Neutral" },
  E: { sy_a: 0.06, sy_b: 0.86, sz_a: 0.03, sz_b: 0.75, label: "Slightly Stable" },
  F: { sy_a: 0.04, sy_b: 0.83, sz_a: 0.016, sz_b: 0.7, label: "Stable" },
};

// Interface for industrial emission grid cells
export interface IndustrialSource {
  lat: number;
  lon: number;
  pm25_emission: number;
  pm10_emission: number;
  nox_emission: number;
  so2_emission: number;
  co_emission: number;
  voc_emission: number;
  distance_m?: number;
}

let _industrialSourcesCache: IndustrialSource[] | null = null;

function loadIndustrialSources(): IndustrialSource[] {
  if (_industrialSourcesCache !== null) {
    return _industrialSourcesCache;
  }

  const csvPath = path.join(process.cwd(), "data", "industrial_sources.csv");
  if (!fs.existsSync(csvPath)) {
    console.warn(`Industrial sources CSV not found at ${csvPath}`);
    _industrialSourcesCache = [];
    return [];
  }

  try {
    const csvContent = fs.readFileSync(csvPath, "utf-8");
    const lines = csvContent.split(/\r?\n/);
    const sources: IndustrialSource[] = [];

    // Parse CSV headers: POINT_X,POINT_Y,PM25_INDDD,PM10_INDDD,NOx_INDDD,SO2_INDDD,CO_INDDD,VOC_INDDD
    // Note: POINT_X is lon, POINT_Y is lat
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(",");
      if (cols.length < 8) continue;

      sources.push({
        lon: parseFloat(cols[0]) || 0,
        lat: parseFloat(cols[1]) || 0,
        pm25_emission: parseFloat(cols[2]) || 0,
        pm10_emission: parseFloat(cols[3]) || 0,
        nox_emission: parseFloat(cols[4]) || 0,
        so2_emission: parseFloat(cols[5]) || 0,
        co_emission: parseFloat(cols[6]) || 0,
        voc_emission: parseFloat(cols[7]) || 0,
      });
    }

    _industrialSourcesCache = sources;
    console.log(`Loaded ${sources.length} industrial emission grid cells.`);
    return sources;
  } catch (err) {
    console.error("Error loading industrial sources CSV:", err);
    _industrialSourcesCache = [];
    return [];
  }
}

export function findNearestIndustrialSources(lat: number, lon: number, topN = 3): IndustrialSource[] {
  const sources = loadIndustrialSources();
  if (sources.length === 0) return [];

  const topLimit = Math.min(topN, 10);
  const mapped = sources.map((s) => {
    // Distance in meters
    const distM = haversine(lat, lon, s.lat, s.lon) * 1000.0;
    return { ...s, distance_m: Math.round(distM * 10) / 10 };
  });

  // Sort by distance ascending
  mapped.sort((a, b) => (a.distance_m || 0) - (b.distance_m || 0));
  return mapped.slice(0, topLimit);
}

export function estimateStabilityClass(windSpeed: number, hour: number): string {
  const isDaytime = hour >= 6 && hour <= 18;

  if (isDaytime) {
    if (windSpeed < 2) return "A";
    if (windSpeed < 3) return "B";
    if (windSpeed < 5) return "C";
    return "D";
  } else {
    if (windSpeed < 3) return "F";
    if (windSpeed < 5) return "E";
    return "D";
  }
}

export function gaussianPlumeConcentration(
  Q: number,          // Emission rate (µg/s)
  x: number,          // Downwind distance (km)
  y: number,          // Crosswind distance (km)
  z: number,          // Receptor height (m)
  H: number,          // Effective source height (m)
  windSpeed: number,  // m/s
  stability = "D"
): number {
  if (x <= 0 || windSpeed < 0.1) {
    return 0.0;
  }

  const params = STABILITY_PARAMS[stability] || STABILITY_PARAMS["D"];

  // Dispersion coefficients (convert x from km to meters for the power fit)
  const xMeters = x * 1000.0;
  const sigmaY = params.sy_a * Math.pow(xMeters, params.sy_b);
  const sigmaZ = params.sz_a * Math.pow(xMeters, params.sz_b);

  if (sigmaY < 0.1 || sigmaZ < 0.1) {
    return 0.0;
  }

  // Gaussian plume equation with ground reflection reflection
  const expY = Math.exp(-Math.pow(y * 1000.0, 2) / (2 * sigmaY ** 2));
  const expZ1 = Math.exp(-Math.pow(z - H, 2) / (2 * sigmaZ ** 2));
  const expZ2 = Math.exp(-Math.pow(z + H, 2) / (2 * sigmaZ ** 2));

  const C = (Q / (2 * Math.PI * windSpeed * sigmaY * sigmaZ)) * expY * (expZ1 + expZ2);

  return Math.max(0.0, C);
}

export async function computeBackwardTrajectory(
  startLat: number,
  startLon: number,
  hours = 3.0,
  dtMinutes = 10.0
): Promise<any[]> {
  const trajectory: any[] = [];
  let lat = startLat;
  let lon = startLon;
  const now = new Date();
  const totalSteps = Math.floor((hours * 60) / dtMinutes);

  for (let step = 0; step <= totalSteps; step++) {
    const time = new Date(now.getTime() - step * dtMinutes * 60 * 1000);
    const wind = await interpolateWind(lat, lon);

    trajectory.push({
      lat: Math.round(lat * 1000000) / 1000000,
      lon: Math.round(lon * 1000000) / 1000000,
      time: time.toISOString(),
      step,
      minutes_back: Math.round(step * dtMinutes * 10) / 10,
      wind_speed: wind.wind_speed,
      wind_direction: wind.wind_direction,
    });

    if (step < totalSteps) {
      // Step backward: reverse the wind direction vector
      const backDirRad = (((wind.wind_direction + 180) % 360) * Math.PI) / 180;
      const speed = wind.wind_speed;
      const dtSeconds = dtMinutes * 60;

      // Displacement in meters
      const dx = speed * dtSeconds * Math.sin(backDirRad);
      const dy = speed * dtSeconds * Math.cos(backDirRad);

      // Convert displacement to lat/lon degrees (approximation)
      lat += dy / 111320.0;
      lon += dx / (111320.0 * Math.cos((lat * Math.PI) / 180));
    }
  }

  return trajectory;
}

export function computeWardFlowChain(zoneWards: any[], windDirection: number): any[] {
  if (!zoneWards || zoneWards.length === 0) return [];

  // Center of zone wards
  const centerLat = zoneWards.reduce((sum, w) => sum + (w.lat || w.latitude), 0) / zoneWards.length;
  const centerLng =
    zoneWards.reduce((sum, w) => sum + (w.lng || w.longitude || w.lon || 0), 0) / zoneWards.length;

  const results = zoneWards.map((ward) => {
    const wLat = ward.lat || ward.latitude;
    const wLng = ward.lng || ward.longitude || ward.lon || 0;

    // Vector from center to ward in approximate meters
    const dlat = (wLat - centerLat) * 111320;
    const dlng = (wLng - centerLng) * 111320 * Math.cos((centerLat * Math.PI) / 180);

    // Project onto downwind flow direction (direction wind blows TO)
    const flowToRad = (((windDirection + 180) % 360) * Math.PI) / 180;
    const projection = dlat * Math.cos(flowToRad) + dlng * Math.sin(flowToRad);

    return {
      ward_id: ward.ward_id || ward.id,
      name: ward.name || "",
      lat: wLat,
      lng: wLng,
      wind_axis_position_m: Math.round(projection * 10) / 10,
      position_label:
        projection > 100 ? "downwind" : projection < -100 ? "upwind" : "crosswind",
    };
  });

  // Sort from most upwind (lowest position meters) to most downwind
  results.sort((a, b) => a.wind_axis_position_m - b.wind_axis_position_m);
  return results.map((w, idx) => ({ ...w, flow_order: idx + 1 }));
}

export function estimateTransportContribution(
  sourceWard: { lat: number; lng?: number; lon?: number; pm25: number },
  receptorWard: { lat: number; lng?: number; lon?: number },
  windSpeed: number,
  windDirection: number,
  sourcePm25: number
): any {
  const srcLat = sourceWard.lat;
  const srcLng = sourceWard.lng || sourceWard.lon || 0;
  const recLat = receptorWard.lat;
  const recLng = receptorWard.lng || receptorWard.lon || 0;

  const distKm = haversine(srcLat, srcLng, recLat, recLng);
  if (distKm < 0.05) {
    return { contribution_pct: 0, travel_time_min: 0 };
  }

  // Bearing from source to receptor
  const dlat = ((recLat - srcLat) * Math.PI) / 180;
  const dlon = ((recLng - srcLng) * Math.PI) / 180;
  const y = Math.sin(dlon) * Math.cos((recLat * Math.PI) / 180);
  const x =
    Math.cos((srcLat * Math.PI) / 180) * Math.sin((recLat * Math.PI) / 180) -
    Math.sin((srcLat * Math.PI) / 180) * Math.cos((recLat * Math.PI) / 180) * Math.cos(dlon);
  
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

  // Downwind direction (direction wind blows TO)
  const downwindDir = (windDirection + 180) % 360;
  let angleDiff = Math.abs(bearing - downwindDir);
  if (angleDiff > 180) {
    angleDiff = 360 - angleDiff;
  }

  if (angleDiff > 60) {
    return {
      contribution_pct: 0,
      travel_time_min: 0,
      is_downwind: false,
      angle_offset: Math.round(angleDiff * 10) / 10,
    };
  }

  const downwindKm = distKm * Math.cos((angleDiff * Math.PI) / 180);
  const crosswindKm = distKm * Math.sin((angleDiff * Math.PI) / 180);

  const hour = new Date().getHours();
  const stability = estimateStabilityClass(windSpeed, hour);

  // Approximate emission rate
  const Q = sourcePm25 * 100;

  const concentration = gaussianPlumeConcentration(
    Q,
    downwindKm,
    crosswindKm,
    2.0,
    10.0,
    Math.max(0.5, windSpeed),
    stability
  );

  const contributionPct = Math.min(100, (concentration / Math.max(1, sourcePm25)) * 100);
  const travelTime = (distKm * 1000) / Math.max(0.5, windSpeed) / 60; // minutes

  return {
    contribution_pct: Math.round(contributionPct * 100) / 100,
    travel_time_min: Math.round(travelTime * 10) / 10,
    distance_km: Math.round(distKm * 100) / 100,
    is_downwind: true,
    angle_offset: Math.round(angleDiff * 10) / 10,
    stability_class: stability,
    plume_concentration: Math.round(concentration * 10000) / 10000,
  };
}

export function estimateSourceCoordinates(
  lat: number,
  lon: number,
  windDirection: number,
  windSpeed: number,
  transportHours = 1.0
): {
  source_lat: number;
  source_lon: number;
  travel_distance_km: number;
  transport_hours: number;
  wind_direction: number;
  wind_speed: number;
} {
  // Travel distance = speed (m/s) × time (s) → km
  const travelDistanceKm = (windSpeed * transportHours * 3600) / 1000.0;

  // Wind blows FROM windDirection. Project backward to find upwind source
  const rad = (windDirection * Math.PI) / 180;
  const dlat = (travelDistanceKm * Math.cos(rad)) / 111.0;
  const dlon = (travelDistanceKm * Math.sin(rad)) / (111.0 * Math.cos((lat * Math.PI) / 180));

  return {
    source_lat: Math.round((lat + dlat) * 1000000) / 1000000,
    source_lon: Math.round((lon + dlon) * 1000000) / 1000000,
    travel_distance_km: Math.round(travelDistanceKm * 100) / 100,
    transport_hours: transportHours,
    wind_direction: Math.round(windDirection * 10) / 10,
    wind_speed: Math.round(windSpeed * 100) / 100,
  };
}
