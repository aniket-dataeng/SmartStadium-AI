"""
alerts.py — SmartStadium-AI Intelligent Alert Engine

Analyses live IoT snapshots from the stadium and produces:
  - Structured alerts (severity-classified, actionable).
  - Smart suggestions for crowd re-routing and wait-time reduction.
"""
from typing import Any

# Thresholds
STAND_CRITICAL_PCT  = 0.95
STAND_WARNING_PCT   = 0.80
GATE_CRITICAL_PCT   = 0.85
GATE_WARNING_PCT    = 0.70
FOOD_WAIT_CRITICAL  = 600   # seconds (10 min)
RESTROOM_CRITICAL   = 0.90
PARKING_CRITICAL    = 0.90


def _severity(usage: float, warn: float, crit: float) -> str:
    """Return a severity string based on usage ratio vs thresholds."""
    if usage >= crit:
        return "critical"
    if usage >= warn:
        return "warning"
    return "ok"


def generate_alerts(data: dict[str, Any]) -> dict[str, Any]:
    """Analyse an IoT snapshot and generate alerts plus suggestions.

    Args:
        data: The output of :func:`simulation.generate_iot_data`.

    Returns:
        A dict with ``alerts`` (list of alert objects) and
        ``suggestions`` (de-duplicated list of actionable strings).
    """
    alerts: list[dict[str, Any]] = []
    suggestions: set[str] = set()

    # ── Stands ──────────────────────────────────────────────────────────────
    for stand in data.get("stands", []):
        usage = stand["occupancy"] / stand["capacity"]
        sev = _severity(usage, STAND_WARNING_PCT, STAND_CRITICAL_PCT)
        name = stand["stand_id"].replace("_", " ")
        if sev == "critical":
            alerts.append({
                "severity": "critical",
                "category": "crowd",
                "message": f"🚨 {name} is extremely packed ({int(usage * 100)}% capacity).",
                "requires_action": True,
                "action_type": "Deploy Crowd Control Staff",
            })
            suggestions.add(f"💡 Consider opening overflow seating near {name}.")
        elif sev == "warning":
            alerts.append({
                "severity": "warning",
                "category": "crowd",
                "message": f"⚠️ {name} is filling up ({int(usage * 100)}% capacity).",
                "requires_action": False,
                "action_type": "Monitor Closely",
            })

    # ── Gates ────────────────────────────────────────────────────────────────
    low_usage_gates = [
        g["zone_id"].replace("_", " ")
        for g in data.get("gates", [])
        if g["crowd_count"] / g["capacity"] < 0.55
    ]
    for gate in data.get("gates", []):
        usage = gate["crowd_count"] / gate["capacity"]
        sev = _severity(usage, GATE_WARNING_PCT, GATE_CRITICAL_PCT)
        name = gate["zone_id"].replace("_", " ")
        wait = gate.get("estimated_wait_mins", 0)
        if sev == "critical":
            alerts.append({
                "severity": "critical",
                "category": "gate",
                "message": f"🚫 {name} is congested ({int(usage * 100)}% · ~{wait}m wait).",
                "requires_action": True,
                "action_type": "Redirect Crowd to Alternate Gate",
            })
            if low_usage_gates:
                suggestions.add(
                    f"💡 Redirect flow from {name} → {low_usage_gates[0]}."
                )
            else:
                suggestions.add(f"💡 Open additional lanes at {name}.")
        elif sev == "warning":
            alerts.append({
                "severity": "warning",
                "category": "gate",
                "message": f"⚠️ {name} is getting busy (~{wait}m wait).",
                "requires_action": False,
                "action_type": "Monitor",
            })

    # ── Food Stalls ──────────────────────────────────────────────────────────
    stall_waits: list[dict[str, Any]] = []
    for stall in data.get("food_stalls", []):
        wait_secs = (stall["queue_length"] * stall["avg_service_time_sec"]) / max(
            stall["active_counters"], 1
        )
        name = stall["location"].replace("_", " ")
        stall_waits.append({"name": name, "wait_secs": wait_secs})
        if wait_secs > FOOD_WAIT_CRITICAL:
            alerts.append({
                "severity": "warning",
                "category": "food",
                "message": f"🍔 {name} overloaded! Est. wait: {int(wait_secs / 60)} mins.",
                "requires_action": False,
                "action_type": "Open Additional Counter",
            })

    if stall_waits:
        best = min(stall_waits, key=lambda x: x["wait_secs"])
        suggestions.add(
            f"🍔 Shortest queue: {best['name']} (~{int(best['wait_secs'] / 60)} mins)."
        )

    # ── Restrooms ────────────────────────────────────────────────────────────
    restroom_usages: list[dict[str, Any]] = []
    for room in data.get("restrooms", []):
        usage = room["occupancy"] / room["capacity"]
        name = room["restroom_id"].replace("_", " ")
        restroom_usages.append({"name": name, "usage": usage})
        if usage >= RESTROOM_CRITICAL:
            alerts.append({
                "severity": "warning",
                "category": "restroom",
                "message": f"🚻 {name} near full capacity ({int(usage * 100)}%).",
                "requires_action": False,
                "action_type": "Direct Attendees to Alternate Restroom",
            })

    if restroom_usages:
        best_room = min(restroom_usages, key=lambda x: x["usage"])
        suggestions.add(f"🚻 Use {best_room['name']} for the shortest restroom wait.")

    # ── Parking ──────────────────────────────────────────────────────────────
    for lot in data.get("parking", []):
        usage = lot["occupancy"] / lot["capacity"]
        name = lot["lot_id"]
        if usage >= PARKING_CRITICAL:
            alerts.append({
                "severity": "critical",
                "category": "parking",
                "message": f"🚗 Lot {name} is nearly full ({int(usage * 100)}%).",
                "requires_action": True,
                "action_type": "Notify Traffic Staff to Redirect Vehicles",
            })
            suggestions.add(f"💡 Redirect incoming vehicles away from Lot {name}.")

    return {
        "alerts": alerts,
        "suggestions": list(suggestions),
        "summary": {
            "critical_count": sum(1 for a in alerts if a["severity"] == "critical"),
            "warning_count": sum(1 for a in alerts if a["severity"] == "warning"),
        },
    }
