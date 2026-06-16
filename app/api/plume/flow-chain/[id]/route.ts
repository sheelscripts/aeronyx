import { NextRequest, NextResponse } from "next/server";
import { WARD_META } from "../../../../../lib/weather/wardsData";
import { interpolateWind } from "../../../../../lib/weather/windService";
import { computeWardFlowChain } from "../../../../../lib/weather/atmospheric";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const zoneId = params.id; // zoneId is like "civil_lines", "central", etc.
  
  // Find wards in the zone
  const zoneWards = WARD_META.filter(
    (w) =>
      w.zone.toLowerCase().replace(/ /g, "_") === zoneId.toLowerCase() &&
      w.feature_type === "ward"
  );

  if (zoneWards.length === 0) {
    return NextResponse.json({ error: "Zone not found or has no wards", chain: [] }, { status: 404 });
  }

  try {
    const cLat = zoneWards.reduce((s, w) => s + w.lat, 0) / zoneWards.length;
    const cLng = zoneWards.reduce((s, w) => s + w.lng, 0) / zoneWards.length;
    const wind = await interpolateWind(cLat, cLng);

    const chain = computeWardFlowChain(zoneWards, wind.wind_direction);

    return NextResponse.json({
      zone_id: zoneId,
      wind,
      count: chain.length,
      chain,
    });
  } catch (err) {
    console.error(`API flow-chain error for ${zoneId}:`, err);
    return NextResponse.json({ error: "Failed to compute flow chain", chain: [] }, { status: 500 });
  }
}
