/* =============================================================================
   AIResQ ClimSols FLOOD MAP - Google Maps with Satellite/Streets/Hybrid Views
   Auto-refresh every 1 minute
   ============================================================================= */

// =============================================================================
// CONFIGURATION
// =============================================================================

// Default bounds (India-wide, will adjust to data)
const DEFAULT_BOUNDS = {
    minLat: 8.0,
    maxLat: 37.0,
    minLng: 68.0,
    maxLng: 97.5
};

// Map configuration
const MAP_CONFIG = {
    defaultZoom: 12,
    minZoom: 5,
    maxZoom: 20
};

// Auto-refresh interval: 1 minute (60000ms)
const AUTO_REFRESH_INTERVAL = 60000;

// =============================================================================
// STATE
// =============================================================================

let map = null;
let markers = [];
let labelOverlays = [];
let showStreetLabels = false;
let currentBasemap = 'satellite';
let autoRefreshTimer = null;
let nextRefreshTime = null;
let countdownTimer = null;
let isInitialLoad = true;  // Track if this is the first load

// Animation state
let allSubmissions = [];
let animationTimer = null;
let isAnimating = false;
let currentAnimationIndex = 0;
let animationSpeed = 1; // 1x speed by default

// =============================================================================
// POSITION PERSISTENCE
// =============================================================================

function saveMapPosition() {
    if (!map) return;
    const center = map.getCenter();
    const position = {
        lat: center.lat(),
        lng: center.lng(),
        zoom: map.getZoom()
    };
    sessionStorage.setItem('floodmap_position', JSON.stringify(position));
}

function restoreMapPosition() {
    try {
        const saved = sessionStorage.getItem('floodmap_position');
        if (saved) {
            const position = JSON.parse(saved);
            if (position.lat && position.lng && position.zoom) {
                return position;
            }
        }
    } catch (e) {
        console.warn('Could not restore map position:', e);
    }
    return null;
}

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

    // Try to restore saved position, otherwise use default center
    const savedPosition = restoreMapPosition();
    const defaultCenter = savedPosition ? 
        { lat: savedPosition.lat, lng: savedPosition.lng } :
        { lat: (DEFAULT_BOUNDS.minLat + DEFAULT_BOUNDS.maxLat) / 2, lng: (DEFAULT_BOUNDS.minLng + DEFAULT_BOUNDS.maxLng) / 2 };
    const initialZoom = savedPosition ? savedPosition.zoom : MAP_CONFIG.defaultZoom;

    // Create map with satellite view by default
    map = new google.maps.Map(mapEl, {
        center: defaultCenter,
        zoom: initialZoom,
        minZoom: MAP_CONFIG.minZoom,
        maxZoom: MAP_CONFIG.maxZoom,
        mapTypeId: 'satellite',
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_BOTTOM
        },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        styles: getMapStyles()
    });

    // Save position when user moves/zooms the map
    map.addListener('idle', saveMapPosition);
    
    // Mark that we have a saved position (skip fitBounds on initial load if we have saved position)
    isInitialLoad = !savedPosition;

    // Load initial data
    loadSubmissions();

    // Start auto-refresh
    startAutoRefresh();
    
    console.log('AIResQ ClimSols Flood Map initialized with 1-minute auto-refresh');
}

// =============================================================================
// BASEMAP CONTROL
// =============================================================================

function setBasemap(type) {
    if (!map) return;
    
    currentBasemap = type;
    
    // Update button states
    document.querySelectorAll('.basemap-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`basemap${type.charAt(0).toUpperCase() + type.slice(1)}`).classList.add('active');
    
    // Set map type
    switch (type) {
        case 'satellite':
            map.setMapTypeId('satellite');
            break;
        case 'roadmap':
            map.setMapTypeId('roadmap');
            break;
        case 'hybrid':
            map.setMapTypeId('hybrid');
            break;
    }
    
    // Apply custom styles for each basemap mode
    if (type === 'roadmap') {
        map.setOptions({ styles: [] });
    } else {
        map.setOptions({ styles: [] });
    }
}

function getMapStyles() {
    // Styles to hide/show labels
    if (showStreetLabels) {
        return []; // Default Google styles with labels
    }
    
    return [
        {
            featureType: 'all',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
        },
        {
            featureType: 'administrative',
            elementType: 'labels',
            stylers: [{ visibility: 'on' }]
        }
    ];
}

function toggleStreetLabels() {
    showStreetLabels = !showStreetLabels;
    
    const btn = document.getElementById('streetLabelsToggle');
    if (btn) {
        btn.classList.toggle('active', showStreetLabels);
    }
    
    // Apply styles
    if (currentBasemap === 'roadmap') {
        map.setOptions({ styles: showStreetLabels ? [] : getMapStyles() });
    }
}

// =============================================================================
// DATA LOADING
// =============================================================================

async function loadSubmissions() {
    try {
        showRefreshIndicator(true);
        
        const res = await fetch('/api/submissions');
        const submissions = await res.json();

        // Sort submissions by received_at timestamp
        submissions.sort((a, b) => {
            const dateA = a.received_at ? new Date(a.received_at) : new Date(0);
            const dateB = b.received_at ? new Date(b.received_at) : new Date(0);
            return dateA - dateB;
        });

        // Store all submissions for animation
        allSubmissions = submissions;

        // If currently animating, don't reload everything
        if (isAnimating) {
            showRefreshIndicator(false);
            return;
        }

        // Clear existing markers and overlays
        clearMarkers();

        // On initial load, start animation automatically
        // Otherwise show all markers at once
        if (isInitialLoad && submissions.length > 0) {
            // Start animation automatically
            setTimeout(() => {
                startAnimation();
            }, 500);
        } else {
            // Show all markers at once (normal mode)
            displayAllMarkers(submissions);
        }

        // Update info panel
        updateInfoPanel(submissions.length);
        
        // Update quick stats
        updateQuickStats(submissions);
        
        // Show animation controls if there are submissions
        const animControls = document.getElementById('animationControls');
        if (animControls) {
            animControls.style.display = submissions.length > 0 ? 'flex' : 'none';
            updateAnimationUI();
        }
        
        showRefreshIndicator(false);
        
        console.log(`Loaded ${submissions.length} submissions`);
    } catch (err) {
        console.error('Error loading submissions:', err);
        showRefreshIndicator(false);
    }
}

function displayAllMarkers(submissions) {
    let bounds = new google.maps.LatLngBounds();
    let hasValidMarkers = false;

    submissions.forEach((sub, index) => {
        if (!sub.gps || !sub.gps.lat || !sub.gps.lon) return;

        const marker = createMarker(sub, index);
        if (marker) {
            markers.push(marker);
            bounds.extend(marker.getPosition());
            hasValidMarkers = true;
        }
    });

    // Only fit bounds on initial load when there's no saved position
    if (hasValidMarkers && markers.length > 0 && isInitialLoad) {
        map.fitBounds(bounds);
        
        // Limit zoom level after fitting bounds
        const listener = google.maps.event.addListener(map, 'idle', () => {
            if (map.getZoom() > 16) map.setZoom(16);
            google.maps.event.removeListener(listener);
        });
    }
}

function createMarker(sub, index) {
    if (!sub.gps || !sub.gps.lat || !sub.gps.lon) return null;

    const position = { lat: sub.gps.lat, lng: sub.gps.lon };
    const depthCm = sub.flood_depth_cm || 0;
    const depthM = (depthCm / 100).toFixed(2);

    // Get marker color based on depth
    const markerColor = getDepthColor(depthCm);
    
    // Create invisible marker (used only for position tracking)
    const marker = new google.maps.Marker({
        position: position,
        map: map,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 0,
            fillOpacity: 0,
            strokeOpacity: 0
        },
        optimized: false,
        visible: false,
        zIndex: 0
    });

    // Create depth label overlay with click functionality
    const labelOverlay = createLabelOverlay(marker, depthM, depthCm, sub);
    labelOverlay.setMap(map);
    labelOverlays.push(labelOverlay);

    // Create info window
    const d = new Date(sub.received_at);
    const dateStr = formatDateTime(d);

    const infoContent = `
        <div style="padding:8px 10px;font-family:Inter,sans-serif;min-width:160px;max-width:200px;">
            <div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:4px;">
                📍 FLOOD REPORT
            </div>
            <div style="font-size:20px;font-weight:700;color:${markerColor};margin-bottom:2px;">
                ${depthM} m
            </div>
            <div style="font-size:10px;color:#666;margin-bottom:8px;">
                ${getDepthLabel(depthCm)}
            </div>
            <div style="border-top:1px solid #eee;padding-top:6px;">
                <div style="font-size:10px;color:#555;margin-bottom:3px;">
                    📅 ${dateStr}
                </div>
                <div style="font-size:10px;color:#666;margin-bottom:3px;">
                    📍 ${sub.location || sub.street || 'Unknown location'}
                </div>
                <div style="font-size:10px;color:#666;">
                    👤 ${sub.name || 'Anonymous'}
                </div>
            </div>
        </div>
    `;

    const infoWindow = new google.maps.InfoWindow({
        content: infoContent,
        disableAutoPan: false
    });

    // Store info window on marker
    marker.infoWindow = infoWindow;
    return marker;
}

// =============================================================================
// DEPTH COLOR & LABELS
// =============================================================================

function getDepthColor(depthCm) {
    if (depthCm <= 30) return '#4CAF50';      // Green - Safe
    if (depthCm <= 60) return '#FFC107';      // Yellow - Caution
    if (depthCm <= 100) return '#FF9800';     // Orange - Warning
    return '#F44336';                          // Red - Danger
}

function getDepthLabel(depthCm) {
    if (depthCm === 0) return 'No Flood';
    if (depthCm <= 30) return 'Low - Safe for vehicles';
    if (depthCm <= 60) return 'Moderate - Caution advised';
    if (depthCm <= 100) return 'High - Danger for vehicles';
    return 'Severe - Evacuation recommended';
}

// =============================================================================
// LABEL OVERLAY
// =============================================================================

function createLabelOverlay(marker, depthText, depthCm, submissionData) {
    const color = getDepthColor(depthCm);
    
    const labelDiv = document.createElement('div');
    labelDiv.className = 'depth-label-overlay';
    labelDiv.innerHTML = `
        <div style="
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-bottom: 6px solid ${color};
            margin: 0 auto;
        "></div>
        <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 52px;
            padding: 4px 8px;
            border-radius: 6px;
            background: ${color};
            color: white;
            font: 600 12px/1.2 Inter, Arial, sans-serif;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        ">
            ${depthText}m
        </div>
    `;

    const overlay = new google.maps.OverlayView();

    overlay.onAdd = function() {
        const panes = this.getPanes();
        panes.overlayMouseTarget.appendChild(labelDiv);
        labelDiv.style.position = 'absolute';
        labelDiv.style.display = 'block';
        labelDiv.style.pointerEvents = 'auto';
        labelDiv.style.zIndex = '200';
        labelDiv.setAttribute('role', 'button');
        labelDiv.setAttribute('tabindex', '0');
        labelDiv.setAttribute('aria-label', `Show details for ${depthText} meters flood report`);
        
        // Add hover effects
        const labelContent = labelDiv.querySelectorAll('div')[1];
        labelContent.addEventListener('mouseenter', () => {
            labelContent.style.transform = 'scale(1.1)';
            labelContent.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
        });
        labelContent.addEventListener('mouseleave', () => {
            labelContent.style.transform = 'scale(1)';
            labelContent.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        });
        
        // Add click handler to show info window
        const openMetadata = (event) => {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            // Close all other info windows
            markers.forEach(m => m.infoWindow && m.infoWindow.close());

            // Open this marker's info window
            if (marker.infoWindow) {
                marker.infoWindow.setPosition(marker.getPosition());
                marker.infoWindow.open(map);
            }
        };

        labelDiv.addEventListener('click', openMetadata);
        labelDiv.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                openMetadata(event);
            }
        });
    };

    overlay.draw = function() {
        const projection = this.getProjection();
        if (!projection) return;
        
        const position = projection.fromLatLngToDivPixel(marker.getPosition());
        if (!position) return;
        
        labelDiv.style.left = (position.x - 26) + 'px';
        labelDiv.style.top = (position.y + 5) + 'px';
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
// AUTO-REFRESH (1 MINUTE)
// =============================================================================

function startAutoRefresh() {
    stopAutoRefresh();
    
    // Set next refresh time
    nextRefreshTime = Date.now() + AUTO_REFRESH_INTERVAL;
    
    // Start refresh timer
    autoRefreshTimer = setInterval(() => {
        console.log('Auto-refreshing map data...');
        loadSubmissions();
        nextRefreshTime = Date.now() + AUTO_REFRESH_INTERVAL;
    }, AUTO_REFRESH_INTERVAL);
    
    // Start countdown display
    updateCountdown();
    countdownTimer = setInterval(updateCountdown, 1000);
    
    console.log('Auto-refresh started: updates every 60 seconds');
}

function stopAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
    }
}

function updateCountdown() {
    const el = document.getElementById('nextRefresh');
    if (!el || !nextRefreshTime) return;
    
    const remaining = Math.max(0, Math.ceil((nextRefreshTime - Date.now()) / 1000));
    el.textContent = `(${remaining}s)`;
}

function manualRefresh() {
    loadSubmissions();
    nextRefreshTime = Date.now() + AUTO_REFRESH_INTERVAL;
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
        indicator.classList.toggle('active', show);
    }
}

function updateInfoPanel(count) {
    const updateEl = document.getElementById('lastUpdate');
    const dotEl = document.getElementById('statusDot');
    
    if (updateEl) {
        updateEl.textContent = 'Updated';
    }
    if (dotEl) {
        dotEl.classList.add('pulse');
        setTimeout(() => dotEl.classList.remove('pulse'), 2000);
    }
}

function updateQuickStats(submissions) {
    const quickStatsCount = document.getElementById('quickStatsCount');
    const quickStatsAvg = document.getElementById('quickStatsAvg');
    const quickStatsCritical = document.getElementById('quickStatsCritical');
    
    if (!quickStatsCount || !quickStatsAvg || !quickStatsCritical) return;
    
    const validSubmissions = submissions.filter(sub => sub.flood_depth_cm !== undefined);
    
    // Count
    quickStatsCount.textContent = validSubmissions.length;
    
    // Average depth
    if (validSubmissions.length > 0) {
        const totalDepth = validSubmissions.reduce((sum, sub) => sum + (sub.flood_depth_cm || 0), 0);
        const avgDepth = Math.round(totalDepth / validSubmissions.length);
        quickStatsAvg.textContent = `${avgDepth} cm`;
    } else {
        quickStatsAvg.textContent = '0 cm';
    }
    
    // Critical count (>100cm)
    const criticalCount = validSubmissions.filter(sub => (sub.flood_depth_cm || 0) > 100).length;
    quickStatsCritical.textContent = criticalCount;
    
    // Add pulse animation if there are critical reports
    if (criticalCount > 0) {
        quickStatsCritical.classList.add('pulse');
    } else {
        quickStatsCritical.classList.remove('pulse');
    }
}

function formatDateTime(d) {
    const pad = n => n.toString().padStart(2, '0');
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hour = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${day}/${month}/${year} ${hour}:${min}`;
}

// =============================================================================
// ANIMATION CONTROLS
// =============================================================================

function toggleAnimation() {
    if (isAnimating) {
        pauseAnimation();
    } else {
        startAnimation();
    }
}

function startAnimation() {
    if (allSubmissions.length === 0) return;
    
    // Stop auto-refresh during animation
    stopAutoRefresh();
    
    // If starting from scratch, clear all markers
    if (currentAnimationIndex === 0) {
        clearMarkers();
    }
    
    isAnimating = true;
    
    // Mark initial load as complete
    isInitialLoad = false;
    
    updateAnimationUI();
    
    // Start displaying markers one by one
    animateNextMarker();
}

function pauseAnimation() {
    isAnimating = false;
    if (animationTimer) {
        clearTimeout(animationTimer);
        animationTimer = null;
    }
    updateAnimationUI();
}

function stopAnimation() {
    pauseAnimation();
    currentAnimationIndex = 0;
    
    // Clear all markers and display all at once
    clearMarkers();
    displayAllMarkers(allSubmissions);
    
    // Resume auto-refresh
    startAutoRefresh();
    
    updateAnimationUI();
}

function animateNextMarker() {
    if (!isAnimating || currentAnimationIndex >= allSubmissions.length) {
        // Animation complete
        isAnimating = false;
        updateAnimationUI();
        
        // Resume auto-refresh
        startAutoRefresh();
        return;
    }
    
    const submission = allSubmissions[currentAnimationIndex];
    
    // Create and add the marker
    const marker = createMarker(submission, currentAnimationIndex);
    if (marker) {
        markers.push(marker);
        
        // On first marker, fit bounds to show all submissions area
        if (currentAnimationIndex === 0 && allSubmissions.length > 0) {
            const bounds = new google.maps.LatLngBounds();
            allSubmissions.forEach(sub => {
                if (sub.gps && sub.gps.lat && sub.gps.lon) {
                    bounds.extend({ lat: sub.gps.lat, lng: sub.gps.lon });
                }
            });
            map.fitBounds(bounds);
            const listener = google.maps.event.addListener(map, 'idle', () => {
                if (map.getZoom() > 14) map.setZoom(14);
                google.maps.event.removeListener(listener);
            });
        } else {
            // Center map on new marker with smooth pan
            map.panTo(marker.getPosition());
        }
        
        // Open info window briefly
        if (marker.infoWindow) {
            marker.infoWindow.open(map, marker);
            
            // Close after 800ms for faster animation
            setTimeout(() => {
                if (marker.infoWindow) {
                    marker.infoWindow.close();
                }
            }, 800);
        }
    }
    
    currentAnimationIndex++;
    updateAnimationUI();
    
    // Calculate delay based on speed (1000ms / speed)
    const delay = 1000 / animationSpeed;
    
    // Schedule next marker
    animationTimer = setTimeout(() => {
        animateNextMarker();
    }, delay);
}

function changeAnimationSpeed() {
    const speedSelect = document.getElementById('animSpeed');
    if (speedSelect) {
        animationSpeed = parseFloat(speedSelect.value);
        
        // If currently animating, restart with new speed
        if (isAnimating) {
            if (animationTimer) {
                clearTimeout(animationTimer);
            }
            animateNextMarker();
        }
    }
}

function updateAnimationUI() {
    const playIcon = document.getElementById('animPlayIcon');
    const pauseIcon = document.getElementById('animPauseIcon');
    const currentIndexEl = document.getElementById('animCurrentIndex');
    const totalCountEl = document.getElementById('animTotalCount');
    
    // Update play/pause button
    if (playIcon && pauseIcon) {
        if (isAnimating) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }
    
    // Update progress
    if (currentIndexEl) {
        currentIndexEl.textContent = currentAnimationIndex;
    }
    if (totalCountEl) {
        totalCountEl.textContent = allSubmissions.length;
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

window.addEventListener('load', () => {
    initMap();
});

window.addEventListener('beforeunload', () => {
    stopAutoRefresh();
});
