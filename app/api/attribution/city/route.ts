import { NextResponse } from "next/server";
import { WARD_META } from "../../../../lib/weather/wardsData";
import { computeBayesianAttribution, aggregateZoneAttribution } from "../../../../lib/attribution/engine";

export async function GET() {
  try {
    const wardReadings = WARD_META.filter((w) => w.feature_type === "ward");
    const attributions = wardReadings.map((w) => {
      const pm25 = w.profile === "clean" ? 35 : w.profile === "industrial" ? 95 : 65;
      const reading = { pm25, co: pm25 / 35, no2: pm25 / 1000, tvoc: pm25 / 150 };
      return computeBayesianAttribution(w.ward_id, reading, w.profile);
    });

    const wardAqis = wardReadings.reduce((acc, w) => {
      acc[w.ward_id] = w.profile === "clean" ? 60 : w.profile === "industrial" ? 170 : 110;
      return acc;
    }, {} as Record<string, number>);

    const cityAttribution = aggregateZoneAttribution(attributions, wardAqis);

    return NextResponse.json(cityAttribution);
  } catch (err) {
    console.error("API city attribution error:", err);
    return NextResponse.json({ error: "Failed to compute city attribution", scores: {} }, { status: 500 });
  }
}
