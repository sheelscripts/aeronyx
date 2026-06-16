import { NextRequest, NextResponse } from "next/server";
import { getAlertHistory, clearAlertHistory } from "../../../lib/db/database";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) || 50 : 50;

    const alerts = await getAlertHistory(limit);

    return NextResponse.json({
      count: alerts.length,
      alerts,
    });
  } catch (err) {
    console.error("API alerts GET error:", err);
    return NextResponse.json({ error: "Failed to fetch alerts" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const success = await clearAlertHistory();
    return NextResponse.json({ cleared: success });
  } catch (err) {
    console.error("API alerts DELETE error:", err);
    return NextResponse.json({ error: "Failed to clear alerts" }, { status: 500 });
  }
}
