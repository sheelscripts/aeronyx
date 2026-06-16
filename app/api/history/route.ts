import { NextRequest, NextResponse } from "next/server";
import { getHistory } from "../../../lib/thingspeak/fetch";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hoursParam = searchParams.get("hours");
    const hours = hoursParam ? parseInt(hoursParam, 10) || 24 : 24;

    const data = await getHistory(hours);
    return NextResponse.json({
      count: data.length,
      data,
    });
  } catch (err) {
    console.error("API history error:", err);
    return NextResponse.json({ error: "Failed to fetch history data" }, { status: 500 });
  }
}
