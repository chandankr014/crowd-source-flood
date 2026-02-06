/* AIResQ ClimSols - Index Page JavaScript (Hindi) */

// =============================================================================
// CALIBRATION CONSTANTS - Fixed 2-meter scale system
// =============================================================================
// The visual container represents exactly 2 meters (200cm) of real-world height.
// All calculations derive from this fixed scale.
const CALIBRATION = {
    // Real-world height represented by the visual container (in cm)
    SCALE_MAX_CM: 200,

    // Container height in pixels - will be updated dynamically from DOM
    CONTAINER_HEIGHT_PX: 180,

    // Bottom padding in pixels (object sits above container bottom)
    BOTTOM_OFFSET_PX: 8,

    // Derived: pixels per centimeter (for precise calculations)
    get PX_PER_CM() {
        return (this.CONTAINER_HEIGHT_PX - this.BOTTOM_OFFSET_PX) / this.SCALE_MAX_CM;
    },

    // Derived: centimeters per pixel
    get CM_PER_PX() {
        return this.SCALE_MAX_CM / (this.CONTAINER_HEIGHT_PX - this.BOTTOM_OFFSET_PX);
    },

    // Derived: usable height (container height minus bottom offset)
    get USABLE_HEIGHT_PX() {
        return this.CONTAINER_HEIGHT_PX - this.BOTTOM_OFFSET_PX;
    },

    // Debug logging enabled
    DEBUG: true,

    // Log calibration data for debugging
    log(label, data) {
        if (this.DEBUG) {
            console.log(`[Calibration:${label}]`, data);
        }
    },

    // Update container height from DOM (call on load and resize)
    updateFromDOM() {
        const container = document.querySelector('.depth-visual-container');
        if (container) {
            this.CONTAINER_HEIGHT_PX = container.offsetHeight;
            this.log('DOMUpdate', {
                containerHeightPx: this.CONTAINER_HEIGHT_PX,
                usableHeightPx: this.USABLE_HEIGHT_PX,
                pxPerCm: this.PX_PER_CM.toFixed(3),
                scaleMaxCm: this.SCALE_MAX_CM
            });
        }
    },

    // Convert real-world cm to pixel height
    cmToPixels(cm) {
        return (cm / this.SCALE_MAX_CM) * this.USABLE_HEIGHT_PX;
    },

    // Convert pixel height to real-world cm
    pixelsToCm(px) {
        return (px / this.USABLE_HEIGHT_PX) * this.SCALE_MAX_CM;
    }
};

// Reference depth labels (in cm) – scaled & physically consistent
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

// Reference object real heights in cm (for depth calculation)
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


// Visual sizes removed - now handled by CSS with data-type attribute

let selectedReference = 'car';
let currentUnit = 'meter';
let depthInCm = 0;
let personHeightCm = 183; // Default 6 feet
let cameraStream = null;

// Unit conversion helpers
function cmToDisplay(cm, unit) {
    switch (unit) {
        case 'meter': return (cm / 100).toFixed(2).toString();
        case 'feet': return (cm / 30.48).toFixed(2).toString();
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

// Update reference display with data-type for CSS responsive sizing
// Now also scales the reference object height proportionally to the 2m container
function updateReferenceDisplay() {
    const refDisplay = document.getElementById('referenceDisplay');
    const refImg = document.getElementById('referenceImg');

    if (!refDisplay || !refImg) return;

    // Update calibration from DOM to handle responsive container sizes
    CALIBRATION.updateFromDOM();

    // Set data-type attribute for CSS-based responsive sizing
    refDisplay.setAttribute('data-type', selectedReference);
    refImg.src = referenceImages[selectedReference];

    // =======================================================================
    // CALIBRATED SCALING: Scale reference object to match 2m container
    // =======================================================================
    const refHeightCm = referenceRealHeights[selectedReference];

    // Calculate the height in pixels using calibration
    const scaledHeightPx = CALIBRATION.cmToPixels(refHeightCm);

    // Apply the calculated height to the reference display
    refDisplay.style.setProperty('--ref-height', `${Math.round(scaledHeightPx)}px`);

    // Debug logging
    CALIBRATION.log('RefDisplay', {
        reference: selectedReference,
        realHeightCm: refHeightCm,
        scaledHeightPx: Math.round(scaledHeightPx),
        containerHeightPx: CALIBRATION.CONTAINER_HEIGHT_PX,
        usableHeightPx: CALIBRATION.USABLE_HEIGHT_PX,
        scaleMaxCm: CALIBRATION.SCALE_MAX_CM,
        pxPerCm: CALIBRATION.PX_PER_CM.toFixed(3)
    });
}

// Page navigation
function showPage(page) {
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    }
    document.getElementById('crowdsourcePage').classList.add('hidden');
    document.getElementById('volunteerPage').classList.add('hidden');
    document.getElementById('mapPage').classList.add('hidden');
    document.getElementById('aboutPage').classList.add('hidden');
    document.getElementById(page + 'Page').classList.remove('hidden');

    if (page === 'map') {
        initMap();
    }
}

// Request permissions on page load
async function requestPermissions() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                document.getElementById('gps_lat').value = pos.coords.latitude;
                document.getElementById('gps_lon').value = pos.coords.longitude;
                document.getElementById('gps_accuracy').value = pos.coords.accuracy;
                document.getElementById('gpsStatus').classList.add('active');
                document.getElementById('gpsText').textContent = `GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
            },
            err => {
                document.getElementById('gpsText').textContent = 'Location access denied';
            },
            { enableHighAccuracy: true }
        );
    }

    if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            stream.getTracks().forEach(track => track.stop());
        } catch (e) {
            console.log('Camera permission not granted:', e.message);
        }
    }
}

// Open gallery
function openGallery() {
    document.getElementById('photoGallery').click();
}

// Open camera
async function openCamera() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraStream');

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        video.srcObject = cameraStream;
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    } catch (e) {
        alert('Camera access denied. Please allow camera access in your browser settings.');
    }
}

// Close camera
function closeCamera() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraStream');

    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    video.srcObject = null;
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// Capture photo from camera
function capturePhoto() {
    const video = document.getElementById('cameraStream');
    const canvas = document.getElementById('cameraCanvas');
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(blob => {
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const dt = new DataTransfer();
        dt.items.add(file);
        document.getElementById('photo').files = dt.files;

        showPhotoPreview(file);
        closeCamera();
    }, 'image/jpeg', 0.9);
}

// Photo selection handler
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

// Show photo preview
function showPhotoPreview(file) {
    const preview = document.getElementById('photoPreview');
    const previewImg = document.getElementById('previewImg');
    const photoName = document.getElementById('photoName');
    previewImg.src = URL.createObjectURL(file);
    photoName.textContent = file.name;
    preview.style.display = 'block';
}

// Volunteer tabs
function showVolunteerTab(tab) {
    document.getElementById('volunteerRegister').classList.add('hidden');
    document.getElementById('volunteerSignin').classList.add('hidden');
    document.getElementById('volunteerDashboard').classList.add('hidden');
    if (tab === 'register') document.getElementById('volunteerRegister').classList.remove('hidden');
    else if (tab === 'signin') document.getElementById('volunteerSignin').classList.remove('hidden');
}

// Checkbox toggle
function toggleCheckbox(el, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    el.classList.toggle('checked');
    const checkbox = el.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = el.classList.contains('checked');
}

// Radio select
function selectRadio(el, name, event) {
    if (event) event.stopPropagation();
    document.querySelectorAll(`input[name="${name}"]`).forEach(r => {
        const parent = r.closest('.radio-item');
        if (parent) parent.classList.remove('selected');
    });
    el.classList.add('selected');
    const radio = el.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
}

// Person height adjustment - calibrated to default 6ft (183cm)
// DEBUG: Call setPersonHeight(cm) from console to test
// DEBUG: Call CALIBRATION.log('test', {...}) to see calibration data
function setPersonHeight(heightCm) {
    // Clamp between 100cm (3'3") and 230cm (7'6")
    // Note: heights > 200cm will extend beyond the 2m visual scale
    personHeightCm = Math.max(100, Math.min(230, Math.round(heightCm)));
    referenceRealHeights.person = personHeightCm;

    // Calibration: depth labels scale proportionally to 6ft baseline
    // E.g., if person is 5ft (152cm), ankle at 25cm for 6ft becomes ~21cm
    const baseHeight = 183; // 6 feet in cm (default)
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

    // Update the cm display
    const cmDisplay = document.querySelector('.height-cm-display');
    if (cmDisplay) {
        cmDisplay.textContent = `(${personHeightCm} cm)`;
    }

    // Calculate the scaled height in pixels for display
    const scaledHeightPx = CALIBRATION.cmToPixels(personHeightCm);

    // Debug log for calibration verification
    CALIBRATION.log('PersonHeight', {
        heightCm: personHeightCm,
        baseHeightCm: baseHeight,
        ratio: ratio.toFixed(3),
        kneeDepthCm: Math.round(45 * ratio),
        waistDepthCm: Math.round(100 * ratio),
        scaledHeightPx: Math.round(scaledHeightPx),
        exceedsScale: personHeightCm > CALIBRATION.SCALE_MAX_CM
    });

    // Recalculate display if person is selected (updates both visual and labels)
    if (selectedReference === 'person') {
        updateReferenceDisplay();
        updateDepthDisplay(depthInCm);
    }
}

// Convert feet+inches to cm
function feetInchesToCm(feet, inches) {
    return Math.round((feet * 30.48) + (inches * 2.54));
}

// Update height from feet/inches inputs
function updateHeightFromInputs() {
    const feetInput = document.getElementById('personHeightFeet');
    const inchesInput = document.getElementById('personHeightInches');

    if (!feetInput || !inchesInput) return;

    const feet = parseInt(feetInput.value) || 6;
    const inches = parseInt(inchesInput.value) || 0;
    const cm = feetInchesToCm(feet, inches);

    setPersonHeight(cm);

    // Update preset button states
    document.querySelectorAll('.height-preset').forEach(btn => {
        const pFeet = parseInt(btn.dataset.feet);
        const pInches = parseInt(btn.dataset.inches);
        btn.classList.toggle('active', pFeet === feet && pInches === inches);
    });
}

// Initialize reference selector
function initReferenceSelector() {
    document.querySelectorAll('.reference-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.reference-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedReference = opt.dataset.type;
            document.getElementById('vehicle_type').value = selectedReference;

            // Show/hide height adjustment for person
            const heightAdjustment = document.getElementById('heightAdjustmentSection');
            if (heightAdjustment) {
                heightAdjustment.classList.toggle('hidden', selectedReference !== 'person');
            }

            updateReferenceDisplay();
            updateDepthDisplay(depthInCm);
        });
    });
}

// Initialize unit selector
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

// Initialize depth controls
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

// Update depth display
// Uses CALIBRATION constants for consistent 2-meter scale rendering
function updateDepthDisplay(cm) {
    const waterLevel = document.getElementById('waterLevel');
    const depthValueEl = document.getElementById('depthValue');
    const depthUnitLabel = document.getElementById('depthUnitLabel');
    const inputUnit = document.getElementById('inputUnit');
    const depthInput = document.getElementById('depth_input');
    const depthStatus = document.getElementById('depthStatus');

    // Update display value
    const displayValue = cmToDisplay(cm, currentUnit);
    if (depthValueEl) depthValueEl.textContent = displayValue;
    if (depthUnitLabel) depthUnitLabel.textContent = getUnitLabel(currentUnit);
    if (inputUnit) inputUnit.textContent = getUnitLabel(currentUnit);

    // Update input field
    if (depthInput && document.activeElement !== depthInput) {
        depthInput.value = displayValue;
    }

    // Update status label based on reference object depth thresholds
    const labels = depthLabels[selectedReference];
    let status = labels[0].label;
    for (let i = labels.length - 1; i >= 0; i--) {
        if (cm >= labels[i].depth) { status = labels[i].label; break; }
    }
    if (depthStatus) depthStatus.textContent = status;

    // =======================================================================
    // CALIBRATED WATER LEVEL CALCULATION
    // =======================================================================
    // Water level is always calculated against the fixed 2-meter (200cm) scale
    // This ensures the visual representation is physically accurate regardless
    // of which reference object is selected.

    const refHeightCm = referenceRealHeights[selectedReference];

    // Calculate water height in pixels for accurate rendering
    // This is clamped to the usable height (container - bottom offset)
    const waterHeightPx = Math.min(CALIBRATION.cmToPixels(cm), CALIBRATION.USABLE_HEIGHT_PX);

    // Calculate reference object height in pixels
    const refHeightPx = CALIBRATION.cmToPixels(refHeightCm);

    // Calculate submergence level (how much of the reference object is submerged)
    const submergencePercent = Math.min((cm / refHeightCm) * 100, 100);

    // Calculate the overlap between water and reference object in cm
    const overlapCm = Math.min(cm, refHeightCm);

    if (waterLevel) {
        // Set water level height in pixels for precise calibration
        waterLevel.style.height = waterHeightPx + 'px';
    }

    // Debug logging for calibration verification
    CALIBRATION.log('DepthCalc', {
        inputDepthCm: cm,
        reference: selectedReference,
        refHeightCm: refHeightCm,
        refHeightPx: refHeightPx.toFixed(1) + 'px',
        scaleMaxCm: CALIBRATION.SCALE_MAX_CM,
        waterHeightPx: waterHeightPx.toFixed(1) + 'px',
        submergencePercent: submergencePercent.toFixed(2) + '%',
        overlapCm: overlapCm,
        status: status
    });

    // Update status badge color
    if (depthStatus) {
        if (cm === 0) {
            depthStatus.style.background = 'var(--primary-dim)';
            depthStatus.style.color = 'var(--primary)';
        } else if (cm < 50) {
            depthStatus.style.background = 'rgba(16, 185, 129, 0.15)';
            depthStatus.style.color = 'var(--success)';
        } else if (cm < 100) {
            depthStatus.style.background = 'rgba(245, 158, 11, 0.15)';
            depthStatus.style.color = 'var(--warning)';
        } else {
            depthStatus.style.background = 'rgba(239, 68, 68, 0.15)';
            depthStatus.style.color = 'var(--error)';
        }
    }
}

// GPS
let gpsWatchId = null;
let gpsBestAccuracy = Infinity;

function initGPS() {
    if (!navigator.geolocation) {
        document.getElementById('gpsText').textContent = 'GPS not supported';
        return;
    }

    gpsBestAccuracy = Infinity;
    document.getElementById('gpsText').textContent = 'Acquiring GPS signal...';

    if (gpsWatchId) navigator.geolocation.clearWatch(gpsWatchId);

    gpsWatchId = navigator.geolocation.watchPosition(pos => {
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
            } else if (accuracy <= 30) {
                accuracyLabel = '📍 Good accuracy';
            } else if (accuracy <= 100) {
                accuracyLabel = '📍 Moderate accuracy';
            } else {
                accuracyLabel = '📍 accuracy';
            }

            document.getElementById('gpsText').textContent = `${accuracyLabel} (±${Math.round(accuracy)}m)`;
            document.getElementById('gpsStatus').classList.add('active');
        }

        // Stop watching once we have excellent accuracy
        if (accuracy <= 10) {
            navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
            console.log("Excellent GPS accuracy achieved:", accuracy, "m");
        }
    }, err => {
        document.getElementById('gpsText').textContent = 'GPS unavailable - using approximate location';
        fallbackIP();
    }, {
        enableHighAccuracy: true,
        timeout: 60000,
        maximumAge: 0
    });

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

// Initialize height adjustment controls (feet + inches)
function initHeightAdjustment() {
    const feetInput = document.getElementById('personHeightFeet');
    const inchesInput = document.getElementById('personHeightInches');

    // Input event listeners
    if (feetInput) {
        feetInput.addEventListener('input', updateHeightFromInputs);
        feetInput.addEventListener('change', updateHeightFromInputs);
    }

    if (inchesInput) {
        inchesInput.addEventListener('input', updateHeightFromInputs);
        inchesInput.addEventListener('change', updateHeightFromInputs);
    }

    // Preset button click handlers
    document.querySelectorAll('.height-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const feet = parseInt(btn.dataset.feet);
            const inches = parseInt(btn.dataset.inches);

            // Update inputs
            if (feetInput) feetInput.value = feet;
            if (inchesInput) inchesInput.value = inches;

            // Update all preset states
            document.querySelectorAll('.height-preset').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Calculate and set height
            const cm = feetInchesToCm(feet, inches);
            setPersonHeight(cm);
        });
    });

    // Initialize with default 6'0" (183cm)
    setPersonHeight(183);
}

// Report form submit
function initReportForm() {
    const form = document.getElementById('reportForm');
    if (!form) return;

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const status = document.getElementById('formStatus');
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true; btn.textContent = 'Submitting...';

        try {
            const formData = new FormData(e.target);

            // Add person height if person is selected
            if (selectedReference === 'person') {
                formData.append('person_height_cm', personHeightCm);
            }

            const r = await fetch('/api/submit', { method: 'POST', body: formData });
            const d = await r.json();
            if (d.ok) {
                status.textContent = '✓ Report submitted successfully!';
                status.className = 'status-msg success';
                e.target.reset();

                if (typeof grecaptcha !== 'undefined') grecaptcha.reset();
                document.getElementById('flood_depth_cm').value = 0;
                depthInCm = 0;
                updateDepthDisplay(0);

                // Reset reference selector
                document.querySelectorAll('.reference-option').forEach(o => o.classList.remove('selected'));
                document.querySelector('.reference-option[data-type="car"]').classList.add('selected');
                selectedReference = 'car';
                updateReferenceDisplay();

                // Hide height adjustment
                const heightAdjustment = document.getElementById('heightAdjustmentSection');
                if (heightAdjustment) heightAdjustment.classList.add('hidden');

                // Clear photo preview and file inputs
                document.getElementById('photoPreview').style.display = 'none';
                document.getElementById('previewImg').src = '';
                document.getElementById('photo').value = '';
                document.getElementById('photoGallery').value = '';
            } else throw new Error(d.error);
        } catch (err) {
            status.textContent = '✗ ' + err.message;
            status.className = 'status-msg error';
        }
        status.classList.remove('hidden');
        btn.disabled = false; btn.textContent = 'Submit Report';
    });
}

// Volunteer registration
function initVolunteerForms() {
    const regForm = document.getElementById('volunteerRegForm');
    const signinForm = document.getElementById('volunteerSigninForm');

    if (regForm) {
        regForm.addEventListener('submit', async e => {
            e.preventDefault();
            const status = document.getElementById('regStatus');
            const skills = Array.from(document.querySelectorAll('#skillsGroup input:checked')).map(i => i.value);
            const availability = document.querySelector('input[name="availability"]:checked')?.value || '';

            try {
                const r = await fetch('/api/volunteer/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: e.target.username.value,
                        phone: e.target.phone.value,
                        skills, availability
                    })
                });
                const d = await r.json();
                if (d.ok) {
                    status.textContent = '✓ Registration successful! You can now sign in.';
                    status.className = 'status-msg success';
                    e.target.reset();
                    document.querySelectorAll('.checkbox-item').forEach(c => c.classList.remove('checked'));
                    document.querySelectorAll('.radio-item').forEach(r => r.classList.remove('selected'));
                } else throw new Error(d.error);
            } catch (err) {
                status.textContent = '✗ ' + err.message;
                status.className = 'status-msg error';
            }
            status.classList.remove('hidden');
        });
    }

    if (signinForm) {
        signinForm.addEventListener('submit', async e => {
            e.preventDefault();
            const status = document.getElementById('signinStatus');
            try {
                const r = await fetch('/api/volunteer/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: e.target.phone.value })
                });
                const d = await r.json();
                if (d.ok) {
                    document.getElementById('volunteerSignin').classList.add('hidden');
                    document.getElementById('volunteerDashboard').classList.remove('hidden');
                    document.getElementById('volName').textContent = d.volunteer.username;
                    document.getElementById('volSkills').textContent = d.volunteer.skills?.join(', ') || 'None';
                    document.getElementById('volAvail').textContent = d.volunteer.availability || 'Not set';
                } else throw new Error(d.error);
            } catch (err) {
                status.textContent = '✗ ' + err.message;
                status.className = 'status-msg error';
                status.classList.remove('hidden');
            }
        });
    }
}

function volunteerSignout() {
    document.getElementById('volunteerDashboard').classList.add('hidden');
    document.getElementById('volunteerSignin').classList.remove('hidden');
    document.getElementById('signinStatus').classList.add('hidden');
}

// ==================== LANGUAGE SWITCHING ====================
const LANGUAGES = {
    'en': { name: 'English' },
    'hn': { name: 'हिंदी' },
    'bn': { name: 'বাংলা' },
    'ta': { name: 'தமிழ்' },
    'te': { name: 'తెలుగు' },
    'mr': { name: 'मराठी' },
    'gu': { name: 'ગુજરાતી' },
    'kn': { name: 'ಕನ್ನಡ' },
    'ml': { name: 'മലയാളം' },
    'pa': { name: 'ਪੰਜਾਬੀ' },
    'or': { name: 'ଓଡ଼ିଆ' },
    'as': { name: 'অসমীয়া' },
    'ur': { name: 'اردو' }
};

function getCurrentLang() {
    const path = window.location.pathname;
    const match = path.match(/^\/([a-z]{2})\//);
    return match ? match[1] : 'en';
}

function isAdminPage() {
    return window.location.pathname.includes('admin');
}

function switchLanguage(langCode) {
    localStorage.removeItem('preferredLang');
    const isAdmin = isAdminPage();

    if (langCode === 'en') {
        window.location.href = isAdmin ? '/admin' : '/';
    } else {
        window.location.href = isAdmin ? `/${langCode}/admin.html` : `/${langCode}/`;
    }
}

function toggleLangMenu(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('langDropdown');
    dropdown.classList.toggle('open');
}

function toggleIndicSubmenu(event) {
    event.stopPropagation();
    const wrapper = document.getElementById('indicSubmenu');
    wrapper.classList.toggle('open');
}

function highlightCurrentLang() {
    const currentLang = getCurrentLang();
    document.querySelectorAll('.lang-menu-item[data-lang]').forEach(item => {
        item.classList.toggle('active', item.dataset.lang === currentLang);
    });
}

function initLanguagePreference() {
    highlightCurrentLang();
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('langDropdown');
    if (dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
    }
});

// Handle window resize - recalibrate reference display
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        CALIBRATION.log('Resize', { windowWidth: window.innerWidth, windowHeight: window.innerHeight });
        updateReferenceDisplay();
        updateDepthDisplay(depthInCm);
    }, 150);
});

// Initialize everything on page load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize calibration from DOM first
    CALIBRATION.updateFromDOM();
    CALIBRATION.log('Init', {
        containerHeightPx: CALIBRATION.CONTAINER_HEIGHT_PX,
        scaleMaxCm: CALIBRATION.SCALE_MAX_CM,
        pxPerCm: CALIBRATION.PX_PER_CM.toFixed(3),
        cmPerPx: CALIBRATION.CM_PER_PX.toFixed(3)
    });

    requestPermissions();
    initGPS();
    initLanguagePreference();
    initReferenceSelector();
    initUnitSelector();
    initDepthControls();
    initHeightAdjustment();
    initReportForm();
    initVolunteerForms();

    // Initialize reference display with calibrated data-type
    updateReferenceDisplay();

    // Log initial state for debugging
    console.log('[AIResQ] Calibration system initialized. Debug commands:');
    console.log('  CALIBRATION.log("test", {...}) - Log calibration data');
    console.log('  setPersonHeight(cm) - Set person height and recalibrate');
    console.log('  CALIBRATION.DEBUG = false - Disable debug logging');
});

// =============================================================================
// MAP FUNCTIONALITY
// =============================================================================
const DEFAULT_ZOOM = 12;
const DEFAULT_CENTER = { lat: 23.2156, lng: 72.6369 }; // Ahmedabad
const ICON_VISIBILITY_ZOOM_THRESHOLD = 14; // Show icons only when zoom > 14
let map = null;
let markers = [];

// Update marker visibility based on zoom level
function updateMarkersForZoom(zoomLevel) {
    const showIcons = zoomLevel > ICON_VISIBILITY_ZOOM_THRESHOLD;
    markers.forEach(marker => {
        // Show/hide the marker icon based on zoom level
        marker.setVisible(showIcons);
        // Force label overlay to redraw for correct positioning
        if (marker.labelOverlay) {
            marker.labelOverlay.draw();
        }
    });
}

function initMap() {
    if (map) {
        loadSubmissions(); // Reload submissions if map already exists
        return;
    }

    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    if (!window.google || !window.google.maps) {
        console.error('Google Maps not loaded, retrying...');
        setTimeout(initMap, 500);
        return;
    }

    map = new google.maps.Map(mapEl, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeId: 'satellite',
        disableDefaultUI: true,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy'
    });

    // Add zoom change listener to update marker visibility
    map.addListener('zoom_changed', () => {
        const zoomLevel = map.getZoom();
        updateMarkersForZoom(zoomLevel);
    });

    loadSubmissions();
}

async function loadSubmissions() {
    try {
        const res = await fetch('/api/submissions');
        const submissions = await res.json();

        // Clean up existing markers and their label overlays
        markers.forEach(m => {
            if (m.labelOverlay) m.labelOverlay.setMap(null);
            if (m.label) m.label.setMap(null);
            m.setMap(null);
        });
        markers = [];

        const portraits = ['m2.png', 'p2.svg', 'w1.svg', 'w2.svg', 'm1.png', 'w3.png', 'w4.png'];
        const currentZoom = map.getZoom();
        const showIcons = currentZoom > ICON_VISIBILITY_ZOOM_THRESHOLD;

        submissions.forEach((sub, index) => {
            if (!sub.gps || !sub.gps.lat || !sub.gps.lon) return;

            const depthM = (sub.flood_depth_cm / 100).toFixed(2);
            const d = new Date(sub.received_at);
            const pad = n => n.toString().padStart(2, '0');
            const date = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear().toString().slice(-2)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            const portrait = portraits[index % portraits.length];

            // Create custom marker with person icon
            const marker = new google.maps.Marker({
                position: { lat: sub.gps.lat, lng: sub.gps.lon },
                map: map,
                icon: {
                    url: `/static/portraits/${portrait}`,
                    scaledSize: new google.maps.Size(48, 48),
                    anchor: new google.maps.Point(24, 48)
                },
                optimized: false,
                visible: showIcons // Set initial visibility based on zoom
            });

            // Create permanent depth label with beautiful styling
            const labelDiv = document.createElement('div');
            labelDiv.className = 'depth-label';
            labelDiv.innerHTML = `
                <div style="
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    width:56px;      /* 2x width : height (56x28) */
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
                    <div style="line-height:1;">${depthM}m</div>
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

            const labelOverlay = new google.maps.OverlayView();
            labelOverlay.onAdd = function () {
                const panes = this.getPanes();
                panes.overlayLayer.appendChild(labelDiv);
            };

            labelOverlay.draw = function () {
                const projection = this.getProjection();
                const position = projection.fromLatLngToDivPixel(marker.getPosition());
                const zoomLevel = map.getZoom();
                const showIcons = zoomLevel > ICON_VISIBILITY_ZOOM_THRESHOLD;

                labelDiv.style.left = (position.x - 30) + 'px';
                // Position label above icon when visible, centered on point when icon hidden
                labelDiv.style.top = showIcons ? (position.y - 70) + 'px' : (position.y - 38) + 'px';
            };

            labelOverlay.onRemove = function () {
                if (labelDiv.parentElement) {
                    labelDiv.parentElement.removeChild(labelDiv);
                }
            };

            labelOverlay.setMap(map);
            marker.labelOverlay = labelOverlay;

            // Click to show timestamp
            const infoWindow = new google.maps.InfoWindow({
                content: `<div style="padding:10px 12px;font-family:Inter,sans-serif;">
                    <div style="font-size:13px;color:#666;margin-bottom:4px;">📅 Reported on:</div>
                    <div style="font-size:14px;font-weight:600;color:#0A2534;">${date}</div>
                </div>`,
                disableAutoPan: false
            });

            marker.addListener('click', () => {
                markers.forEach(m => m.infoWindow && m.infoWindow.close());
                infoWindow.open(map, marker);
            });

            marker.infoWindow = infoWindow;
            markers.push(marker);
        });

        // Center on first submission or use default
        if (submissions.length > 0 && submissions[0].gps) {
            map.setCenter({ lat: submissions[0].gps.lat, lng: submissions[0].gps.lon });
        }
    } catch (err) {
        console.error('Error loading submissions:', err);
    }
}

function toggleFullscreen() {
    const container = document.getElementById('mapContainer');
    if (!document.fullscreenElement) {
        container.requestFullscreen().catch(err => console.error('Fullscreen error:', err));
    } else {
        document.exitFullscreen();
    }
}
