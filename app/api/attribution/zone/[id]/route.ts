import { NextRequest, NextResponse } from "next/server";
import { WARD_META } from "../../../../../lib/weather/wardsData";
import { computeBayesianAttribution, aggregateZoneAttribution } from "../../../../../lib/attribution/engine";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const zoneId = params.id; // zoneId is like "civil_lines", "central", etc.
  
  const zoneWards = WARD_META.filter(
    (w) =>
      w.zone.toLowerCase().replace(/ /g, "_") === zoneId.toLowerCase() &&
      w.feature_type === "ward"
  );

  if (zoneWards.length === 0) {
    return NextResponse.json({ error: "Zone not found or has no wards", scores: {} }, { status: 404 });
  }

  try {
    const attributions = zoneWards.map((w) => {
      const pm25 = w.profile === "clean" ? 35 : w.profile === "industrial" ? 95 : 65;
      const reading = { pm25, co: pm25 / 35, no2: pm25 / 1000, tvoc: pm25 / 150 };
      return computeBayesianAttribution(w.ward_id, reading, w.profile);
    });

    const wardAqis = zoneWards.reduce((acc, w) => {
      acc[w.ward_id] = w.profile === "clean" ? 60 : w.profile === "industrial" ? 170 : 110;
      return acc;
    }, {} as Record<string, number>);

    const zoneAttribution = aggregateZoneAttribution(attributions, wardAqis);

    return NextResponse.json(zoneAttribution);
  } catch (err) {
    console.error(`API zone attribution error for ${zoneId}:`, err);
    return NextResponse.json({ error: "Failed to compute zone attribution", scores: {} }, { status: 500 });
  }
}
