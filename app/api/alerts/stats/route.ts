import { NextResponse } from "next/server";
import { getAlertHistory, getAlertRules } from "../../../../lib/db/database";

export async function GET() {
  try {
    const alerts = await getAlertHistory(100);
    const rules = await getAlertRules();

    const critical = alerts.filter((a) => a.severity === "critical").length;
    const warning = alerts.filter((a) => a.severity === "warning").length;
    
    const zones = Array.from(new Set(alerts.map((a) => a.zone).filter(Boolean)));
    const activeRulesCount = rules.filter((r) => r.enabled).length;

    return NextResponse.json({
      total: alerts.length,
      critical,
      warning,
      affected_zones: zones,
      active_rules: activeRulesCount,
    });
  } catch (err) {
    console.error("API alert stats error:", err);
    return NextResponse.json({ error: "Failed to generate alert stats" }, { status: 500 });
  }
}
