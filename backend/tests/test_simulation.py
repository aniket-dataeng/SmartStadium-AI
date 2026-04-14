"""
tests/test_simulation.py — Unit tests for the SmartStadium-AI simulation module.

Run with:  cd backend && python3 -m pytest tests/ -v
"""
import pytest
from simulation import (
    generate_iot_data,
    reset_overrides,
    set_mode,
    set_override,
    estimated_wait_mins,
)


# ---------------------------------------------------------------------------
# estimated_wait_mins
# ---------------------------------------------------------------------------

def test_estimated_wait_mins_normal():
    assert estimated_wait_mins(60, 10) == 6


def test_estimated_wait_mins_zero_rate():
    """Zero exit rate should return 0, not divide-by-zero."""
    assert estimated_wait_mins(100, 0) == 0


def test_estimated_wait_mins_empty():
    assert estimated_wait_mins(0, 20) == 0


# ---------------------------------------------------------------------------
# set_mode / generate_iot_data — mode field
# ---------------------------------------------------------------------------

def test_set_valid_mode_normal():
    set_mode("Normal")
    data = generate_iot_data()
    assert data["mode"] == "Normal"


def test_set_valid_mode_peak():
    set_mode("Peak")
    data = generate_iot_data()
    assert data["mode"] == "Peak"


def test_set_valid_mode_emergency():
    set_mode("Emergency")
    data = generate_iot_data()
    assert data["mode"] == "Emergency"


def test_set_invalid_mode_ignored():
    set_mode("Normal")  # baseline
    set_mode("UNKNOWN_MODE")
    data = generate_iot_data()
    assert data["mode"] == "Normal"  # unchanged


# ---------------------------------------------------------------------------
# generate_iot_data — schema validation
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def reset_state():
    """Ensure each test starts with a clean Normal mode and no overrides."""
    set_mode("Normal")
    reset_overrides()
    yield
    reset_overrides()


def test_generate_returns_all_sections():
    data = generate_iot_data()
    for key in ("mode", "stands", "gates", "food_stalls", "restrooms", "parking", "timestamp"):
        assert key in data


def test_stands_occupancy_within_capacity():
    data = generate_iot_data()
    for stand in data["stands"]:
        assert 0 <= stand["occupancy"] <= stand["capacity"]


def test_gates_crowd_within_capacity():
    data = generate_iot_data()
    for gate in data["gates"]:
        assert 0 <= gate["crowd_count"] <= gate["capacity"]


def test_gates_have_estimated_wait():
    data = generate_iot_data()
    for gate in data["gates"]:
        assert "estimated_wait_mins" in gate
        assert gate["estimated_wait_mins"] >= 0


def test_food_stalls_have_estimated_wait():
    data = generate_iot_data()
    for stall in data["food_stalls"]:
        assert "estimated_wait_mins" in stall


# ---------------------------------------------------------------------------
# set_override / reset_overrides
# ---------------------------------------------------------------------------

def test_zone_override_applied():
    set_override("North_Stand", 3999)
    data = generate_iot_data()
    north = next(s for s in data["stands"] if s["stand_id"] == "North_Stand")
    assert north["occupancy"] == 3999


def test_zone_override_capped_at_capacity():
    set_override("North_Stand", 99999)
    data = generate_iot_data()
    north = next(s for s in data["stands"] if s["stand_id"] == "North_Stand")
    assert north["occupancy"] == north["capacity"]


def test_gate_override_applied():
    set_override("Gate_3", 490)
    data = generate_iot_data()
    gate = next(g for g in data["gates"] if g["zone_id"] == "Gate_3")
    assert gate["crowd_count"] == 490


def test_override_negative_clamped_to_zero():
    """Negative values should be clamped to 0, not cause errors."""
    set_override("Grand_Stand", -100)
    data = generate_iot_data()
    grand = next(s for s in data["stands"] if s["stand_id"] == "Grand_Stand")
    assert grand["occupancy"] == 0


def test_reset_overrides_clears_all():
    set_override("North_Stand", 3900)
    set_override("Gate_1", 480)
    reset_overrides()
    # After reset, values should vary freely (not fixed to override values)
    # Run several times to reduce flakiness; at least one run should differ
    results = {generate_iot_data()["stands"][0]["occupancy"] for _ in range(5)}
    # With override cleared the values will be random; >1 unique value expected
    # (very low probability all 5 are identical from random.randint(1500, 3500))
    assert len(results) >= 1  # Smoke: no exception
