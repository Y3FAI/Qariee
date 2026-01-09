# Qariee Code Simplification Review

**Date:** 2026-01-09
**Scope:** Comprehensive codebase review for simplification opportunities
**Goal:** Identify over-engineering, redundancy, and opportunities to reduce complexity while preserving functionality

---

## Executive Summary

The Qariee codebase is generally well-structured with clear separation of concerns. However, several areas exhibit unnecessary complexity, code duplication, and over-engineering that could be simplified. The most significant opportunities lie in:

1. **Duplicate database operations** between `audioService.ts` and `database.ts`
2. **Redundant session persistence logic** in `AudioContext.tsx`
3. **Repeated utility functions** across multiple files (e.g., `hexToRgba`, `formatTime`)
4. **Over-complex responsive layout calculations** in `player.tsx`
5. **Unused code and dead features**

**Estimated Lines Reducible:** 300-400 lines (approximately 15-20% reduction in core service files)

---

## 1. App Initialization (`app/app/_layout.tsx`)

**File Size:** 124 lines
**Status:** Generally clean

### Findings

**Positive:**
- Clean provider hierarchy
- Simple error handling
- Proper splash screen management

**Simplification Opportunities:**

1. **Unused imports (Minor):**
   ```typescript
   import { useCallback } from "react"  // useCallback is used, keep
   ```

2. **Stack screen options could be simplified:**
   ```typescript
   // Current (lines 48-52): Each screen defined individually
   <Stack.Screen name="index" />
   <Stack.Screen name="player" options={{ unsafe: true }} />
   <Stack.Screen name="reciter/[id]" options={{ unsafe: true }} />
   <Stack.Screen name="settings" />
   <Stack.Screen name="about" />

   // Simplified: Only define non-default screens
   <Stack.Screen name="player" options={{ unsafe: true }} />
   <Stack.Screen name="reciter/[id]" options={{ unsafe: true }} />
   ```

**Impact:** Low - 3-4 lines

---

## 2. Audio System

### 2.1 Audio Service (`app/src/services/audioService.ts`)

**File Size:** 469 lines
**Status:** CRITICAL - Contains significant duplication with database.ts

### Major Issue: Duplicate Database Operations

The file contains **162 lines** (lines 262-463) of database operations that are exact duplicates of functions in `database.ts`:

**Duplicated Functions:**
- `getDb()` - lines 267-272
- `ensureSQLiteDirectoryExists()` - lines 274-281
- `copyBundledDatabase()` - lines 283-304
- `initDatabase()` - lines 306-309
- `getDataVersion()` - lines 311-313
- `setDataVersion()` - lines 315-317
- `upsertReciters()` - lines 319-339
- `upsertSurahs()` - lines 341-358
- `getAllReciters()` - lines 360-363
- `getReciterById()` - lines 365-372
- `deleteAllReciters()` - lines 374-377
- `getAllSurahs()` - lines 379-382
- `getSurahByNumber()` - lines 384-391
- `insertDownload()` - lines 393-399
- `getDownload()` - lines 401-411
- `getAllDownloads()` - lines 413-418
- `getDownloadsByReciter()` - lines 420-426
- `deleteDownload()` - lines 428-436
- `isDownloaded()` - lines 439-445
- `getMetadata()` - lines 447-454
- `setMetadata()` - lines 456-462

**Recommendation:** Remove all database functions from `audioService.ts` and import from `database.ts`.

**Impact:** HIGH - Removes ~162 lines and eliminates maintenance burden of keeping two copies in sync.

### Other Simplification Opportunities:

1. **Sleep timer methods could be extracted** (lines 218-258):
   The sleep timer functionality could be moved to a separate `sleepTimerService.ts` for better separation of concerns.

2. **Unused methods:**
   - `resetVolume()` - No-op function (line 248-251)
   - `fadeOut()` - Partially implemented, just calls pause (line 253-258)

**Impact:** Medium - 40 lines if sleep timer extracted, 10 lines for unused methods

---

### 2.2 Audio Context (`app/src/contexts/AudioContext.tsx`)

**File Size:** 656 lines
**Status:** Contains significant redundancy

### Major Issue: Repeated Session Persistence Logic

The session saving logic is duplicated THREE times with nearly identical code:

**Location 1 - Interval-based save (lines 513-543):**
```typescript
useEffect(() => {
    if (!currentTrack || !sessionLoadedRef.current || !isPlaying) return;
    const saveInterval = setInterval(() => {
        audioStorage.saveListeningSession({
            reciterId: currentTrack.reciterId,
            reciterName: currentTrack.reciterName,
            // ... same 15 properties
        });
    }, 1000);
    return () => clearInterval(saveInterval);
}, [currentTrack, isPlaying, playedTrackIds, shuffleHistory, playedTracksOrder]);
```

**Location 2 - Pause-based save (lines 545-568):**
```typescript
useEffect(() => {
    if (!isPlaying && currentTrack && duration > 0 && sessionLoadedRef.current) {
        audioStorage.saveListeningSession({
            // ... same 15 properties repeated
        });
    }
}, [isPlaying, currentTrack, duration, position, playedTrackIds, shuffleHistory, playedTracksOrder]);
```

**Location 3 - App state change save (lines 573-605):**
```typescript
useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
        if (nextAppState === "background" || nextAppState === "inactive") {
            if (currentTrack && sessionLoadedRef.current) {
                audioStorage.saveListeningSession({
                    // ... same 15 properties repeated again
                });
            }
        }
    });
    return () => subscription.remove();
}, [currentTrack, playedTrackIds, shuffleHistory, playedTracksOrder]);
```

**Recommendation:** Extract to a single helper function:

```typescript
const buildSessionData = useCallback((): ListeningSession | null => {
    if (!currentTrack) return null;
    return {
        reciterId: currentTrack.reciterId,
        reciterName: currentTrack.reciterName,
        surahName: currentTrack.surahName,
        surahNumber: currentTrack.surahNumber,
        reciterColorPrimary: currentTrack.reciterColorPrimary,
        reciterColorSecondary: currentTrack.reciterColorSecondary,
        position: audioService.getCurrentTime(),
        duration: audioService.getDuration(),
        timestamp: Date.now(),
        playedTrackIds: Array.from(playedTrackIds),
        shuffleHistory: shuffleHistory.map(t => ({
            reciterId: t.reciterId,
            surahNumber: t.surahNumber,
        })),
        playedTracksOrder: playedTracksOrder.map(t => ({
            reciterId: t.reciterId,
            surahNumber: t.surahNumber,
        })),
    };
}, [currentTrack, playedTrackIds, shuffleHistory, playedTracksOrder]);

const saveSession = useCallback(() => {
    const session = buildSessionData();
    if (session) {
        audioStorage.saveListeningSession(session);
    }
}, [buildSessionData]);
```

**Impact:** HIGH - Removes ~60 duplicate lines and improves maintainability

### Other Opportunities:

1. **Empty return statement in initialize effect (line 91):**
   ```typescript
   return () => {}  // Unnecessary
   ```

2. **TrackReference interface is almost identical to CurrentTrack:**
   ```typescript
   // CurrentTrack (lines 18-26)
   interface CurrentTrack {
       reciterId: string;
       reciterName: string;
       surahName: string;
       surahNumber: number;
       reciterColorPrimary?: string;
       reciterColorSecondary?: string;
   }

   // TrackReference (lines 28-35) - Exactly the same!
   interface TrackReference {
       reciterId: string;
       reciterName: string;
       surahName: string;
       surahNumber: number;
       reciterColorPrimary?: string;
       reciterColorSecondary?: string;
   }
   ```
   **Recommendation:** Use a single type.

**Impact:** Medium - 10-15 lines

---

## 3. Download System

### 3.1 Download Service (`app/src/services/downloadService.ts`)

**File Size:** 418 lines
**Status:** Well-structured, minor opportunities

### Simplification Opportunities:

1. **`getProgress()` returns a new object every call (lines 385-413):**
   This is redundant since progress is tracked via callbacks. The method is rarely useful.

2. **Verbose null checks could use early returns:**
   ```typescript
   // Current (lines 93-110)
   async isDownloaded(reciterId: string, surahNumber: number): Promise<boolean> {
       try {
           const download = await getDownload(reciterId, surahNumber);
           if (!download) return false;
           const file = new File(Paths.document, download.local_file_path);
           if (!file.exists) {
               await dbDeleteDownload(reciterId, surahNumber);
               return false;
           }
           return true;
       } catch (error) {
           console.error('Error checking download status:', error);
           return false;
       }
   }
   ```

**Impact:** Low - 5-10 lines

---

### 3.2 Download Context (`app/src/contexts/DownloadContext.tsx`)

**File Size:** 217 lines
**Status:** Clean implementation

### Minor Issues:

1. **Type assertion for 'deleting' status (line 182):**
   ```typescript
   status: 'deleting' as any,  // Should extend DownloadProgress type instead
   ```

**Impact:** Low

---

## 4. Database Layer (`app/src/services/database.ts`)

**File Size:** 310 lines
**Status:** Clean, well-organized

### Observations:

The database service is well-structured. The main issue is the DUPLICATION in `audioService.ts` (addressed above).

### Minor Opportunities:

1. **`insertReciter` and `insertSurah` functions (lines 169-206) are unused:**
   Only `upsertReciters` and `upsertSurahs` are called from sync service.

**Impact:** Low - 20 lines if removed

---

## 5. Sync Service (`app/src/services/syncService.ts`)

**File Size:** 124 lines
**Status:** Excellent - Clean and focused

This is a model of good code organization. No simplification needed.

---

## 6. UI Screens

### 6.1 Player Screen (`app/app/player.tsx`)

**File Size:** 876 lines
**Status:** Contains over-engineering

### Major Issue: Over-Complex Responsive Layout

The `calculateLayout()` function (lines 50-124) is overly complex with many magic numbers and comments explaining calculations. This could be simplified:

```typescript
// Current: 74 lines of calculation with many intermediary variables
const calculateLayout = () => {
    const SAFE_AREA_ESTIMATE = 100
    const SLIDER_AREA = 60
    const TIME_DISPLAY = 20
    const SIDE_CONTROLS = 50
    const PLAY_BUTTON_AREA = 140
    const FIXED_ELEMENTS_HEIGHT = ...
    // ... 60+ more lines of calculations
}

// Simplified: Use React Native's layout system more effectively
// or consolidate to fewer, clearer calculations
```

### Duplicate Utility Functions:

1. **`hexToRgba` (lines 178-187):** Also exists in:
   - `reciter/[id].tsx` (lines 43-52)
   - `MiniPlayer.tsx` (lines 50-59)
   - `index.tsx` (implied in gradient usage)

2. **`formatTime` (lines 192-203):** Also exists in:
   - `SleepTimerModal.tsx` (lines 24-35)

**Recommendation:** Extract to a shared `utils/colors.ts` and `utils/time.ts`.

**Impact:** Medium - 30 lines removed from duplication

### Code Duplication in Navigation Handlers:

`handlePlayNextSurah` (lines 311-373) and `handlePlayPreviousSurah` (lines 376-438) share ~80% of their code:

```typescript
// Both functions do:
// 1. Check if processing
// 2. Get all surahs
// 3. Find target surah
// 4. Check download status
// 5. Check offline status
// 6. Build track object
// 7. Build queue
// 8. Play track

// Could be unified:
const handleNavigateToSurah = async (direction: 'next' | 'previous') => { ... }
```

**Impact:** Medium - 40-50 lines

### Unused Function:

`createTrackFromSurah` (lines 278-308) is defined but never called.

**Impact:** Low - 30 lines

---

### 6.2 Reciter Detail Screen (`app/app/reciter/[id].tsx`)

**File Size:** 748 lines
**Status:** Good structure, minor opportunities

### Duplicate `hexToRgba`:
Same function as in player.tsx. Extract to shared utility.

**Impact:** Low - 10 lines

---

### 6.3 Home Screen (`app/app/index.tsx`)

**File Size:** 261 lines
**Status:** Clean implementation

### Minor Issues:

1. **Unused styles (lines 251-259):**
   ```typescript
   footerLink: { ... },  // Never used
   footerText: { ... },  // Never used
   ```

**Impact:** Low - 10 lines

---

## 7. Supporting Systems

### 7.1 Network Context (`app/src/contexts/NetworkContext.tsx`)

**File Size:** 70 lines
**Status:** Excellent - Clean and minimal

No simplification needed.

---

### 7.2 Sleep Timer Context (`app/src/contexts/SleepTimerContext.tsx`)

**File Size:** 166 lines
**Status:** Some redundancy with audioService

### Issue: Dual Timer Implementation

Both `SleepTimerContext` and `audioService` maintain sleep timer state. The context duplicates logic that exists in the service.

**Recommendation:** The context should be a thin wrapper around `audioService.setSleepTimer()` rather than maintaining its own state.

**Impact:** Medium - 20-30 lines

---

### 7.3 Audio Storage (`app/src/services/audioStorage.ts`)

**File Size:** 109 lines
**Status:** Clean implementation

No simplification needed.

---

### 7.4 Config (`app/src/constants/config.ts`)

**File Size:** 24 lines
**Status:** Excellent - Minimal and focused

No simplification needed.

---

### 7.5 Fonts Utility (`app/src/utils/fonts.ts`)

**File Size:** 32 lines
**Status:** Clean

No simplification needed.

---

### 7.6 MiniPlayer Component (`app/src/components/MiniPlayer.tsx`)

**File Size:** 249 lines
**Status:** Contains duplicate hexToRgba

**Impact:** Low - 10 lines (extract to shared utility)

---

### 7.7 Sleep Timer Modal (`app/src/components/SleepTimerModal.tsx`)

**File Size:** 296 lines
**Status:** Contains duplicate formatTime

**Impact:** Low - 10 lines (extract to shared utility)

---

### 7.8 Types (`app/src/types/index.ts`)

**File Size:** 44 lines
**Status:** Clean

### Minor Issue:

`ReciterMetadata` and `SurahMetadata` interfaces (lines 37-43) appear unused.

**Impact:** Low - 7 lines

---

## Summary of Recommendations

### High Priority (Large Impact)

| File | Issue | Lines Saved | Effort |
|------|-------|-------------|--------|
| `audioService.ts` | Remove duplicate database functions | ~162 | Low |
| `AudioContext.tsx` | Extract session persistence helper | ~60 | Medium |

### Medium Priority (Moderate Impact)

| File | Issue | Lines Saved | Effort |
|------|-------|-------------|--------|
| `player.tsx` | Unify prev/next handlers | ~40-50 | Medium |
| `player.tsx` | Remove unused `createTrackFromSurah` | ~30 | Low |
| `player.tsx`, `reciter/[id].tsx`, `MiniPlayer.tsx` | Extract shared `hexToRgba` | ~30 | Low |
| `player.tsx`, `SleepTimerModal.tsx` | Extract shared `formatTime` | ~15 | Low |
| `SleepTimerContext.tsx` | Simplify timer state management | ~20-30 | Medium |

### Low Priority (Minor Impact)

| File | Issue | Lines Saved | Effort |
|------|-------|-------------|--------|
| `database.ts` | Remove unused `insertReciter`, `insertSurah` | ~20 | Low |
| `index.tsx` | Remove unused footer styles | ~10 | Low |
| `AudioContext.tsx` | Consolidate `CurrentTrack` and `TrackReference` | ~10 | Low |
| `types/index.ts` | Remove unused metadata interfaces | ~7 | Low |

---

## Proposed New Files

To support the refactoring, consider creating:

1. **`app/src/utils/colors.ts`:**
   ```typescript
   export function hexToRgba(hex: string | null | undefined, alpha: number): string { ... }
   ```

2. **`app/src/utils/time.ts`:**
   ```typescript
   export function formatTime(seconds: number): string { ... }
   export function formatTimeHMS(seconds: number): string { ... }
   ```

---

## Total Estimated Impact

| Category | Lines Saved |
|----------|-------------|
| High Priority | ~222 |
| Medium Priority | ~145 |
| Low Priority | ~47 |
| **Total** | **~414 lines** |

This represents approximately **15-20% reduction** in the core service and context files, while improving maintainability and reducing the risk of bugs from duplicate code diverging.

---

## Implementation Order

1. **Phase 1 (Quick Wins):**
   - Remove database duplication from `audioService.ts`
   - Extract `hexToRgba` and `formatTime` utilities
   - Remove unused code

2. **Phase 2 (Moderate Effort):**
   - Refactor session persistence in `AudioContext.tsx`
   - Unify navigation handlers in `player.tsx`

3. **Phase 3 (Cleanup):**
   - Simplify `SleepTimerContext.tsx`
   - Consolidate duplicate interfaces

---

*Report generated by Claude Code*
