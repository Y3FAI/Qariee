# Qariee

## Forks

This section documents major architectural and infrastructure decisions made during development.

### Storage Solution: Cloudflare R2

**Decision Date:** 2025-11-20

**Chosen Solution:** Cloudflare R2 Object Storage

**Rationale:**
- Storage cost: $0.015/GB/month (~$4.35/month for 300GB)
- Zero egress fees (unlimited free downloads)
- Built-in global CDN for fast downloads
- 10 million free read operations/month
- Scales cost-effectively if traffic explodes
- Protection against surprise bills during viral growth

**Alternatives Considered:**
- **Backblaze B2:** Cheaper at low traffic ($1.80 vs $4.35) but egress costs after 3x storage limit
- **Wasabi:** Good for 1TB+ ($6.99/month) but has 1TB minimum
- **AWS S3:** Most expensive due to egress fees ($0.09/GB)

**Key Advantage:** Predictable costs with unlimited download potential. If the app goes viral, costs remain manageable (~$35-70/month for 1B downloads) vs thousands on other providers.

---

## Project Overview

**Qariee** is a Spotify-style Quran streaming and offline listening app for Android, built with React Native. The app provides a modern, clean interface for discovering Quran reciters (Qaris) and listening to recitations with seamless streaming and offline download capabilities.

**Vision:** "Spotify for Quran"

**Target Platform:** Android (React Native)

**Languages:** English and Arabic with i18n support

---

## Forks - App Design & Architecture

### Platform & Technology

**Decision Date:** 2025-11-20

**Platform:** Android-first with React Native

**Key Technology Decisions:**
- React Native for cross-platform foundation
- Offline-first architecture (major feature)
- Stream-first with integrated downloads
- i18n support for English and Arabic

**Rationale:**
- React Native allows future iOS expansion
- Offline downloads are critical for Quran apps (commutes, travel, data limits)
- Stream-first UX reduces friction (instant playback)

---

### MVP Scope

**Core Features (Minimal but Polished):**

1. **Reciter Library** - Browse 3 featured Quran reciters (starting small)
2. **Surah Streaming** - Instant playback of all 114 surahs per reciter
3. **Persistent Audio Player** - Bottom mini-player + expandable full player
4. **Offline Downloads** - Download surahs for offline listening, integrated with player
5. **Downloaded Library** - Access all offline content

**Initial Reciters (3 only for MVP):**
- Mishary Rashid Alafasy
- Abdul Basit Abdul Samad
- Abdur-Rahman As-Sudais

**Explicitly NOT in MVP:**
- User accounts / authentication
- Favorites / bookmarks
- Search functionality
- Playlists
- Translations / Tafsir
- Sleep timer / speed control
- Social features
- Repeat modes
- Continue listening / resume

---

### User Flows

#### Flow 1: First Time User - Discovery & Streaming
```
1. Open App
   ↓
2. Home Screen: Grid of Reciters
   - 2-column grid with reciter photos
   ↓
3. Tap Reciter (e.g., "Mishary Rashid")
   ↓
4. Surah List Screen
   - Header: Reciter photo + name
   - List: 114 surahs with download indicators
   ↓
5. Tap Surah (e.g., "Al-Baqarah")
   ↓
6. ✨ Streams immediately
   - Bottom mini-player appears
   - Background playback enabled
   ↓
7. Tap mini-player → Expands to full player
```

#### Flow 2: Downloading for Offline
```
1. Playing surah (streaming)
   ↓
2. Tap download icon in player or surah list
   ↓
3. Download starts with progress indicator
   - Listening continues during download
   ↓
4. Download completes → Checkmark indicator
   ↓
5. Surah now available offline
   - Next playback uses local file
```

#### Flow 3: Offline Listening
```
1. No internet connection
   ↓
2. Open app → Navigate to Library tab
   ↓
3. See all downloaded surahs grouped by reciter
   ↓
4. Tap to play → Plays from local storage
   ↓
5. Seamless experience (identical to streaming)
```

---

### Navigation Structure

#### Bottom Tab Navigation (2 Tabs)

**Tab 1: Home 🏠**
- Grid of all reciters
- Primary discovery interface

**Tab 2: Library 📥**
- Downloaded content organized by reciter
- Storage usage indicator
- Quick access to offline surahs

#### Screen Stack
```
Home Stack:
  ├─ Reciter Grid (Home)
  └─ Surah List (Reciter Detail)

Library Stack:
  └─ Downloaded Content

Modal/Overlay:
  └─ Full Player Screen (slides up from mini-player)
```

#### Mini Player (Persistent)
- Appears at bottom when playback starts
- Visible across all screens
- Tap or swipe up to expand to full player
- Swipe down to minimize from full player

---

### Design System

#### Visual Style
- **Aesthetic:** Clean, modern, Spotify-inspired
- **Theme:** Dark theme (MVP), light theme support later
- **Photos:** Smooth rounded corners (no hard edges), blended modern look
- **Typography:** Clean, readable, supports Arabic and Latin scripts

#### Component Design Decisions

**Reciter Cards (Home Screen):**
- 2-column grid on mobile
- Square aspect ratio with rounded corners (16-24px radius)
- Reciter photo with subtle shadow/elevation
- Name and surah count below

**Surah List Items:**
- Row layout: [Number] [Arabic Name / Transliteration] [Download Icon] [Duration]
- 72px height per item
- Tap row → play, tap download icon → download
- Visual indicator for download status

**Mini Player:**
- Fixed at bottom, above navigation tabs
- Shows: small reciter image, surah name, play/pause, skip controls
- Progress bar
- Swipe up or tap to expand

**Full Player:**
- Large reciter image (rounded corners)
- Surah name in Arabic and transliteration
- Reciter name
- Playback controls (previous, play/pause, next)
- Scrubber with timestamps
- Download button integrated
- Swipe down or back button to minimize

**Download State Indicators:**
- Not downloaded: Outline download icon
- Downloading: Circular progress (0-100%)
- Downloaded: Filled checkmark (success color)

#### Micro-interactions
- Card press: Subtle scale animation
- Player transitions: Smooth slide animations (300ms)
- Download progress: Animated circular indicator
- Play/Pause: Icon morph animation
- Haptic feedback on key interactions

#### Gestures
- Mini player: Swipe up to expand, swipe left/right to skip
- Full player: Swipe down to minimize, swipe left/right to skip
- Surah list: Tap to play, long press for options (future)

---

### Technical Architecture

**Frontend:**
- React Native
- React Navigation (stack + bottom tabs)
- React Native Track Player (audio playback)
- i18n for internationalization

**Local Storage:**
- SQLite for metadata (reciters, surahs, download status)
- React Native FileSystem for audio files
- AsyncStorage for app preferences

**Remote Storage:**
- Cloudflare R2 for audio file hosting
- Free egress/CDN for streaming

**Audio Strategy:**
- Stream-first (instant playback)
- Progressive download to local storage
- Format: MP3 (128-192 kbps)
- Background playback support
- Notification controls

---

### Data Architecture

**Decision Date:** 2025-11-20

#### Background Update Strategy

**First Launch:**
- App fetches metadata from R2
- Populates local SQLite database
- Shows loading screen during initial setup
- Bundles static surah metadata (never changes)

**Subsequent Launches:**
- App starts instantly using cached SQLite data
- Home screen appears immediately (no loading)
- Metadata updates silently in background
- No interruption to user experience

**Rationale:**
- Instant app startup after first launch
- No "checking for updates" delays
- Offline-first approach
- Seamless user experience
- Data stays fresh without user awareness

#### R2 Storage Structure

```
qariee-audio/                    (R2 Bucket)
├── metadata/
│   └── db.json                  (App settings, reciters, and configuration)
│
├── audio/
│   ├── mishary-alafasy/
│   │   ├── 001.mp3              (Al-Fatihah)
│   │   ├── 002.mp3              (Al-Baqarah)
│   │   └── ... (all 114 surahs)
│   ├── abdul-basit/
│   └── sudais/
│
└── images/
    └── reciters/
        ├── mishary-alafasy.jpg
        ├── abdul-basit.jpg
        └── sudais.jpg
```

**Naming Convention:**
- Reciter IDs: kebab-case (e.g., `mishary-alafasy`, `abdul-basit`)
- Audio files: 3-digit zero-padded (e.g., `001.mp3`, `002.mp3`, `114.mp3`)
- Consistent structure across all reciters

#### Data Structure

**db.json** (Remote - centralized configuration):
- **version**: Database schema version
- **settings**: App-wide configuration
  - `cdn_base_url`: Base URL for all CDN resources
  - `app_name`: Application name
  - `support_email`: Support contact
  - `app_version`: Latest app version available
  - `min_app_version`: Minimum required app version
- **reciters**: Array of reciter objects
  - Reciter ID (used to construct all URLs)
  - Name in English
  - Name in Arabic

**surahs.json** (Bundled in app - static):
- Surah number (1-114)
- Arabic name
- English name

#### Remote Configuration & Version Management

**Centralized Settings:**
- All app settings stored in remote `db.json`
- Downloaded and cached on app launch
- Allows remote updates without app releases

**Version Checking:**
- App compares local version with `app_version` in db.json
- Shows update banner when new version is available
- Supports minimum version enforcement via `min_app_version`
- Update messages localized via i18n (not in db.json)

**CDN Failover:**
- CDN base URL stored remotely in `cdn_base_url`
- If domain is lost/changed, update db.json with new URL
- All users receive new CDN URL on next launch
- No app update required for CDN migrations

**Benefits:**
- Change CDN provider instantly
- Push critical updates to all users
- Enforce minimum app versions
- Single source of truth for configuration

#### URL Construction

All URLs constructed from reciter ID:
- Photo: `https://cdn.qariee.com/images/reciters/{reciter-id}.jpg`
- Audio: `https://cdn.qariee.com/audio/{reciter-id}/{surah-number}.mp3`
- Single CDN base URL configured in app

**Benefits:**
- Minimal JSON payload
- Single source of truth for CDN URL
- Easy to migrate CDN providers
- No URL redundancy in data

#### SQLite Schema

**Reciters Table:**
- ID (primary key)
- Name (English and Arabic)

**Surahs Table:**
- Number (1-114)
- Name (English and Arabic)

**Downloads Table:**
- Reciter ID + Surah number (composite key)
- Local file path
- Download timestamp

**App Metadata:**
- Key-value store for app state
- First launch flag
- User preferences

#### Content Management

**MVP Strategy:**
- Start with **3 reciters only** to keep scope manageable
- Expand gradually after validating core functionality
- Quality over quantity approach

**Adding New Reciters:**
1. Prepare complete reciter folder (all 114 surahs required)
2. Upload audio files to R2: `/audio/{reciter-id}/001.mp3` through `114.mp3`
3. Upload reciter photo to R2: `/images/reciters/{reciter-id}.jpg`
4. Update `reciters.json` with new entry
5. Users receive update on next app launch automatically (background sync)

**Rules:**
- Only complete reciters (all 114 surahs) are added
- No partial collections
- Ensures consistent experience across all reciters
- Start small, scale gradually

---

## Project Structure

```
qariee/
├── README.md                    # Main project documentation
│
└── app/                         # React Native app (Expo)
    ├── app/                     # Expo Router app directory
    │   ├── _layout.tsx          # Root layout with data initialization
    │   ├── index.tsx            # Root redirect to tabs
    │   └── (tabs)/              # Tab navigation
    │       ├── _layout.tsx      # Tab bar configuration
    │       ├── index.tsx        # Home screen (Reciters grid)
    │       └── library.tsx      # Library screen (Downloads)
    │
    ├── src/                     # Source code
    │   ├── services/            # Core services
    │   │   ├── database.ts      # SQLite database operations
    │   │   ├── dataSync.ts      # Background data sync logic
    │   │   └── i18n.ts          # Internationalization setup
    │   │
    │   ├── constants/           # App constants
    │   │   └── config.ts        # CDN URLs and configuration
    │   │
    │   ├── types/               # TypeScript type definitions
    │   │   └── index.ts         # Reciter, Surah, Download types
    │   │
    │   ├── components/          # Reusable UI components (future)
    │   ├── hooks/               # Custom React hooks (future)
    │   └── utils/               # Utility functions (future)
    │
    ├── assets/                  # Static assets
    │   └── data/
    │       └── surahs.json      # All 114 surahs (bundled)
    │
    ├── package.json             # Dependencies and scripts
    ├── app.json                 # Expo configuration
    └── tsconfig.json            # TypeScript configuration
```

---

## Dependencies

### Core Framework
- **React Native 0.81.5** - Mobile app framework
- **Expo ~54.0.25** - Development platform and build tools
- **Expo Router ~6.0.15** - File-based routing

### Navigation
- **@react-navigation/native ^7.1.8** - Navigation library
- **@react-navigation/bottom-tabs ^7.4.0** - Bottom tab navigation
- **react-native-screens ~4.16.0** - Native screen components
- **react-native-safe-area-context ~5.6.0** - Safe area handling

### Data & Storage
- **expo-sqlite** - SQLite database for local storage
- **expo-file-system** - File system access for downloads
- **@react-native-async-storage/async-storage** - Key-value storage

### Audio
- **expo-audio** - Audio playback and background support

### Internationalization
- **i18next** - i18n framework
- **react-i18next** - React bindings for i18next

### UI & Animations
- **react-native-gesture-handler ~2.28.0** - Touch gestures
- **react-native-reanimated ~4.1.1** - Smooth animations
- **@expo/vector-icons ^15.0.3** - Icon library (Ionicons)
- **react-native-image-colors** - Extract dominant colors from images

### Development
- **TypeScript ~5.9.2** - Type safety
- **ESLint ^9.25.0** - Code linting
- **expo-dev-client ~6.0.18** - Custom development builds

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Android Studio (for Android development)
- Expo CLI

### Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd qariee/app
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start the development server:**
```bash
npm start
```

4. **Run on Android:**
```bash
npm run android
```

### Development Scripts

```bash
npm start          # Start Expo development server
npm run android    # Run on Android emulator/device
npm run ios        # Run on iOS simulator (macOS only)
npm run web        # Run in web browser
npm run lint       # Run ESLint
```

---

## Implementation Status

### ✅ Completed (MVP Foundation)

**Infrastructure:**
- [x] Project setup with Expo and React Native
- [x] TypeScript configuration
- [x] File-based routing with Expo Router
- [x] SQLite database schema and operations
- [x] Background data sync service
- [x] i18n setup (English/Arabic support)

**UI Screens:**
- [x] Root layout with app initialization
- [x] Bottom tab navigation (Home, Library)
- [x] Home screen with reciters grid
- [x] Library screen with downloads list
- [x] Loading states and splash screen

**Data:**
- [x] Complete surahs.json (all 114 surahs)
- [x] Database models for reciters, surahs, downloads
- [x] URL construction helpers for CDN assets

### 🚧 In Progress / TODO

**Core Features:**
- [ ] Reciter detail screen (surah list)
- [ ] Audio player integration (expo-audio)
- [ ] Download functionality (FileSystem)
- [ ] Full player UI (bottom sheet modal)
- [ ] Mini player component (persistent)
- [ ] Background playback controls
- [ ] Notification controls

**Data & Content:**
- [ ] Upload 3 initial reciters to R2
- [ ] Create sample reciters.json
- [ ] Test background data sync

**Polish:**
- [ ] Dark theme refinement
- [ ] Loading skeletons
- [ ] Error handling and retry logic
- [ ] Offline mode indicators
- [ ] Download progress UI

---

## Database Schema

### Tables

**reciters**
```sql
CREATE TABLE reciters (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL
);
```

**surahs**
```sql
CREATE TABLE surahs (
  number INTEGER PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL
);
```

**downloads**
```sql
CREATE TABLE downloads (
  reciter_id TEXT NOT NULL,
  surah_number INTEGER NOT NULL,
  local_file_path TEXT NOT NULL,
  downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reciter_id, surah_number)
);
```

**app_metadata**
```sql
CREATE TABLE app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

---

## Key Features Implemented

### 1. Background Data Sync
- First launch: Fetches reciters.json from R2, shows loading screen
- Subsequent launches: Instant startup, updates in background
- Offline-first architecture

### 2. Database Operations
- Full CRUD operations for reciters, surahs, downloads
- Async/await API
- Type-safe queries with TypeScript

### 3. Internationalization
- English and Arabic support
- Dynamic language switching (ready for implementation)
- RTL support ready

### 4. URL Construction
- CDN URLs built from reciter IDs
- Single configuration point
- Easy to migrate CDN providers

---

## Changelog

### 2025-11-21 - UI Polish & Remote Configuration

**Added:**
- Safe area handling with react-native-safe-area-context
- Mini player component with dynamic background colors
- Color extraction from reciter images (react-native-image-colors)
- Centralized app configuration via remote db.json
- App version checking and update notifications
- Update banner UI component with i18n support
- AudioContext for global playback state management

**Changed:**
- Migrated from reciters.json to comprehensive db.json
- Added app_version and min_app_version to remote config
- CDN base URL now remotely configurable for failover support
- Removed bottom tabs navigation (simplified MVP)
- Made mini player persistent across all screens

**Technical:**
- Dynamic CDN URL configuration from remote settings
- Semantic version comparison for update checks
- i18n messages for update notifications (English/Arabic)
- Global AudioContext provides needsUpdate state
- Background color extraction using dominant colors from images

**UI/UX:**
- Mini player shows current track with reciter image
- Background color adapts to reciter's image palette
- Update banner appears at top of home screen when available
- Play/pause button toggles based on playback state
- Circular reciter images with proper safe area insets

### 2025-11-20 - MVP Foundation

**Added:**
- Initial project setup with Expo and React Native
- SQLite database with schema for reciters, surahs, and downloads
- Background data synchronization service
- Tab navigation (Home and Library screens)
- Home screen with reciters grid layout
- Library screen with downloads list
- Complete surahs.json with all 114 surahs
- i18n support for English and Arabic
- TypeScript type definitions
- URL construction helpers for R2 CDN

**Technical:**
- expo-sqlite for local database
- expo-file-system for file downloads
- expo-audio for audio playback
- i18next for internationalization
- Expo Router for file-based navigation

**Design:**
- Dark theme (Spotify-inspired)
- Modern, clean UI with rounded corners
- 2-column grid for reciter cards
- Bottom tab navigation

---

## License

[License information to be added]
