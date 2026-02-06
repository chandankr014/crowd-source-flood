/* =============================================================================
   AIResQ ClimSols - Report Page JavaScript
   ============================================================================= */

// =============================================================================
// CALIBRATION CONSTANTS - Fixed 2-meter scale system
// =============================================================================
const CALIBRATION = {
    SCALE_MAX_CM: 200,
    CONTAINER_HEIGHT_PX: 180,
    BOTTOM_OFFSET_PX: 8,

    get PX_PER_CM() {
        return (this.CONTAINER_HEIGHT_PX - this.BOTTOM_OFFSET_PX) / this.SCALE_MAX_CM;
    },

    get USABLE_HEIGHT_PX() {
        return this.CONTAINER_HEIGHT_PX - this.BOTTOM_OFFSET_PX;
    },

    DEBUG: false,

    log(label, data) {
        if (this.DEBUG) console.log(`[Calibration:${label}]`, data);
    },

    updateFromDOM() {
        const container = document.querySelector('.depth-visual-container');
        if (container) {
            this.CONTAINER_HEIGHT_PX = container.offsetHeight;
        }
    },

    cmToPixels(cm) {
        return (cm / this.SCALE_MAX_CM) * this.USABLE_HEIGHT_PX;
    }
};

// =============================================================================
// REFERENCE DATA
// =============================================================================

const depthLabels = {
    car: [
        { depth: 0, label: 'No Flood' },
        { depth: 18, label: 'Ground clearance' },
        { depth: 35, label: 'Exhaust / underbody risk' },
        { depth: 60, label: 'Door sill level' },
        { depth: 95, label: 'Window level' },
        { depth: 150, label: 'Roof level' }
    ],
    autorickshaw: [
        { depth: 0, label: 'No Flood' },
        { depth: 15, label: 'Ground clearance' },
        { depth: 35, label: 'Wheel hub level' },
        { depth: 50, label: 'Floor level' },
        { depth: 75, label: 'Seat level' },
        { depth: 165, label: 'Roof level' }
    ],
    bike: [
        { depth: 0, label: 'No Flood' },
        { depth: 15, label: 'Ground clearance' },
        { depth: 45, label: 'Wheel hub level' },
        { depth: 60, label: 'Engine intake risk' },
        { depth: 90, label: 'Seat level' },
        { depth: 125, label: 'Handlebar level' }
    ],
    cycle: [
        { depth: 0, label: 'No Flood' },
        { depth: 10, label: 'Ground level' },
        { depth: 25, label: 'Wheel hub level' },
        { depth: 45, label: 'Pedal level' },
        { depth: 90, label: 'Seat level' },
        { depth: 110, label: 'Handlebar level' }
    ],
    person: [
        { depth: 0, label: 'No Flood' },
        { depth: 25, label: 'Ankle level' },
        { depth: 45, label: 'Knee level' },
        { depth: 75, label: 'Mid-thigh level' },
        { depth: 100, label: 'Waist level' },
        { depth: 135, label: 'Chest level' },
        { depth: 155, label: 'Neck level' },
        { depth: 180, label: 'Fully submerged' }
    ]
};

const referenceRealHeights = {
    car: 155,
    autorickshaw: 185,
    bike: 130,
    cycle: 120,
    person: 183
};

const referenceImages = {
    car: '/static/carsvg.svg',
    autorickshaw: '/static/autorickshaw.svg',
    bike: '/static/bikesvg.svg',
    cycle: '/static/bicycle.svg',
    person: '/static/person.svg'
};

// =============================================================================
// STATE
// =============================================================================

let selectedReference = 'car';
let currentUnit = 'meter';
let depthInCm = 0;
let personHeightCm = 183;
let cameraStream = null;

// =============================================================================
// UNIT CONVERSION
// =============================================================================

function cmToDisplay(cm, unit) {
    switch (unit) {
        case 'meter': return (cm / 100).toFixed(2);
        case 'feet': return (cm / 30.48).toFixed(2);
        case 'cm': return cm.toString();
    }
}

function displayToCm(value, unit) {
    switch (unit) {
        case 'meter': return Math.round(value * 100);
        case 'feet': return Math.round(value * 30.48);
        case 'cm': return Math.round(value);
    }
}

function getUnitLabel(unit) {
    switch (unit) {
        case 'meter': return 'm';
        case 'feet': return 'ft';
        case 'cm': return 'cm';
    }
}

// =============================================================================
// REFERENCE DISPLAY
// =============================================================================

function updateReferenceDisplay() {
    const refDisplay = document.getElementById('referenceDisplay');
    const refImg = document.getElementById('referenceImg');

    if (!refDisplay || !refImg) return;

    CALIBRATION.updateFromDOM();

    refDisplay.setAttribute('data-type', selectedReference);
    refImg.src = referenceImages[selectedReference];

    const refHeightCm = referenceRealHeights[selectedReference];
    const scaledHeightPx = CALIBRATION.cmToPixels(refHeightCm);
    refDisplay.style.setProperty('--ref-height', `${Math.round(scaledHeightPx)}px`);
}

// =============================================================================
// DEPTH DISPLAY
// =============================================================================

function updateDepthDisplay(cm) {
    const waterLevel = document.getElementById('waterLevel');
    const depthValueEl = document.getElementById('depthValue');
    const depthUnitLabel = document.getElementById('depthUnitLabel');
    const inputUnit = document.getElementById('inputUnit');
    const depthInput = document.getElementById('depth_input');
    const depthStatus = document.getElementById('depthStatus');

    const displayValue = cmToDisplay(cm, currentUnit);
    if (depthValueEl) depthValueEl.textContent = displayValue;
    if (depthUnitLabel) depthUnitLabel.textContent = getUnitLabel(currentUnit);
    if (inputUnit) inputUnit.textContent = getUnitLabel(currentUnit);

    if (depthInput && document.activeElement !== depthInput) {
        depthInput.value = displayValue;
    }

    // Update status
    const labels = depthLabels[selectedReference];
    let status = labels[0].label;
    for (let i = labels.length - 1; i >= 0; i--) {
        if (cm >= labels[i].depth) { status = labels[i].label; break; }
    }
    if (depthStatus) depthStatus.textContent = status;

    // Water level visual
    const waterHeightPx = Math.min(CALIBRATION.cmToPixels(cm), CALIBRATION.USABLE_HEIGHT_PX);
    if (waterLevel) {
        waterLevel.style.height = waterHeightPx + 'px';
    }

    // Status color
    if (depthStatus) {
        if (cm === 0) {
            depthStatus.style.background = '#E3F2FD';
            depthStatus.style.color = '#1976D2';
        } else if (cm < 50) {
            depthStatus.style.background = 'rgba(46, 125, 50, 0.15)';
            depthStatus.style.color = '#2E7D32';
        } else if (cm < 100) {
            depthStatus.style.background = 'rgba(237, 108, 2, 0.15)';
            depthStatus.style.color = '#ED6C02';
        } else {
            depthStatus.style.background = 'rgba(211, 47, 47, 0.15)';
            depthStatus.style.color = '#D32F2F';
        }
    }
}

// =============================================================================
// PERSON HEIGHT
// =============================================================================

function setPersonHeight(heightCm) {
    personHeightCm = Math.max(100, Math.min(230, Math.round(heightCm)));
    referenceRealHeights.person = personHeightCm;

    const baseHeight = 183;
    const ratio = personHeightCm / baseHeight;

    depthLabels.person = [
        { depth: 0, label: 'No Flood' },
        { depth: Math.round(25 * ratio), label: 'Ankle level' },
        { depth: Math.round(45 * ratio), label: 'Knee level' },
        { depth: Math.round(75 * ratio), label: 'Mid-thigh level' },
        { depth: Math.round(100 * ratio), label: 'Waist level' },
        { depth: Math.round(135 * ratio), label: 'Chest level' },
        { depth: Math.round(155 * ratio), label: 'Neck level' },
        { depth: personHeightCm, label: 'Fully submerged' }
    ];

    const cmDisplay = document.querySelector('.height-cm-display');
    if (cmDisplay) cmDisplay.textContent = `(${personHeightCm} cm)`;

    if (selectedReference === 'person') {
        updateReferenceDisplay();
        updateDepthDisplay(depthInCm);
    }
}

function feetInchesToCm(feet, inches) {
    return Math.round((feet * 30.48) + (inches * 2.54));
}

function updateHeightFromInputs() {
    const feetInput = document.getElementById('personHeightFeet');
    const inchesInput = document.getElementById('personHeightInches');

    if (!feetInput || !inchesInput) return;

    const feet = parseInt(feetInput.value) || 6;
    const inches = parseInt(inchesInput.value) || 0;
    const cm = feetInchesToCm(feet, inches);

    setPersonHeight(cm);

    document.querySelectorAll('.height-preset').forEach(btn => {
        const pFeet = parseInt(btn.dataset.feet);
        const pInches = parseInt(btn.dataset.inches);
        btn.classList.toggle('active', pFeet === feet && pInches === inches);
    });
}

// =============================================================================
// CAMERA & PHOTO
// =============================================================================

function openGallery() {
    document.getElementById('photoGallery').click();
}

async function openCamera() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraStream');

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        video.srcObject = cameraStream;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    } catch (e) {
        alert('Camera access denied. Please allow camera access in your browser settings.');
    }
}

function closeCamera() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraStream');

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    video.srcObject = null;
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function capturePhoto() {
    const video = document.getElementById('cameraStream');
    const canvas = document.getElementById('cameraCanvas');
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(blob => {
        const file = new File([blob], `flood_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const dt = new DataTransfer();
        dt.items.add(file);
        document.getElementById('photo').files = dt.files;

        showPhotoPreview(file);
        closeCamera();
    }, 'image/jpeg', 0.9);
}

function handlePhotoSelect(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const mainInput = document.getElementById('photo');
        const dt = new DataTransfer();
        dt.items.add(file);
        mainInput.files = dt.files;
        showPhotoPreview(file);
    }
}

function showPhotoPreview(file) {
    const preview = document.getElementById('photoPreview');
    const previewImg = document.getElementById('previewImg');
    const photoName = document.getElementById('photoName');
    previewImg.src = URL.createObjectURL(file);
    photoName.textContent = file.name;
    preview.classList.remove('hidden');
}

// =============================================================================
// GPS
// =============================================================================

let gpsWatchId = null;
let gpsBestAccuracy = Infinity;

function initGPS() {
    const gpsText = document.getElementById('gpsText');
    const gpsStatus = document.getElementById('gpsStatus');

    if (!navigator.geolocation) {
        gpsText.textContent = 'GPS not supported';
        return;
    }

    gpsBestAccuracy = Infinity;
    gpsText.textContent = 'Acquiring GPS signal...';

    if (gpsWatchId) navigator.geolocation.clearWatch(gpsWatchId);

    gpsWatchId = navigator.geolocation.watchPosition(
        pos => {
            const accuracy = pos.coords.accuracy;

            // Only update if more accurate than previous reading
            if (accuracy < gpsBestAccuracy) {
                gpsBestAccuracy = accuracy;
                document.getElementById('gps_lat').value = pos.coords.latitude.toFixed(6);
                document.getElementById('gps_lon').value = pos.coords.longitude.toFixed(6);
                document.getElementById('gps_accuracy').value = accuracy.toFixed(2);

                // Show accuracy level to user
                let accuracyLabel = '';
                if (accuracy <= 10) {
                    accuracyLabel = '📍 High accuracy';
                    gpsStatus.className = 'gps-status success';
                } else if (accuracy <= 30) {
                    accuracyLabel = '📍 Good accuracy';
                    gpsStatus.className = 'gps-status success';
                } else if (accuracy <= 100) {
                    accuracyLabel = '📍 Moderate accuracy';
                    gpsStatus.className = 'gps-status warning';
                } else {
                    accuracyLabel = '📍 accuracy';
                    gpsStatus.className = 'gps-status warning';
                }

                gpsText.textContent = `${accuracyLabel} (±${Math.round(accuracy)}m)`;
            }

            // Stop watching once we have excellent accuracy
            if (accuracy <= 10) {
                navigator.geolocation.clearWatch(gpsWatchId);
                gpsWatchId = null;
                console.log("Excellent GPS accuracy achieved:", accuracy, "m");
            }
        },
        err => {
            gpsText.textContent = 'GPS unavailable - using approximate location';
            gpsStatus.classList.add('error');
            fallbackIP();
        },
        {
            enableHighAccuracy: true,
            timeout: 60000,
            maximumAge: 0
        }
    );

    // Auto-stop after 2 minutes to save battery
    setTimeout(() => {
        if (gpsWatchId) {
            navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
        }
    }, 120000);
}

async function fallbackIP() {
    try {
        const r = await fetch('https://ipapi.co/json/');
        const d = await r.json();
        if (d.latitude) {
            document.getElementById('gps_lat').value = d.latitude;
            document.getElementById('gps_lon').value = d.longitude;
            document.getElementById('gps_accuracy').value = 5000;
            document.getElementById('gpsText').textContent = `Approx: ${d.city || 'Detected'}`;
            if (d.city) document.getElementById('zone').value = d.city;
        }
    } catch (e) { }
}

// =============================================================================
// FORM INITIALIZATION
// =============================================================================

function initReferenceSelector() {
    document.querySelectorAll('.reference-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.reference-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedReference = opt.dataset.type;
            document.getElementById('vehicle_type').value = selectedReference;

            const heightAdjustment = document.getElementById('heightAdjustmentSection');
            if (heightAdjustment) {
                heightAdjustment.classList.toggle('hidden', selectedReference !== 'person');
            }

            updateReferenceDisplay();
            updateDepthDisplay(depthInCm);
        });
    });
}

function initUnitSelector() {
    document.querySelectorAll('.unit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentUnit = btn.dataset.unit;

            const depthInput = document.getElementById('depth_input');
            switch (currentUnit) {
                case 'meter':
                    depthInput.step = '0.01';
                    depthInput.max = '2';
                    break;
                case 'feet':
                    depthInput.step = '0.1';
                    depthInput.max = '6.56';
                    break;
                case 'cm':
                    depthInput.step = '1';
                    depthInput.max = '200';
                    break;
            }
            updateDepthDisplay(depthInCm);
        });
    });
}

function initDepthControls() {
    const depthSlider = document.getElementById('flood_depth_cm');
    const depthInput = document.getElementById('depth_input');

    if (depthSlider) {
        depthSlider.addEventListener('input', e => {
            depthInCm = parseInt(e.target.value);
            updateDepthDisplay(depthInCm);
        });
    }

    if (depthInput) {
        depthInput.addEventListener('input', e => {
            const value = parseFloat(e.target.value) || 0;
            depthInCm = displayToCm(value, currentUnit);
            depthInCm = Math.max(0, Math.min(200, depthInCm));
            if (depthSlider) depthSlider.value = depthInCm;
            updateDepthDisplay(depthInCm);
        });
    }
}

function initHeightAdjustment() {
    const feetInput = document.getElementById('personHeightFeet');
    const inchesInput = document.getElementById('personHeightInches');

    if (feetInput) {
        feetInput.addEventListener('input', updateHeightFromInputs);
        feetInput.addEventListener('change', updateHeightFromInputs);
    }

    if (inchesInput) {
        inchesInput.addEventListener('input', updateHeightFromInputs);
        inchesInput.addEventListener('change', updateHeightFromInputs);
    }

    document.querySelectorAll('.height-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const feet = parseInt(btn.dataset.feet);
            const inches = parseInt(btn.dataset.inches);

            if (feetInput) feetInput.value = feet;
            if (inchesInput) inchesInput.value = inches;

            document.querySelectorAll('.height-preset').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            setPersonHeight(feetInchesToCm(feet, inches));
        });
    });

    setPersonHeight(183);
}

function initReportForm() {
    const form = document.getElementById('reportForm');
    if (!form) return;

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const status = document.getElementById('formStatus');
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner" style="display:inline-block;width:16px;height:16px;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;margin-right:8px;"></span> Submitting...';

        try {
            const formData = new FormData(e.target);

            if (selectedReference === 'person') {
                formData.append('person_height_cm', personHeightCm);
            }

            const r = await fetch('/api/submit', { method: 'POST', body: formData });
            const d = await r.json();

            if (d.ok) {
                status.textContent = '✓ Flood report submitted successfully! Thank you for contributing.';
                status.className = 'status-msg success';
                e.target.reset();

                if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
                document.getElementById('flood_depth_cm').value = 0;
                depthInCm = 0;
                updateDepthDisplay(0);

                document.querySelectorAll('.reference-option').forEach(o => o.classList.remove('selected'));
                document.querySelector('.reference-option[data-type="car"]').classList.add('selected');
                selectedReference = 'car';
                updateReferenceDisplay();

                const heightAdjustment = document.getElementById('heightAdjustmentSection');
                if (heightAdjustment) heightAdjustment.classList.add('hidden');

                document.getElementById('photoPreview').classList.add('hidden');
                document.getElementById('previewImg').src = '';
                document.getElementById('photo').value = '';
                document.getElementById('photoGallery').value = '';
            } else {
                throw new Error(d.error);
            }
        } catch (err) {
            status.textContent = '✗ Error: ' + err.message;
            status.className = 'status-msg error';
        }

        status.classList.remove('hidden');
        btn.disabled = false;
        btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg> Submit Flood Report';
    });
}

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initReferenceSelector();
    initUnitSelector();
    initDepthControls();
    initHeightAdjustment();
    initReportForm();
    initGPS();
    updateReferenceDisplay();
    updateDepthDisplay(0);

    console.log('AIResQ ClimSols Flood Report page initialized');
});
