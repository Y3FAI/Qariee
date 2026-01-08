# Qariee (Rabi) - File Structure

> Complete directory tree of the repository

## Repository Root

```
Qariee/
├── . gitignore
├── README. md
├── TODO.md
├── app/                          # Main React Native application
├── assets/                       # Root-level assets
├── backend/                      # CDN management scripts
└── docs/                         # Documentation
```

---

## `/app` - Main Application

```
app/
├── app/                          # Screens (expo-router)
├── assets/                       # App assets
├── src/                          # Source code
├── app.json                      # Expo config
├── dataflow.md                   # Architecture doc
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
    └── [id].tsx                  # Reciter detail (dynamic route)
```

---

## `/app/src` - Source Code

```
app/src/
├── components/                   # UI components
├── constants/                    # Config & constants
├── contexts/                     # React Context providers
├── locales/                      # i18n translations
├── services/                     # Business logic
├── types/                        # TypeScript types
└── utils/                        # Helpers
```

---

## `/app/src/components`

```
app/src/components/
├── CircularProgress. tsx          # Download progress circle
├── CustomDrawer.tsx              # Side menu drawer
├── MiniPlayer.tsx                # Bottom player bar
├── OfflineIndicator.tsx          # Network status banner
├── SleepTimerModal.tsx           # Sleep timer modal
├── SurahName.tsx                 # Arabic calligraphy
└── UpdateBanner.tsx              # Update notification
```

---

## `/app/src/constants`

```
app/src/constants/
├── config.ts                     # CDN URLs + config
└── quranDivisions.ts             # Quran structure data
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
├── audioService. ts               # Playback engine (1151 lines)
├── audioStorage.ts               # Session persistence
├── database.ts                   # SQLite operations
├── dataSync.ts                   # CDN sync
├── downloadService.ts            # Download manager
└── i18n.ts                       # i18next config
```

---

## `/app/src/locales`

```
app/src/locales/
├── ar. json                       # Arabic translations
└── en.json                       # English translations
```

---

## `/app/src/types`

```
app/src/types/
└── index.ts                      # All TypeScript types
```

---

## `/app/src/utils`

```
app/src/utils/
└── fonts.ts                      # Font helpers
```

---

## `/app/assets`

```
app/assets/
├── data/
│   ├── reciters.json            # Bundled reciter (fallback)
│   └── surahs.json              # All 114 surahs
├── fonts/
│   └── surah_names.ttf          # Arabic calligraphy font
└── images/
    ├── icon.png
    ├── splash-icon.png
    ├── android-icon-*. png
    └── favicon.png
```

---

## `/backend` - CDN Management

```
backend/
├── README.md
├── r2/                           # Local R2 mirror
│   ├── metadata/
│   │   └── db.json              # App database
│   └── images/
│       └── reciters/
│           └── hussary.jpg
├── sync-to-r2.sh                # Upload metadata/images
└── download-audio-to-r2.sh      # Upload audio files
```

---

## `/docs` - Documentation

```
docs/
├── DEV.md                        # Development guide
├── FINDINGS.md                   # Dev findings
├── HISTORY.md                    # Change log
├── IDEAS.md                      # Feature ideas
├── TASKS.MD                      # Task list
├── dataflow.md                   # Architecture
├── production.md                 # Production guide
├── publishing-checklist. md       # Store checklist
├── review.md                     # Code review
├── tests.md                      # Testing docs
└── unit-testing-strategy.md     # Test strategy
```

---

## `/assets` - Root Assets

```
assets/
├── banner.png                    # Repository banner
├── icon.png                      # App icon
├── notification_icon.png         # Notification icon
├── splash.png                    # Splash screen
└── icons/                        # Additional icons
```

---

## File Count Summary

| Category            | Files |
| ------------------- | ----- |
| **Screens**         | 6     |
| **Components**      | 7     |
| **Contexts**        | 4     |
| **Services**        | 6     |
| **Constants**       | 2     |
| **Locales**         | 2     |
| **Backend Scripts** | 2     |
| **Documentation**   | 11    |

**Total TypeScript/TSX:** ~30 files  
**Total LOC (src/):** ~3,000 lines

---

## Key Files

| File               | Lines | Purpose                |
| ------------------ | ----- | ---------------------- |
| audioService.ts    | 1151  | Playback + queue logic |
| AudioContext.tsx   | 516   | Audio state management |
| downloadService.ts | 382   | Download queue system  |
| dataSync.ts        | 257   | CDN synchronization    |
| database.ts        | 194   | SQLite operations      |
| player.tsx         | ~900  | Full-screen player UI  |
| reciter/[id].tsx   | ~650  | Surah list + downloads |

---

## Runtime Files (Not in Repo)

```
# Device storage:
{DEVICE}/rabi. db                  # SQLite database
{DOCUMENT}/audio/{reciter}/{surah}.mp3  # Downloaded MP3s

# Build output:
app/node_modules/                 # Dependencies
app/.expo/                        # Expo cache
app/dist/                         # Build artifacts
```
