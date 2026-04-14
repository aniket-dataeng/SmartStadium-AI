# SmartStadium-AI 🏏

> **Real-time crowd management and attendee experience platform for large-scale sporting venues.**

SmartStadium-AI addresses the core challenges of physical event management — crowd movement, waiting times, and real-time coordination — through an AI-assisted, WebSocket-powered dashboard for Wankhede Stadium.

---

## Problem Statement Alignment

| Challenge | Solution |
|---|---|
| Crowd movement | Live heat-map with per-stand occupancy and gate congestion indicators |
| Waiting times | Pre-computed estimated wait times for gates, food stalls, and restrooms |
| Real-time coordination | FastAPI WebSocket broadcast loop (6-second IoT cycle) to all clients simultaneously |
| Attendee navigation | Optimal route engine that avoids jammed gates and routes to best amenity |
| Emergency management | Admin-triggered evacuation alert pushed to all connected clients |

---

## Architecture

```
SmartStadium-AI/
├── backend/             # FastAPI + WebSocket server
│   ├── main.py          # App bootstrap, WS endpoint, REST API
│   ├── simulation.py    # IoT data simulation engine
│   ├── alerts.py        # Intelligent alert & suggestion engine
│   ├── tests/           # pytest unit tests
│   │   ├── test_simulation.py
│   │   └── test_alerts.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/            # Vite + React SPA
    ├── src/
    │   ├── App.jsx      # All components (Auth, Map, Dashboards)
    │   └── index.css    # Design system
    ├── public/
    │   └── manifest.json  # PWA manifest
    └── index.html       # SEO, CSP, Google Analytics
```

---

## Evaluation Criteria

### ✅ Code Quality
- Full type hints and docstrings in all backend Python files
- Modular React components with `useMemo`/`useCallback` for performance
- Named constants for all thresholds in `alerts.py`

### ✅ Security
- **Input validation**: All WebSocket messages validated via Pydantic models before state mutation
- **Rate limiting**: REST endpoints capped at 10 req/min via SlowAPI
- **CORS**: Restricted to `CORS_ORIGINS` env var (not wildcard in production)
- **CSP**: `Content-Security-Policy` meta tag in `index.html`
- **Input sanitization**: Ticket codes trimmed, length-capped, and uppercased before processing

### ✅ Efficiency
- WebSocket broadcast loop pushes to all clients in one pass (dead connections auto-cleaned)
- Frontend route computation memoised with `useMemo` — only recomputes on data change
- WebSocket auto-reconnect with exponential backoff (max 30s, 8 retries)
- Pre-computed `estimated_wait_mins` in IoT payload avoids redundant frontend math

### ✅ Testing
Run the backend test suite:
```bash
cd backend
python3 -m pip install --user -r requirements.txt
python3 -m pytest tests/ -v
```
Tests cover: mode setting, zone overrides, schema validation, alert severity thresholds, summary counters, and edge cases (empty data, negative values).

### ✅ Accessibility (WCAG 2.1 AA)
- All interactive elements have `aria-label`, `aria-pressed`, or `aria-live` attributes
- Keyboard navigation: SVG stands are focusable with `tabIndex=0` and `onKeyDown`
- Skip-to-main-content link (`<a class="skip-link">`)
- `:focus-visible` ring with sufficient contrast (3px accent-neon)
- `@media (prefers-reduced-motion: reduce)` disables all animations
- `role="alert"`, `role="status"`, `role="alertdialog"` on all dynamic regions
- Emergency dialog uses `aria-modal="true"` and `aria-labelledby`

### ✅ Google Services
- **Google Analytics** (GA4): `gtag` script in `index.html`; events tracked for login, navigation, food ordering, crowd actions
- **Google Maps**: Deep-link to venue coordinates from the Smart Navigator panel
- **Google Fonts**: Inter + Outfit served via Google Fonts CDN
- **PWA Manifest**: `manifest.json` for Firebase Hosting / Google Cloud Run deployment

---

## Local Development

### Prerequisites
- Python 3.10+
- Node.js 18+

### Backend
```bash
cd backend
python3 -m pip install --user -r requirements.txt
cp .env.example .env   # edit as needed
python3 main.py
# → http://localhost:8000
# → ws://localhost:8000/ws
# → http://localhost:8000/docs  (Swagger UI)
# → http://localhost:8000/health
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Demo Credentials
| Role | Ticket Code |
|------|-------------|
| Fan / Attendee | `TKT-123` (Sachin Tendulkar Stand, Lot P1, Seat A-45) |
| Fan / Attendee | `TKT-456` (MCA Pavilion, Lot P4, Seat VIP-02) |
| Admin | Any name — no ticket required |

---

## Deployment (Google Cloud Run)

```bash
# Backend
gcloud run deploy smartstadium-backend \
  --source ./backend \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars CORS_ORIGINS=https://your-frontend-url.run.app

# Frontend (build first)
cd frontend && npm run build
# Deploy dist/ to Firebase Hosting or Cloud Run static serving
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check + connected client count |
| POST | `/set_mode/{mode}` | Change simulation mode (Normal/Peak/Emergency) |
| WS | `/ws` | Real-time IoT data + admin commands |
| GET | `/docs` | Swagger UI |