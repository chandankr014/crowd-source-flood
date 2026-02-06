// =============================================================================
// FLOOD MAP - Google Maps Satellite View with Auto-refresh
// AIResQ ClimSols - Gurugram Flood Monitoring
// =============================================================================

// Gurugram bounds configuration
const GURUGRAM_BOUNDS = {
    minx: 76.9253,
    miny: 28.3207,
    maxx: 77.1749,
    maxy: 28.5512
};

// Map configuration
const DEFAULT_ZOOM = 14;
const DEFAULT_CENTER = {
    lat: (GURUGRAM_BOUNDS.miny + GURUGRAM_BOUNDS.maxy) / 2,
    lng: (GURUGRAM_BOUNDS.minx + GURUGRAM_BOUNDS.maxx) / 2
};

// Auto-refresh configuration (1 minute = 60000ms)
const AUTO_REFRESH_INTERVAL = 60000;

// State
let map = null;
let markers = [];
let labelOverlays = [];
let showLabels = true;
let showIcons = true;
let autoRefreshTimer = null;

// Portrait images for markers
const portraits = ['m2.png', 'p2.svg', 'w1.svg', 'w2.svg', 'm1.png', 'w3.png', 'w4.png'];

// =============================================================================
// MAP INITIALIZATION
// =============================================================================

function initMap() {
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    if (!window.google || !window.google.maps) {
        console.error('Google Maps not loaded, retrying...');
        setTimeout(initMap, 500);
        return;
    }

    // Create map with satellite view
    map = new google.maps.Map(mapEl, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeId: 'satellite',
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy'
    });

    // Restrict map to Gurugram bounds
    const bounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(GURUGRAM_BOUNDS.miny, GURUGRAM_BOUNDS.minx),
        new google.maps.LatLng(GURUGRAM_BOUNDS.maxy, GURUGRAM_BOUNDS.maxx)
    );
    
    // Apply soft bounds (user can pan slightly outside but map will return)
    map.fitBounds(bounds);
    map.setCenter(DEFAULT_CENTER);
    map.setZoom(DEFAULT_ZOOM);

    // Load initial submissions
    loadSubmissions();

    // Start auto-refresh
    startAutoRefresh();
}

// =============================================================================
// DATA LOADING
// =============================================================================

async function loadSubmissions() {
    try {
        showRefreshIndicator(true);
        
        const res = await fetch('/api/submissions');
        const submissions = await res.json();

        // Clear existing markers and overlays
        clearMarkers();

        submissions.forEach((sub, index) => {
            if (!sub.gps || !sub.gps.lat || !sub.gps.lon) return;

            // Check if submission is within Gurugram bounds
            if (sub.gps.lat < GURUGRAM_BOUNDS.miny || sub.gps.lat > GURUGRAM_BOUNDS.maxy ||
                sub.gps.lon < GURUGRAM_BOUNDS.minx || sub.gps.lon > GURUGRAM_BOUNDS.maxx) {
                return; // Skip submissions outside Gurugram
            }

            const depthM = (sub.flood_depth_cm / 100).toFixed(2);
            const portrait = portraits[index % portraits.length];

            // Create marker with person icon
            const marker = new google.maps.Marker({
                position: { lat: sub.gps.lat, lng: sub.gps.lon },
                map: map,
                icon: {
                    url: `/static/portraits/${portrait}`,
                    scaledSize: new google.maps.Size(32, 32),
                    anchor: new google.maps.Point(16, 32)
                },
                optimized: false,
                visible: showIcons
            });

            // Create depth label overlay
            const labelOverlay = createLabelOverlay(marker, depthM);
            labelOverlay.setMap(map);
            labelOverlays.push(labelOverlay);

            // Create info window with timestamp
            const d = new Date(sub.received_at);
            const pad = n => n.toString().padStart(2, '0');
            const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear().toString().slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding:10px 12px;font-family:Inter,sans-serif;">
                        <div style="font-size:13px;color:#666;margin-bottom:4px;">📅 Reported on:</div>
                        <div style="font-size:14px;font-weight:600;color:#0A2534;">${dateStr}</div>
                        <div style="font-size:12px;color:#666;margin-top:8px;">Location: ${sub.location || 'Unknown'}</div>
                        <div style="font-size:12px;color:#666;">Reporter: ${sub.name || 'Anonymous'}</div>
                    </div>
                `,
                disableAutoPan: false
            });

            marker.addListener('click', () => {
                markers.forEach(m => m.infoWindow && m.infoWindow.close());
                infoWindow.open(map, marker);
            });

            marker.infoWindow = infoWindow;
            markers.push(marker);
        });

        // Update info panel
        updateInfoPanel(submissions.length);
        
        showRefreshIndicator(false);
    } catch (err) {
        console.error('Error loading submissions:', err);
        showRefreshIndicator(false);
    }
}

// =============================================================================
// LABEL OVERLAY
// =============================================================================

function createLabelOverlay(marker, depthText) {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'depth-label';
    labelDiv.innerHTML = `
        <div style="
            display:flex;
            align-items:center;
            justify-content:center;
            width:56px;
            height:28px;
            border-radius:6px;
            background:rgba(255,255,255,0.95);
            border:1px solid rgba(10,37,52,0.08);
            box-shadow:0 2px 6px rgba(10,37,52,0.12);
            font:600 12px/1 Arial,Helvetica,sans-serif;
            color:#0A2534;
            text-align:center;
            padding:0 6px;
        ">
            <div style="line-height:1;">${depthText}m</div>
        </div>
        <div style="
            width:0;
            height:0;
            border-left:8px solid transparent;
            border-right:8px solid transparent;
            border-top:8px solid rgba(255,255,255,0.95);
            margin:2px auto 0;
            filter:drop-shadow(0 1px 1px rgba(10,37,52,0.06));
        "></div>
    `;

    const overlay = new google.maps.OverlayView();

    overlay.onAdd = function() {
        const panes = this.getPanes();
        panes.overlayLayer.appendChild(labelDiv);
        labelDiv.style.display = showLabels ? 'block' : 'none';
    };

    overlay.draw = function() {
        const projection = this.getProjection();
        const position = projection.fromLatLngToDivPixel(marker.getPosition());
        labelDiv.style.left = (position.x - 28) + 'px';
        labelDiv.style.top = (position.y - 58) + 'px';
    };

    overlay.onRemove = function() {
        if (labelDiv.parentElement) {
            labelDiv.parentElement.removeChild(labelDiv);
        }
    };

    overlay.labelDiv = labelDiv;
    return overlay;
}

// =============================================================================
// TOGGLE FUNCTIONS
// =============================================================================

function toggleLabels() {
    showLabels = !showLabels;
    const toggleBtn = document.getElementById('labelToggle');
    
    if (showLabels) {
        toggleBtn.classList.add('active');
    } else {
        toggleBtn.classList.remove('active');
    }

    // Update all label overlays
    labelOverlays.forEach(overlay => {
        if (overlay.labelDiv) {
            overlay.labelDiv.style.display = showLabels ? 'block' : 'none';
        }
    });
}

function toggleIcons() {
    showIcons = !showIcons;
    const toggleBtn = document.getElementById('iconToggle');
    
    if (showIcons) {
        toggleBtn.classList.add('active');
    } else {
        toggleBtn.classList.remove('active');
    }

    // Update all markers visibility
    markers.forEach(marker => {
        marker.setVisible(showIcons);
    });
}

// =============================================================================
// AUTO-REFRESH
// =============================================================================

function startAutoRefresh() {
    // Clear existing timer if any
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }

    // Set up new timer
    autoRefreshTimer = setInterval(() => {
        console.log('Auto-refreshing map data...');
        loadSubmissions();
    }, AUTO_REFRESH_INTERVAL);

    console.log(`Auto-refresh enabled: updating every ${AUTO_REFRESH_INTERVAL / 1000} seconds`);
}

function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
        console.log('Auto-refresh disabled');
    }
}

// =============================================================================
// UI UTILITIES
// =============================================================================

function clearMarkers() {
    markers.forEach(m => {
        if (m.infoWindow) m.infoWindow.close();
        m.setMap(null);
    });
    markers = [];

    labelOverlays.forEach(overlay => {
        overlay.setMap(null);
    });
    labelOverlays = [];
}

function showRefreshIndicator(show) {
    const indicator = document.getElementById('refreshIndicator');
    if (indicator) {
        indicator.style.display = show ? 'flex' : 'none';
    }
}

function updateInfoPanel(count) {
    const countEl = document.getElementById('submissionCount');
    const updateEl = document.getElementById('lastUpdate');
    
    if (countEl) {
        countEl.textContent = `${count} submission${count !== 1 ? 's' : ''} displayed`;
    }
    
    if (updateEl) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        updateEl.textContent = `Last updated: ${timeStr}`;
    }
}

function toggleFullscreen() {
    const elem = document.documentElement;
    if (!document.fullscreenElement) {
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

// Initialize map when page loads
window.addEventListener('load', () => {
    initMap();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});
