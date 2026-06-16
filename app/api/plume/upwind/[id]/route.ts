import { NextRequest, NextResponse } from "next/server";
import { WARD_META } from "../../../../../lib/weather/wardsData";
import { getUpwindWards, interpolateWind } from "../../../../../lib/weather/windService";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const wardId = params.id;
  const target = WARD_META.find((w) => w.ward_id === wardId);

  if (!target) {
    return NextResponse.json({ error: "Ward not found", upwind_wards: [] }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const radiusParam = searchParams.get("radius_km");
    const radius = radiusParam ? parseFloat(radiusParam) || 6.0 : 6.0;

    const allWards = WARD_META.filter((w) => w.feature_type === "ward" && w.ward_id !== wardId);
    const upwind = await getUpwindWards(target.lat, target.lng, allWards, radius);
    const wind = await interpolateWind(target.lat, target.lng);

    return NextResponse.json({
      ward_id: wardId,
      ward_name: target.name,
      radius_km: radius,
      wind_at_ward: wind,
      count: upwind.length,
      upwind_wards: upwind,
    });
  } catch (err) {
    console.error(`API plume upwind error for ${wardId}:`, err);
    return NextResponse.json({ error: "Failed to fetch upwind wards", upwind_wards: [] }, { status: 500 });
  }
}
