import { NextResponse } from "next/server";
import { fetchLatestFromThingSpeak } from "../../../../lib/thingspeak/fetch";
import { detectSource, detectAnomaly, forecastAqi } from "../../../../lib/ml/mlPredictor";

export async function GET() {
  try {
    const reading = await fetchLatestFromThingSpeak();
    if (!reading) {
      return NextResponse.json({
        error: "No live data available",
        source_detection: { source: "vehicle", confidence: 0.5, probabilities: {} },
        anomaly_detection: { is_anomaly: false, anomaly_score: 0.0 },
        forecast_6h: [],
      });
    }

    const now = new Date();
    const hour = now.getUTCHours() + now.getUTCMinutes() / 60.0;

    const source = detectSource(
      reading.pm25,
      reading.co,
      reading.no2,
      reading.tvoc,
      reading.temperature,
      reading.humidity,
      hour
    );

    const anomaly = detectAnomaly(
      reading.pm25,
      reading.co,
      reading.no2,
      reading.tvoc,
      reading.temperature,
      reading.humidity
    );

    const forecasts = forecastAqi(reading, 6);

    return NextResponse.json({
      timestamp: now.toISOString(),
      current_aqi: reading.aqi,
      source_detection: source,
      anomaly_detection: anomaly,
      forecast_6h: forecasts,
    });
  } catch (err: any) {
    console.error("API ML summary error:", err);
    return NextResponse.json({
      error: err?.message || "Internal error",
      source_detection: { source: "vehicle", confidence: 0.5, probabilities: {} },
      anomaly_detection: { is_anomaly: false, anomaly_score: 0.0 },
      forecast_6h: [],
    });
  }
}
