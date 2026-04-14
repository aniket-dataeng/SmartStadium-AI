"""
main.py — SmartStadium-AI FastAPI Backend

Provides:
  - WebSocket endpoint (/ws) for real-time IoT broadcasting and admin commands.
  - REST endpoints for mode control and health checks.
  - CORS configuration, rate-limiting, and input validation via Pydantic.
"""
import asyncio
import json
import os
from contextlib import asynccontextmanager
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

import simulation
from alerts import generate_alerts

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
load_dotenv()

_raw_origins: str = os.getenv("CORS_ORIGINS", "http://localhost:5173")
ALLOWED_ORIGINS: list[str] = [o.strip() for o in _raw_origins.split(",")]
if "http://localhost:5174" not in ALLOWED_ORIGINS:
    ALLOWED_ORIGINS.append("http://localhost:5174")
BROADCAST_INTERVAL: float = float(os.getenv("BROADCAST_INTERVAL_SECS", "6"))

# ---------------------------------------------------------------------------
# Pydantic Message Models (Security: typed & validated input)
# ---------------------------------------------------------------------------

class SetModeMsg(BaseModel):
    """Admin message to change the global simulation mode."""
    mode: Literal["Normal", "Peak", "Emergency"]


class SetOverrideMsg(BaseModel):
    """Admin message to forcibly set a zone's crowd level."""
    type: Literal["set_override"]
    zone_id: str = Field(..., min_length=1, max_length=60, pattern=r"^[\w_]+$")
    value: int = Field(..., ge=0, le=5000)


class ResetOverridesMsg(BaseModel):
    """Admin message to clear all active overrides."""
    type: Literal["reset_overrides"]


class BroadcastMsg(BaseModel):
    """Admin message broadcast to all clients (cheer, announcement, emergency)."""
    type: Literal["cheer_sync", "announcement", "emergency", "light_show"]
    message: str | None = Field(default=None, max_length=500)


# ---------------------------------------------------------------------------
# WebSocket Connection Manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    """Manages the pool of active WebSocket connections."""

    def __init__(self) -> None:
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: str) -> None:
        """Send a text message to every connected client, skipping broken ones."""
        dead: list[WebSocket] = []
        for ws in list(self.active):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()
background_task: asyncio.Task | None = None


# ---------------------------------------------------------------------------
# Simulation broadcast loop
# ---------------------------------------------------------------------------

async def simulation_loop() -> None:
    """Continuously generate IoT data and broadcast it to all clients."""
    while True:
        iot_data = simulation.generate_iot_data()
        intelligence = generate_alerts(iot_data)
        payload = {"iot_data": iot_data, "intelligence": intelligence}
        await manager.broadcast(json.dumps(payload))
        await asyncio.sleep(BROADCAST_INTERVAL)


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    global background_task
    background_task = asyncio.create_task(simulation_loop())
    yield
    if background_task:
        background_task.cancel()


# ---------------------------------------------------------------------------
# App bootstrap
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="SmartStadium-AI API",
    description=(
        "Real-time crowd management and attendee experience platform "
        "for large-scale sporting venues."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health", tags=["ops"])
async def health_check(request: Request) -> dict:
    """Return service liveness status. Used by load balancers and monitoring."""
    return {
        "status": "ok",
        "mode": simulation.current_mode,
        "connected_clients": len(manager.active),
    }


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """Handle real-time bidirectional communication with stadium clients.

    Incoming messages from admin clients are validated with Pydantic models
    before any state mutation occurs.
    """
    await manager.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_text()

            # Safely parse JSON; ignore malformed frames
            try:
                msg: dict = json.loads(raw)
            except json.JSONDecodeError:
                continue

            msg_type = msg.get("type", "")

            # Mode change (no explicit 'type' field)
            if "mode" in msg and msg_type == "":
                try:
                    validated = SetModeMsg(**msg)
                    simulation.set_mode(validated.mode)
                except Exception:
                    pass

            elif msg_type == "set_override":
                try:
                    validated = SetOverrideMsg(**msg)
                    simulation.set_override(validated.zone_id, validated.value)
                except Exception:
                    pass

            elif msg_type == "reset_overrides":
                simulation.reset_overrides()

            elif msg_type in ("cheer_sync", "announcement", "emergency", "light_show"):
                try:
                    validated = BroadcastMsg(**msg)
                    if validated.type == "emergency":
                        simulation.set_mode("Emergency")
                    await manager.broadcast(validated.model_dump_json())
                except Exception:
                    pass

    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ---------------------------------------------------------------------------
# REST helpers
# ---------------------------------------------------------------------------

@app.post("/set_mode/{mode}", tags=["admin"])
@limiter.limit("10/minute")
async def api_set_mode(mode: str, request: Request) -> dict:
    """Change the simulation crowd mode via REST (rate-limited to 10 req/min).

    Args:
        mode: One of 'Normal', 'Peak', or 'Emergency'.
    """
    try:
        validated = SetModeMsg(mode=mode)
        simulation.set_mode(validated.mode)
        return {"status": "success", "mode": validated.mode}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
