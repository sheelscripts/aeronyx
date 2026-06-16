import { NextRequest, NextResponse } from "next/server";
import { getWindHistoryData } from "../../../../lib/weather/windService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hoursParam = searchParams.get("hours");
    const hours = hoursParam ? parseInt(hoursParam, 10) || 24 : 24;

    const data = await getWindHistoryData(hours);

    return NextResponse.json({
      hours,
      count: data.length,
      history: data,
    });
  } catch (err) {
    console.error("API wind history error:", err);
    return NextResponse.json({ error: "Failed to fetch wind history" }, { status: 500 });
  }
}
