import { NextResponse } from "next/server";
import { getAllStationWinds } from "../../../../lib/weather/windService";

export async function GET() {
  try {
    const stations = await getAllStationWinds();
    return NextResponse.json({
      count: stations.length,
      stations,
    });
  } catch (err) {
    console.error("API wind current error:", err);
    return NextResponse.json({ error: "Failed to fetch current wind" }, { status: 500 });
  }
}
