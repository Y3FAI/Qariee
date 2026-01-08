# Qariee - Quran Recitation App

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

## Author

Y3F
