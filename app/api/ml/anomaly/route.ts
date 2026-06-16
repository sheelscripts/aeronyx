import { NextResponse } from "next/server";
import { fetchLatestFromThingSpeak } from "../../../../lib/thingspeak/fetch";
import { detectAnomaly } from "../../../../lib/ml/mlPredictor";

export async function GET() {
  try {
    const reading = await fetchLatestFromThingSpeak();
    if (!reading) {
      return NextResponse.json({ error: "No live data available", is_anomaly: false, anomaly_score: 0.0 });
    }

    const result = detectAnomaly(
      reading.pm25,
      reading.co,
      reading.no2,
      reading.tvoc,
      reading.temperature,
      reading.humidity
    );

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
      reading: {
        pm25: reading.pm25,
        co: reading.co,
        no2: reading.no2,
        tvoc: reading.tvoc,
        temperature: reading.temperature,
        humidity: reading.humidity,
      },
    });
  } catch (err: any) {
    console.error("API ML anomaly error:", err);
    return NextResponse.json({ is_anomaly: false, anomaly_score: 0.0, error: err?.message || "Internal error" });
  }
}
