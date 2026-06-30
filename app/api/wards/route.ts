import { NextRequest, NextResponse } from "next/server";
import { WARD_META, ZONE_DEFS } from "../../../lib/weather/wardsData";
import { getLiveZoneAqi } from "../../../lib/weather/aqiLiveService";
import { calculateAqi, getAqiCategory } from "../../../lib/ml/aqiCalc";
import { interpolateWind, getUpwindWards } from "../../../lib/weather/windService";
import { computeBayesianAttribution, aggregateZoneAttribution } from "../../../lib/attribution/engine";
import { fetchLatestFromThingSpeak } from "../../../lib/thingspeak/fetch";
import { fetchLatestFromWaqi, fetchWaqiStationsInBounds, WaqiStationBound } from "../../../lib/waqi/fetch";

// Deterministic noise helper based on string hash
function getGaussianNoise(mean = 0, std = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);
  return mean + std * randStdNormal;
}

function stableWardSeed(wardId: string): number {
  let acc = 0;
  for (let i = 0; i < wardId.length; i++) {
    acc += (i + 1) * wardId.charCodeAt(i);
  }
  return (acc % 1000) / 1000.0;
}

const POLLUTION_PROFILES: Record<
  string,
  { pm25_base: number; co_base: number; no2_base: number; tvoc_base: number; so2_base: number; source: string | null }
> = {
  clean: { pm25_base: 32, co_base: 0.9, no2_base: 0.02, tvoc_base: 0.2, so2_base: 0.006, source: null },
  vehicle: { pm25_base: 58, co_base: 1.8, no2_base: 0.045, tvoc_base: 0.35, so2_base: 0.01, source: "vehicle" },
  industrial: { pm25_base: 82, co_base: 2.6, no2_base: 0.07, tvoc_base: 0.7, so2_base: 0.02, source: "industrial" },
  construction: { pm25_base: 90, co_base: 1.6, no2_base: 0.04, tvoc_base: 0.85, so2_base: 0.01, source: "construction" },
  biomass: { pm25_base: 74, co_base: 3.0, no2_base: 0.05, tvoc_base: 0.75, so2_base: 0.013, source: "biomass" },
  mixed: { pm25_base: 62, co_base: 1.7, no2_base: 0.04, tvoc_base: 0.45, so2_base: 0.01, source: "vehicle" },
};

async function generateWardReading(ward: any, zoneLive?: any, anchorReading?: any): Promise<any> {
  const now = new Date();
  const hour = now.getUTCHours() + now.getUTCMinutes() / 60.0;

  const morningPeak = Math.exp(-Math.pow(hour - 8, 2) / 8);
  const eveningPeak = Math.exp(-Math.pow(hour - 18, 2) / 8);
  const trafficFactor = 0.4 + 0.6 * (morningPeak + eveningPeak);

  const prof = POLLUTION_PROFILES[ward.profile] || POLLUTION_PROFILES["mixed"];

  const widHash = stableWardSeed(ward.ward_id);
  const wardVar = ward.feature_type === "zone" ? 1.0 : 0.72 + 0.56 * widHash;

  let spatialVar = 1.0 + 0.05 * Math.sin(ward.lat * 36.0) + 0.03 * Math.cos(ward.lng * 33.0);
  spatialVar = Math.max(0.92, Math.min(1.08, spatialVar));
  if (ward.feature_type === "zone") {
    spatialVar = 1.0;
  }

  let pm25, co, no2, tvoc, so2;
  let temperature, humidity;
  let wind_speed = 0, wind_direction = 0;

  if (anchorReading && anchorReading.status !== "offline") {
    // Spatial variation multipliers based on ward profile (damped to prevent excessive divergence)
    let profileMultiplier = 1.0;
    if (ward.profile === "clean") profileMultiplier = 0.85;
    else if (ward.profile === "industrial") profileMultiplier = 1.15;
    else if (ward.profile === "construction") profileMultiplier = 1.12;
    else if (ward.profile === "biomass") profileMultiplier = 1.08;
    else if (ward.profile === "vehicle") profileMultiplier = 1.05;

    // Apply stable ward variation and profile multiplier to the anchor values (capped at 1.5)
    const localScale = Math.min(1.5, (0.92 + 0.16 * widHash) * spatialVar * profileMultiplier);

    pm25 = Math.max(5, anchorReading.pm25 * localScale + getGaussianNoise(0, 3.5));
    co = Math.max(0.1, anchorReading.co * localScale + getGaussianNoise(0, 0.08));
    no2 = Math.max(0.005, anchorReading.no2 * localScale + getGaussianNoise(0, 0.004));
    tvoc = Math.max(0.01, anchorReading.tvoc * localScale + getGaussianNoise(0, 0.04));
    
    const anchorSo2 = anchorReading.so2 || 0.01;
    so2 = Math.max(0.001, anchorSo2 * localScale + getGaussianNoise(0, 0.0015));

    temperature = anchorReading.temperature + getGaussianNoise(0, 0.6);
    humidity = Math.max(10, Math.min(100, anchorReading.humidity + getGaussianNoise(0, 1.8)));

    const wind = await interpolateWind(ward.lat, ward.lng);
    wind_speed = wind.wind_speed || 0;
    wind_direction = wind.wind_direction || 0;
  } else {
    // Fallback: original simulation logic
    pm25 = Math.max(5, prof.pm25_base * trafficFactor * wardVar * spatialVar + getGaussianNoise(0, 9));
    co = Math.max(0.1, prof.co_base * trafficFactor * wardVar * spatialVar + getGaussianNoise(0, 0.25));
    no2 = Math.max(0.005, prof.no2_base * trafficFactor * wardVar * spatialVar + getGaussianNoise(0, 0.009));
    tvoc = Math.max(0.01, prof.tvoc_base * trafficFactor * wardVar * spatialVar + getGaussianNoise(0, 0.06));
    so2 = Math.max(0.001, prof.so2_base * trafficFactor * wardVar * spatialVar + getGaussianNoise(0, 0.0035));

    let liveAqi: number | null = null;
    if (zoneLive) {
      if (zoneLive.pm25 !== null && zoneLive.pm25 !== undefined) {
        let localPmScale = 0.92 + 0.16 * widHash + 0.04 * (spatialVar - 1.0);
        localPmScale = Math.max(0.88, Math.min(1.08, localPmScale));
        pm25 = Math.max(5, zoneLive.pm25 * localPmScale + getGaussianNoise(0, 2.5));
        const pmOnlyLiveAqi = calculateAqi(zoneLive.pm25, 0.0, 0.0);
        liveAqi = pmOnlyLiveAqi;
      }
      if (zoneLive.us_aqi !== null && zoneLive.us_aqi !== undefined && liveAqi !== null) {
        const candidateLiveAqi = zoneLive.us_aqi;
        if (candidateLiveAqi >= 0 && candidateLiveAqi <= 350 && Math.abs(candidateLiveAqi - liveAqi) <= 80) {
          liveAqi = Math.round(0.7 * liveAqi + 0.3 * candidateLiveAqi);
        }
      }
      let pmScale = pm25 / Math.max(prof.pm25_base * trafficFactor, 1.0);
      pmScale = Math.max(0.7, Math.min(1.6, pmScale));
      co = Math.max(0.1, prof.co_base * trafficFactor * wardVar * pmScale + getGaussianNoise(0, 0.15));
      no2 = Math.max(0.005, prof.no2_base * trafficFactor * wardVar * pmScale + getGaussianNoise(0, 0.006));
      tvoc = Math.max(0.01, prof.tvoc_base * trafficFactor * wardVar * pmScale + getGaussianNoise(0, 0.04));
      so2 = Math.max(0.001, prof.so2_base * trafficFactor * wardVar * pmScale + getGaussianNoise(0, 0.0025));
    }

    temperature = 28.0 + 5 * Math.sin(((hour - 14) * Math.PI) / 12) + getGaussianNoise(0, 1.2);
    humidity = 55.0 - 15 * Math.sin(((hour - 14) * Math.PI) / 12) + getGaussianNoise(0, 2.5);

    const wind = await interpolateWind(ward.lat, ward.lng);
    wind_speed = wind.wind_speed || 0;
    wind_direction = wind.wind_direction || 0;
  }

  const rawAqi = calculateAqi(pm25, co, no2);
  // Cap the fallback AQI at 170 to prevent unrealistic spikes in the fallback simulation
  const maxAqi = anchorReading ? 450 : 170;
  const aqi = Math.max(0, Math.min(maxAqi, rawAqi));
  const cat = getAqiCategory(aqi);

  return {
    ward_id: ward.ward_id,
    name: ward.name,
    zone: ward.zone,
    lat: ward.lat,
    lng: ward.lng,
    feature_type: ward.feature_type,
    timestamp: now.toISOString(),
    temperature: Math.round(Math.max(15, Math.min(45, temperature)) * 10) / 10,
    humidity: Math.round(Math.max(20, Math.min(95, humidity)) * 10) / 10,
    pm25: Math.round(pm25 * 10) / 10,
    co: Math.round(co * 100) / 100,
    no2: Math.round(no2 * 1000) / 1000,
    tvoc: Math.round(tvoc * 100) / 100,
    so2: Math.round(so2 * 1000) / 1000,
    wind_speed: Math.round(wind_speed * 100) / 100,
    wind_direction: Math.round(wind_direction * 10) / 10,
    aqi,
    aqi_category: cat.category,
    aqi_color: cat.color,
    aqi_source: anchorReading ? (anchorReading.so2 !== undefined ? "waqi-api" : "thingspeak") : "open-meteo",
    source_detected: prof.source,
    source_confidence: prof.source ? Math.round((0.65 + Math.random() * 0.3) * 100) / 100 : null,
  };
}

function toLegacySource(attrSrc: string): string {
  if (attrSrc === "vehicular") return "vehicle";
  if (["industrial", "biomass", "construction"].includes(attrSrc)) return attrSrc;
  return "mixed";
}

// Simple server-side cache for zone readings to prevent API rate limits
interface CachedZoneReading {
  timestamp: number;
  reading: any;
}
const zoneReadingsCache: Record<string, CachedZoneReading> = {};
const CACHE_EXPIRY_MS = 6 * 60 * 1000; // Cache for 6 minutes (WAQI only updates hourly anyway)

async function getZoneAnchorReading(zoneName: string, lat: number, lng: number, token?: string): Promise<any> {
  const cacheKey = `${zoneName}_${lat}_${lng}`;
  const now = Date.now();
  if (zoneReadingsCache[cacheKey] && (now - zoneReadingsCache[cacheKey].timestamp < CACHE_EXPIRY_MS)) {
    return zoneReadingsCache[cacheKey].reading;
  }

  try {
    const reading = await fetchLatestFromWaqi(token, lat, lng);
    if (reading) {
      zoneReadingsCache[cacheKey] = {
        timestamp: now,
        reading
      };
      return reading;
    }
  } catch (e) {
    console.error(`Failed to fetch zone WAQI for ${zoneName}:`, e);
  }

  if (zoneReadingsCache[cacheKey]) {
    return zoneReadingsCache[cacheKey].reading;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") || "real_api";
    const waqiToken = searchParams.get("waqi_token") || undefined;
    const thingspeakChannel = searchParams.get("thingspeak_channel") || undefined;
    const thingspeakKey = searchParams.get("thingspeak_key") || undefined;

    // 1. Fetch central baseline anchor in Delhi
    const centralAnchor = await fetchLatestFromWaqi(waqiToken, ZONE_DEFS["Central"].lat, ZONE_DEFS["Central"].lng);
    
    // 2. Fetch all station feeds in Delhi bounds (1 single optimized API query to avoid rate limits)
    const stations = await fetchWaqiStationsInBounds(waqiToken);

    // If source is hardware, fetch the central hardware baseline
    let hardwareAnchor = null;
    if (source === "hardware") {
      hardwareAnchor = await fetchLatestFromThingSpeak(thingspeakChannel, thingspeakKey);
    }

    const zoneAnchors: Record<string, any> = {};
    const zoneNames = Object.keys(ZONE_DEFS);

    for (const zoneName of zoneNames) {
      const def = ZONE_DEFS[zoneName];
      let zoneReading = null;

      if (centralAnchor) {
        // Find geographically nearest station to this zone's coordinates
        let nearestStation: WaqiStationBound | null = null;
        let minDist = Infinity;
        for (const s of stations) {
          const dist = Math.sqrt(Math.pow(s.lat - def.lat, 2) + Math.pow(s.lon - def.lng, 2));
          if (dist < minDist) {
            minDist = dist;
            nearestStation = s;
          }
        }

        // If a nearby station is found within 15km / 0.15 degrees
        if (nearestStation && minDist < 0.15) {
          const centralAqi = centralAnchor.aqi || 100;
          // Scale relative to central anchor AQI
          const relativeScale = Math.min(1.5, Math.max(0.6, nearestStation.aqi / centralAqi));
          
          zoneReading = {
            ...centralAnchor,
            pm25: Math.max(5, centralAnchor.pm25 * relativeScale),
            co: Math.max(0.1, centralAnchor.co * relativeScale),
            no2: Math.max(0.005, centralAnchor.no2 * relativeScale),
            tvoc: Math.max(0.01, centralAnchor.tvoc * relativeScale),
            temperature: centralAnchor.temperature,
            humidity: centralAnchor.humidity,
            aqi: nearestStation.aqi,
          };
        } else {
          // Fall back to zoning profile scale relative to central anchor
          let profileMultiplier = 1.0;
          if (def.profile === "clean") profileMultiplier = 0.85;
          else if (def.profile === "industrial") profileMultiplier = 1.15;
          else if (def.profile === "construction") profileMultiplier = 1.12;
          else if (def.profile === "biomass") profileMultiplier = 1.08;
          else if (def.profile === "vehicle") profileMultiplier = 1.05;

          const scale = profileMultiplier;
          zoneReading = {
            ...centralAnchor,
            pm25: Math.max(5, centralAnchor.pm25 * scale),
            co: Math.max(0.1, centralAnchor.co * scale),
            no2: Math.max(0.005, centralAnchor.no2 * scale),
            tvoc: Math.max(0.01, centralAnchor.tvoc * scale),
            temperature: centralAnchor.temperature,
            humidity: centralAnchor.humidity,
            aqi: centralAnchor.aqi,
          };
        }
      }

      // If hardware mode is active, override with scaled hardware reading
      if (source === "hardware" && hardwareAnchor) {
        const centralAqi = centralAnchor ? centralAnchor.aqi || 100 : 100;
        const zoneAqi = zoneReading ? zoneReading.aqi || 100 : 100;
        const relativeScale = Math.min(1.5, Math.max(0.6, zoneAqi / centralAqi));
        
        zoneReading = {
          ...hardwareAnchor,
          pm25: Math.max(5, hardwareAnchor.pm25 * relativeScale),
          co: Math.max(0.1, hardwareAnchor.co * relativeScale),
          no2: Math.max(0.005, hardwareAnchor.no2 * relativeScale),
          tvoc: Math.max(0.01, hardwareAnchor.tvoc * relativeScale),
          temperature: hardwareAnchor.temperature,
          humidity: hardwareAnchor.humidity,
        };
      }
      
      zoneAnchors[zoneName] = zoneReading;
    }

    const liveZone = await getLiveZoneAqi(ZONE_DEFS);
    const readings = await Promise.all(
      WARD_META.map((w) => {
        const zoneAnchor = zoneAnchors[w.zone] || null;
        return generateWardReading(w, liveZone[w.zone], zoneAnchor);
      })
    );

    const wardReadings = readings.filter((r) => r.feature_type === "ward");
    const wardProfileMap = WARD_META.reduce((acc, w) => {
      acc[w.ward_id] = w.profile;
      return acc;
    }, {} as Record<string, string>);

    // Add upwind wind context and compute attribution for each ward
    for (const r of wardReadings) {
      const upwind = await getUpwindWards(r.lat, r.lng, wardReadings, 7.0);
      const upwindTop: any[] = [];

      for (const u of upwind.slice(0, 3)) {
        const s = wardReadings.find((w) => w.ward_id === u.ward_id);
        if (!s) continue;
        const anglePenalty = Math.max(0.2, 1.0 - parseFloat(u.angle_from_wind) / 90.0);
        upwindTop.push({
          ward_id: u.ward_id,
          name: u.name,
          source_detected: s.source_detected,
          aqi: s.aqi,
          score: Math.round((s.aqi / 500.0) * anglePenalty * 1000) / 1000,
          distance_km: u.distance_km,
        });
      }

      upwindTop.sort((a, b) => b.score - a.score);

      const attribution = computeBayesianAttribution(
        r.ward_id,
        r,
        wardProfileMap[r.ward_id] || "mixed",
        { upwind_sources: upwindTop }
      );

      r.attribution_scores = attribution.scores;
      r.attribution_confidence = attribution.confidence;
      r.source_dominant = toLegacySource(attribution.dominant_source);
      r.wind_exposure = {
        wind_speed: r.wind_speed,
        wind_direction: r.wind_direction,
        upwind_sources: upwindTop,
      };
    }

    // Zone aggregation
    const zones = Array.from(new Set(wardReadings.map((w) => w.zone)));
    const zoneStats: Record<string, any> = {};

    for (const z of zones) {
      const zWards = wardReadings.filter((w) => w.zone === z);
      const attributions = zWards.map((w) => ({
        ward_id: w.ward_id,
        scores: w.attribution_scores,
      }));
      const wardAqis = zWards.reduce((acc, w) => {
        acc[w.ward_id] = w.aqi;
        return acc;
      }, {} as Record<string, number>);

      const agg = aggregateZoneAttribution(attributions, wardAqis);

      zoneStats[z] = {
        dominant_source: toLegacySource(agg.dominant_source),
        scores: agg.scores,
        confidence_score: agg.confidence_score,
      };
    }

    // Inject zone attribution into zone features
    for (const r of readings) {
      if (r.feature_type === "zone") {
        const z = zoneStats[r.zone] || {};
        r.zone_dominant_source = z.dominant_source;
        r.attribution_scores = z.scores;
      }
    }

    return NextResponse.json({
      count: readings.length,
      timestamp: new Date().toISOString(),
      zone_source_summary: zoneStats,
      wards: readings,
    });
  } catch (err) {
    console.error("API wards error:", err);
    return NextResponse.json({ error: "Failed to generate wards data" }, { status: 500 });
  }
}

