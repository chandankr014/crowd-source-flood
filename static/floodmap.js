/* =============================================================================
   AIResQ Flood Map — WebSocket Real-Time + Google Maps
   No sequential marker animation. All markers appear instantly.
   ============================================================================= */

// =============================================================================
// CONFIGURATION
// =============================================================================
const DEFAULT_BOUNDS = { minLat: 8.0, maxLat: 37.0, minLng: 68.0, maxLng: 97.5 };
const MAP_CONFIG     = { defaultZoom: 12, minZoom: 5, maxZoom: 20 };

// =============================================================================
// STATE
// =============================================================================
let map = null;
let markers = [];
let labelOverlays = [];
let currentBasemap = 'satellite';
let isInitialLoad = true;
let allSubmissions = [];          // full list (used for stats + de-dup)
let knownIds = new Set();         // track IDs already on the map
let latestMarkerId = null;        // ID of the marker with "latest" styling

// Latest-card
let latestCardData = null;        // store for re-expand

// Socket
let socket = null;

// =============================================================================
// POSITION PERSISTENCE
// =============================================================================
function saveMapPosition() {
    if (!map) return;
    const c = map.getCenter();
    sessionStorage.setItem('floodmap_position', JSON.stringify({
        lat: c.lat(), lng: c.lng(), zoom: map.getZoom()
    }));
}
function restoreMapPosition() {
    try {
        const s = sessionStorage.getItem('floodmap_position');
        if (s) { const p = JSON.parse(s); if (p.lat && p.lng && p.zoom) return p; }
    } catch (_) {}
    return null;
}

// =============================================================================
// MAP INITIALIZATION
// =============================================================================
function initMap() {
    const el = document.getElementById('map');
    if (!el) return;
    if (!window.google || !window.google.maps) {
        setTimeout(initMap, 500);
        return;
    }

    const saved = restoreMapPosition();
    const center = saved
        ? { lat: saved.lat, lng: saved.lng }
        : { lat: (DEFAULT_BOUNDS.minLat + DEFAULT_BOUNDS.maxLat) / 2,
            lng: (DEFAULT_BOUNDS.minLng + DEFAULT_BOUNDS.maxLng) / 2 };
    const zoom = saved ? saved.zoom : MAP_CONFIG.defaultZoom;

    map = new google.maps.Map(el, {
        center, zoom,
        minZoom: MAP_CONFIG.minZoom, maxZoom: MAP_CONFIG.maxZoom,
        mapTypeId: 'satellite',
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
        mapTypeControl: false, streetViewControl: false, fullscreenControl: false,
        gestureHandling: 'greedy'
    });

    map.addListener('idle', saveMapPosition);
    isInitialLoad = !saved;

    // Initial load — all markers at once
    loadSubmissions();

    // Start WebSocket for real-time updates
    initSocket();

    console.log('Flood Map initialised — WebSocket real-time');
}

// =============================================================================
// BASEMAP CONTROL
// =============================================================================
function setBasemap(type) {
    if (!map) return;
    currentBasemap = type;
    document.querySelectorAll('.fm-btn').forEach(b => {
        if (b.id && b.id.startsWith('basemap')) b.classList.remove('active');
    });
    const id = 'basemap' + type.charAt(0).toUpperCase() + type.slice(1);
    const btn = document.getElementById(id);
    if (btn) btn.classList.add('active');
    map.setMapTypeId(type);
}

// =============================================================================
// DATA LOADING  (initial + fallback)
// =============================================================================
async function loadSubmissions() {
    try {
        showRefreshIndicator(true);
        const res = await fetch('/api/submissions');
        const submissions = await res.json();
        submissions.sort((a, b) => new Date(a.received_at || 0) - new Date(b.received_at || 0));
        allSubmissions = submissions;
        knownIds = new Set(submissions.map(s => s.id));
        clearMarkers();
        displayAllMarkers(submissions);
        updateStats(submissions);
        showRefreshIndicator(false);
        console.log(`Loaded ${submissions.length} submissions`);
    } catch (err) {
        console.error('Error loading submissions:', err);
        showRefreshIndicator(false);
    }
}

// =============================================================================
// DISPLAY ALL MARKERS (instant, no animation)
// Highlights only the most recent submission.
// =============================================================================
function displayAllMarkers(submissions) {
    let bounds = new google.maps.LatLngBounds();
    let hasValid = false;

    // Find the latest submission by received_at
    let latestSub = null;
    submissions.forEach(s => {
        if (!s.gps || !s.gps.lat || !s.gps.lon) return;
        if (!latestSub || new Date(s.received_at) > new Date(latestSub.received_at)) {
            latestSub = s;
        }
    });

    submissions.forEach(sub => {
        if (!sub.gps || !sub.gps.lat || !sub.gps.lon) return;
        const isLatest = latestSub && sub.id === latestSub.id;
        const marker = createMarker(sub, isLatest);
        if (marker) {
            markers.push(marker);
            bounds.extend(marker.getPosition());
            hasValid = true;
            if (isLatest) latestMarkerId = sub.id;
        }
    });

    if (hasValid && isInitialLoad) {
        map.fitBounds(bounds);
        const listener = google.maps.event.addListener(map, 'idle', () => {
            if (map.getZoom() > 16) map.setZoom(16);
            google.maps.event.removeListener(listener);
        });
        isInitialLoad = false;
    }

    // Show latest card for the most recent submission
    if (latestSub) showLatestCard(latestSub);
}

// =============================================================================
// WEBSOCKET  (Socket.IO)
// =============================================================================
function initSocket() {
    if (!window.io) { console.warn('Socket.IO client not loaded'); return; }

    socket = io({ transports: ['websocket', 'polling'] });

    socket.on('connect', () => {
        console.log('WebSocket connected, transport:', socket.io.engine.transport.name);
        setConnectionState('live');
        disconnectedAt = null;
    });

    socket.on('new_submission', (sub) => {
        const t0 = performance.now();
        handleNewSubmission(sub);
        console.log(`[ws] new_submission displayed in ${(performance.now() - t0).toFixed(1)}ms`, sub.id);
    });

    socket.on('disconnect', (reason) => {
        console.warn('WebSocket disconnected:', reason);
        setConnectionState('reconnecting');
        // Show offline banner after 10s if still disconnected
        setTimeout(() => {
            if (!socket.connected) {
                setConnectionState('offline');
                showConnBanner();
            }
        }, 10000);
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('WebSocket reconnected after', attemptNumber, 'attempts');
        setConnectionState('live');
        hideConnBanner();
        showToast('Back online', 'success');
        // Reload all data to catch anything missed during disconnect
        loadSubmissions();
    });

    socket.on('connect_error', () => {
        setConnectionState('reconnecting');
    });
}

function manualReconnect() {
    if (socket) { socket.connect(); }
}

// =============================================================================
// HANDLE NEW SUBMISSION  (instant display)
// =============================================================================
function handleNewSubmission(sub) {
    if (!sub || !sub.gps || !sub.gps.lat || !sub.gps.lon) return;
    if (knownIds.has(sub.id)) return; // duplicate guard

    // Demote previous latest marker
    if (latestMarkerId) {
        demoteLatestMarker(latestMarkerId);
    }

    // Add to state
    knownIds.add(sub.id);
    allSubmissions.push(sub);

    // Create marker as "latest"
    const marker = createMarker(sub, true);
    if (marker) {
        markers.push(marker);
        map.panTo(marker.getPosition());
    }
    latestMarkerId = sub.id;

    // Update stats + latest card
    updateStats(allSubmissions);
    showLatestCard(sub);
    showToast(`New report: ${(sub.flood_depth_cm / 100).toFixed(2)} m`, 'info');
}

function demoteLatestMarker(id) {
    // Find the existing marker & label for this id, remove pulse ring
    const idx = markers.findIndex(m => m._subId === id);
    if (idx === -1) return;
    const m = markers[idx];
    // Remove pulse overlay if attached
    if (m._pulseOverlay) { m._pulseOverlay.setMap(null); m._pulseOverlay = null; }
    // Remove NEW badge from label
    const lo = labelOverlays.find(l => l._subId === id);
    if (lo && lo.labelDiv) {
        const badge = lo.labelDiv.querySelector('.fm-new-badge');
        if (badge) badge.remove();
    }
}

// =============================================================================
// MARKER CREATION
// =============================================================================
function createMarker(sub, isLatest) {
    if (!sub.gps || !sub.gps.lat || !sub.gps.lon) return null;
    const pos = { lat: sub.gps.lat, lng: sub.gps.lon };
    const depthCm = sub.flood_depth_cm || 0;
    const depthM  = (depthCm / 100).toFixed(2);
    const color   = getDepthColor(depthCm);

    // Invisible anchor marker
    const marker = new google.maps.Marker({
        position: pos, map,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0, fillOpacity: 0, strokeOpacity: 0 },
        optimized: false, visible: false, zIndex: 0
    });
    marker._subId = sub.id;

    // Label overlay
    const labelOv = createLabelOverlay(marker, depthM, depthCm, sub, isLatest);
    labelOv.setMap(map);
    labelOv._subId = sub.id;
    labelOverlays.push(labelOv);

    // Info window
    const dateStr = formatDateTime(new Date(sub.received_at));
    const infoContent = `
        <div style="padding:8px 10px;font-family:Inter,sans-serif;min-width:160px;max-width:200px;">
            <div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px;">
                📍 FLOOD REPORT
            </div>
            <div style="font-size:20px;font-weight:700;color:${color};margin-bottom:2px;">${depthM} m</div>
            <div style="font-size:10px;color:#666;margin-bottom:8px;">${getDepthLabel(depthCm)}</div>
            <div style="border-top:1px solid #eee;padding-top:6px;">
                <div style="font-size:10px;color:#555;margin-bottom:3px;">📅 ${dateStr}</div>
                <div style="font-size:10px;color:#666;margin-bottom:3px;">📍 ${sub.location || sub.street || 'Unknown'}</div>
                <div style="font-size:10px;color:#666;">👤 ${sub.name || 'Anonymous'}</div>
            </div>
        </div>`;
    const iw = new google.maps.InfoWindow({ content: infoContent, disableAutoPan: false });
    marker.infoWindow = iw;

    // Pulse ring for latest
    if (isLatest) {
        const pulseOv = createPulseOverlay(marker);
        pulseOv.setMap(map);
        marker._pulseOverlay = pulseOv;
    }

    return marker;
}

// =============================================================================
// DEPTH HELPERS
// =============================================================================
function getDepthColor(cm) {
    if (cm <= 30)  return '#4CAF50';
    if (cm <= 60)  return '#FFC107';
    if (cm <= 100) return '#FF9800';
    return '#F44336';
}
function getDepthLabel(cm) {
    if (cm === 0)  return 'No Flood';
    if (cm <= 30)  return 'Low – Safe for vehicles';
    if (cm <= 60)  return 'Moderate – Caution advised';
    if (cm <= 100) return 'High – Danger for vehicles';
    return 'Severe – Evacuation recommended';
}

// =============================================================================
// LABEL OVERLAY
// =============================================================================
function createLabelOverlay(marker, depthText, depthCm, sub, isLatest) {
    const color = getDepthColor(depthCm);
    const labelDiv = document.createElement('div');
    labelDiv.className = 'depth-label-overlay';
    labelDiv.innerHTML = `
        <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:6px solid ${color};margin:0 auto;"></div>
        <div style="display:flex;align-items:center;justify-content:center;min-width:52px;padding:4px 8px;border-radius:6px;background:${color};color:white;font:600 12px/1.2 Inter,Arial,sans-serif;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;transition:transform .2s,box-shadow .2s;gap:4px;">
            ${depthText}m
            ${isLatest ? '<span class="fm-new-badge" style="background:#fff;color:'+color+';font-size:8px;padding:1px 4px;border-radius:3px;font-weight:700;">NEW</span>' : ''}
        </div>`;

    const overlay = new google.maps.OverlayView();
    overlay.onAdd = function () {
        this.getPanes().overlayMouseTarget.appendChild(labelDiv);
        labelDiv.style.position = 'absolute';
        labelDiv.style.pointerEvents = 'auto';
        labelDiv.style.zIndex = '200';

        const content = labelDiv.querySelectorAll('div')[1];
        if (content) {
            content.addEventListener('mouseenter', () => { content.style.transform = 'scale(1.1)'; content.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)'; });
            content.addEventListener('mouseleave', () => { content.style.transform = 'scale(1)'; content.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'; });
        }

        labelDiv.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            markers.forEach(m => m.infoWindow && m.infoWindow.close());
            if (marker.infoWindow) { marker.infoWindow.setPosition(marker.getPosition()); marker.infoWindow.open(map); }
        });
    };
    overlay.draw = function () {
        const proj = this.getProjection(); if (!proj) return;
        const pt = proj.fromLatLngToDivPixel(marker.getPosition()); if (!pt) return;
        labelDiv.style.left = (pt.x - 26) + 'px';
        labelDiv.style.top  = (pt.y + 5)  + 'px';
    };
    overlay.onRemove = function () { if (labelDiv.parentElement) labelDiv.parentElement.removeChild(labelDiv); };
    overlay.labelDiv = labelDiv;
    return overlay;
}

// =============================================================================
// PULSE RING OVERLAY  (subtle)
// =============================================================================
function createPulseOverlay(marker) {
    const div = document.createElement('div');
    div.innerHTML = '<div class="fm-pulse-ring"></div>';
    div.style.position = 'absolute';
    div.style.pointerEvents = 'none';

    const ov = new google.maps.OverlayView();
    ov.onAdd = function () { this.getPanes().overlayLayer.appendChild(div); };
    ov.draw = function () {
        const proj = this.getProjection(); if (!proj) return;
        const pt = proj.fromLatLngToDivPixel(marker.getPosition()); if (!pt) return;
        div.style.left = (pt.x - 20) + 'px';
        div.style.top  = (pt.y - 14) + 'px';
    };
    ov.onRemove = function () { if (div.parentElement) div.parentElement.removeChild(div); };
    return ov;
}

// =============================================================================
// UI HELPERS
// =============================================================================
function clearMarkers() {
    markers.forEach(m => { if (m.infoWindow) m.infoWindow.close(); if (m._pulseOverlay) m._pulseOverlay.setMap(null); m.setMap(null); });
    markers = [];
    labelOverlays.forEach(o => o.setMap(null));
    labelOverlays = [];
}

function showRefreshIndicator(show) {
    const el = document.getElementById('refreshIndicator');
    if (el) el.classList.toggle('active', show);
}

function updateStats(submissions) {
    const count = submissions.length;
    const valid = submissions.filter(s => s.flood_depth_cm !== undefined);
    const avg   = valid.length > 0 ? Math.round(valid.reduce((s, v) => s + (v.flood_depth_cm || 0), 0) / valid.length) : 0;
    const crit  = valid.filter(s => (s.flood_depth_cm || 0) > 100).length;

    const el = document.getElementById('fmReportCount');
    if (el) el.textContent = `${count} report${count !== 1 ? 's' : ''}`;
}

function formatDateTime(d) {
    const pad = n => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// =============================================================================
// LATEST CARD
// =============================================================================
function showLatestCard(sub) {
    latestCardData = sub;
    const card = document.getElementById('fmLatestCard');
    const pill = document.getElementById('fmLatestPill');
    if (!card) return;

    const depthM = ((sub.flood_depth_cm || 0) / 100).toFixed(2);
    const color  = getDepthColor(sub.flood_depth_cm || 0);
    document.getElementById('fmLatestDepth').textContent = depthM + ' m';
    document.getElementById('fmLatestDepth').style.color = color;
    document.getElementById('fmLatestLocation').textContent = sub.location || sub.street || 'Unknown';
    document.getElementById('fmLatestReporter').textContent = sub.name || 'Anonymous';
    document.getElementById('fmLatestTime').textContent = formatDateTime(new Date(sub.received_at));

    card.classList.add('visible');
    card.classList.remove('dismissed');
    if (pill) pill.classList.remove('visible');
}

function dismissLatestCard() {
    const card = document.getElementById('fmLatestCard');
    const pill = document.getElementById('fmLatestPill');
    if (card) card.classList.add('dismissed');
    if (pill && latestCardData) pill.classList.add('visible');
}

function expandLatestCard() {
    if (latestCardData) showLatestCard(latestCardData);
}

// =============================================================================
// CONNECTION STATE UX
// =============================================================================
function setConnectionState(state) {
    const dot  = document.getElementById('fmStatusDot');
    const text = document.getElementById('fmStatusText');
    if (!dot || !text) return;

    dot.className = 'fm-status-dot ' + state;
    if (state === 'live')         text.textContent = 'LIVE';
    else if (state === 'reconnecting') text.textContent = 'RECONNECTING';
    else                          text.textContent = 'OFFLINE';
}

function showConnBanner() {
    const el = document.getElementById('fmConnBanner');
    if (el) el.classList.add('visible');
}
function hideConnBanner() {
    const el = document.getElementById('fmConnBanner');
    if (el) el.classList.remove('visible');
}

// =============================================================================
// TOAST
// =============================================================================
function showToast(msg, type) {
    const container = document.getElementById('fmToastContainer');
    if (!container) return;
    const t = document.createElement('div');
    t.className = 'fm-toast ' + (type || 'info');
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => {
        t.classList.add('out');
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

// =============================================================================
// LEGEND TOGGLE
// =============================================================================
function toggleLegend() {
    const el = document.getElementById('fmLegend');
    if (!el) return;
    el.classList.toggle('collapsed');
    // On mobile, also toggle 'expanded' for inverse default
    el.classList.toggle('expanded');
}

// =============================================================================
// FULLSCREEN
// =============================================================================
function toggleFullscreen() {
    const elem = document.documentElement;
    if (!document.fullscreenElement) {
        (elem.requestFullscreen || elem.webkitRequestFullscreen || elem.msRequestFullscreen).call(elem);
    } else {
        (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
    }
}

// =============================================================================
// MANUAL REFRESH
// =============================================================================
function manualRefresh() {
    loadSubmissions();
}

// =============================================================================
// INIT
// =============================================================================
window.addEventListener('load', initMap);
window.addEventListener('beforeunload', () => {
    if (socket) socket.disconnect();
});
