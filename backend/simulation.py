"""
simulation.py — SmartStadium-AI IoT Data Simulation

Generates realistic crowd, gate, food stall, restroom, and parking data
for Wankhede Stadium. Supports Normal, Peak, and Emergency crowd modes,
as well as per-zone admin overrides for crowd control scenarios.
"""
import random
from datetime import datetime, timezone
from typing import Any

# ---------------------------------------------------------------------------
# Global State (module-level singletons for simplicity; scoped to process)
# ---------------------------------------------------------------------------
current_mode: str = "Normal"
zone_overrides: dict[str, int] = {}
gate_overrides: dict[str, int] = {}

# ---------------------------------------------------------------------------
# Mode & Override Control
# ---------------------------------------------------------------------------

def set_mode(mode: str) -> None:
    """Set the simulation crowd mode.

    Args:
        mode: One of 'Normal', 'Peak', or 'Emergency'.
    """
    global current_mode
    if mode in ("Normal", "Peak", "Emergency"):
        current_mode = mode


def set_override(zone_id: str, value: int) -> None:
    """Pin a zone's crowd/occupancy to a specific value.

    Args:
        zone_id: The identifier of the zone or gate (e.g., 'Gate_3', 'North_Stand').
        value:   The occupancy count to force for this zone.
    """
    global zone_overrides, gate_overrides
    if "Gate" in zone_id:
        gate_overrides[zone_id] = max(0, value)
    else:
        zone_overrides[zone_id] = max(0, value)


def reset_overrides() -> None:
    """Clear all admin-set zone and gate overrides."""
    zone_overrides.clear()
    gate_overrides.clear()


# ---------------------------------------------------------------------------
# Wait-time helper
# ---------------------------------------------------------------------------

def estimated_wait_mins(crowd_count: int, exit_rate_per_min: int) -> int:
    """Calculate estimated wait time in minutes.

    Args:
        crowd_count:       Current number of people waiting.
        exit_rate_per_min: How many people clear per minute.

    Returns:
        Estimated wait time in whole minutes (minimum 0).
    """
    if exit_rate_per_min <= 0:
        return 0
    return max(0, round(crowd_count / exit_rate_per_min))


# ---------------------------------------------------------------------------
# Main data generator
# ---------------------------------------------------------------------------

def generate_iot_data() -> dict[str, Any]:
    """Generate a full IoT snapshot for all stadium zones.

    Produces simulated sensor readings for stands, gates, food stalls,
    restrooms, and parking lots. Values are influenced by the current
    simulation mode and any active admin overrides.

    Returns:
        A dictionary containing mode, timestamp, and lists of zone readings.
    """
    crowd_multiplier: float = {"Normal": 1.0, "Peak": 1.5, "Emergency": 2.2}[current_mode]
    queue_multiplier: float = {"Normal": 1.0, "Peak": 1.8, "Emergency": 0.5}[current_mode]

    # -- Stands --
    stand_names = [
        "Sachin_Tendulkar_Stand", "Sunil_Gavaskar_Stand", "Vijay_Merchant_Stand",
        "Grand_Stand", "Vithal_Divecha_Stand", "Garware_Pavilion_Stand",
        "North_Stand", "MCA_Pavilion",
    ]
    stands = []
    for name in stand_names:
        capacity = 4000
        raw_occ = zone_overrides.get(name, int(random.randint(1500, 3500) * crowd_multiplier))
        occupancy_pct = min(raw_occ, capacity) / capacity
        stands.append({
            "stand_id": name,
            "occupancy": min(raw_occ, capacity),
            "capacity": capacity,
            "occupancy_pct": round(occupancy_pct * 100, 1),
        })

    # -- Gates --
    gates = []
    for i in range(1, 8):
        gate_id = f"Gate_{i}"
        if gate_id in gate_overrides:
            crowd = gate_overrides[gate_id]
            entry = random.randint(20, 50)
        elif current_mode == "Emergency" and i == 1:
            crowd = random.randint(480, 500)
            entry = random.randint(80, 100)
        else:
            crowd = int(random.randint(50, 300) * crowd_multiplier)
            entry = int(random.randint(20, 50) * crowd_multiplier)

        exit_rate = random.randint(10, 30)
        crowd = min(crowd, 500)
        gates.append({
            "zone_id": gate_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "crowd_count": crowd,
            "capacity": 500,
            "entry_rate_per_min": entry,
            "exit_rate_per_min": exit_rate,
            "estimated_wait_mins": estimated_wait_mins(crowd, exit_rate),
        })

    # -- Food Stalls --
    food_names = [
        "Powerplay_Pizza", "Dugout_Drinks", "Mumbai_Chaat_Corner",
        "Sixer_Snacks", "Third_Umpire_Cafe", "Pavilion_Grill", "Yorker_Ice_Creams",
    ]
    food_stalls = []
    for name in food_names:
        if current_mode == "Peak" and name == "Powerplay_Pizza":
            q_len = random.randint(30, 45)
        else:
            q_len = int(random.randint(5, 20) * queue_multiplier)
        svc_secs = random.randint(30, 60)
        counters = random.randint(2, 5)
        wait_secs = round((q_len * svc_secs) / max(counters, 1))
        food_stalls.append({
            "location": name,
            "queue_length": q_len,
            "avg_service_time_sec": svc_secs,
            "active_counters": counters,
            "estimated_wait_mins": max(0, round(wait_secs / 60)),
        })

    # -- Restrooms --
    restrooms = []
    for r in ("Restroom_Block_B", "Restroom_Block_C", "Restroom_Medizone"):
        capacity = 50
        raw_occ = int(random.randint(10, 40) * crowd_multiplier)
        restrooms.append({
            "restroom_id": r,
            "occupancy": min(raw_occ, capacity),
            "capacity": capacity,
        })

    # -- Parking --
    parking = []
    for i in range(1, 6):
        lot_id = f"P{i}"
        capacity = 200
        if current_mode == "Emergency" and i == 1:
            raw_occ = random.randint(180, 200)
        else:
            raw_occ = int(random.randint(50, 150) * crowd_multiplier)
        parking.append({
            "lot_id": lot_id,
            "occupancy": min(raw_occ, capacity),
            "capacity": capacity,
        })

    return {
        "mode": current_mode,
        "stands": stands,
        "gates": gates,
        "food_stalls": food_stalls,
        "restrooms": restrooms,
        "parking": parking,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
