# Qariee - Big Picture

> Modern Quran listening app with offline-first architecture.

## System Architecture

```
                        ┌─────────────────┐
                        │   EXPO APP      │
                        │  (React Native) │
                        └────────┬────────┘
                                 │
       ┌─────────────┬───────────┼───────────┬─────────────┐
       ▼             ▼           ▼           ▼             ▼
┌──────────┐  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  AUDIO   │  │ DOWNLOAD │ │ NETWORK  │ │  SLEEP   │ │ DATABASE │
│ SERVICE  │  │ SERVICE  │ │ MONITOR  │ │  TIMER   │ │ SERVICE  │
└────┬─────┘  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
     │             │            │            │            │
     └─────────────┴────────────┴────────────┴────────────┘
                               ▼
                    ┌──────────────────────┐
                    │  STORAGE LAYER       │
                    │  • SQLite (qariee.db)  │
                    │  • File System (MP3) │
                    │  • AsyncStorage      │
                    └──────────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │  REMOTE SOURCES      │
                    │  • Cloudflare R2 CDN │
                    └──────────────────────┘
```

## Data Flow

```
CDN ──▶ SYNC ──▶ SQLite ──▶ UI
                                  │
USER ──▶ SCREEN ──▶ CONTEXT ──▶ SERVICE ──▶ expo-audio ──▶ PLAYBACK
                                  │
                                  ▼
                        FILE SYSTEM (Downloads)
```

## Services Summary

| Service             | Purpose                                 | File                         |
| ------------------- | --------------------------------------- | ---------------------------- |
| **audioService**    | Playback, queue, media controls         | audioService.ts (1151 LOC)   |
| **downloadService** | Download management, local storage      | downloadService.ts (382 LOC) |
| **database**        | SQLite operations                       | database.ts (194 LOC)        |
| **dataSync**        | CDN sync, first launch initialization   | dataSync.ts (257 LOC)        |
| **audioStorage**    | Session persistence with AsyncStorage   | audioStorage.ts              |
| **i18n**            | Internationalization (Aqarieec/English) | i18n.ts                      |

## Core Principles

-   **Offline-First**: Bundled data + downloaded MP3s work without internet
-   **Hybrid Storage**: SQLite for metadata, File System for audio files
-   **Background Sync**: Silent CDN updates on network recovery
-   **Native Media**: Lock screen controls via expo-media-control
-   **Bilingual**: Full Aqarieec/English support with RTL layouts

---

## Audio Service

Singleton class managing playback with advanced queue logic.

```
┌─────────────────────────────────────────────────────┐
│                  AUDIO SERVICE                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│   initialize(player)                               │
│        │                                            │
│        ▼                                            │
│   Setup media controls (lock screen)               │
│        │                                            │
│        ▼                                            │
│   play(track, queue)                               │
│        │                                            │
│        ├─────────────┬─────────────┐               │
│        ▼             ▼             │               │
│   LOCAL FILE    REMOTE URL         │               │
│   (if exists)   (CDN stream)       │               │
│        │             │             │               │
│        └──────┬──────┘             │               │
│               ▼                                     │
│        player.replace(source)                      │
│               │                                     │
│               ▼                                     │
│        player.play()                               │
│               │                                     │
│               ▼                                     │
│   Monitor playback (native events)                 │
│               │                                     │
│               ▼                                     │
│   didJustFinish?  ──▶ playNext()                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Playback Modes:

```typescript
export type PlaybackMode = "sequential" | "shuffle" | "repeat"
```

```
SEQUENTIAL:   [1] → [2] → [3] → [STOP]
SHUFFLE:     [3] → [1] → [4] → [2] (avoids last 5 played)
REPEAT:      [1] → [1] → [1] → [...]
```

### Key Features:

-   **Smart Queue**: Filters out undownloaded tracks when offline
-   **Played Tracking**: Maintains `Set<string>` of played track IDs
-   **Shuffle History**: Keeps last 5 tracks to avoid repeats
-   **Iterative playNext()**: Loops through queue to skip unplayable tracks
-   **Safety Timeout**: Resets stuck `isProcessingNext` after 30s
-   **Throttled Metadata**: Updates lock screen every 1s max

### Code Evidence:

```typescript
// From audioService.ts
private playedTrackIds:  Set<string> = new Set()
private shuffleHistory: Track[] = [] // Max 5
private playedTracksOrder: Track[] = []
private isProcessingNext:  boolean = false
private isOffline: boolean = false
```

### Offline Handling:

```typescript
// Line 397-402
if (this.isOffline && !localPath) {
    throw new Error(
        "Cannot stream while offline. Please download the surah first.",
    )
}
```

---

## Download Service

Manages file downloads with concurrent queue system.

```
┌─────────────────────────────────────────────────────┐
│                 DOWNLOAD SERVICE                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│   downloadSurah(reciterId, surahNumber)            │
│        │                                            │
│        ▼                                            │
│   Check if already downloaded                      │
│        │                                            │
│        ▼                                            │
│   Create DownloadResumable task                    │
│        │                                            │
│        ▼                                            │
│   Queue (max 2 concurrent)                         │
│        │                                            │
│        ▼                                            │
│   Download from CDN                                │
│        │                                            │
│        ├─── Progress callbacks ───▶ UI             │
│        │                                            │
│        ▼                                            │
│   Save to:  audio/{reciterId}/{surah}. mp3           │
│        │                                            │
│        ▼                                            │
│   Insert to downloads table                        │
│        │                                            │
│        ▼                                            │
│   Update DownloadContext                           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Storage Structure:

```
{DOCUMENT_DIRECTORY}/
└── audio/
    ├── hussary/
    │   ├── 001.mp3
    │   ├── 002.mp3
    │   └── ...
    └── {reciterId}/
        └── {surah}.mp3
```

### Key Features:

```typescript
// From downloadService.ts
private maxConcurrentDownloads = 2
private downloadQueue: DownloadTask[] = []
private activeDownloads: Map<string, DownloadTask> = new Map()
private progressCallbacks: Map<string, ProgressCallback[]> = new Map()
```

### File System API:

```typescript
// Uses expo-file-system new API
import { Directory, File, Paths } from 'expo-file-system'
import * as FileSystemLegacy from 'expo-file-system/legacy' // For DownloadResumable

// Check if file exists
const file = new File(Paths. document, download.local_file_path)
if (! file.exists) { ... }
```

---

## Database Service

SQLite database for metadata persistence.

```
┌─────────────────────────────────────────────────────┐
│                 SQLite SCHEMA                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│   reciters                                         │
│   ├── id (TEXT PRIMARY KEY)                        │
│   ├── name_en (TEXT NOT NULL)                      │
│   ├── name_ar (TEXT NOT NULL)                      │
│   ├── color_primary (TEXT NOT NULL)                │
│   └── color_secondary (TEXT NOT NULL)              │
│                                                     │
│   surahs                                           │
│   ├── number (INTEGER PRIMARY KEY)                 │
│   ├── name_ar (TEXT NOT NULL)                      │
│   └── name_en (TEXT NOT NULL)                      │
│                                                     │
│   downloads                                        │
│   ├── reciter_id (TEXT NOT NULL)                   │
│   ├── surah_number (INTEGER NOT NULL)              │
│   ├── local_file_path (TEXT NOT NULL)              │
│   ├── downloaded_at (TEXT DEFAULT CURRENT_TIMESTAMP) │
│   └── PRIMARY KEY (reciter_id, surah_number)       │
│                                                     │
│   app_metadata                                     │
│   ├── key (TEXT PRIMARY KEY)                       │
│   └── value (TEXT NOT NULL)                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Database File:

```typescript
// From database.ts
const db = SQLite.openDatabaseSync("database.db")
```

### Key Operations:

```typescript
// Reciters
export const insertReciter = async (reciter: Reciter): Promise<void>
export const getAllReciters = async (): Promise<Reciter[]>
export const getReciterById = async (id: string): Promise<Reciter | null>

// Surahs
export const insertSurah = async (surah: Surah): Promise<void>
export const getAllSurahs = async (): Promise<Surah[]>
export const getSurahByNumber = async (number: number): Promise<Surah | null>

// Downloads
export const insertDownload = async (download:  Omit<Download, 'downloaded_at'>)
export const getDownload = async (reciterId: string, surahNumber: number)
export const deleteDownload = async (reciterId: string, surahNumber: number)

// Metadata
export const getMetadata = async (key: string): Promise<string | null>
export const setMetadata = async (key: string, value: string): Promise<void>
```

---

## Data Sync Service

Handles first launch initialization and background updates.

```
┌─────────────────────────────────────────────────────┐
│                   DATA SYNC                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│   FIRST LAUNCH:                                      │
│   1. initDatabase()                                │
│        │                                            │
│        ▼                                            │
│   2. Try fetch db. json from CDN                    │
│        │                                            │
│        ├─────────────┬─────────────┐               │
│        ▼             ▼             │               │
│   SUCCESS        FAIL              │               │
│        │             │             │               │
│   Parse CDN     Load bundled       │               │
│   reciters      reciters. json      │               │
│        │             │             │               │
│        └──────┬──────┘             │               │
│               ▼                                     │
│   3. insertReciter() for each                      │
│        │                                            │
│        ▼                                            │
│   4. Load bundled surahs. json (114 surahs)         │
│        │                                            │
│        ▼                                            │
│   5. AsyncStorage.setItem('first_launch_complete') │
│                                                     │
│   SUBSEQUENT LAUNCHES:                             │
│   1. Load from SQLite immediately                  │
│   2. updateDataInBackground() (fire & forget)      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### CDN URL Configuration:

```typescript
// From config.ts

export const getAppDatabaseUrl = (): string => {
    return `${CDN_BASE_URL}/metadata/db.json`
}

export const getReciterPhotoUrl = (reciterId: string): string => {
    return `${CDN_BASE_URL}/images/reciters/${reciterId}.jpg`
}

export const getAudioUrl = (reciterId: string, surahNumber: number): string => {
    const surahPadded = surahNumber.toString().padStart(3, "0")
    return `${CDN_BASE_URL}/audio/${reciterId}/${surahPadded}.mp3`
}
```

### db.json Format:

```typescript
interface AppDatabase {
    version: string
    settings: {
        cdn_base_url: string
        app_name: string
        support_email: string
        app_version: string
        min_app_version: string
    }
    reciters: Reciter[]
}
```

### Update Strategy:

```typescript
// From dataSync.ts - checkForUpdates DISABLED
const checkForUpdates = async (): Promise<boolean> => {
    return false // Always returns false - no annoying banners
}
```

---

## Context Architecture

Four React contexts manage global state.

```
┌─────────────────────────────────────────────────────┐
│                 PROVIDER HIERARCHY                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│   <SafeAreaProvider>                               │
│     <NetworkProvider>              (NetworkContext. tsx) │
│       <AudioProvider>              (AudioContext.tsx)   │
│         <SleepTimerProvider>      (SleepTimerContext.tsx) │
│           <DownloadProvider>      (DownloadContext.tsx)  │
│             <Drawer>                                │
│               <Screens />                           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### NetworkContext

```typescript
// From NetworkContext.tsx
interface NetworkContextType {
    isConnected: boolean
    isInternetReachable: boolean | null
    isOffline: boolean
    networkType: Network.NetworkStateType | null
}

// Device is offline if not connected OR internet not reachable
const isOffline = !isConnected || isInternetReachable === false
```

### AudioContext

```typescript
// From AudioContext.tsx
interface AudioContextType {
    currentTrack: CurrentTrack | null
    isPlaying: boolean
    position: number
    duration: number
    playbackMode: PlaybackMode
    playTrack: (track: Track, queue?: Track[]) => Promise<void>
    togglePlayPause: () => void
    seekTo: (seconds: number) => Promise<void>
    playNext: () => Promise<void>
    playPrevious: () => Promise<void>
}
```

**Session Persistence:**

```typescript
// Saves every 1 second while playing
audioStorage.saveListeningSession({
  reciterId, reciterName, surahName, surahNumber,
  reciterColorPrimary, reciterColorSecondary,
  position, duration, timestamp,
  playedTrackIds:  Array.from(audioService.getPlayedTrackIds()),
  shuffleHistory: audioService.getShuffleHistory().map(... ),
  playedTracksOrder: audioService.getPlayedTracksOrder().map(...)
})
```

### DownloadContext

```typescript
// From DownloadContext.tsx
interface DownloadContextType {
    downloads: Download[]
    activeDownloads: Map<string, DownloadProgress>
    downloadSurah: (reciterId: string, surahNumber: number) => Promise<void>
    deleteDownload: (reciterId: string, surahNumber: number) => Promise<void>
    cancelDownload: (reciterId: string, surahNumber: number) => Promise<void>
    isDownloaded: (reciterId: string, surahNumber: number) => boolean
    getProgress: (
        reciterId: string,
        surahNumber: number,
    ) => DownloadProgress | null
    storageUsed: number
}
```

**Safety Check:**

```typescript
// Lines 109-124 - Skip to next track if deleting currently playing
if (
    currentTrack &&
    currentTrack.reciterId === reciterId &&
    currentTrack.surahNumber === surahNumber
) {
    if (isPlaying) {
        await playNext()
    }
}
```

### SleepTimerContext

```typescript
// From SleepTimerContext.tsx
interface SleepTimerContextType {
    isActive: boolean
    timeRemaining: number
    startTimer: (minutes: number) => void
    stopTimer: () => void
}
```

---

## UI Structure

File-based routing with expo-router.

```
┌─────────────────────────────────────────────────────┐
│                    APP SCREENS                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│   app/                                             │
│   ├── _layout.tsx            # Root + providers    │
│   ├── index.tsx              # Home (reciter grid) │
│   ├── reciter/[id].tsx       # Surah list         │
│   ├── player. tsx             # Full-screen player  │
│   ├── settings.tsx           # Settings screen     │
│   └── about.tsx              # About screen        │
│                                                     │
│   src/                                             │
│   ├── components/            # 7 reusable UI       │
│   │   ├── MiniPlayer.tsx     # Bottom bar player   │
│   │   ├── SurahName.tsx      # Aqarieec calligraphy  │
│   │   ├── CircularProgress.tsx                     │
│   │   ├── SleepTimerModal.tsx                      │
│   │   ├── UpdateBanner.tsx                         │
│   │   ├── OfflineIndicator.tsx                     │
│   │   └── CustomDrawer.tsx                         │
│   ├── contexts/             # 4 context providers  │
│   ├── services/             # 6 service files      │
│   ├── constants/            # Config & URLs        │
│   ├── locales/              # i18n translations    │
│   ├── types/                # TypeScript types     │
│   └── utils/                # Helper functions     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Navigation Flow:

```
index.tsx (Reciter Grid)
    ↓ tap reciter
reciter/[id].tsx (Surah List)
    ↓ tap surah
MiniPlayer appears (bottom bar)
    ↓ tap MiniPlayer
player.tsx (Full Screen)
```

### Layout Configuration:

```typescript
// From _layout.tsx
<AudioProvider>
  <SleepTimerProvider>
    <DownloadProvider>
      <Drawer drawerContent={CustomDrawer} screenOptions={{... }}>
        <Drawer.Screen name="index" />
        <Drawer.Screen name="player" options={{ swipeEnabled: false }} />
        <Drawer.Screen name="reciter/[id]" />
        <Drawer.Screen name="settings" />
        <Drawer.Screen name="about" />
      </Drawer>
    </DownloadProvider>
  </SleepTimerProvider>
</AudioProvider>
```

---

## Backend Management Scripts

Bash scripts for Cloudflare R2 CDN management.

```
┌─────────────────────────────────────────────────────┐
│              BACKEND SCRIPTS (Bash)                 │
├─────────────────────────────────────────────────────┤
│                                                     │
│   backend/                                         │
│   ├── r2/                    # Local mirror        │
│   │   ├── metadata/                                │
│   │   │   └── db.json        # App config          │
│   │   └── images/                                  │
│   │       └── reciters/                            │
│   │           └── hussary. jpg                      │
│   │                                                 │
│   ├── sync-to-r2.sh          # Upload metadata    │
│   │   Uses: wrangler r2 object put                │
│   │                                                 │
│   └── download-audio-to-r2.sh  # Upload audio     │
│       Uses:  curl + wrangler                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### sync-to-r2.sh

```bash
# Uploads local r2/ files to Cloudflare R2 bucket 'qariee'
wrangler r2 object put "qariee/${remote_path}" --file="${local_file}"
```

### download-audio-to-r2.sh

```bash
# Downloads from mp3quran.net and uploads to R2
# Syntax: ./download-audio-to-r2.sh <reciter_id> <base_url> [start] [end]
# Example: ./download-audio-to-r2.sh hussary https://server13.mp3quran.net/husr 1 114
```

---

## Key Technologies

```
┌─────────────────────────────────────────────────────┐
│                  TECH STACK                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│   FRAMEWORK:                                       │
│   • Expo SDK 54                                    │
│   • React Native 0.81.5                            │
│   • TypeScript 5.9                                 │
│   • expo-router (file-based routing)              │
│                                                     │
│   AUDIO:                                             │
│   • expo-audio (native playback)                  │
│   • expo-media-control (lock screen)              │
│   • react-native-background-timer (sleep timer)   │
│                                                     │
│   STORAGE:                                         │
│   • expo-sqlite (SQLite database)                 │
│   • expo-file-system (downloads)                  │
│   • @react-native-async-storage/async-storage     │
│                                                     │
│   UI:                                              │
│   • react-native-reanimated 4.1.1                 │
│   • expo-linear-gradient                          │
│   • expo-image (optimized images)                 │
│   • @react-native-community/slider                │
│                                                     │
│   I18N:                                            │
│   • i18next + react-i18next                       │
│   • expo-localization                             │
│                                                     │
│   INFRASTRUCTURE:                                  │
│   • Cloudflare R2 (CDN storage)                   │
│   • Wrangler CLI (R2 management)                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Philosophy

1. **Offline-First** - Works without internet after initial setup
2. **User-Centric** - Simple, beautiful Quran listening experience
3. **Performance** - Native audio, smooth animations
4. **Respectful** - Proper handling of sacred Quranic content
5. **Modern** - Latest React Native + Expo tools
6. **Maintainable** - Clean architecture, TypeScript types

---

## Code Statistics

| Component           | Lines of Code | Complexity |
| ------------------- | ------------- | ---------- |
| audioService. ts    | 1151          | High       |
| AudioContext.tsx    | 516           | Medium     |
| downloadService.ts  | 382           | Medium     |
| dataSync.ts         | 257           | Low        |
| database.ts         | 194           | Low        |
| DownloadContext.tsx | 217           | Low        |
| NetworkContext.tsx  | 69            | Low        |

**Total App Code:** ~12,000 lines (app/ directory)

---

## Architecture Highlights

### Why Singleton Services?

```typescript
// From audioService.ts
export const audioService = new AudioService()

// From downloadService.ts
export const downloadService = new DownloadService()
```

**Reason:** Single audio player instance, shared queue state, consistent behavior across components.

### Why SQLite + File System?

-   **SQLite**: Fast queries, relational data (reciters, surahs, downloads)
-   **File System**: Large blobs (MP3 files), native player compatibility
-   **Separation**: Database records metadata, filesystem holds actual files

### Why Context API?

-   Built into React - no extra dependencies
-   Good enough for this app's complexity
-   Provider pattern keeps concerns separated
-   Easy to test and maintain

### Why Cloudflare R2?

-   S3-compatible API
-   Free egress (data transfer)
-   Custom domain support
-   Affordable storage

---

_App Name: Qariee (qariee)_  
_Version: 1.0.0_  
_Database: database.db (SQLite)_  
_Tech: React Native/Expo + TypeScript_  
_Author: Y3F_
