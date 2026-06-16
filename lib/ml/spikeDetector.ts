export const DEFAULT_THRESHOLD = 2.0;

export interface SpikeResult {
  is_spike: boolean;
  z_score: number;
  mean: number;
  std: number;
  severity: string;
  threshold_used: number;
  note?: string;
}

function meanStd(values: number[]): { mean: number; std: number } {
  const n = values.length;
  if (n === 0) {
    return { mean: 0.0, std: 1.0 };
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  return { mean, std: Math.max(Math.sqrt(variance), 0.1) };
}

export function detectSpike(
  currentPm25: number,
  history: number[],
  threshold = DEFAULT_THRESHOLD
): SpikeResult {
  if (history.length < 3) {
    return {
      is_spike: false,
      z_score: 0.0,
      mean: currentPm25,
      std: 1.0,
      severity: "unknown",
      threshold_used: threshold,
      note: "Insufficient history for spike detection",
    };
  }

  const { mean, std } = meanStd(history);
  const z = (currentPm25 - mean) / std;

  const is_spike = z > threshold;

  let severity = "normal";
  if (z <= 1.5) {
    severity = "normal";
  } else if (z <= 2.0) {
    severity = "low";
  } else if (z <= 3.0) {
    severity = "medium";
  } else if (z <= 4.0) {
    severity = "high";
  } else {
    severity = "extreme";
  }

  return {
    is_spike,
    z_score: Math.round(z * 1000) / 1000,
    mean: Math.round(mean * 100) / 100,
    std: Math.round(std * 100) / 100,
    severity,
    threshold_used: threshold,
  };
}

export function detectSpikeFromReadings(
  current: { pm25: number; [key: string]: any },
  historyReadings: Array<{ pm25: number; [key: string]: any }>,
  threshold = DEFAULT_THRESHOLD
): SpikeResult {
  try {
    const currentPm25 = parseFloat(current.pm25 as any) || 0.0;
    const historyPm25 = historyReadings
      .map((r) => parseFloat(r.pm25 as any))
      .filter((v) => !isNaN(v));
    return detectSpike(currentPm25, historyPm25, threshold);
  } catch (err) {
    console.warn("Spike detector value error:", err);
    return {
      is_spike: false,
      z_score: 0.0,
      mean: 0.0,
      std: 1.0,
      severity: "unknown",
      threshold_used: threshold,
      note: "Error processing values for spike detection",
    };
  }
}
