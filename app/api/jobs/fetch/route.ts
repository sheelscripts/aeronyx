import { NextResponse } from "next/server";
import { initDb, insertSensorReading } from "../../../../lib/db/database";
import { fetchLatestFromThingSpeak } from "../../../../lib/thingspeak/fetch";
import { evaluateAlertRules } from "../../../../lib/alerts/engine";

export async function GET() {
  try {
    // 1. Initialize DB tables/JSON file if not done
    await initDb();

    // 2. Fetch the latest reading from ThingSpeak
    const reading = await fetchLatestFromThingSpeak();
    if (!reading) {
      return NextResponse.json({ status: "ignored", message: "Failed to resolve any sensor reading." });
    }

    // 3. Persist the reading in database
    const stored = await insertSensorReading(reading);

    // 4. Evaluate alert rules for this reading
    const triggeredAlerts = await evaluateAlertRules([reading]);

    return NextResponse.json({
      status: "success",
      timestamp: new Date().toISOString(),
      reading_stored: stored,
      alerts_triggered: triggeredAlerts.length,
      reading,
    });
  } catch (err: any) {
    console.error("Cron fetch job failed:", err);
    return NextResponse.json({ error: "Cron job execution failed", message: err?.message }, { status: 500 });
  }
}

// Support POST requests as well (for Supabase cron pg_net compatibility)
export async function POST() {
  return GET();
}
