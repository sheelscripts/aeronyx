import { NextRequest, NextResponse } from "next/server";
import { updateAlertRule, deleteAlertRule } from "../../../../../lib/db/database";

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const ruleId = params.id;

  try {
    const body = await request.json();
    const updated = await updateAlertRule(ruleId, body);

    if (!updated) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error(`API alerts rules PUT error for ${ruleId}:`, err);
    return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const ruleId = params.id;

  try {
    const success = await deleteAlertRule(ruleId);
    return NextResponse.json({ deleted: ruleId, removed: success ? 1 : 0 });
  } catch (err) {
    console.error(`API alerts rules DELETE error for ${ruleId}:`, err);
    return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
  }
}
