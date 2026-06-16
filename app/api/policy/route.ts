import { NextRequest, NextResponse } from "next/server";
import { fetchLatestFromThingSpeak } from "../../../lib/thingspeak/fetch";
import { getPolicyRecommendations } from "../../../lib/utils/policyEngine";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceParam = searchParams.get("source");
    const aqiParam = searchParams.get("aqi");

    const reading = await fetchLatestFromThingSpeak();

    const effectiveAqi = aqiParam ? parseInt(aqiParam, 10) || 100 : reading?.aqi ?? 100;
    const effectiveSource = sourceParam || reading?.source_detected || "unknown";

    const policy = getPolicyRecommendations(effectiveSource, effectiveAqi);
    return NextResponse.json(policy);
  } catch (err) {
    console.error("API policy error:", err);
    return NextResponse.json({ error: "Failed to fetch policy recommendations" }, { status: 500 });
  }
}
