import { getAlertRules, insertAlerts, AlertLog } from "../db/database";

const DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

// In-memory debounce lock (resets on container recycles, acceptable for serverless)
const _recentFires: Record<string, string> = {};

export async function evaluateAlertRules(wardData: any[]): Promise<AlertLog[]> {
  try {
    const rules = await getAlertRules();
    const triggered: AlertLog[] = [];
    const now = new Date();

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const metric = rule.metric;
      const threshold = rule.threshold;
      const op = rule.operator;
      const target = rule.zone;

      for (const ward of wardData) {
        // Zone target filter
        if (target !== "all" && ward.name !== target && ward.ward_id !== target) {
          continue;
        }

        const value = parseFloat(ward[metric]);
        if (isNaN(value)) continue;

        let fired = false;
        if (op === "gt" && value > threshold) fired = true;
        if (op === "lt" && value < threshold) fired = true;
        if (op === "eq" && value === threshold) fired = true;

        if (!fired) continue;

        // Apply debounce lock
        const fireKey = `${rule.rule_id}_${ward.ward_id}`;
        const lastFire = _recentFires[fireKey];
        if (lastFire) {
          const lastDt = new Date(lastFire);
          if (now.getTime() - lastDt.getTime() < DEBOUNCE_MS) {
            continue;
          }
        }

        const alert: AlertLog = {
          alert_id: Math.random().toString(36).substring(2, 10),
          rule_id: rule.rule_id,
          rule_name: rule.name,
          zone: ward.name || ward.ward_id,
          ward_id: ward.ward_id,
          metric,
          value: Math.round(value * 100) / 100,
          threshold,
          severity: rule.severity,
          message: `${ward.name || ward.ward_id}: ${metric.toUpperCase()} = ${Math.round(value * 10) / 10} (${op === "gt" ? ">" : op === "lt" ? "<" : "="}${threshold})`,
          timestamp: now.toISOString(),
        };

        triggered.push(alert);
        _recentFires[fireKey] = now.toISOString();
      }
    }

    if (triggered.length > 0) {
      await insertAlerts(triggered);
      console.log(`Fired ${triggered.length} alert(s) and logged in database.`);
    }

    return triggered;
  } catch (err) {
    console.error("Error evaluating rules:", err);
    return [];
  }
}
