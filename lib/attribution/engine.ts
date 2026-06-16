export const SOURCES = ["vehicular", "industrial", "biomass", "construction", "dust", "regional"];

export const ZONE_PRIORS: Record<string, Record<string, number>> = {
  vehicle: { vehicular: 0.34, industrial: 0.12, biomass: 0.1, construction: 0.18, dust: 0.16, regional: 0.1 },
  industrial: { vehicular: 0.16, industrial: 0.38, biomass: 0.08, construction: 0.12, dust: 0.1, regional: 0.16 },
  construction: { vehicular: 0.12, industrial: 0.1, biomass: 0.06, construction: 0.4, dust: 0.22, regional: 0.1 },
  biomass: { vehicular: 0.12, industrial: 0.1, biomass: 0.38, construction: 0.1, dust: 0.12, regional: 0.18 },
  mixed: { vehicular: 0.2, industrial: 0.2, biomass: 0.14, construction: 0.18, dust: 0.14, regional: 0.14 },
  clean: { vehicular: 0.12, industrial: 0.08, biomass: 0.08, construction: 0.1, dust: 0.1, regional: 0.52 },
};

function normalize(scores: Record<string, number>): Record<string, number> {
  const total = Object.values(scores).reduce((sum, v) => sum + Math.max(0.0, v), 0);
  if (total <= 0) {
    const defaultVal = Math.round((1.0 / Object.keys(scores).length) * 1000) / 1000;
    const res: Record<string, number> = {};
    for (const k of Object.keys(scores)) res[k] = defaultVal;
    return res;
  }
  const normalized: Record<string, number> = {};
  for (const [k, v] of Object.entries(scores)) {
    normalized[k] = Math.round((Math.max(0.0, v) / total) * 1000) / 1000;
  }
  return normalized;
}

function getHourlyPattern(hour: number): Record<string, number> {
  const veh_peak = hour >= 7 && hour <= 11 || hour >= 17 && hour <= 22 ? 1.0 : 0.6;
  const industrial_flat = 0.8;
  const biomass_evening = hour >= 18 && hour <= 23 || hour >= 4 && hour <= 7 ? 1.0 : 0.6;
  const construction_day = hour >= 9 && hour <= 18 ? 1.0 : 0.4;
  const dust_day = hour >= 10 && hour <= 17 ? 0.9 : 0.6;
  const regional_flat = 0.7;

  return {
    vehicular: veh_peak,
    industrial: industrial_flat,
    biomass: biomass_evening,
    construction: construction_day,
    dust: dust_day,
    regional: regional_flat,
  };
}

function getFingerprintLikelihood(reading: Record<string, any>): Record<string, number> {
  const pm25 = parseFloat(reading.pm25) || 0.0;
  const co = parseFloat(reading.co) || 0.0;
  const no2 = parseFloat(reading.no2) || 0.0;
  const tvoc = parseFloat(reading.tvoc) || 0.0;
  const so2 = parseFloat(reading.so2) || 0.0;

  const pm_co = pm25 / Math.max(co, 0.01);
  const tvoc_no2 = tvoc / Math.max(no2, 0.001);

  const score: Record<string, number> = {};
  for (const s of SOURCES) score[s] = 0.08;

  if (pm_co > 28 && no2 > 0.08) {
    score.vehicular += 0.42;
  }
  if (co >= 2.0 && co <= 6.0) {
    score.vehicular += 0.1;
  }

  if (no2 > 0.14 && co > 4.0) {
    score.industrial += 0.36;
  }
  if (so2 > 0.06) {
    score.industrial += 0.18;
  }

  if (co > 5.0 && tvoc > 0.75) {
    score.biomass += 0.4;
  }
  if (tvoc_no2 > 8) {
    score.biomass += 0.08;
  }

  if (pm25 > 180 && co < 3.5) {
    score.construction += 0.33;
  }
  if (tvoc > 0.9) {
    score.construction += 0.08;
  }

  if (pm25 > 220 && no2 < 0.07) {
    score.dust += 0.33;
  }

  if (pm25 > 120) {
    score.regional += 0.12;
  }

  return normalize(score);
}

function applyPriors(
  likelihood: Record<string, number>,
  zoneProfile: string,
  hour: number,
  windContext?: any
): Record<string, number> {
  const prior = ZONE_PRIORS[zoneProfile] || ZONE_PRIORS["mixed"];
  const temporal = getHourlyPattern(hour);

  const fused: Record<string, number> = {};
  for (const s of SOURCES) {
    const lVal = likelihood[s] ?? 0.0;
    const pVal = prior[s] ?? 0.1;
    const tVal = temporal[s] ?? 0.7;
    fused[s] = Math.max(0.0001, lVal * pVal * tVal);
  }

  if (windContext) {
    const upwind = windContext.upwind_sources || [];
    if (upwind.length > 0) {
      const srcBoost: Record<string, number> = {};
      for (const item of upwind) {
        const src = item.source_detected;
        const score = parseFloat(item.score) || 0.0;
        if (!src) continue;
        const mapped = src === "vehicle" ? "vehicular" : src;
        if (!SOURCES.includes(mapped)) continue;
        srcBoost[mapped] = (srcBoost[mapped] || 0.0) + score;
      }
      for (const [s, v] of Object.entries(srcBoost)) {
        fused[s] *= 1.0 + Math.min(0.5, v);
      }
    }
  }

  return normalize(fused);
}

export function computeBayesianAttribution(
  wardId: string,
  reading: Record<string, any>,
  zoneProfile = "mixed",
  windContext?: any
): {
  ward_id: string;
  timestamp: string;
  scores: Record<string, number>;
  dominant_source: string;
  confidence: string;
  confidence_score: number;
} {
  const now = new Date();
  const hour = now.getUTCHours() + now.getUTCMinutes() / 60.0;

  const likelihood = getFingerprintLikelihood(reading);
  const posterior = applyPriors(likelihood, zoneProfile, hour, windContext);

  let dominant = "regional";
  let maxScore = -1;
  for (const [k, v] of Object.entries(posterior)) {
    if (v > maxScore) {
      maxScore = v;
      dominant = k;
    }
  }

  const confidence = maxScore >= 0.55 ? "high" : maxScore >= 0.38 ? "medium" : "low";

  return {
    ward_id: wardId,
    timestamp: now.toISOString(),
    scores: posterior,
    dominant_source: dominant,
    confidence,
    confidence_score: Math.round(maxScore * 1000) / 1000,
  };
}

export function aggregateZoneAttribution(
  wardAttributions: any[],
  wardAqis?: Record<string, number>
): {
  scores: Record<string, number>;
  dominant_source: string;
  confidence_score: number;
} {
  const totals: Record<string, number> = {};
  for (const s of SOURCES) totals[s] = 0.0;

  for (const a of wardAttributions) {
    const wardId = a.ward_id;
    const weight = wardAqis?.[wardId] ?? 100.0;
    for (const s of SOURCES) {
      const sVal = parseFloat(a.scores?.[s]) || 0.0;
      totals[s] += weight * sVal;
    }
  }

  const norm = normalize(totals);

  let dominant = "regional";
  let maxScore = -1;
  for (const [k, v] of Object.entries(norm)) {
    if (v > maxScore) {
      maxScore = v;
      dominant = k;
    }
  }

  return {
    scores: norm,
    dominant_source: dominant,
    confidence_score: norm[dominant],
  };
}
