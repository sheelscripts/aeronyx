import { NextRequest, NextResponse } from "next/server";
import { WARD_META, ZONE_DEFS } from "../../../../../lib/weather/wardsData";
import { getLiveZoneAqi } from "../../../../../lib/weather/aqiLiveService";
import { calculateAqi, getAqiCategory } from "../../../../../lib/ml/aqiCalc";
import { interpolateWind } from "../../../../../lib/weather/windService";
import {
  estimateSourceCoordinates,
  estimateStabilityClass,
  gaussianPlumeConcentration,
  findNearestIndustrialSources,
} from "../../../../../lib/weather/atmospheric";
import { detectSpikeFromReadings } from "../../../../../lib/ml/spikeDetector";

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

function generateWardReadingLocal(ward: any, zoneLive?: any): any {
  const hour = new Date().getUTCHours();
  const trafficFactor = 0.4 + 0.6 * (Math.exp(-Math.pow(hour - 8, 2) / 8) + Math.exp(-Math.pow(hour - 18, 2) / 8));
  const prof = POLLUTION_PROFILES[ward.profile] || POLLUTION_PROFILES["mixed"];
  const widHash = stableWardSeed(ward.ward_id);
  const wardVar = ward.feature_type === "zone" ? 1.0 : 0.72 + 0.56 * widHash;

  let pm25 = prof.pm25_base * trafficFactor * wardVar;
  if (zoneLive && zoneLive.pm25 !== null && zoneLive.pm25 !== undefined) {
    pm25 = zoneLive.pm25 * (0.92 + 0.16 * widHash);
  }

  const aqi = calculateAqi(pm25, 0.0, 0.0);
  return {
    ward_id: ward.ward_id,
    name: ward.name,
    zone: ward.zone,
    pm25: Math.round(pm25 * 10) / 10,
    aqi,
  };
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const wardId = params.id;
  const ward = WARD_META.find((w) => w.ward_id === wardId);

  if (!ward) {
    return NextResponse.json({ error: "Ward not found" }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const transportParam = searchParams.get("transport_hours");
    const transportHours = transportParam ? parseFloat(transportParam) || 1.0 : 1.0;
    const topSourcesParam = searchParams.get("top_sources");
    const topSources = topSourcesParam ? parseInt(topSourcesParam, 10) || 3 : 3;

    const liveZone = await getLiveZoneAqi(ZONE_DEFS);
    const current = generateWardReadingLocal(ward, liveZone[ward.zone]);

    // Baseline population from neighboring wards
    const nearby = WARD_META.filter((w) => w.feature_type === "ward" && w.ward_id !== wardId)
      .slice(0, 48)
      .map((w) => generateWardReadingLocal(w, liveZone[w.zone]));

    const spikeInfo = detectSpikeFromReadings(current, nearby);

    const wind = await interpolateWind(ward.lat, ward.lng);
    const windSpeed = wind.wind_speed || 2.0;
    const windDirection = wind.wind_direction || 315.0;

    // Estimate coordinates of the source (backward wind vector)
    const sourceCoords = estimateSourceCoordinates(
      ward.lat,
      ward.lng,
      windDirection,
      windSpeed,
      transportHours
    );

    // Fetch nearest industrial cells from Zenodo data
    const industrialMatches = findNearestIndustrialSources(
      sourceCoords.source_lat,
      sourceCoords.source_lon,
      topSources
    );

    // Gaussian Plume calculation per source
    const hour = new Date().getHours();
    const stability = estimateStabilityClass(windSpeed, hour);
    const enrichedSources = industrialMatches.map((src: any) => {
      const distKm = src.distance_m / 1000.0;
      // Convert tons/day to ug/s (1 ton/day ≈ 11.57 g/s = 11,574,074 ug/s)
      const Q = (src.pm25_emission * 1000000) / 86400;
      const conc = gaussianPlumeConcentration(
        Q,
        Math.max(distKm, 0.05),
        0.0, // directly downwind
        1.5, // breathing height
        30.0, // stack height
        Math.max(windSpeed, 0.5),
        stability
      );
      return {
        ...src,
        stability_class: stability,
        plume_conc_ug_m3: Math.round(conc * 1000000) / 1000000,
      };
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      ward: {
        ward_id: current.ward_id,
        name: ward.name,
        zone: ward.zone,
        aqi: current.aqi,
        pm25: current.pm25,
        lat: ward.lat,
        lng: ward.lng,
      },
      spike: spikeInfo,
      wind,
      estimated_source_location: sourceCoords,
      industrial_source_matches: enrichedSources,
      model_notes: {
        stability_class: stability,
        transport_hours: transportHours,
        emissions_dataset: "Zenodo Delhi Domain 2020 (DelhiDomain_2020.shp)",
        plume_model: "Gaussian Pasquill-Gifford",
      },
    });
  } catch (err) {
    console.error(`API industrial source match error for ${wardId}:`, err);
    return NextResponse.json({ error: "Failed to resolve industrial matches" }, { status: 500 });
  }
}
