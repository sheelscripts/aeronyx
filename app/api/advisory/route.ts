import { NextResponse } from "next/server";
import { fetchLatestFromThingSpeak } from "../../../lib/thingspeak/fetch";
import { getHealthAdvisory } from "../../../lib/ml/aqiCalc";

export async function GET() {
  try {
    const reading = await fetchLatestFromThingSpeak();
    const aqi = reading?.aqi ?? 100;
    const source = reading?.source_detected ?? "unknown";

    const advisory = getHealthAdvisory(aqi, source);
    return NextResponse.json(advisory);
  } catch (err) {
    console.error("API advisory error:", err);
    return NextResponse.json({ error: "Failed to generate health advisory" }, { status: 500 });
  }
}
