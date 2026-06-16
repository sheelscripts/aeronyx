import { NextRequest, NextResponse } from "next/server";
import { WARD_META } from "../../../../../lib/weather/wardsData";
import { computeBayesianAttribution } from "../../../../../lib/attribution/engine";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const wardId = params.id;
  const ward = WARD_META.find((w) => w.ward_id === wardId);

  if (!ward) {
    return NextResponse.json({ error: "Ward not found" }, { status: 404 });
  }

  try {
    // Generate a mock current reading for calculation
    const hour = new Date().getUTCHours();
    const pm25 = ward.profile === "clean" ? 35 : ward.profile === "industrial" ? 95 : 65;
    const reading = {
      pm25,
      co: pm25 / 35,
      no2: pm25 / 1000,
      tvoc: pm25 / 150,
      temperature: 28,
      humidity: 50,
    };

    const attribution = computeBayesianAttribution(wardId, reading, ward.profile);
    return NextResponse.json(attribution);
  } catch (err) {
    console.error(`API ward attribution error for ${wardId}:`, err);
    return NextResponse.json({ error: "Failed to compute ward attribution" }, { status: 500 });
  }
}
