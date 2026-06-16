import { NextRequest, NextResponse } from "next/server";
import { getWindFieldGrid } from "../../../../lib/weather/windService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gridSizeParam = searchParams.get("grid_size");
    const gridSize = gridSizeParam ? parseInt(gridSizeParam, 10) || 12 : 12;

    const grid = await getWindFieldGrid(28.4, 28.85, 76.85, 77.35, gridSize);

    return NextResponse.json({
      grid_size: gridSize,
      count: grid.length,
      field: grid,
    });
  } catch (err) {
    console.error("API wind field error:", err);
    return NextResponse.json({ error: "Failed to interpolate wind field" }, { status: 500 });
  }
}
