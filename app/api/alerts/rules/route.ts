import { NextRequest, NextResponse } from "next/server";
import { getAlertRules, createAlertRule, AlertRule } from "../../../../lib/db/database";

export async function GET() {
  try {
    const rules = await getAlertRules();
    return NextResponse.json({
      count: rules.length,
      rules,
    });
  } catch (err) {
    console.error("API alerts rules GET error:", err);
    return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const newRule: AlertRule = {
      rule_id: body.rule_id || `rule_${Math.random().toString(36).substring(2, 10)}`,
      name: body.name || "Unnamed Rule",
      description: body.description || "",
      metric: body.metric || "aqi",
      threshold: parseFloat(body.threshold) || 200,
      operator: body.operator || "gt",
      zone: body.zone || "all",
      severity: body.severity || "warning",
      enabled: body.enabled !== false,
      created_at: new Date().toISOString(),
    };

    const savedRule = await createAlertRule(newRule);
    return NextResponse.json(savedRule);
  } catch (err) {
    console.error("API alerts rules POST error:", err);
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
  }
}
