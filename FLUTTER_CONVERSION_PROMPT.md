# Flutter Android App Conversion Prompt

## Project: AIResQ ClimSols - Crowdsourced Flood Monitoring App

Convert this Flask + JavaScript web application into a **Flutter Android app** that maintains the same functionality, code logic, and user experience.

---

## 📋 Project Overview

**AIResQ ClimSols** is a crowdsourced flood depth reporting and disaster response platform. Users can:
1. **Report Flood Depth** - Submit flood reports with GPS location, photos, and visual depth estimation
2. **Volunteer Portal** - Register and sign in as disaster response volunteers  
3. **Admin Dashboard** - View/verify submissions, manage volunteers, AI-powered news extraction

---

## 🏗️ Architecture Requirements

### App Structure (Clean Architecture)
```
lib/
├── main.dart
├── core/
│   ├── constants/
│   │   ├── api_constants.dart       # API endpoints
│   │   ├── app_colors.dart          # Theme colors
│   │   └── depth_labels.dart        # Reference object depth mappings
│   ├── services/
│   │   ├── api_service.dart         # HTTP client wrapper
│   │   ├── auth_service.dart        # JWT token management
│   │   ├── location_service.dart    # GPS/location handling
│   │   └── storage_service.dart     # SharedPreferences/local storage
│   └── utils/
│       ├── validators.dart          # Input validators
│       └── unit_converters.dart     # cm/m/feet conversions
├── features/
│   ├── report/                      # Flood reporting feature
│   │   ├── data/
│   │   │   ├── models/submission_model.dart
│   │   │   └── repositories/submission_repository.dart
│   │   ├── presentation/
│   │   │   ├── screens/report_screen.dart
│   │   │   ├── widgets/
│   │   │   │   ├── depth_slider_widget.dart
│   │   │   │   ├── reference_selector_widget.dart
│   │   │   │   ├── water_level_animation.dart
│   │   │   │   └── photo_capture_widget.dart
│   │   │   └── controllers/report_controller.dart
│   ├── volunteer/                   # Volunteer portal feature
│   │   ├── data/
│   │   │   ├── models/volunteer_model.dart
│   │   │   └── repositories/volunteer_repository.dart
│   │   └── presentation/
│   │       ├── screens/volunteer_screen.dart
│   │       └── widgets/...
│   ├── admin/                       # Admin dashboard feature
│   │   ├── data/
│   │   │   └── repositories/admin_repository.dart
│   │   └── presentation/
│   │       ├── screens/
│   │       │   ├── admin_login_screen.dart
│   │       │   ├── submissions_tab.dart
│   │       │   ├── volunteers_tab.dart
│   │       │   └── ai_analysis_tab.dart
│   │       └── widgets/...
│   └── about/
│       └── presentation/screens/about_screen.dart
└── shared/
    └── widgets/
        ├── app_navbar.dart
        └── language_selector.dart
```

---

## 🎨 UI/Design Specifications

### Color Palette
```dart
// Primary colors
static const primaryTeal = Color(0xFF0D9488);      // --primary-teal
static const primaryDark = Color(0xFF0A7B71);      // --primary-dark
static const primaryDim = Color(0xFFE6F5F4);       // --primary-dim

// Status colors
static const success = Color(0xFF10B981);          // Green
static const warning = Color(0xFFF59E0B);          // Amber
static const error = Color(0xFFEF4444);            // Red

// Background/Surface
static const bgDark = Color(0xFF0A2534);           // Dark navy
static const bgLight = Color(0xFFF8FAFC);          // Light gray
static const surface = Color(0xFFFFFFFF);          // White

// Text
static const textPrimary = Color(0xFF1E293B);
static const textSecondary = Color(0xFF64748B);
```

### Typography
- Use **Inter** font family (Google Fonts package)
- Headings: FontWeight.w600-w700
- Body: FontWeight.w400-w500

---

## 📱 Feature 1: Flood Depth Reporting

### Core Functionality
The main feature allows users to report flood depth using visual reference objects.

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

// Reference object real heights in cm
final Map<String, int> referenceRealHeights = {
  'car': 150,
  'autorickshaw': 165,
  'bike': 125,
  'cycle': 110,
  'person': 183, // 6 feet default, user-adjustable
};
```

### Report Form Fields
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
  final String? imagePath;         // Photo path
  final String? thumbnailPath;     // Thumbnail path
  final DateTime receivedAt;
}

class GpsData {
  final double? lat;
  final double? lon;
  final double? accuracy;
}
```

### Water Level Animation Widget
Create an animated water level visualization:
- Display selected reference object SVG/image
- Animate blue water overlay from bottom up based on depth percentage
- Water height = (depthCm / referenceHeight) * 100%
- Include wave animation effect

### Unit Conversion
Support three units with real-time conversion:
```dart
String cmToDisplay(int cm, String unit) {
  switch (unit) {
    case 'meter': return (cm / 100).toStringAsFixed(2);
    case 'feet': return (cm / 30.48).toStringAsFixed(2);
    case 'cm': return cm.toString();
  }
}

int displayToCm(double value, String unit) {
  switch (unit) {
    case 'meter': return (value * 100).round();
    case 'feet': return (value * 30.48).round();
    case 'cm': return value.round();
  }
}
```

### Person Height Adjustment
When "Person" is selected, show height adjustment controls:
- Feet + Inches inputs
- Preset buttons: 5'0", 5'4", 5'7", 6'0", 6'2"
- Recalculate depth labels proportionally based on height ratio

### GPS Location
- Use `geolocator` package for high-accuracy GPS
- Fallback to IP-based location using ipapi.co API
- Display location status in real-time

### Photo Capture
- Camera capture with `image_picker` or `camera` package
- Gallery selection option
- Generate thumbnails for submissions
- Max file size: 10MB

---

## 📱 Feature 2: Volunteer Portal

### Registration Form
```dart
class VolunteerModel {
  final String? id;
  final String username;           // Required
  final String phone;              // Required (min 10 digits)
  final List<String> skills;       // Multi-select checkboxes
  final String? availability;      // Radio selection
  final DateTime? registeredAt;
  final String status;             // 'active' default
}

// Skills options
final skillOptions = [
  'Emergency Response',
  'Data Collection',
  'Community Outreach',
  'Technical Support',
  'Coordination',
];

// Availability options
final availabilityOptions = [
  'weekdays',
  'weekends',
  'both',
  'emergency',
];
```

### Sign In
- Phone number lookup
- Display volunteer dashboard after successful sign-in

---

## 📱 Feature 3: Admin Dashboard

### Authentication
- JWT-based authentication with 1-hour cookie/token expiration
- Login with username + password
- Store token securely using `flutter_secure_storage`

### Submissions Tab
- List all submissions with thumbnails
- Filter buttons: All / Pending / Valid / Invalid
- Search by name, location, or ID
- View full submission details in modal/dialog
- Verify submissions (mark as valid/invalid)
- Delete submissions with confirmation
- Export to CSV

### Volunteers Tab
- List all registered volunteers
- Search by name or phone
- Display skills and availability

### AI Analysis Tab
- Search input for news queries
- URL selection with checkboxes
- Extract intelligence button
- Display extracted news items
- Save/discard options
- View saved news records

### Stats Cards
Display at top of admin dashboard:
- Total Reports count
- Pending Review count
- Critical Areas (depth > 100cm)
- Verified count

---

## 🌐 API Endpoints

### Base Configuration
```dart
// Configure the base URL based on environment
const String baseUrl = 'https://your-api-domain.com';
// OR for local development: 'http://localhost:8005'
```

### Public Endpoints
```dart
// Health check
GET /health

// Submit flood report (multipart/form-data)
POST /api/submit
// Form fields: name, phone, street, zone, vehicle_type, flood_depth_cm, 
//              remarks, gps_lat, gps_lon, gps_accuracy, photo, g-recaptcha-response

// Volunteer registration
POST /api/volunteer/register
// Body: { username, phone, skills[], availability }

// Volunteer login
POST /api/volunteer/login
// Body: { phone }
```

### Admin Endpoints (Require JWT Auth)
```dart
// Login
POST /api/admin/login
// Body: { username, password }
// Returns: Sets httpOnly cookie 'admin_token'

// Logout
POST /api/admin/logout

// Get submissions (with optional filter)
GET /api/admin/submissions?filter=all|pending|valid|invalid

// Get single submission
GET /api/admin/submission/{id}

// Delete submission
DELETE /api/admin/submission/{id}

// Verify submission
POST /api/admin/verify/{id}
// Body: { status: 'valid' | 'invalid' }

// Export submissions
GET /api/admin/export.json
GET /api/admin/export.csv

// Get volunteers
GET /api/admin/volunteers

// AI Search
POST /api/admin/ai/search
// Body: { query, max_urls }

// AI Extract
POST /api/admin/ai/extract
// Body: { urls[] }

// Save scraped news
POST /api/admin/ai/news/save
// Body: { query, source_urls[], news_items[] }

// Get saved news
GET /api/admin/ai/news

// Delete saved news
DELETE /api/admin/ai/news/{id}
```

---

## 🌍 Multi-Language Support

Implement localization for 13 languages:
```dart
final supportedLanguages = {
  'en': 'English',
  'hn': 'हिंदी (Hindi)',
  'bn': 'বাংলা (Bengali)',
  'ta': 'தமிழ் (Tamil)',
  'te': 'తెలుగు (Telugu)',
  'mr': 'मराठी (Marathi)',
  'gu': 'ગુજરાતી (Gujarati)',
  'kn': 'ಕನ್ನಡ (Kannada)',
  'ml': 'മലയാളം (Malayalam)',
  'pa': 'ਪੰਜਾਬੀ (Punjabi)',
  'or': 'ଓଡ଼ିଆ (Odia)',
  'as': 'অসমীয়া (Assamese)',
  'ur': 'اردو (Urdu)',
};
```

Use Flutter's `intl` package with ARB files for translations.

---

## 📦 Required Flutter Packages

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # State Management
  provider: ^6.0.0
  # OR riverpod: ^2.0.0
  
  # Networking
  http: ^1.0.0
  # OR dio: ^5.0.0
  
  # Location
  geolocator: ^10.0.0
  geocoding: ^2.1.0
  
  # Camera/Image
  image_picker: ^1.0.0
  camera: ^0.10.0
  image: ^4.0.0  # For thumbnail generation
  
  # Storage
  shared_preferences: ^2.2.0
  flutter_secure_storage: ^9.0.0
  
  # UI
  google_fonts: ^6.0.0
  flutter_svg: ^2.0.0
  cached_network_image: ^3.3.0
  shimmer: ^3.0.0  # Loading states
  
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

## 🔐 Required Permissions (AndroidManifest.xml)

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
- [ ] Configure API service with base URL
- [ ] Implement location service
- [ ] Set up secure storage for auth tokens

### Phase 2: Report Feature
- [ ] Build report form UI
- [ ] Implement reference object selector
- [ ] Create depth slider with unit conversion
- [ ] Build water level animation widget
- [ ] Implement person height adjustment
- [ ] Add GPS location capture
- [ ] Implement photo capture/gallery
- [ ] Add thumbnail generation
- [ ] Create submission API integration
- [ ] Add reCAPTCHA (use webview or skip for mobile)

### Phase 3: Volunteer Feature
- [ ] Build volunteer registration form
- [ ] Implement skills multi-select
- [ ] Build availability radio selection
- [ ] Create volunteer sign-in
- [ ] Build volunteer dashboard

### Phase 4: Admin Feature
- [ ] Build admin login screen
- [ ] Implement JWT auth service
- [ ] Build submissions list with thumbnails
- [ ] Add filter buttons and search
- [ ] Create submission detail modal
- [ ] Implement verify/delete actions
- [ ] Build volunteers tab
- [ ] Implement AI analysis tab (optional)
- [ ] Add CSV export functionality

### Phase 5: Polish
- [ ] Add language selector
- [ ] Implement localization
- [ ] Add loading states and shimmer effects
- [ ] Handle error states gracefully
- [ ] Test on various Android devices
- [ ] Optimize performance

---

## 🎯 Key Implementation Notes

1. **Water Level Animation**: Use `AnimatedContainer` or `AnimatedBuilder` for smooth water level transitions. The water overlay should start from the bottom and rise based on depth percentage.

2. **Form Validation**: Name and phone are optional. Only reCAPTCHA is strictly required in the web version - for mobile, you may implement device attestation or skip verification.

3. **Image Handling**: Generate 300x300 thumbnails for faster list loading. Store original images at full resolution.

4. **Offline Support**: Consider implementing local caching for submissions when offline, syncing when connection is restored.

5. **Person Height Calibration**: When user adjusts their height, recalculate all depth labels proportionally using the ratio: `newDepth = baseDepth * (personHeight / 183)`

6. **Admin Session**: JWT token expires in 1 hour. Handle token expiration gracefully by redirecting to login.

---

## 📁 Assets to Include

From the web project's `/static/` folder, include these SVG files:
- `carsvg.svg` - Car reference image
- `autorickshaw.svg` - Auto rickshaw reference
- `bikesvg.svg` - Motorcycle reference
- `bicycle.svg` - Bicycle reference
- `person.svg` - Person reference
- `airesq_dark.png` - App logo
- `favicon.ico` - App icon

---

## 🚀 Getting Started

1. Create new Flutter project: `flutter create airesq_climsols`
2. Copy assets to `assets/` folder
3. Update `pubspec.yaml` with dependencies and asset declarations
4. Follow the architecture structure above
5. Start with core services, then build features progressively
6. Test API integration with the Flask backend

---

**Note**: The existing Flask backend (`app.py`) should remain unchanged. The Flutter app will communicate with it via the documented REST API endpoints.
