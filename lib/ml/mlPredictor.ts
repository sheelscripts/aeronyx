export interface PredictionResult {
  source: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface ForecastItem {
  hour_offset: number;
  timestamp: string;
  predicted_aqi: number;
  category: string;
  color: string;
}

export interface AnomalyResult {
  is_anomaly: boolean;
  anomaly_score: number;
}

// Replicates _rule_based_source from predictor.py
export function detectSourceLocal(
  pm25: number,
  co: number,
  no2: number,
  tvoc: number
): PredictionResult {
  const pm25_co = pm25 / Math.max(co, 0.01);
  const tvoc_no2 = tvoc / Math.max(no2, 0.001);

  const scores: Record<string, number> = {
    vehicle: 0.0,
    industrial: 0.0,
    construction: 0.0,
    biomass: 0.0,
    mixed: 0.05, // base default
  };

  // Vehicle indicators: high pm25/co ratio, moderate no2
  if (pm25_co > 30 && no2 > 0.08) {
    scores.vehicle += 0.45;
  }
  if (pm25_co > 20) {
    scores.vehicle += 0.15;
  }
  if (co > 2.0 && co <= 5.0) {
    scores.vehicle += 0.1;
  }

  // Industrial indicators: high no2 + co
  if (no2 > 0.15 && co > 4.0) {
    scores.industrial += 0.45;
  }
  if (no2 > 0.1) {
    scores.industrial += 0.15;
  }
  if (tvoc > 0.5 && no2 > 0.12) {
    scores.industrial += 0.1;
  }

  // Biomass indicators: high co + tvoc
  if (co > 5.0 && tvoc > 0.8) {
    scores.biomass += 0.45;
  }
  if (co > 4.0) {
    scores.biomass += 0.1;
  }
  if (tvoc > 0.6) {
    scores.biomass += 0.1;
  }

  // Construction indicators: high tvoc + pm25
  if (tvoc > 1.0 && pm25 > 180) {
    scores.construction += 0.45;
  }
  if (pm25 > 150) {
    scores.construction += 0.1;
  }
  if (tvoc > 0.8) {
    scores.construction += 0.05;
  }

  // Normalize to probabilities
  const total = Object.values(scores).reduce((sum, val) => sum + val, 0) || 1.0;
  const probabilities: Record<string, number> = {};
  for (const [key, val] of Object.entries(scores)) {
    probabilities[key] = Math.round((val / total) * 1000) / 1000;
  }

  // Find top source
  let topSource = "mixed";
  let maxProb = -1;
  for (const [key, val] of Object.entries(probabilities)) {
    if (val > maxProb) {
      maxProb = val;
      topSource = key;
    }
  }

  return {
    source: topSource,
    confidence: maxProb,
    probabilities,
  };
}

// Wrapper matching python detect_source/detect_source_bayesian shape
export function detectSource(
  pm25: number,
  co: number,
  no2: number,
  tvoc: number,
  temperature: number,
  humidity: number,
  hour?: number
): PredictionResult {
  return detectSourceLocal(pm25, co, no2, tvoc);
}

// AQI category helper matching CPCB standards
export function getAqiCategoryAndColor(aqi: number): { category: string; color: string } {
  if (aqi <= 50) return { category: "Good", color: "#22c55e" };
  if (aqi <= 100) return { category: "Satisfactory", color: "#84cc16" };
  if (aqi <= 200) return { category: "Moderate", color: "#b45309" };
  if (aqi <= 300) return { category: "Poor", color: "#f97316" };
  if (aqi <= 400) return { category: "Very Poor", color: "#ef4444" };
  return { category: "Severe", color: "#991b1b" };
}

// Replicates the rule-based diurnal forecast from predictor.py
export function forecastAqi(
  currentReading: { aqi?: number; [key: string]: any },
  horizonHours = 24
): ForecastItem[] {
  const currentAqi = currentReading.aqi || 100;
  const now = new Date();
  const currentHour = now.getUTCHours() + now.getUTCMinutes() / 60.0;

  const forecasts: ForecastItem[] = [];

  // Deterministic noise helper based on string hash
  const getHashNoise = (offset: number) => {
    const key = `offset_${offset}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = key.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (Math.abs(hash) % 20) - 10; // -10 to +10
  };

  const currentTraffic =
    0.4 +
    0.6 *
      (Math.exp(-Math.pow(currentHour - 8, 2) / 8) +
        Math.exp(-Math.pow(currentHour - 18, 2) / 8));

  for (let h = 1; h <= horizonHours; h++) {
    const futureHour = (currentHour + h) % 24;
    const morning = Math.exp(-Math.pow(futureHour - 8, 2) / 8);
    const evening = Math.exp(-Math.pow(futureHour - 18, 2) / 8);
    const traffic = 0.4 + 0.6 * (morning + evening);

    const ratio = traffic / Math.max(0.4, currentTraffic);
    const noise = getHashNoise(h);
    const predAqi = Math.round(Math.max(20, Math.min(500, currentAqi * ratio + noise)));

    const { category, color } = getAqiCategoryAndColor(predAqi);

    const futureTime = new Date(now.getTime());
    futureTime.setUTCMinutes(0);
    futureTime.setUTCSeconds(0);
    futureTime.setUTCMilliseconds(0);
    futureTime.setUTCHours(futureTime.getUTCHours() + h);

    forecasts.push({
      hour_offset: h,
      timestamp: futureTime.toISOString(),
      predicted_aqi: predAqi,
      category,
      color,
    });
  }

  return forecasts;
}

// Rule-based anomaly detector matching Isolation Forest logic
export function detectAnomaly(
  pm25: number,
  co: number,
  no2: number,
  tvoc: number,
  temperature: number,
  humidity: number
): AnomalyResult {
  // Simple check for values exceeding extreme bounds
  let score = 0.0;
  let is_anomaly = false;

  // Build an anomaly score based on deviation from normal Delhi boundaries
  if (pm25 > 350 || pm25 < 5) score += 0.35;
  if (co > 10.0 || co < 0.1) score += 0.25;
  if (no2 > 0.35) score += 0.2;
  if (tvoc > 2.5) score += 0.2;
  if (temperature > 48 || temperature < 5) score += 0.15;
  if (humidity > 98 || humidity < 10) score += 0.15;

  if (score >= 0.4) {
    is_anomaly = true;
  }

  return {
    is_anomaly,
    anomaly_score: Math.round(score * 1000) / 1000,
  };
}
