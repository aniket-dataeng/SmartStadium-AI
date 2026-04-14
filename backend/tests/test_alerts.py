"""
tests/test_alerts.py — Unit tests for the SmartStadium-AI alert engine.

Run with:  cd backend && python3 -m pytest tests/ -v
"""
import pytest
from alerts import generate_alerts, STAND_CRITICAL_PCT, GATE_CRITICAL_PCT


# ---------------------------------------------------------------------------
# Helpers to build minimal IoT snapshots
# ---------------------------------------------------------------------------

def make_data(
    stand_occ_pct: float = 0.5,
    gate_occ_pct: float = 0.3,
    food_queue: int = 5,
    restroom_occ_pct: float = 0.4,
    parking_occ_pct: float = 0.5,
) -> dict:
    """Build a minimal IoT snapshot for testing."""
    cap_stand = 4000
    cap_gate = 500
    cap_rest = 50
    cap_park = 200
    return {
        "stands": [
            {"stand_id": "North_Stand", "occupancy": int(cap_stand * stand_occ_pct), "capacity": cap_stand}
        ],
        "gates": [
            {
                "zone_id": "Gate_1",
                "crowd_count": int(cap_gate * gate_occ_pct),
                "capacity": cap_gate,
                "entry_rate_per_min": 30,
                "exit_rate_per_min": 20,
                "estimated_wait_mins": 5,
            }
        ],
        "food_stalls": [
            {"location": "Powerplay_Pizza", "queue_length": food_queue, "avg_service_time_sec": 60, "active_counters": 3}
        ],
        "restrooms": [
            {"restroom_id": "Restroom_Block_B", "occupancy": int(cap_rest * restroom_occ_pct), "capacity": cap_rest}
        ],
        "parking": [
            {"lot_id": "P1", "occupancy": int(cap_park * parking_occ_pct), "capacity": cap_park}
        ],
    }


# ---------------------------------------------------------------------------
# Return structure
# ---------------------------------------------------------------------------

def test_generate_alerts_returns_correct_keys():
    result = generate_alerts(make_data())
    assert "alerts" in result
    assert "suggestions" in result
    assert "summary" in result


def test_summary_counts_match_alerts():
    data = make_data(stand_occ_pct=0.97, gate_occ_pct=0.9)
    result = generate_alerts(data)
    critical = sum(1 for a in result["alerts"] if a["severity"] == "critical")
    warning = sum(1 for a in result["alerts"] if a["severity"] == "warning")
    assert result["summary"]["critical_count"] == critical
    assert result["summary"]["warning_count"] == warning


# ---------------------------------------------------------------------------
# Stand alerts
# ---------------------------------------------------------------------------

def test_no_alert_when_stand_safe():
    data = make_data(stand_occ_pct=0.5)
    result = generate_alerts(data)
    stand_alerts = [a for a in result["alerts"] if a["category"] == "crowd"]
    assert len(stand_alerts) == 0


def test_critical_alert_when_stand_packed():
    data = make_data(stand_occ_pct=STAND_CRITICAL_PCT + 0.01)
    result = generate_alerts(data)
    critical = [a for a in result["alerts"] if a["category"] == "crowd" and a["severity"] == "critical"]
    assert len(critical) == 1
    assert critical[0]["requires_action"] is True


# ---------------------------------------------------------------------------
# Gate alerts
# ---------------------------------------------------------------------------

def test_no_alert_when_gate_clear():
    data = make_data(gate_occ_pct=0.3)
    result = generate_alerts(data)
    gate_alerts = [a for a in result["alerts"] if a["category"] == "gate"]
    assert len(gate_alerts) == 0


def test_critical_alert_when_gate_congested():
    data = make_data(gate_occ_pct=GATE_CRITICAL_PCT + 0.05)
    result = generate_alerts(data)
    gate_alerts = [a for a in result["alerts"] if a["category"] == "gate" and a["severity"] == "critical"]
    assert len(gate_alerts) == 1


# ---------------------------------------------------------------------------
# Food stall alerts
# ---------------------------------------------------------------------------

def test_food_alert_when_very_long_queue():
    # queue_length=35, svc=60s, counters=3 → wait = 35*60/3 = 700s > 600s threshold
    data = make_data(food_queue=35)
    result = generate_alerts(data)
    food_alerts = [a for a in result["alerts"] if a["category"] == "food"]
    assert len(food_alerts) == 1


def test_food_suggestion_always_present():
    """A 'shortest queue' suggestion should always be generated."""
    data = make_data(food_queue=2)
    result = generate_alerts(data)
    food_suggestions = [s for s in result["suggestions"] if "Shortest queue" in s or "queue" in s.lower()]
    assert len(food_suggestions) >= 1


# ---------------------------------------------------------------------------
# Parking alerts
# ---------------------------------------------------------------------------

def test_parking_alert_when_nearly_full():
    data = make_data(parking_occ_pct=0.95)
    result = generate_alerts(data)
    park_alerts = [a for a in result["alerts"] if a["category"] == "parking"]
    assert len(park_alerts) == 1
    assert park_alerts[0]["severity"] == "critical"


def test_no_parking_alert_when_available():
    data = make_data(parking_occ_pct=0.5)
    result = generate_alerts(data)
    park_alerts = [a for a in result["alerts"] if a["category"] == "parking"]
    assert len(park_alerts) == 0


# ---------------------------------------------------------------------------
# Empty data edge case
# ---------------------------------------------------------------------------

def test_empty_data_does_not_crash():
    result = generate_alerts({})
    assert result["alerts"] == []
    assert result["suggestions"] == []
    assert result["summary"]["critical_count"] == 0
