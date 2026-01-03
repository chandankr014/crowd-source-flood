// Global state
let gpsData = { lat: null, lon: null, accuracy: null };
let selectedVehicle = 'car';
let depthInputMode = 'reference'; // 'reference' or 'manual'

// NOTE: depthLabels and referenceImages are defined in index.html inline script
// to avoid duplication. If using app.js separately, these would need to be defined here.

// DOM Elements
const reportForm = document.getElementById('reportForm');
const formStatus = document.getElementById('formStatus');
const depthSlider = document.getElementById('flood_depth_cm');
const depthValue = document.getElementById('depthValue');
const depthStatus = document.getElementById('depthStatus');
const waterOverlay = document.getElementById('waterOverlay');
const vehicleImage = document.getElementById('vehicleImage');
const vehicleTypeInput = document.getElementById('vehicle_type');
const gpsStatus = document.getElementById('gpsStatus');
const gpsText = document.getElementById('gpsText');
const captchaQuestion = document.getElementById('captchaQuestion');
const captchaAnswer = document.getElementById('captcha_answer');
const captchaToken = document.getElementById('captcha_token');
const refreshCaptcha = document.getElementById('refreshCaptcha');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initGPS();
    fetchCaptcha();
    setupFormHandlers();
    setupVehicleSelector();
    setupDepthInputMode();
    updateReferenceMarkers();
    updateDepthVisualization(0);

    const retryBtn = document.getElementById('retryGPS');
    if (retryBtn) {
        retryBtn.addEventListener('click', initGPS);
    }
});

// Vehicle Selector
function setupVehicleSelector() {
    const options = document.querySelectorAll('.vehicle-option');
    options.forEach(option => {
        option.addEventListener('click', () => {
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            selectedVehicle = option.dataset.type;
            vehicleTypeInput.value = selectedVehicle;
            vehicleImage.src = vehicleImages[selectedVehicle];
            updateReferenceMarkers();
            updateDepthVisualization(parseInt(depthSlider.value));
        });
    });
}

// Update reference markers based on selected vehicle
function updateReferenceMarkers() {
    const labels = depthLabels[selectedVehicle];
    const markersContainer = document.getElementById('referenceMarkers');

    let markersHTML = '';

    // Reverse the labels (excluding the first "No flooding" entry) to display from top to bottom
    const reversedLabels = [...labels].reverse();

    reversedLabels.forEach((item, idx) => {
        const isActive = item.depth === 0 ? 'active' : '';
        markersHTML += `<div class="marker-item ${isActive}" data-depth="${item.depth}" onclick="setDepthByReference(${item.depth})"><div class="marker-line"></div><span>${item.label}</span></div>`;
    });

    markersContainer.innerHTML = markersHTML;
}

// Set depth by clicking on reference marker
function setDepthByReference(depth) {
    depthSlider.value = depth;
    updateDepthVisualization(depth);
}

// Setup depth input mode toggle
function setupDepthInputMode() {
    const modeToggle = document.querySelectorAll('.depth-mode-btn');
    modeToggle.forEach(btn => {
        btn.addEventListener('click', () => {
            modeToggle.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            depthInputMode = btn.dataset.mode;

            const sliderSection = document.getElementById('sliderSection');
            const manualSection = document.getElementById('manualSection');

            if (depthInputMode === 'manual') {
                sliderSection.style.display = 'none';
                manualSection.style.display = 'flex';
            } else {
                sliderSection.style.display = 'flex';
                manualSection.style.display = 'none';
            }
        });
    });

    // Setup manual input handler
    const manualInput = document.getElementById('manual_depth_input');
    if (manualInput) {
        manualInput.addEventListener('input', (e) => {
            let value = parseInt(e.target.value) || 0;
            value = Math.max(0, Math.min(200, value));
            depthSlider.value = value;
            updateDepthVisualization(value);
        });
    }
}

// GPS Capture
let watchId = null;

function initGPS() {
    const retryBtn = document.getElementById('retryGPS');
    if (retryBtn) retryBtn.style.display = 'none';

    // Reset border colors
    const streetField = document.getElementById('street');
    const zoneField = document.getElementById('zone');
    if (streetField) streetField.style.borderColor = '';
    if (zoneField) zoneField.style.borderColor = '';

    if (!navigator.geolocation) {
        updateGPSStatus('GPS not supported', false);
        fallbackToIPLocation();
        return;
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
    };

    gpsText.textContent = 'Locating...';

    if (watchId) navigator.geolocation.clearWatch(watchId);

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            gpsData.lat = position.coords.latitude.toFixed(6);
            gpsData.lon = position.coords.longitude.toFixed(6);
            gpsData.accuracy = position.coords.accuracy.toFixed(2);

            document.getElementById('gps_lat').value = gpsData.lat;
            document.getElementById('gps_lon').value = gpsData.lon;
            document.getElementById('gps_accuracy').value = gpsData.accuracy;

            // updateGPSStatus(`Located (±${gpsData.accuracy}m)`, true);
            updateGPSStatus(`Location: (${gpsData.lat}, ${gpsData.lon})`, true);

            if (position.coords.accuracy < 30) {
                navigator.geolocation.clearWatch(watchId);
                watchId = null;
                console.log("GPS ACCURACY IS TOO LOW: ", gpsData.accuracy);
            }
        },
        (error) => {
            console.warn('GPS error:', error);
            let msg = 'GPS unavailable';
            if (error.code === 1) msg = 'Location permission denied';
            else if (error.code === 3) msg = 'Location timeout';

            updateGPSStatus(msg, false);
            if (retryBtn) retryBtn.style.display = 'inline-block';

            // Highlight address fields as fallback
            document.getElementById('street').style.borderColor = 'var(--primary-teal)';
            document.getElementById('zone').style.borderColor = 'var(--primary-teal)';

            fallbackToIPLocation();
        },
        options
    );
}

async function fallbackToIPLocation() {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if (data.latitude && data.longitude) {
            gpsData.lat = data.latitude.toFixed(6);
            gpsData.lon = data.longitude.toFixed(6);
            gpsData.accuracy = "Approx (IP)";
            document.getElementById('gps_lat').value = gpsData.lat;
            document.getElementById('gps_lon').value = gpsData.lon;
            document.getElementById('gps_accuracy').value = 5000;
            updateGPSStatus(`Approx: ${data.city || 'Detected'}`, true);
            if (data.city && !document.getElementById('zone').value) {
                document.getElementById('zone').value = data.city;
            }
        }
    } catch (e) { console.error('IP fallback failed', e); }
}

function updateGPSStatus(text, active) {
    gpsText.textContent = text;
    if (active) {
        gpsStatus.classList.add('active');
    } else {
        gpsStatus.classList.remove('active');
    }
}

// Depth Visualization
function updateDepthVisualization(depth) {
    const labels = depthLabels[selectedVehicle];
    const vehicleHeight = 250; // Height of vehicle container

    depthValue.textContent = depth;

    // Update manual input if it exists
    const manualInput = document.getElementById('manual_depth_input');
    if (manualInput && document.activeElement !== manualInput) {
        manualInput.value = depth;
    }

    // Determine status based on depth
    let status = labels[0].label; // Default to "No flooding"
    let activeDepth = 0;

    // Find the appropriate label for the current depth
    for (let i = labels.length - 1; i >= 0; i--) {
        if (depth >= labels[i].depth) {
            status = labels[i].label;
            activeDepth = labels[i].depth;
            break;
        }
    }

    depthStatus.textContent = status;

    // Update active marker in UI
    const markers = document.querySelectorAll('.marker-item');
    markers.forEach(marker => {
        const markerDepth = parseInt(marker.dataset.depth);
        if (markerDepth === activeDepth) {
            marker.classList.add('active');
        } else {
            marker.classList.remove('active');
        }
    });

    // Calculate water overlay height (proportional to vehicle height)
    const maxDepth = labels[labels.length - 1].depth;
    const percentage = Math.min((depth / maxDepth) * 100, 100);
    const waterHeight = (percentage / 100) * vehicleHeight;
    waterOverlay.style.height = `${waterHeight}px`;
}

// Captcha
async function fetchCaptcha() {
    try {
        const response = await fetch('/api/captcha');
        if (!response.ok) throw new Error('Failed to load captcha');
        const data = await response.json();
        captchaQuestion.textContent = `${data.a} + ${data.b} = ?`;
        captchaToken.value = data.token;
        captchaAnswer.value = '';
    } catch (error) {
        captchaQuestion.textContent = 'Captcha unavailable';
        console.error('Captcha error:', error);
    }
}

// Form Handlers
function setupFormHandlers() {
    // Depth slider
    depthSlider.addEventListener('input', (e) => {
        updateDepthVisualization(parseInt(e.target.value));
    });

    // Captcha refresh
    refreshCaptcha.addEventListener('click', fetchCaptcha);

    // Form submit
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitReport();
    });
}

async function submitReport() {
    const submitBtn = reportForm.querySelector('.submit-btn');
    const originalText = submitBtn.textContent;

    // Validate form before submission
    const phone = document.getElementById('phone').value.trim();
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
        showStatus('✗ Please enter a valid phone number (at least 10 digits)', 'error');
        return;
    }

    const depth = parseInt(depthSlider.value);
    if (depth < 0) {
        showStatus('✗ Flood depth Invalid', 'error');
        return;
    }

    const photo = document.getElementById('photo').files[0];
    if (!photo) {
        showStatus('✗ Please select a photo to upload', 'error');
        return;
    }

    if (photo.size > 10 * 1024 * 1024) {
        showStatus('✗ Photo size must be less than 10MB', 'error');
        return;
    }

    try {
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;

        const formData = new FormData(reportForm);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch('/api/submit', {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const result = await response.json();

        if (!response.ok || !result.ok) {
            throw new Error(result.error || 'Submission failed');
        }

        showStatus('✓ Report submitted successfully! Thank you for contributing.', 'success');
        reportForm.reset();
        depthSlider.value = 30;
        updateDepthVisualization(0);
        fetchCaptcha();

        // Reset vehicle selector
        document.querySelectorAll('.vehicle-option').forEach(opt => opt.classList.remove('selected'));
        document.querySelector('.vehicle-option[data-type="car"]').classList.add('selected');
        selectedVehicle = 'car';
        vehicleTypeInput.value = 'car';
        vehicleImage.src = vehicleImages['car'];

        // Reset border colors
        document.getElementById('street').style.borderColor = '';
        document.getElementById('zone').style.borderColor = '';

        // Re-capture GPS for next submission
        setTimeout(initGPS, 1000);

    } catch (error) {
        if (error.name === 'AbortError') {
            showStatus('✗ Upload timeout. Please check your connection and try again.', 'error');
        } else if (!navigator.onLine) {
            showStatus('✗ No internet connection. Please check and try again.', 'error');
        } else {
            showStatus('✗ Error: ' + error.message, 'error');
        }
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function showStatus(message, type) {
    formStatus.textContent = message;
    formStatus.className = `form-status ${type}`;
    formStatus.style.display = 'block';

    setTimeout(() => {
        formStatus.style.display = 'none';
    }, 5000);
}
