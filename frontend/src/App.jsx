import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import './index.css'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const IS_PROD = import.meta.env.PROD;
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = IS_PROD 
  ? `${WS_PROTOCOL}//${window.location.host}/ws`
  : 'ws://localhost:8000/ws';
const GMAPS_VENUE_URL = 'https://www.google.com/maps/place/Wankhede+Stadium/@18.9388,72.8254,17z';

const VALID_TICKETS = {
  'TKT-123': { stand: 'Sachin_Tendulkar_Stand', lot: 'P1', seat: 'A-45' },
  'TKT-456': { stand: 'MCA_Pavilion', lot: 'P4', seat: 'VIP-02' },
};

const UPCOMING_MATCH = {
  teamA: 'MI', teamB: 'CSK', date: 'Apr 15, 7:30 PM', venue: 'Wankhede', tournament: 'IPL 2025'
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatName = (name) => name ? name.replace(/_/g, ' ') : '';
const calculateDistance = (p1, p2) => Math.hypot(p2.x - p1.x, p2.y - p1.y);
const getHeatmapColor = (u) => u > 0.85 ? 'status-red' : u > 0.65 ? 'status-yellow' : 'status-green';

/** Fire a Google Analytics event if gtag is available */
const trackEvent = (action, category, label) => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', action, { event_category: category, event_label: label });
  }
};

// ---------------------------------------------------------------------------
// Node position maps
// ---------------------------------------------------------------------------
const positionMap = {
  'Gate_1': { x: 5, y: 50 }, 'Gate_2': { x: 10, y: 30 }, 'Gate_3': { x: 10, y: 70 },
  'Gate_4': { x: 50, y: 10 }, 'Gate_5': { x: 90, y: 30 }, 'Gate_6': { x: 90, y: 70 }, 'Gate_7': { x: 95, y: 50 },
  'P1': { x: 25, y: 95 }, 'P2': { x: 75, y: 95 }, 'P3': { x: 25, y: 5 }, 'P4': { x: 75, y: 5 }, 'P5': { x: 50, y: 95 },
  'North_Stand': { x: 82, y: 50 }, 'MCA_Pavilion': { x: 72.6, y: 34.1 },
  'Garware_Pavilion_Stand': { x: 27.4, y: 65.9 }, 'Vijay_Merchant_Stand': { x: 27.4, y: 34.1 },
  'Sachin_Tendulkar_Stand': { x: 50, y: 72.5 }, 'Sunil_Gavaskar_Stand': { x: 72.6, y: 65.9 },
  'Vithal_Divecha_Stand': { x: 18, y: 50 }, 'Grand_Stand': { x: 50, y: 27.5 },
  'Powerplay_Pizza': { x: 35, y: 12 }, 'Dugout_Drinks': { x: 65, y: 12 },
  'Mumbai_Chaat_Corner': { x: 35, y: 88 }, 'Sixer_Snacks': { x: 65, y: 88 },
  'Third_Umpire_Cafe': { x: 88, y: 50 }, 'Pavilion_Grill': { x: 12, y: 50 },
};

const RESTROOM_MAP = {
  'Restroom_Block_B': { x: 20, y: 20 },
  'Restroom_Block_C': { x: 80, y: 20 },
  'Restroom_Medizone': { x: 50, y: 92 },
};

const ALL_STANDS = ['North_Stand','MCA_Pavilion','Grand_Stand','Vijay_Merchant_Stand','Garware_Pavilion_Stand','Vithal_Divecha_Stand','Sunil_Gavaskar_Stand','Sachin_Tendulkar_Stand'];
const ALL_GATES = ['Gate_1','Gate_2','Gate_3','Gate_4','Gate_5','Gate_6','Gate_7'];
const ALL_STALLS = ['Powerplay_Pizza','Dugout_Drinks','Mumbai_Chaat_Corner','Sixer_Snacks','Third_Umpire_Cafe','Pavilion_Grill'];
const ALL_RESTROOMS = ['Restroom_Block_B','Restroom_Block_C','Restroom_Medizone'];

// SVG paths for each stand
const STAND_PATHS = {
  "North_Stand": "M 704.7 445.0 L 890.8 390.0 A 420 300 0 0 1 890.8 610.0 L 704.7 555.0 A 220 150 0 0 0 704.7 445.0 Z",
  "Sunil_Gavaskar_Stand": "M 701.8 559.8 L 885.2 619.6 A 420 300 0 0 1 667.5 775.1 L 587.7 637.6 A 220 150 0 0 0 701.8 559.8 Z",
  "Sachin_Tendulkar_Stand": "M 580.6 639.6 L 653.9 779.1 A 420 300 0 0 1 346.1 779.1 L 419.4 639.6 A 220 150 0 0 0 580.6 639.6 Z",
  "Garware_Pavilion_Stand": "M 412.3 637.6 L 332.5 775.1 A 420 300 0 0 1 114.8 619.6 L 298.2 559.8 A 220 150 0 0 0 412.3 637.6 Z",
  "Vithal_Divecha_Stand": "M 295.3 555.0 L 109.2 610.0 A 420 300 0 0 1 109.2 390.0 L 295.3 445.0 A 220 150 0 0 0 295.3 555.0 Z",
  "Vijay_Merchant_Stand": "M 298.2 440.2 L 114.8 380.4 A 420 300 0 0 1 332.5 224.9 L 412.3 362.4 A 220 150 0 0 0 298.2 440.2 Z",
  "Grand_Stand": "M 419.4 360.4 L 346.1 220.9 A 420 300 0 0 1 653.9 220.9 L 580.6 360.4 A 220 150 0 0 0 419.4 360.4 Z",
  "MCA_Pavilion": "M 587.7 362.4 L 667.5 224.9 A 420 300 0 0 1 885.2 380.4 L 701.8 440.2 A 220 150 0 0 0 587.7 362.4 Z",
};

// ---------------------------------------------------------------------------
// Route computation (expensive — memoised in consumers)
// ---------------------------------------------------------------------------
const computeOptimalRoute = (ticketDetails, iotData) => {
  if (!ticketDetails || !iotData?.gates) return { activeGate: { id: 'Gate_4', waitMins: 0 }, skipped: null, navPath: null };
  const parkingPos = positionMap[ticketDetails.lot];
  const standPos = positionMap[ticketDetails.stand];
  if (!parkingPos || !standPos) return { activeGate: { id: 'Gate_4', waitMins: 0 }, skipped: null, navPath: null };

  const gates = iotData.gates
    .filter(g => positionMap[g.zone_id])
    .map(g => {
      const pos = positionMap[g.zone_id];
      const dist = calculateDistance(parkingPos, pos) + calculateDistance(pos, standPos);
      const waitMins = g.estimated_wait_mins ?? Math.ceil(g.crowd_count / (g.exit_rate_per_min || 1));
      return { id: g.zone_id, dist, waitMins, pos, jammed: (g.crowd_count / g.capacity) > 0.85 };
    })
    .sort((a, b) => a.dist - b.dist);

  let activeGate = gates[0];
  let skipped = null;
  if (gates.length > 1 && (gates[0].jammed || gates[0].waitMins > 10)) {
    const alt = gates.find(g => !g.jammed && g.waitMins <= gates[0].waitMins - 5);
    if (alt) { skipped = gates[0]; activeGate = alt; }
  }
  return { activeGate, skipped, navPath: { lot: ticketDetails.lot, gate: activeGate.id, stand: ticketDetails.stand, seat: ticketDetails.seat } };
};

// ---------------------------------------------------------------------------
// ConnectionStatus component
// ---------------------------------------------------------------------------
function ConnectionStatus({ status }) {
  const labels = { connected: '🟢 Live', connecting: '🟡 Connecting…', disconnected: '🔴 Offline' };
  return (
    <div className={`connection-banner ${status}`} role="status" aria-live="polite" aria-label={`WebSocket status: ${status}`}>
      <span className="conn-dot" aria-hidden="true" />
      {labels[status]}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuthScreen
// ---------------------------------------------------------------------------
function AuthScreen({ onLogin }) {
  const [role, setRole] = useState('user');
  const [username, setUsername] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (!username.trim()) { setError('Please enter your name.'); return; }
    const safeUser = username.trim().slice(0, 60);
    if (role === 'admin') {
      trackEvent('login', 'auth', 'admin');
      onLogin({ role: 'admin', username: safeUser, ticket: null, ticketDetails: null });
    } else {
      if (!ticketId) { setError('Please enter a valid ticket ID (e.g. TKT-123).'); return; }
      const safeTicket = ticketId.trim().toUpperCase().slice(0, 20);
      const details = VALID_TICKETS[safeTicket] ?? null;
      trackEvent('login', 'auth', 'attendee');
      onLogin({ role: 'user', username: safeUser, ticket: safeTicket, ticketDetails: details });
    }
  };

  return (
    <div className="auth-container" role="main">
      <div className="auth-card" role="region" aria-label="Login">
        <div className="auth-logo" aria-label="SmartStadium AI">Wankhede <span>Experience</span></div>
        <p className="auth-subtitle subtext">Official SmartStadium Platform</p>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <form onSubmit={handleLogin} className="auth-form" noValidate>
          <div className="form-group">
            <label id="role-label">Select Login Mode</label>
            <div className="role-toggles" role="group" aria-labelledby="role-label">
              <button type="button" id="btn-user" aria-pressed={role === 'user'}
                className={`role-btn ${role === 'user' ? 'active' : ''}`}
                onClick={() => setRole('user')}>Fan / Attendee</button>
              <button type="button" id="btn-admin" aria-pressed={role === 'admin'}
                className={`role-btn ${role === 'admin' ? 'active' : ''}`}
                onClick={() => setRole('admin')}>Command Center</button>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="input-name">Name</label>
            <input id="input-name" type="text" placeholder="Enter full name"
              value={username} onChange={e => setUsername(e.target.value)}
              autoComplete="name" required aria-required="true" maxLength={60} />
          </div>
          {role === 'user' && (
            <div className="form-group">
              <label htmlFor="input-ticket">Ticket Validation Code</label>
              <input id="input-ticket" type="text" placeholder="e.g. TKT-123"
                value={ticketId} onChange={e => setTicketId(e.target.value)}
                aria-describedby="ticket-hint" required aria-required="true" maxLength={20} />
              <small id="ticket-hint">Demo keys: TKT-123 or TKT-456</small>
            </div>
          )}
          <button type="submit" id="btn-enter" className="login-submit-btn">Enter Venue</button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stadium Map
// ---------------------------------------------------------------------------
const UserStadiumMap = ({ iotData, navPath, isNavigating }) => {
  const stands = iotData?.stands || [];
  const gates = iotData?.gates || [];
  const parking = iotData?.parking || [];
  const stalls = iotData?.food_stalls || [];
  const [zoomedStand, setZoomedStand] = useState(null);

  let amenityRoutePath = '', seatRoutePath = '';
  if (isNavigating && navPath) {
    if (navPath.amenity) {
      const sPos = positionMap[navPath.stand], aPos = positionMap[navPath.amenity] || RESTROOM_MAP[navPath.amenity];
      if (sPos && aPos) amenityRoutePath = `M ${sPos.x} ${sPos.y} Q ${(sPos.x+aPos.x)/2} ${Math.min(sPos.y,aPos.y)-10}, ${aPos.x} ${aPos.y}`;
    } else {
      const pPos = positionMap[navPath.lot], gPos = positionMap[navPath.gate], sPos = positionMap[navPath.stand];
      if (pPos && gPos && sPos) seatRoutePath = `M ${pPos.x} ${pPos.y} Q ${gPos.x} ${pPos.y}, ${gPos.x} ${gPos.y} T ${sPos.x} ${sPos.y}`;
    }
  }
  const activePath = seatRoutePath || amenityRoutePath;
  const jammedGates = new Set(gates.filter(g => (g.crowd_count/g.capacity) > 0.85).map(g => g.zone_id));

  return (
    <section className={`stadium-canvas user-mode ${isNavigating ? 'nav-active' : ''}`} aria-label="Interactive stadium map">
      <div className={`stadium-wrapper ${zoomedStand ? 'zoom-active' : ''}`}>
        <svg className="stadium-svg-ring" viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="Wankhede Stadium layout">
          <defs>
            <linearGradient id="grad-blue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1E3A8A" /><stop offset="100%" stopColor="#172554" /></linearGradient>
            <linearGradient id="grad-red" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#991B1B" /><stop offset="100%" stopColor="#450A0A" /></linearGradient>
            <linearGradient id="grad-orange" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C2410C" /><stop offset="100%" stopColor="#7C2D12" /></linearGradient>
            <linearGradient id="grad-green" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#166534" /><stop offset="100%" stopColor="#14532D" /></linearGradient>
          </defs>
          <ellipse cx="500" cy="500" rx="420" ry="300" className="svg-field-bounds" />
          {stands.map(stand => {
            const occ = stand.occupancy / stand.capacity;
            const isHighlighted = navPath?.stand === stand.stand_id;
            const isDimmed = isNavigating && !isHighlighted && !navPath?.amenity;
            const isJammed = occ > 0.85;
            return (
              <g key={stand.stand_id} role="button" tabIndex={0}
                aria-label={`${formatName(stand.stand_id)}: ${Math.round(occ*100)}% full${isJammed?' — jammed':''}`}
                onClick={() => setZoomedStand(zoomedStand === stand.stand_id ? null : stand.stand_id)}
                onKeyDown={e => e.key === 'Enter' && setZoomedStand(zoomedStand === stand.stand_id ? null : stand.stand_id)}
                className={`svg-stand-group ${isHighlighted||zoomedStand===stand.stand_id?'stand-highlighted':''} ${isDimmed?'dimmed':''} ${isJammed?'stand-jammed':''}`}>
                <path d={STAND_PATHS[stand.stand_id]} className={`svg-stand-path struct-${stand.stand_id}`} />
                <title>{`${formatName(stand.stand_id)} — ${Math.round(occ*100)}% full`}</title>
              </g>
            );
          })}
          <ellipse cx="500" cy="500" rx="215" ry="145" className="svg-pitch-outer" />
          <rect x="475" y="450" width="50" height="100" rx="2" className="svg-pitch-inner" />
          <text x="500" y="500" className="svg-pitch-label" alignmentBaseline="middle" textAnchor="middle" transform="rotate(-90 500 500)">CRICKET PITCH</text>
        </svg>

        <div className="stand-labels-overlay" aria-hidden="true">
          {stands.map(stand => {
            const pos = positionMap[stand.stand_id];
            if (!pos) return null;
            const isHighlighted = navPath?.stand === stand.stand_id;
            const isDimmed = isNavigating && !isHighlighted && !navPath?.amenity;
            return (
              <div key={`lbl-${stand.stand_id}`} className={`stand-label-float ${isHighlighted?'active':''} ${isDimmed?'dimmed':''}`}
                style={{ top:`${pos.y}%`, left:`${pos.x}%` }}>
                <span>{formatName(stand.stand_id).replace(' Stand','').replace(' Pavilion','')}</span>
              </div>
            );
          })}
        </div>

        {isNavigating && activePath && (
          <svg className="route-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d={activePath} className="dash-anim-dynamic" />
          </svg>
        )}

        {parking.map(lot => {
          const pos = positionMap[lot.lot_id]; if (!pos) return null;
          const usage = lot.occupancy / lot.capacity;
          const isHighlighted = navPath?.lot === lot.lot_id;
          const isDimmed = isNavigating && !isHighlighted;
          return (
            <div key={lot.lot_id} className={`map-node formal-node obj-park ${isDimmed?'hidden-node':''}`}
              style={{ top:`${pos.y}%`, left:`${pos.x}%` }}
              role="img" aria-label={`Parking ${lot.lot_id}: ${lot.occupancy}/${lot.capacity} spaces used`}>
              <div className={`node-circle ${getHeatmapColor(usage)}`}>P</div>
              <div className="node-tooltip">{formatName(lot.lot_id)}</div>
              {isHighlighted && <div className="nav-pin" aria-hidden="true">📍</div>}
            </div>
          );
        })}

        {gates.map(gate => {
          const pos = positionMap[gate.zone_id]; if (!pos) return null;
          const usage = gate.crowd_count / gate.capacity;
          const isHighlighted = navPath?.gate === gate.zone_id;
          const isDimmed = isNavigating && !isHighlighted && !navPath?.amenity;
          const isJam = jammedGates.has(gate.zone_id);
          const wait = gate.estimated_wait_mins ?? Math.ceil(gate.crowd_count / (gate.exit_rate_per_min || 1));
          return (
            <div key={gate.zone_id} className={`map-node formal-node obj-gate ${isDimmed?'hidden-node':''} ${isJam?'gate-jammed':''}`}
              style={{ top:`${pos.y}%`, left:`${pos.x}%` }}
              role="img" aria-label={`${formatName(gate.zone_id)}: ${Math.round(usage*100)}% capacity, ~${wait} min wait${isJam?' — jammed':''}`}>
              <div className={`node-circle ${getHeatmapColor(usage)}`}>{isJam?'🚫':'G'}</div>
              <div className="mini-wait-flag" aria-hidden="true">{wait}m</div>
              <div className="node-tooltip">{formatName(gate.zone_id)}{isJam?' — JAMMED':''}</div>
              {isHighlighted && <div className="nav-pin" aria-hidden="true">📍</div>}
            </div>
          );
        })}

        {stalls.map(stall => {
          const pos = positionMap[stall.location]; if (!pos) return null;
          const isDimmed = isNavigating && navPath?.amenity && navPath.amenity !== stall.location;
          const isHighlighted = navPath?.amenity === stall.location;
          return (
            <div key={stall.location} className={`map-node amenity-node tooltip-persist ${isDimmed?'hidden-node':''}`}
              style={{ top:`${pos.y}%`, left:`${pos.x}%`, zIndex:30 }}
              role="img" aria-label={`${formatName(stall.location)} food stall, ~${stall.estimated_wait_mins??'?'} min wait`}>
              <div className="node-circle" style={{ background: isHighlighted?'var(--accent-neon)':'#2A3143' }}>🍔</div>
              <div className="node-tooltip">{formatName(stall.location)}</div>
              {isHighlighted && <div className="nav-pin" aria-hidden="true">📍</div>}
            </div>
          );
        })}

        {Object.entries(RESTROOM_MAP).map(([id, pos]) => {
          const isDimmed = isNavigating && navPath?.amenity && navPath.amenity !== id;
          const isHighlighted = navPath?.amenity === id;
          return (
            <div key={id} className={`map-node amenity-node tooltip-persist ${isDimmed?'hidden-node':''}`}
              style={{ top:`${pos.y}%`, left:`${pos.x}%`, zIndex:30 }}
              role="img" aria-label={`${formatName(id)} restroom`}>
              <div className="node-circle" style={{ background: isHighlighted?'#10B981':'#232A39' }}>🚻</div>
              <div className="node-tooltip">{formatName(id)}</div>
              {isHighlighted && <div className="nav-pin" aria-hidden="true">📍</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------
// Order Modal
// ---------------------------------------------------------------------------
function OrderModal({ stall, onClose }) {
  const [stage, setStage] = useState('menu');
  const [item, setItem] = useState(null);
  const MENU = ['Veg Burger ₹180', 'Cheese Fries ₹120', 'Masala Chai ₹60', 'Cold Drink ₹80'];
  const closeRef = useRef();
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    if (stage === 'preparing') {
      const t = setTimeout(() => setStage('done'), 3500);
      return () => clearTimeout(t);
    }
  }, [stage]);
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Order from ${formatName(stall)}`} onClick={onClose}>
      <div className="order-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🍔 {formatName(stall)}</h3>
          <button className="modal-close" ref={closeRef} onClick={onClose} aria-label="Close order dialog">✕</button>
        </div>
        {stage === 'menu' && (
          <>{MENU.map(m => (
            <button key={m} onClick={() => { setItem(m); setStage('confirming'); trackEvent('add_to_cart','food',m); }}
              className={`menu-item-btn ${item===m?'selected':''}`}>{m}</button>
          ))}</>
        )}
        {stage === 'confirming' && (
          <div className="order-confirm">
            <p>Confirm order: <strong>{item}</strong>?</p>
            <div style={{ display:'flex', gap:'10px', marginTop:'1rem' }}>
              <button className="nav-start-btn" style={{flex:1,padding:'10px'}} onClick={() => { setStage('preparing'); trackEvent('purchase','food',item); }}>✅ Confirm Order</button>
              <button className="nav-start-btn active" style={{flex:1,padding:'10px'}} onClick={() => setStage('menu')}>← Back</button>
            </div>
          </div>
        )}
        {stage === 'preparing' && (
          <div className="order-status-wrap" role="status" aria-live="polite">
            <div className="order-spinner" aria-hidden="true" />
            <p className="order-status-text">🔥 Preparing <strong>{item}</strong>…</p>
            <p className="subtext">Estimated delivery: ~8 mins to your seat</p>
          </div>
        )}
        {stage === 'done' && (
          <div className="order-status-wrap" role="status" aria-live="polite">
            <div className="order-done-icon" aria-hidden="true">✅</div>
            <p className="order-status-text">Order confirmed!</p>
            <p className="subtext"><strong>{item}</strong> arriving in <strong>~8 mins</strong>.</p>
            <button className="nav-start-btn" style={{marginTop:'1rem',width:'100%'}} onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// User Dashboard
// ---------------------------------------------------------------------------
function UserDashboard({ user, logout, globalAlert, iotData, wsStatus }) {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [cheerOverlay, setCheerOverlay] = useState(null);
  const [lightShow, setLightShow] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [amenityNav, setAmenityNav] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [orderModal, setOrderModal] = useState(null);
  const [escapePopup, setEscapePopup] = useState(false);

  // Memoised — only recomputes when iotData or ticketDetails changes
  const { activeGate, skipped, navPath } = useMemo(
    () => computeOptimalRoute(user.ticketDetails, iotData),
    [user.ticketDetails, iotData]
  );

  let finalNavPath = navPath;
  if (amenityNav) finalNavPath = { ...navPath, amenity: amenityNav };

  const getBestRestroom = useCallback(() => {
    if (!iotData?.restrooms) return 'Restroom_Block_B';
    return [...iotData.restrooms].sort((a,b) => (a.occupancy/a.capacity)-(b.occupancy/b.capacity))[0]?.restroom_id || 'Restroom_Block_B';
  }, [iotData?.restrooms]);

  const getBestFood = useCallback(() => {
    if (!iotData?.food_stalls) return 'Powerplay_Pizza';
    return [...iotData.food_stalls].sort((a,b) => (a.queue_length*a.avg_service_time_sec)-(b.queue_length*b.avg_service_time_sec))[0]?.location || 'Powerplay_Pizza';
  }, [iotData?.food_stalls]);

  useEffect(() => {
    if (!globalAlert) return;
    if (globalAlert.type === 'cheer_sync') {
      setCheerOverlay(globalAlert.message || 'SIX!');
      setTimeout(() => setCheerOverlay(null), 4000);
      navigator.vibrate?.([200, 100, 200]);
    } else if (globalAlert.type === 'light_show') {
      setLightShow(true);
      setTimeout(() => setLightShow(false), 5000);
    } else if (globalAlert.type === 'emergency') {
      setEscapePopup(true);
      setToasts(p => [...p, { id: Date.now(), msg: globalAlert.message || 'Emergency: Please evacuate calmly via nearest gate.' }]);
      setTimeout(() => setToasts(p => p.slice(1)), 10000);
    } else if (globalAlert.type === 'announcement') {
      setToasts(p => [...p, { id: Date.now(), msg: globalAlert.message }]);
      setTimeout(() => setToasts(p => p.slice(1)), 6000);
    }
  }, [globalAlert]);

  if (!user.ticketDetails) {
    return (
      <div className="app-container attendee-layout restricted-bg">
        <header className="formal-header">
          <div className="logo">Wankhede <span>Experience</span></div>
          <button onClick={logout} className="logout-btn slim" aria-label="Sign out">Sign Out</button>
        </header>
        <main className="restricted-content" id="main-content">
          <span className="lock-icon" aria-hidden="true">🔒</span>
          <h2>Restricted View</h2>
          <p className="subtext">Your ticket could not be validated. Please check your ticket code.</p>
        </main>
      </div>
    );
  }

  const myStandObj = iotData?.stands?.find(s => s.stand_id === user.ticketDetails.stand);
  const standFill = myStandObj ? Math.round((myStandObj.occupancy / myStandObj.capacity) * 100) : 80;
  const nearbyFood = (iotData?.food_stalls || []).slice(0, 3).map(stall => ({
    ...stall, waitMins: (stall.estimated_wait_mins ?? Math.round((stall.queue_length * stall.avg_service_time_sec) / 60)) || 3
  }));

  return (
    <div className={`app-container attendee-layout ${lightShow ? 'light-show-active' : ''}`}>
      {orderModal && <OrderModal stall={orderModal} onClose={() => setOrderModal(null)} />}

      {escapePopup && (
        <div className="escape-popup" role="alertdialog" aria-modal="true" aria-labelledby="escape-title" aria-describedby="escape-desc">
          <div className="escape-inner">
            <div style={{ fontSize:'2.5rem' }} aria-hidden="true">🚨</div>
            <h2 id="escape-title">Emergency Evacuation</h2>
            <p id="escape-desc">Please evacuate calmly using the nearest available exit gate. Follow staff instructions.</p>
            <button className="nav-start-btn" style={{ marginTop:'1rem' }} onClick={() => setEscapePopup(false)}>I Understand</button>
          </div>
        </div>
      )}

      {cheerOverlay && (
        <div className="cheer-fullscreen-overlay" role="status" aria-live="assertive">
          <div className="cheer-text-boom">{cheerOverlay}</div>
          <div className="confetti-spawner" aria-hidden="true">🎇 🏏 🎇 🏏 🏏</div>
        </div>
      )}

      <div className="toast-container" role="log" aria-live="polite" aria-label="Stadium announcements">
        {toasts.map(t => (
          <div key={t.id} className="toast-message"><span className="toast-icon" aria-hidden="true">📢</span> {t.msg}</div>
        ))}
      </div>

      <header className="attendee-banner clean">
        <div className="logo-small" aria-label="SmartStadium AI">Wankhede <span>Experience</span></div>
        <div className="user-profile">
          <ConnectionStatus status={wsStatus} />
          <span aria-label={`Logged in as ${user.username}`}>{user.username}</span>
          <button onClick={logout} className="logout-btn slim" aria-label="Exit and sign out">Exit</button>
        </div>
      </header>

      <main id="main-content" className="layout-split">
        <div className="main-map-area">
          <UserStadiumMap iotData={iotData} navPath={finalNavPath} isNavigating={isNavigating || !!amenityNav} />
          {isNavigating && !amenityNav && (
            <div className="on-map-directions" role="status" aria-live="polite">
              <h4>Optimal Route Engaged</h4>
              <p>Proceed via <strong>{formatName(activeGate.id)}</strong>.</p>
              <p className="dir-highlight">Estimated Wait: {activeGate.waitMins} min</p>
              {skipped && <p className="skipped-reason">* Skipped {formatName(skipped.id)} — jammed ({skipped.waitMins}m queue).</p>}
            </div>
          )}
          {amenityNav && (
            <div className="on-map-directions" role="status" aria-live="polite">
              <h4>Routing to {formatName(amenityNav)}</h4>
              <p className="dir-highlight">Follow the dotted path on the map.</p>
              <button style={{marginTop:'8px',background:'none',border:'1px solid var(--panel-border)',color:'var(--text-muted)',borderRadius:'6px',padding:'4px 10px',cursor:'pointer',fontSize:'0.8rem'}}
                onClick={() => setAmenityNav(null)} aria-label="Cancel amenity navigation">✕ Cancel</button>
            </div>
          )}
        </div>

        <aside className="engagement-panel structured" aria-label="Stadium information panel">
          <div className="match-hero-card" aria-label="Live match scorecard">
            <p className="league-title">MATCH DAY LIVE · IPL 2025</p>
            <div className="teams-row">
              <div className="team-col rr-accent"><h2>RR</h2><p>143/4</p></div>
              <div className="vs-badge" aria-label="versus">VS</div>
              <div className="team-col mi-accent"><h2>MI</h2><p>110/3</p></div>
            </div>
            <p className="subtext" style={{textAlign:'center',marginTop:'8px',fontSize:'0.75rem'}}>Overs: 16.3 · Target: 144</p>
          </div>

          <div className="formal-card main-ticket-card" aria-label="Smart Navigator">
            <h3>🎫 Smart Navigator</h3>
            <div className="ticket-summary clean">
              <div className="t-row"><span>Seat</span><strong>{user.ticketDetails.seat}</strong></div>
              <div className="t-row"><span>Zone</span><strong>{formatName(user.ticketDetails.stand)}</strong></div>
            </div>
            <p className="subtext" style={{marginBottom:'8px'}}>
              Stand fill: <strong style={{color: standFill > 85 ? 'var(--danger)' : 'var(--success)'}}>{standFill}%</strong>
            </p>
            {isNavigating && !amenityNav && navPath && (
              <div className="nav-strip-anim" aria-label="Route: parking to seat">
                <div className="nav-step">🚗 {navPath.lot}</div>
                <span className="arrows" aria-hidden="true">⇢</span>
                <div className="nav-step">🚪 {navPath.gate.replace('Gate_','G')}</div>
                <span className="arrows" aria-hidden="true">⇢</span>
                <div className="nav-step active">📍 {navPath.seat}</div>
              </div>
            )}
            <button className={`nav-start-btn ${isNavigating ? 'active' : ''}`}
              aria-pressed={isNavigating}
              onClick={() => { setIsNavigating(!isNavigating); setAmenityNav(null); trackEvent('navigate','ux',isNavigating?'stop':'start'); }}>
              {isNavigating ? 'Stop Navigation' : '🧭 Navigate from Lot to Seat'}
            </button>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginTop:'10px'}}>
              <button aria-pressed={!!amenityNav && !['Restroom_Block_B','Restroom_Block_C','Restroom_Medizone'].includes(amenityNav)}
                onClick={() => { const f = getBestFood(); setAmenityNav(amenityNav===f?null:f); setIsNavigating(false); trackEvent('navigate','food',f); }}
                className={`nav-start-btn ${amenityNav&&!ALL_RESTROOMS.includes(amenityNav)?'active':''}`}
                style={{padding:'8px',fontSize:'0.82rem'}}>🍔 Find Food</button>
              <button aria-pressed={ALL_RESTROOMS.includes(amenityNav)}
                onClick={() => { const r = getBestRestroom(); setAmenityNav(amenityNav===r?null:r); setIsNavigating(false); trackEvent('navigate','restroom',r); }}
                className={`nav-start-btn ${ALL_RESTROOMS.includes(amenityNav)?'active':''}`}
                style={{padding:'8px',fontSize:'0.82rem'}}>🚻 Best Restroom</button>
            </div>
            {/* Google Maps deep link */}
            <a href={GMAPS_VENUE_URL} target="_blank" rel="noopener noreferrer"
              className="gmaps-link" aria-label="Open Wankhede Stadium in Google Maps (opens new tab)"
              onClick={() => trackEvent('external_link','google_maps','venue')}>
              🗺️ Open in Google Maps
            </a>
          </div>

          <div className="formal-card stats-row" aria-label="Nearby food stalls">
            <h3>🍔 Nearby Food Stalls</h3>
            <p className="subtext" style={{marginBottom:'8px'}}>Closest to {formatName(user.ticketDetails.stand)}</p>
            <div className="stalls-list" role="list">
              {nearbyFood.map((stall, i) => (
                <div key={i} className="stall-row" role="listitem">
                  <span className="stall-name">{formatName(stall.location)}</span>
                  <span className="stall-wait" aria-label={`${stall.waitMins} minute wait`}>~{stall.waitMins}m wait</span>
                  <button className="stall-order-btn" aria-label={`Order from ${formatName(stall.location)}`}
                    onClick={() => { setOrderModal(stall.location); trackEvent('order_start','food',stall.location); }}>Order</button>
                </div>
              ))}
            </div>
          </div>

          <div className="formal-card engagement-card" aria-label="Fan poll">
            <h3>🏆 Fan Pulse</h3>
            <div className="polling-box minimal" role="group" aria-label="Which team are you supporting?">
              <button id="poll-rr" aria-pressed={selectedTeam==='RR'} className={`poll-btn rr ${selectedTeam==='RR'?'selected':''}`}
                onClick={() => { setSelectedTeam('RR'); trackEvent('poll','engagement','RR'); }}>RR</button>
              <button id="poll-mi" aria-pressed={selectedTeam==='MI'} className={`poll-btn mi ${selectedTeam==='MI'?'selected':''}`}
                onClick={() => { setSelectedTeam('MI'); trackEvent('poll','engagement','MI'); }}>MI</button>
            </div>
            {selectedTeam && (
              <div className="poll-results modern" role="img" aria-label="RR 45% vs MI 55%">
                <div className="poll-bar rr-bar" style={{width:'45%'}} />
                <div className="poll-bar mi-bar" style={{width:'55%'}} />
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin Dashboard
// ---------------------------------------------------------------------------
function AdminDashboard({ user, logout, iotData, sendCommand, wsStatus }) {
  const totalOcc = iotData?.stands?.reduce((a,s) => a+s.occupancy, 0) || 0;
  const totalCap = iotData?.stands?.reduce((a,s) => a+s.capacity, 0) || 1;
  const overallFill = Math.round((totalOcc/totalCap)*100);
  const avgWait = iotData?.gates
    ? Math.round(iotData.gates.reduce((a,g) => a + (g.estimated_wait_mins ?? Math.ceil(g.crowd_count/(g.exit_rate_per_min||1))), 0) / iotData.gates.length)
    : 0;

  const [selectedZone, setSelectedZone] = useState('');
  const [selectedGate, setSelectedGate] = useState('');
  const [controlTarget, setControlTarget] = useState('stand');

  const getTargetList = () => ({ stand:ALL_STANDS, gate:ALL_GATES, stall:ALL_STALLS, restroom:ALL_RESTROOMS }[controlTarget]);
  const selectedId = controlTarget === 'gate' ? selectedGate : selectedZone;
  const setSelected = v => controlTarget === 'gate' ? setSelectedGate(v) : setSelectedZone(v);

  const handleSpike = () => {
    if (!selectedId) return;
    sendCommand({ type:'set_override', zone_id:selectedId, value: controlTarget==='gate'?490:3950 });
    trackEvent('spike','admin',selectedId);
  };

  return (
    <div className="app-container admin-layout">
      <header className="formal-header" role="banner">
        <div className="logo">Wankhede <span>Admin Command Center</span></div>
        <div className="user-profile">
          <ConnectionStatus status={wsStatus} />
          <span style={{color:'var(--accent-neon)',fontWeight:700}} aria-live="polite" aria-label={`Stadium fill: ${overallFill}%`}>Fill: {overallFill}%</span>
          <button onClick={logout} className="logout-btn slim" aria-label="Sign out of admin">Sign Out</button>
        </div>
      </header>

      <div className="admin-stats-bar" role="region" aria-label="Stadium statistics">
        <div className="admin-stat"><span className="stat-val">{totalOcc.toLocaleString()}</span><span className="stat-lbl">Seats Occupied</span></div>
        <div className="admin-stat"><span className="stat-val">{totalCap.toLocaleString()}</span><span className="stat-lbl">Total Capacity</span></div>
        <div className="admin-stat"><span className="stat-val" style={{color:overallFill>85?'var(--danger)':'var(--success)'}}>{overallFill}%</span><span className="stat-lbl">Overall Fill</span></div>
        <div className="admin-stat"><span className="stat-val">{avgWait}m</span><span className="stat-lbl">Avg Gate Wait</span></div>
        <div className="admin-stat upcoming-match-stat">
          <span className="stat-val" style={{fontSize:'0.9rem'}}>{UPCOMING_MATCH.teamA} vs {UPCOMING_MATCH.teamB}</span>
          <span className="stat-lbl">{UPCOMING_MATCH.date} · Next Match</span>
        </div>
      </div>

      <div className="layout-split" style={{marginTop:'0.5rem',flex:1}}>
        <div className="main-map-area">
          <UserStadiumMap iotData={iotData} isNavigating={false} navPath={null} />
        </div>

        <aside className="engagement-panel structured" style={{minWidth:'380px',maxWidth:'420px'}} aria-label="Admin controls">
          <div className="match-hero-card" style={{marginBottom:'0.8rem'}}>
            <p className="league-title">LIVE SCORECARD · IPL 2025</p>
            <div className="teams-row">
              <div className="team-col rr-accent"><h2>RR</h2><p style={{fontSize:'1rem'}}>143/4</p><p className="subtext">16.3 ov</p></div>
              <div className="vs-badge" aria-label="versus">VS</div>
              <div className="team-col mi-accent"><h2>MI</h2><p style={{fontSize:'1rem'}}>110/3</p><p className="subtext">12.0 ov</p></div>
            </div>
            <div style={{borderTop:'1px solid var(--panel-border)',marginTop:'10px',paddingTop:'8px'}}>
              <p className="subtext" style={{textAlign:'center',fontSize:'0.72rem',letterSpacing:'1px',fontWeight:600}}>
                NEXT: {UPCOMING_MATCH.teamA} vs {UPCOMING_MATCH.teamB} · {UPCOMING_MATCH.date}
              </p>
            </div>
          </div>

          <div className="formal-card" style={{padding:'1rem',marginBottom:'0.8rem'}} role="region" aria-label="Crowd Control Panel">
            <h3 style={{fontSize:'0.9rem',marginBottom:'0.5rem'}}>🛠️ Crowd Control</h3>
            <div role="group" aria-label="Select zone type" style={{display:'flex',gap:'6px',marginBottom:'8px',flexWrap:'wrap'}}>
              {['stand','gate','stall','restroom'].map(t => (
                <button key={t} aria-pressed={controlTarget===t}
                  onClick={() => { setControlTarget(t); setSelectedZone(''); setSelectedGate(''); }}
                  style={{padding:'4px 10px',borderRadius:'20px',fontSize:'0.75rem',border:'1px solid var(--panel-border)',cursor:'pointer',fontWeight:600,background:controlTarget===t?'var(--accent-neon)':'transparent',color:controlTarget===t?'#000':'var(--text-muted)',transition:'0.2s'}}>
                  {t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>
            <label htmlFor="zone-select" className="subtext" style={{display:'block',marginBottom:'4px'}}>Select {controlTarget}</label>
            <select id="zone-select" value={selectedId} onChange={e => setSelected(e.target.value)}
              aria-label={`Select ${controlTarget} to control`}
              style={{width:'100%',background:'#0F1218',color:'#fff',border:'1px solid var(--panel-border)',borderRadius:'6px',padding:'8px',fontSize:'0.85rem',marginBottom:'8px',cursor:'pointer'}}>
              <option value="">— Select {controlTarget} —</option>
              {getTargetList().map(id => <option key={id} value={id}>{formatName(id)}</option>)}
            </select>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
              <button disabled={!selectedId} onClick={handleSpike}
                aria-label={selectedId ? `Simulate jam at ${formatName(selectedId)}` : 'Select a zone first'}
                style={{background:selectedId?'var(--warn)':'#2A3143',color:selectedId?'#000':'#555',padding:'8px',borderRadius:'6px',fontSize:'0.82rem',fontWeight:700,cursor:selectedId?'pointer':'not-allowed',border:'none'}}>
                🔴 Spike / Jam
              </button>
              <button onClick={() => { sendCommand({ type:'reset_overrides' }); trackEvent('reset','admin','all'); }}
                aria-label="Reset all zone overrides"
                style={{background:'var(--success)',color:'#fff',padding:'8px',borderRadius:'6px',fontSize:'0.82rem',fontWeight:700,border:'none',cursor:'pointer'}}>
                ✅ Reset All
              </button>
            </div>
          </div>

          <div className="formal-card" style={{padding:'1rem',marginBottom:'0.8rem'}} role="region" aria-label="Engagement Sync">
            <h3 style={{fontSize:'0.9rem',marginBottom:'8px'}}>🎉 Engagement Sync</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px'}} role="group">
              <button aria-label="Trigger Sixer cheer animation" onClick={() => { sendCommand({ type:'cheer_sync', message:'SIX! 🏏' }); trackEvent('cheer','engagement','six'); }}
                style={{background:'var(--mi-color)',color:'#fff',padding:'8px',borderRadius:'6px',fontSize:'0.78rem',fontWeight:700,border:'none',cursor:'pointer'}}>Sixer 🏏</button>
              <button aria-label="Trigger Wicket cheer animation" onClick={() => { sendCommand({ type:'cheer_sync', message:'WICKET! 🎉' }); trackEvent('cheer','engagement','wicket'); }}
                style={{background:'var(--rr-color)',color:'#fff',padding:'8px',borderRadius:'6px',fontSize:'0.78rem',fontWeight:700,border:'none',cursor:'pointer'}}>Wicket 🎉</button>
              <button aria-label="Trigger light show animation" onClick={() => { sendCommand({ type:'light_show' }); trackEvent('light_show','engagement','on'); }}
                style={{background:'#8B5CF6',color:'#fff',padding:'8px',borderRadius:'6px',fontSize:'0.78rem',fontWeight:700,border:'none',cursor:'pointer'}}>Lights ✨</button>
            </div>
          </div>

          <div className="formal-card" style={{padding:'1rem',marginBottom:'0.8rem'}} role="region" aria-label="Emergency Management">
            <h3 style={{fontSize:'0.9rem',marginBottom:'8px'}}>🚨 Emergency</h3>
            <button
              aria-label="Trigger emergency evacuation alert to all attendees"
              onClick={() => { sendCommand({ mode:'Emergency', type:'emergency', message:'Emergency: Evacuate calmly via nearest available gate.' }); trackEvent('emergency','admin','trigger'); }}
              style={{width:'100%',background:'var(--danger)',color:'#fff',padding:'10px',borderRadius:'6px',fontSize:'0.85rem',fontWeight:700,border:'none',cursor:'pointer'}}>
              🚨 Trigger Evacuation Alert
            </button>
          </div>

          <div className="formal-card" style={{padding:'1rem',flex:1,overflowY:'auto'}} role="region" aria-label="Gate Inspector">
            <h3 style={{fontSize:'0.9rem',marginBottom:'5px'}}>📊 Gate Inspector</h3>
            <div role="list">
              {iotData?.gates?.map(g => {
                const wait = g.estimated_wait_mins ?? Math.ceil(g.crowd_count / (g.exit_rate_per_min||1));
                const jammed = g.crowd_count / g.capacity > 0.85;
                return (
                  <div key={g.zone_id} role="listitem"
                    aria-label={`${formatName(g.zone_id)}: ${g.crowd_count}/${g.capacity} people, ${wait} min wait${jammed?' — jammed':''}`}
                    style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid var(--panel-border)',fontSize:'0.82rem'}}>
                    <span style={{color:jammed?'var(--danger)':'var(--text-muted)'}}>{jammed?'🚫 ':''}{g.zone_id.replace('_',' ')}</span>
                    <span style={{color:jammed?'var(--danger)':'var(--success)'}}>{g.crowd_count}/{g.capacity} · {wait}m</span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root App — WebSocket with exponential backoff reconnect
// ---------------------------------------------------------------------------
const WS_MAX_RETRIES = 8;
const WS_BASE_DELAY_MS = 1000;

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [iotData, setIotData] = useState(null);
  const [globalAlert, setGlobalAlert] = useState(null);
  const [wsStatus, setWsStatus] = useState('connecting'); // connecting | connected | disconnected
  const wsRef = useRef(null);
  const retryCount = useRef(0);
  const retryTimer = useRef(null);

  const connectWS = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState < 2) return; // already open/connecting
    setWsStatus('connecting');
    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;

    socket.onopen = () => {
      setWsStatus('connected');
      retryCount.current = 0;
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.iot_data) setIotData(payload.iot_data);
        if (['cheer_sync','announcement','emergency','light_show'].includes(payload.type)) {
          setGlobalAlert({ ...payload, _ts: Date.now() });
        }
      } catch { /* ignore malformed frames */ }
    };

    socket.onerror = () => setWsStatus('disconnected');

    socket.onclose = () => {
      setWsStatus('disconnected');
      if (retryCount.current < WS_MAX_RETRIES) {
        const delay = Math.min(WS_BASE_DELAY_MS * 2 ** retryCount.current, 30000);
        retryCount.current += 1;
        retryTimer.current = setTimeout(connectWS, delay);
      }
    };
  }, []);

  useEffect(() => {
    connectWS();
    return () => {
      clearTimeout(retryTimer.current);
      wsRef.current?.close();
    };
  }, [connectWS]);

  const sendCommand = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  if (!currentUser) return <AuthScreen onLogin={setCurrentUser} />;

  if (!iotData) {
    return (
      <div className="app-container" style={{alignItems:'center',justifyContent:'center'}}>
        <div className="loading-state" role="status" aria-live="polite">
          <div className="loading-spinner" aria-hidden="true" />
          <p>Connecting to SmartStadium…</p>
          <ConnectionStatus status={wsStatus} />
        </div>
      </div>
    );
  }

  if (currentUser.role === 'admin') {
    return <AdminDashboard user={currentUser} logout={() => setCurrentUser(null)} iotData={iotData} sendCommand={sendCommand} wsStatus={wsStatus} />;
  }
  return <UserDashboard user={currentUser} logout={() => setCurrentUser(null)} globalAlert={globalAlert} iotData={iotData} wsStatus={wsStatus} />;
}

export default App;
