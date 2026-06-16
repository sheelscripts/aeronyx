import { NextResponse } from "next/server";
import { fetchLatestFromThingSpeak } from "../../../../lib/thingspeak/fetch";
import { detectSource } from "../../../../lib/ml/mlPredictor";

export async function GET() {
  try {
    const reading = await fetchLatestFromThingSpeak();
    if (!reading) {
      return NextResponse.json({
        source: "vehicle",
        confidence: 0.5,
        probabilities: { vehicle: 0.5, industrial: 0.2, biomass: 0.15, construction: 0.1, mixed: 0.05 },
        error: "No live data available",
      });
    }

    const now = new Date();
    const hour = now.getUTCHours() + now.getUTCMinutes() / 60.0;

    const result = detectSource(
      reading.pm25,
      reading.co,
      reading.no2,
      reading.tvoc,
      reading.temperature,
      reading.humidity,
      hour
    );

    return NextResponse.json({
      ...result,
      timestamp: now.toISOString(),
      reading: {
        pm25: reading.pm25,
        co: reading.co,
        no2: reading.no2,
        tvoc: reading.tvoc,
      },
    });
  } catch (err: any) {
    console.error("API ML source error:", err);
    return NextResponse.json({
      source: "vehicle",
      confidence: 0.5,
      probabilities: { vehicle: 0.5, industrial: 0.2, biomass: 0.15, construction: 0.1, mixed: 0.05 },
      error: err?.message || "Internal error",
    });
  }
}
