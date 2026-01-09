# Overview

Qariee is a mobile application for offline Quran audio playback, built with React Native and Expo. It features a custom audio playback engine, download management, and synchronization with a CDN backend.

Its goal is to provide a fast, reliable, and user-friendly experience for Quran listeners worldwide.

# File Structure

## Key Files

| File               | Lines | Purpose                          |
| ------------------ | ----- | -------------------------------- |
| audioService.ts    | 1151  | Playback engine + queue          |
| AudioContext.tsx   | 516   | Audio state management           |
| database.ts        | 494   | SQLite operations + migrations   |
| downloadService.ts | 382   | Download queue system            |
| syncService.ts     | 233   | CDN sync (debounced, UPSERT)     |
| player.tsx         | ~900  | Full-screen player UI            |
| reciter/[id].tsx   | ~650  | Surah list screen                |
| surahName.ts       | 114   | Ligature mappings                |

> Complete directory tree

## Repository Root

```
Qariee/
├── .gitignore
├── CLAUDE.md                     # Claude AI context
├── README.md
├── app/                          # React Native application
└── backend/                      # CDN management
```

---

## `/app` - Main Application

```
app/
├── android/                      # Android native project
├── app/                          # Screens (expo-router)
├── assets/                       # App assets
├── src/                          # Source code
├── app.json                      # Expo configuration
├── eslint.config.js
├── jest.config.js
├── jest.setup.js
├── package.json
├── package-lock.json
└── tsconfig.json
```

---

## `/app/app` - Screens

```
app/app/
├── _layout.tsx                   # Root layout + providers
├── index.tsx                     # Home (reciter grid)
├── player.tsx                    # Full-screen player
├── settings.tsx                  # Settings screen
├── about.tsx                     # About screen
└── reciter/
    └── [id].tsx                  # Reciter detail
```

---

## `/app/src` - Source Code

```
app/src/
├── components/                   # UI components (6 files)
├── config/                       # Special config (1 file)
├── constants/                    # App constants (2 files)
├── contexts/                     # React contexts (4 files)
├── locales/                      # Translations (2 files)
├── services/                     # Business logic (6 files)
├── types/                        # TypeScript types (2 files)
└── utils/                        # Utilities (1 file)
```

---

## `/app/src/components`

```
app/src/components/
├── CircularProgress.tsx          # Download progress
├── CustomDrawer.tsx              # Side drawer menu
├── MiniPlayer.tsx                # Bottom player bar
├── OfflineIndicator.tsx          # Network status
├── SleepTimerModal.tsx           # Sleep timer UI
└── SurahName.tsx                 # Arabic calligraphy
```

---

## `/app/src/config`

```
app/src/config/
└── surahName.ts                  # Surah ligature mapping (114 surahs)
```

---

## `/app/src/constants`

```
app/src/constants/
├── config.ts                     # CDN URLs (qariee-storage.y3f.me)
└── quranDivisions.ts             # Quran structure grouping
```

---

## `/app/src/contexts`

```
app/src/contexts/
├── AudioContext.tsx              # Audio playback state
├── DownloadContext.tsx           # Download management
├── NetworkContext.tsx            # Network monitoring
└── SleepTimerContext.tsx         # Sleep timer state
```

---

## `/app/src/services`

```
app/src/services/
├── audioService.ts               # Playback engine (1151 lines)
├── audioStorage.ts               # Session persistence
├── database.ts                   # SQLite operations + migrations (494 lines)
├── downloadService.ts            # Download manager
├── i18n.ts                       # i18next config
└── syncService.ts                # CDN sync - debounced, UPSERT (233 lines)
```

---

## `/app/src/locales`

```
app/src/locales/
├── ar.json                       # Arabic translations
└── en.json                       # English translations
```

---

## `/app/src/types`

```
app/src/types/
├── index.ts                      # All TypeScript interfaces
└── react-native-background-timer.d.ts  # Background timer type definitions
```

---

## `/app/src/utils`

```
app/src/utils/
└── fonts.ts                      # Font helpers (Tajawal, Inter)
```

---

## `/app/assets`

```
app/assets/
├── data/
│   ├── database.db              # Pre-populated SQLite (9 reciters, 114 surahs)
│   └── surahs.json              # All 114 surahs
├── fonts/
│   └── surah_names.ttf          # Arabic calligraphy font
└── images/
    ├── icon.png
    ├── splash-icon.png
    ├── android-icon-*.png
    └── favicon.png
```

---

## `/backend` - CDN Management

```
backend/
├── r2/                           # Local R2 mirror
│   ├── images/
│   │   └── reciters/            # Reciter photos
│   └── metadata/
│       └── db.json              # App database
├── scripts/
│   ├── sync-to-r2.sh            # Upload metadata/images
│   └── download-audio-to-r2.sh  # Upload audio files
└── cli/                          # Python CLI for CDN management
    ├── qariee_cli/
    │   ├── commands/            # CLI commands (list, sync, add-reciter, upload-audio, verify, generate-db)
    │   └── utils/               # R2 upload, db.json handling
    └── pyproject.toml           # CLI package config
```

---

# Backend CLI

Python CLI tool for managing CDN content (reciters, audio files, metadata).

## Installation

```bash
cd backend/cli
pip install -e .
```

Requires [wrangler CLI](https://developers.cloudflare.com/r2/data-access/wrangler/) for R2 uploads:
```bash
npm install -g wrangler
wrangler login
```

## Commands

| Command | Description |
|---------|-------------|
| `qariee list` | List all reciters in db.json |
| `qariee add-reciter` | Add a new reciter (auto-generates colors) |
| `qariee upload-audio <id> <url>` | Download & upload 114 MP3s to R2 |
| `qariee sync` | Sync local r2/ to Cloudflare R2 |
| `qariee verify` | Verify R2 metadata and audio files |
| `qariee generate-db` | Regenerate app's bundled SQLite |

## Examples

```bash
# Add a new reciter
qariee add-reciter saad-alghamdi \
  --name-en "Saad Al-Ghamdi" \
  --name-ar "سعد الغامدي" \
  --image ./saad.jpg

# Upload all 114 surahs
qariee upload-audio saad-alghamdi https://server8.mp3quran.net/s_gmd

# Sync metadata and images to CDN
qariee sync

# Dry run sync to preview
qariee sync --dry-run
```

## Workflow: Adding a New Reciter

1. `qariee add-reciter` - Add metadata + image to db.json
2. `qariee upload-audio` - Download & upload 114 MP3s
3. `qariee sync` - Push to Cloudflare R2
4. `qariee generate-db` - Update bundled SQLite for next app release

# Development Quick Reference

## Core Architecture

**Principles**: Offline-first, hybrid storage (SQLite metadata + File System MP3s), background sync, native media controls, bilingual (AR/EN with RTL)

**Singleton Services**: `audioService` & `downloadService` - single instances for consistent state across app

**Provider Hierarchy**: NetworkProvider → AudioProvider → SleepTimerProvider → DownloadProvider → Drawer → Screens

## Audio Service (audioService.ts)

**Playback Modes**:
- `sequential`: [1] → [2] → [3] → [STOP]
- `shuffle`: Random queue, avoids last 5 played tracks
- `repeat`: [1] → [1] → [1] → ...

**Key Features**: Smart offline queue (filters undownloaded), played tracking (Set<string>), shuffle history (last 5), iterative playNext(), safety timeout (30s), throttled metadata updates (1s)

**Session Persistence**: Saves to AsyncStorage every 1s while playing (position, queue, playedTrackIds, shuffleHistory, playedTracksOrder)

## Download Service (downloadService.ts)

**Max Concurrent**: 2 downloads
**Storage Path**: `{DOCUMENT_DIRECTORY}/audio/{reciterId}/{surahNumber}.mp3`
**File System**: Uses expo-file-system new API (`File`, `Directory`, `Paths`)

## Database (database.db)

**Schema**:
- `reciters`: id, name_en, name_ar, color_primary, color_secondary
- `surahs`: number, name_ar, name_en
- `downloads`: reciter_id, surah_number, local_file_path, downloaded_at (composite PK)
- `app_metadata`: key, value

## CDN URLs (config.ts)

```typescript
// Base: qariee-storage.y3f.me
getAppDatabaseUrl() // /metadata/db.json
getReciterPhotoUrl(reciterId) // /images/reciters/{reciterId}.jpg
getAudioUrl(reciterId, surahNumber) // /audio/{reciterId}/{surahNumber:003}.mp3
```

## Data Flow

**Database as Source of Truth**: App ships with pre-populated SQLite database (database.db). CDN is for updates only via UPSERT pattern.

**App Initialization** (`_layout.tsx`):
```
ensureSQLiteDirectoryExists() → copyBundledDatabaseIfNeeded() → runMigrations() → healthCheck() → requestSync()
```

- `ensureSQLiteDirectoryExists()`: Creates SQLite directory on Android
- `copyBundledDatabaseIfNeeded()`: First install only - copies bundled database.db
- `runMigrations()`: Applies pending schema migrations (version-tracked)
- `healthCheck()`: Verifies tables exist and have data
- `requestSync()`: Triggers background sync (debounced, non-blocking)

**Sync Service** (`syncService.ts`):
- Debounced (50ms) to handle network flapping
- Mutex prevents concurrent syncs
- UPSERT pattern: `INSERT ... ON CONFLICT DO UPDATE` (never delete-all)
- Two versions: `schema_version` (DB structure), `data_version` (CDN freshness)

**Playback**: User tap → Context → Service → Check local file → Play local OR stream CDN → Monitor events → playNext() on finish

## Key Context APIs

**AudioContext**: currentTrack, isPlaying, position, duration, playbackMode, playTrack(), togglePlayPause(), seekTo(), playNext(), playPrevious()

**DownloadContext**: downloads[], activeDownloads Map, downloadSurah(), deleteDownload(), cancelDownload(), isDownloaded(), getProgress(), storageUsed

**NetworkContext**: isConnected, isInternetReachable, isOffline (= !connected OR !reachable)

## Navigation Flow

index.tsx (Reciter Grid) → reciter/[id].tsx (Surah List) → MiniPlayer (bottom bar) → player.tsx (Full Screen)

## Tech Stack

**Core**: Expo SDK 54, React Native 0.81.5, TypeScript 5.9, expo-router
**Audio**: expo-audio, expo-media-control, react-native-background-timer
**Storage**: expo-sqlite, expo-file-system, @react-native-async-storage/async-storage
**UI**: react-native-reanimated 4.1.1, expo-linear-gradient, expo-image
**CDN**: Cloudflare R2, Wrangler CLI

## Testing

**Test Commands**:
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

**Test Structure**:
```
app/
├── __mocks__/                    # Jest mocks
│   ├── async-storage.ts
│   ├── expo-audio.ts
│   ├── expo-asset.ts
│   ├── expo-file-system.ts
│   ├── expo-media-control.ts
│   ├── expo-sqlite.ts
│   └── react-native-background-timer.ts
└── src/services/__tests__/
    ├── test-utils.ts             # Factories & helpers
    ├── audioService.test.ts
    ├── audioStorage.test.ts
    ├── database.test.ts
    ├── downloadService.test.ts
    └── syncService.test.ts
```

**Coverage Thresholds** (jest.config.js):
- `database.ts`: 70% statements, branches, functions; 65% lines
- `syncService.ts`: 70% all metrics

**Database Generation**:
```bash
npm run generate-db   # Regenerate bundled database.db from backend/r2/metadata/db.json
```

## Architecture Decisions

**Why Singleton?** Single audio instance, shared queue state
**Why SQLite + FileSystem?** Fast queries (metadata) + native playback (MP3 blobs)
**Why Context API?** Built-in, sufficient complexity, easy testing
**Why Cloudflare R2?** S3-compatible, free egress, custom domain, affordable
**Why Bundled Database?** Works offline from first launch, no network dependency
**Why UPSERT?** Safe concurrent updates, no race conditions, atomic transactions
