# Flutter Mobile App Conversion Prompt

## Project: AIResQ ClimSols - Crowdsourced Flood Monitoring

Convert this Flask web app into a **Flutter Android app** maintaining full functionality and UX.

---

## 📋 Overview

**AIResQ ClimSols** is a crowdsourced flood depth reporting platform. Users can:
1. **Report Flood Depth** - Submit reports with GPS, photos, and visual depth estimation
2. **Volunteer Portal** - Register/sign in as disaster response volunteers

---

## 🏗️ Architecture (Clean Architecture)

```
lib/
├── main.dart
├── core/
│   ├── constants/
│   │   ├── api_constants.dart       # API endpoints
│   │   ├── app_colors.dart          # Theme colors
│   │   └── depth_labels.dart        # Reference object depth mappings
│   ├── services/
│   │   ├── api_service.dart         # HTTP client
│   │   ├── location_service.dart    # GPS handling
│   │   └── storage_service.dart     # Local storage
│   └── utils/
│       ├── validators.dart
│       └── unit_converters.dart     # cm/m/feet conversions
├── features/
│   ├── report/                      # Flood reporting
│   │   ├── data/
│   │   │   ├── models/submission_model.dart
│   │   │   └── repositories/submission_repository.dart
│   │   └── presentation/
│   │       ├── screens/report_screen.dart
│   │       ├── widgets/
│   │       │   ├── depth_slider_widget.dart
│   │       │   ├── reference_selector_widget.dart
│   │       │   ├── water_level_animation.dart
│   │       │   └── photo_capture_widget.dart
│   │       └── controllers/report_controller.dart
│   ├── volunteer/                   # Volunteer portal
│   │   ├── data/
│   │   │   ├── models/volunteer_model.dart
│   │   │   └── repositories/volunteer_repository.dart
│   │   └── presentation/
│   │       ├── screens/volunteer_screen.dart
│   │       └── widgets/...
│   └── about/
│       └── presentation/screens/about_screen.dart
└── shared/
    └── widgets/
        ├── app_navbar.dart
        └── language_selector.dart
```

---

## 🎨 Design Tokens

```dart
// Primary
static const primaryTeal = Color(0xFF0D9488);
static const primaryDark = Color(0xFF0A7B71);
static const primaryDim = Color(0xFFE6F5F4);

// Status
static const success = Color(0xFF10B981);
static const warning = Color(0xFFF59E0B);
static const error = Color(0xFFEF4444);

// Background/Surface
static const bgDark = Color(0xFF0A2534);
static const bgLight = Color(0xFFF8FAFC);
static const surface = Color(0xFFFFFFFF);

// Text
static const textPrimary = Color(0xFF1E293B);
static const textSecondary = Color(0xFF64748B);
```

**Typography**: Use **Inter** font (Google Fonts), headings `w600-w700`, body `w400-w500`.

---

## 📱 Feature 1: Flood Depth Reporting

### Reference Objects & Depth Labels

```dart
final Map<String, List<DepthLabel>> depthLabels = {
  'car': [
    DepthLabel(depth: 0, label: 'No Flood'),
    DepthLabel(depth: 18, label: 'Ground clearance'),
    DepthLabel(depth: 35, label: 'Exhaust / underbody risk'),
    DepthLabel(depth: 60, label: 'Door sill level'),
    DepthLabel(depth: 95, label: 'Window level'),
    DepthLabel(depth: 150, label: 'Roof level'),
  ],
  'autorickshaw': [
    DepthLabel(depth: 0, label: 'No Flood'),
    DepthLabel(depth: 15, label: 'Ground clearance'),
    DepthLabel(depth: 35, label: 'Wheel hub level'),
    DepthLabel(depth: 50, label: 'Floor level'),
    DepthLabel(depth: 75, label: 'Seat level'),
    DepthLabel(depth: 165, label: 'Roof level'),
  ],
  'bike': [
    DepthLabel(depth: 0, label: 'No Flood'),
    DepthLabel(depth: 15, label: 'Ground clearance'),
    DepthLabel(depth: 45, label: 'Wheel hub level'),
    DepthLabel(depth: 60, label: 'Engine intake risk'),
    DepthLabel(depth: 90, label: 'Seat level'),
    DepthLabel(depth: 125, label: 'Handlebar level'),
  ],
  'cycle': [
    DepthLabel(depth: 0, label: 'No Flood'),
    DepthLabel(depth: 10, label: 'Ground level'),
    DepthLabel(depth: 25, label: 'Wheel hub level'),
    DepthLabel(depth: 45, label: 'Pedal level'),
    DepthLabel(depth: 90, label: 'Seat level'),
    DepthLabel(depth: 110, label: 'Handlebar level'),
  ],
  'person': [
    DepthLabel(depth: 0, label: 'No Flood'),
    DepthLabel(depth: 25, label: 'Ankle level'),
    DepthLabel(depth: 45, label: 'Knee level'),
    DepthLabel(depth: 75, label: 'Mid-thigh level'),
    DepthLabel(depth: 100, label: 'Waist level'),
    DepthLabel(depth: 135, label: 'Chest level'),
    DepthLabel(depth: 155, label: 'Neck level'),
    DepthLabel(depth: 180, label: 'Fully submerged'),
  ],
};

final Map<String, int> referenceRealHeights = {
  'car': 150, 'autorickshaw': 165, 'bike': 125, 'cycle': 110, 'person': 183,
};
```

### Submission Model

```dart
class SubmissionModel {
  final String? id;
  final String? name;              // Optional
  final String? phone;             // Optional
  final String? street;            // Optional
  final String? zone;              // Optional
  final String vehicleType;        // Required: car/autorickshaw/bike/cycle/person
  final int floodDepthCm;          // Required: 0-200
  final String? remarks;           // Optional
  final GpsData? gps;              // Auto-captured
  final String? imagePath;
  final String? thumbnailPath;
  final DateTime receivedAt;
}

class GpsData {
  final double? lat;
  final double? lon;
  final double? accuracy;
}
```

### Key Widgets

| Widget | Description |
|--------|-------------|
| **Water Level Animation** | Animated blue overlay rising based on `(depthCm / referenceHeight) * 100%` with wave effect |
| **Reference Selector** | 5 options: car, autorickshaw, bike, cycle, person |
| **Depth Slider** | 0-200cm range with real-time unit conversion |
| **Person Height Adjustment** | Feet+Inches inputs, presets: 5'0", 5'4", 5'7", 6'0", 6'2" |

### Unit Conversion Logic

```dart
String cmToDisplay(int cm, String unit) => switch (unit) {
  'meter' => (cm / 100).toStringAsFixed(2),
  'feet' => (cm / 30.48).toStringAsFixed(2),
  _ => cm.toString(),
};

int displayToCm(double value, String unit) => switch (unit) {
  'meter' => (value * 100).round(),
  'feet' => (value * 30.48).round(),
  _ => value.round(),
};
```

### GPS & Photo

- **GPS**: Use `geolocator` for high-accuracy, fallback to `ipapi.co` API
- **Photo**: Camera capture + gallery via `image_picker`, generate 300x300 thumbnails, max 10MB

---

## 📱 Feature 2: Volunteer Portal

### Volunteer Model

```dart
class VolunteerModel {
  final String? id;
  final String username;           // Required
  final String phone;              // Required (min 10 digits)
  final List<String> skills;       // Multi-select
  final String? availability;      // Radio selection
  final DateTime? registeredAt;
  final String status;             // 'active' default
}

final skillOptions = [
  'Emergency Response', 'Data Collection', 'Community Outreach',
  'Technical Support', 'Coordination',
];

final availabilityOptions = ['weekdays', 'weekends', 'both', 'emergency'];
```

### Features
- Registration form with skills multi-select and availability radio
- Phone number sign-in
- Volunteer dashboard after successful login

---

## 🌐 API Endpoints

### Configuration
```dart
const String baseUrl = 'https://your-api-domain.com'; // or localhost:8005
```

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/api/submit` | Submit flood report (multipart/form-data) |
| `POST` | `/api/volunteer/register` | Volunteer registration |
| `POST` | `/api/volunteer/login` | Volunteer phone lookup |

#### Submit Report Fields
```
name, phone, street, zone, vehicle_type, flood_depth_cm,
remarks, gps_lat, gps_lon, gps_accuracy, photo, g-recaptcha-response
```

---

## 🌍 Multi-Language Support (13 languages)

```dart
final supportedLanguages = {
  'en': 'English', 'hn': 'हिंदी', 'bn': 'বাংলা', 'ta': 'தமிழ்',
  'te': 'తెలుగు', 'mr': 'मराठी', 'gu': 'ગુજરાતી', 'kn': 'ಕನ್ನಡ',
  'ml': 'മലയാളം', 'pa': 'ਪੰਜਾਬੀ', 'or': 'ଓଡ଼ିଆ', 'as': 'অসমীয়া', 'ur': 'اردو',
};
```

Use Flutter `intl` package with ARB files.

---

## 📦 Dependencies

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # State Management
  provider: ^6.0.0
  
  # Networking
  http: ^1.0.0
  
  # Location
  geolocator: ^10.0.0
  geocoding: ^2.1.0
  
  # Camera/Image
  image_picker: ^1.0.0
  image: ^4.0.0
  
  # Storage
  shared_preferences: ^2.2.0
  
  # UI
  google_fonts: ^6.0.0
  flutter_svg: ^2.0.0
  cached_network_image: ^3.3.0
  shimmer: ^3.0.0
  
  # Localization
  intl: ^0.18.0
  flutter_localizations:
    sdk: flutter
  
  # Utilities
  url_launcher: ^6.0.0
  permission_handler: ^11.0.0
  path_provider: ^2.1.0
```

---

## 🔐 Android Permissions

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
```

---

## ✅ Implementation Checklist

### Phase 1: Core Setup
- [ ] Create Flutter project with clean architecture
- [ ] Set up theme and color scheme
- [ ] Configure API service
- [ ] Implement location service

### Phase 2: Report Feature
- [ ] Build report form UI
- [ ] Implement reference object selector
- [ ] Create depth slider with unit conversion
- [ ] Build water level animation widget
- [ ] Implement person height adjustment
- [ ] Add GPS capture
- [ ] Implement photo capture + thumbnails
- [ ] API integration

### Phase 3: Volunteer Feature
- [ ] Build registration form with skills multi-select
- [ ] Build availability radio selection
- [ ] Create volunteer sign-in
- [ ] Build volunteer dashboard

### Phase 4: Polish
- [ ] Add language selector + localization
- [ ] Add loading states (shimmer)
- [ ] Handle errors gracefully
- [ ] Test on various devices

---

## 🎯 Implementation Notes

1. **Water Animation**: Use `AnimatedContainer`/`AnimatedBuilder` for smooth transitions
2. **Validation**: Name/phone optional; consider device attestation instead of reCAPTCHA for mobile
3. **Thumbnails**: Generate 300x300 for lists, store originals at full resolution
4. **Offline**: Consider local queue for offline submissions, sync when online
5. **Person Height**: Recalculate depth labels with ratio `newDepth = baseDepth * (personHeight / 183)`

---

## 📁 Assets (from `/static/`)

- `carsvg.svg`, `autorickshaw.svg`, `bikesvg.svg`, `bicycle.svg`, `person.svg`
- `airesq_dark.png` (logo), `favicon.ico` (icon)

---

## 🚀 Quick Start

```bash
flutter create airesq_climsols
# Copy assets to assets/
# Update pubspec.yaml with dependencies
# Follow architecture structure
# Build progressively: core → report → volunteer → polish
```

> **Note**: Flask backend remains unchanged. Flutter communicates via REST API.
