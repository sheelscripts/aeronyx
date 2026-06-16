import { NextResponse } from "next/server";
import { fetchLatestFromThingSpeak } from "../../../lib/thingspeak/fetch";

export async function GET() {
  try {
    const reading = await fetchLatestFromThingSpeak();
    if (!reading) {
      return NextResponse.json({ status: "offline" });
    }
    return NextResponse.json(reading);
  } catch (err) {
    console.error("API live error:", err);
    return NextResponse.json({ error: "Failed to fetch live data" }, { status: 500 });
  }
}
