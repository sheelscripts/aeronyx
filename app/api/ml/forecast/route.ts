import { NextRequest, NextResponse } from "next/server";
import { fetchLatestFromThingSpeak } from "../../../../lib/thingspeak/fetch";
import { forecastAqi } from "../../../../lib/ml/mlPredictor";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const horizonParam = searchParams.get("horizon");
    const horizon = horizonParam ? parseInt(horizonParam, 10) || 24 : 24;

    const reading = await fetchLatestFromThingSpeak();
    if (!reading) {
      return NextResponse.json({ error: "No live data available", forecasts: [] });
    }

    const forecasts = forecastAqi(reading, horizon);

    return NextResponse.json({
      current_aqi: reading.aqi,
      horizon_hours: horizon,
      timestamp: new Date().toISOString(),
      forecasts,
    });
  } catch (err: any) {
    console.error("API ML forecast error:", err);
    return NextResponse.json({ error: err?.message || "Internal error", forecasts: [] });
  }
}
