# Rabi - Quran Recitation App

A beautiful, modern React Native app for listening to Quran recitations.

## Features

-   🎵 **Audio Playback**: Stream or play downloaded Quran recitations
-   📱 **Offline Mode**: Full offline support with downloaded content
-   🔔 **Lock Screen Controls**: Media controls on lock screen and notifications (iOS & Android)
-   ⬇️ **Smart Downloads**: Download individual surahs or entire reciters' collections
-   🔀 **Playback Modes**: Sequential, shuffle, and repeat modes
-   🌐 **Bilingual**: Full support for Arabic and English
-   🎨 **Beautiful UI**: Gradient themes extracted from reciter images
-   📶 **Network-Aware**: Gracefully handles online/offline transitions

## Tech Stack

-   **Framework**: Expo (React Native)
-   **Language**: TypeScript
-   **Audio**: expo-audio
-   **Database**: expo-sqlite
-   **Storage**: expo-file-system
-   **Network Detection**: expo-network
-   **Media Controls**: expo-media-control
-   **Navigation**: expo-router
-   **Internationalization**: i18next

## Setup

1. Install dependencies:

    ```bash
    npm install
    ```

2. Start the development server:

    ```bash
    npx expo start
    ```

3. Run on device/emulator:

    ```bash
    # iOS
    npx expo run:ios

    # Android
    npx expo run:android
    ```

## Project Structure

```
app/
├── app/                    # Screens (expo-router file-based routing)
│   ├── index.tsx          # Home screen with reciter grid
│   ├── reciter/[id].tsx   # Reciter detail with surah list
│   ├── player.tsx         # Full-screen player
│   └── _layout.tsx        # Root layout with providers
├── src/
│   ├── components/        # Reusable UI components
│   ├── contexts/          # React contexts
│   │   ├── AudioContext.tsx       # Audio playback state
│   │   ├── DownloadContext.tsx    # Download management
│   │   └── NetworkContext.tsx     # Network status
│   ├── services/          # Business logic
│   │   ├── audioService.ts        # Audio playback engine
│   │   ├── downloadService.ts     # Download management
│   │   ├── database.ts            # SQLite operations
│   │   └── dataSync.ts            # Remote data sync
│   ├── constants/         # App configuration
│   ├── locales/           # i18n translations
│   └── utils/             # Helper functions
└── assets/                # Images, fonts, icons
```

## Recent Implementations

### Offline Mode (2025-11-24)

Comprehensive offline support was implemented to provide seamless user experience without internet connection.

#### Architecture

**Network Detection**:

-   Uses `expo-network` for real-time connectivity monitoring
-   `NetworkContext` provides app-wide network state
-   Tracks both connection status and internet reachability

**Audio Service Integration**:

```typescript
// audioService.ts
if (this.isOffline && !localPath) {
    throw new Error(
        "Cannot stream while offline. Please download the surah first.",
    )
}
```

**Offline-Aware Queue Filtering**:

```typescript
// Filter queue to only include downloaded tracks when offline
if (this.isOffline && queue.length > 0) {
    const downloadedTracks = await Promise.all(
        queue.map(async (t) => {
            const localPath = await downloadService.getLocalPath(
                t.reciterId,
                t.surahNumber,
            )
            return localPath ? t : null
        }),
    )
    filteredQueue = downloadedTracks.filter((t): t is Track => t !== null)
}
```

#### UI/UX Changes

1. **Offline Indicator**: Red banner at top of screen when offline
2. **Disabled Content**: Non-downloaded surahs grayed out (40% opacity) and disabled
3. **Download Controls**: All download buttons disabled when offline
4. **Visual Feedback**: Download icons change to darker gray when offline

#### Key Files

-   `/src/contexts/NetworkContext.tsx` - Network state management
-   `/src/components/OfflineIndicator.tsx` - Offline banner component
-   `/src/services/audioService.ts` - Offline playback prevention
-   `/src/contexts/AudioContext.tsx` - Network integration
-   `/app/reciter/[id].tsx` - UI offline handling

### Background Playback & Media Controls (2025-11-24)

Full lock screen and notification controls using `expo-media-control`.

#### Features

-   ✅ Background audio continues when screen is locked
-   ✅ Lock screen shows current surah and reciter
-   ✅ Notification controls: play, pause, next, previous
-   ✅ iOS Control Center integration
-   ✅ Android notification with controls
-   ✅ Bluetooth/headphone controls

#### Configuration

**app.json**:

```json
{
    "ios": {
        "infoPlist": {
            "UIBackgroundModes": ["audio"]
        }
    },
    "android": {
        "permissions": ["WAKE_LOCK"]
    }
}
```

**Audio Mode Setup**:

```typescript
await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionModeAndroid: "duckOthers",
    interruptionMode: "mixWithOthers",
})
```

### Download System

-   **Concurrent Downloads**: Queue with max concurrent limit
-   **Progress Tracking**: Real-time progress for each download
-   **Batch Operations**: Download/remove all surahs for a reciter
-   **Storage Management**: Track total storage used
-   **Auto-Cleanup**: Failed downloads are automatically cleaned up

## Development Notes

### Adding New Features

1. Create feature branch
2. Update TODO.md with task breakdown
3. Implement with TypeScript
4. Test on both iOS and Android
5. Update README with implementation details

### Code Style

-   Use TypeScript for type safety
-   Follow existing patterns in contexts and services
-   Use i18n for all user-facing strings
-   Handle both RTL (Arabic) and LTR (English) layouts
-   Gracefully handle errors with user-friendly messages

## Author

Y3F
