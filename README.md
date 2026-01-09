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
│   │   ├── database.ts            # SQLite operations + migrations
│   │   └── syncService.ts         # CDN sync (debounced, UPSERT)
│   ├── constants/         # App configuration
│   ├── locales/           # i18n translations
│   └── utils/             # Helper functions
└── assets/                # Images, fonts, icons
```

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Scripts

```bash
npm run generate-db   # Regenerate bundled database from backend/r2/metadata/db.json
npm run prebuild      # Clean Expo prebuild
npm run dev           # Build and install debug APK
npm run prod          # Build and install release APK
```

## Backend CLI

A Python CLI tool for managing CDN content (reciters, audio files, metadata).

### Installation

```bash
cd backend/cli
pip install -e .
```

Requires [wrangler CLI](https://developers.cloudflare.com/r2/data-access/wrangler/) for R2 uploads:
```bash
npm install -g wrangler
wrangler login
```

### Commands

| Command | Description |
|---------|-------------|
| `qariee list` | List all reciters in db.json |
| `qariee add-reciter` | Add a new reciter (auto-generates colors) |
| `qariee upload-audio <id> <url>` | Download & upload 114 MP3s to R2 |
| `qariee sync` | Sync local r2/ to Cloudflare R2 |
| `qariee verify` | Verify R2 metadata and audio files |
| `qariee generate-db` | Regenerate app's bundled SQLite |

### Examples

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

# Verify R2 content
qariee verify

# Regenerate app database
qariee generate-db
```

### Workflow: Adding a New Reciter

1. `qariee add-reciter` - Add metadata + image to db.json
2. `qariee upload-audio` - Download & upload 114 MP3s
3. `qariee sync` - Push to Cloudflare R2
4. `qariee generate-db` - Update bundled SQLite for next app release

## Author

Y3F
