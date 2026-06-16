import { NextRequest, NextResponse } from "next/server";
import { WARD_META } from "../../../../../lib/weather/wardsData";
import { computeBackwardTrajectory } from "../../../../../lib/weather/atmospheric";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const wardId = params.id;
  const ward = WARD_META.find((w) => w.ward_id === wardId);

  if (!ward) {
    return NextResponse.json({ error: "Ward not found", trajectory: [] }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const hoursParam = searchParams.get("hours");
    const hours = hoursParam ? parseInt(hoursParam, 10) || 3 : 3;

    const points = await computeBackwardTrajectory(ward.lat, ward.lng, hours, 10.0);

    return NextResponse.json({
      ward_id: wardId,
      ward_name: ward.name,
      hours,
      timestamp: new Date().toISOString(),
      trajectory: points,
    });
  } catch (err) {
    console.error(`API plume trajectory error for ${wardId}:`, err);
    return NextResponse.json({ error: "Failed to calculate trajectory", trajectory: [] }, { status: 500 });
  }
}
