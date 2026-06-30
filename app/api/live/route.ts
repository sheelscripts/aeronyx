import { NextRequest, NextResponse } from "next/server";
import { fetchLatestFromThingSpeak } from "../../../lib/thingspeak/fetch";
import { fetchLatestFromWaqi } from "../../../lib/waqi/fetch";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") || "real_api";
    const waqiToken = searchParams.get("waqi_token") || undefined;
    const thingspeakChannel = searchParams.get("thingspeak_channel") || undefined;
    const thingspeakKey = searchParams.get("thingspeak_key") || undefined;

    let reading = null;

    if (source === "hardware") {
      reading = await fetchLatestFromThingSpeak(thingspeakChannel, thingspeakKey);
    } else {
      reading = await fetchLatestFromWaqi(waqiToken);
    }

    if (!reading) {
      return NextResponse.json({ status: "offline" });
    }

    return NextResponse.json(reading);
  } catch (err) {
    console.error("API live error:", err);
    return NextResponse.json({ error: "Failed to fetch live data" }, { status: 500 });
  }
}

