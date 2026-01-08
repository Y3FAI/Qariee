# Plan: Partial Reciters Support (JSON-Based) - REVISED

## Overview

Some reciters in the application do not have all 114 surahs available. This plan uses a **JSON-based approach with CDN sync and AsyncStorage persistence** to track available surahs per reciter.

**Key Changes from original plan:**
- Fixed queue building logic (filter during construction, not iteration)
- Added AsyncStorage persistence for CDN updates
- Added comprehensive validation
- Fixed first/last surah logic
- Added race condition protection
- Fixed search, shuffle, and download count issues

---

## Architecture Decision: CDN-First with Fallback

Instead of duplicating data, use **CDN-first** approach:
1. App ships with minimal bundled JSON (all reciters have all surahs)
2. CDN provides authoritative `reciter_surahs` data
3. AsyncStorage persists CDN updates
4. If CDN unavailable, use cached AsyncStorage data
5. If no cache, use bundled default (all available)

---

## New File: `app/assets/data/reciter-surahs.json`

```json
{
  "version": "1.0.0",
  "reciters": []
}
```

**Empty by default** - all reciters assumed to have all 114 surahs until CDN says otherwise.

---

## Type Changes (`app/src/types/index.ts`)

```typescript
export interface ReciterSurahs {
  version: string;
  reciters: ReciterMissingSurahs[];
}

export interface ReciterMissingSurahs {
  id: string;
  missing_surahs: number[];  // Use missing (shorter for mostly-complete reciters)
}

// Update AppDatabase to include reciter_surahs
export interface AppDatabase {
  version: string;
  settings: AppSettings;
  reciters: Reciter[];
  reciter_surahs?: ReciterSurahs;
}
```

---

## New Service: `app/src/services/reciterSurahsService.ts`

```typescript
import { ReciterMissingSurahs, ReciterSurahs } from '../types';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'reciter_surahs_data';
const FILE_NAME = 'reciter-surahs.json';

let cachedData: ReciterSurahs | null = null;
let missingSurahsMap = new Map<string, Set<number>>();
let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize reciter surahs data with proper loading sequence:
 * 1. Try AsyncStorage (cached from CDN)
 * 2. Fall back to bundled JSON
 * 3. Default to empty (all available)
 */
export async function loadReciterSurahs(): Promise<void> {
  // Prevent concurrent initialization
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Try AsyncStorage first (CDN cached data)
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as ReciterSurahs;
        await applyData(data);
        console.log('[ReciterSurahs] Loaded from AsyncStorage');
        return;
      }

      // Try bundled JSON
      try {
        const asset = Asset.fromModule(require('../../assets/data/reciter-surahs.json'));
        await asset.downloadAsync();

        if (asset.localUri) {
          const content = await FileSystem.readAsStringAsync(asset.localUri);
          const data = JSON.parse(content) as ReciterSurahs;
          await applyData(data);
          console.log('[ReciterSurahs] Loaded from bundled asset');
          return;
        }
      } catch {
        // Bundled file not found, use default
      }

      // Default: all reciters have all surahs
      await applyData({ version: '1.0.0', reciters: [] });
      console.log('[ReciterSurahs] Using default (all surahs available)');
    } catch (error) {
      console.error('[ReciterSurahs] Load error:', error);
      // Fail safe: default to all available
      await applyData({ version: '1.0.0', reciters: [] });
    } finally {
      isInitialized = true;
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Apply data and build index
 */
async function applyData(data: ReciterSurahs): Promise<void> {
  cachedData = data;
  missingSurahsMap.clear();

  data.reciters.forEach(reciter => {
    missingSurahsMap.set(reciter.id, new Set(reciter.missing_surahs));
  });
}

/**
 * Check if a surah is available for a reciter
 * Returns true if:
 * - Data not loaded yet (failsafe: allow, will be filtered later)
 * - Reciter not in map (all surahs available)
 * - Surah not in missing set
 */
export function isSurahAvailable(reciterId: string, surahNumber: number): boolean {
  if (!isInitialized) {
    console.warn('[ReciterSurahs] Not initialized, assuming available');
    return true; // Fail-safe: assume available during init
  }
  const missing = missingSurahsMap.get(reciterId);
  if (!missing) return true; // Not in list = all available
  return !missing.has(surahNumber);
}

/**
 * Get all missing surahs for a reciter (sorted)
 */
export function getMissingSurahs(reciterId: string): number[] {
  const missing = missingSurahsMap.get(reciterId);
  if (!missing) return [];
  return Array.from(missing).sort((a, b) => a - b);
}

/**
 * Get all available surahs for a reciter (1-114 excluding missing)
 */
export function getAvailableSurahs(reciterId: string): number[] {
  const missing = missingSurahsMap.get(reciterId);
  if (!missing || missing.size === 0) {
    return Array.from({ length: 114 }, (_, i) => i + 1);
  }

  const available: number[] = [];
  for (let i = 1; i <= 114; i++) {
    if (!missing.has(i)) {
      available.push(i);
    }
  }
  return available;
}

/**
 * Get first available surah number for a reciter
 */
export function getFirstAvailableSurah(reciterId: string): number {
  const available = getAvailableSurahs(reciterId);
  return available.length > 0 ? available[0] : 1;
}

/**
 * Get last available surah number for a reciter
 */
export function getLastAvailableSurah(reciterId: string): number {
  const available = getAvailableSurahs(reciterId);
  return available.length > 0 ? available[available.length - 1] : 114;
}

/**
 * Check if surah number is the first available
 */
export function isFirstAvailableSurah(reciterId: string, surahNumber: number): boolean {
  return surahNumber === getFirstAvailableSurah(reciterId);
}

/**
 * Check if surah number is the last available
 */
export function isLastAvailableSurah(reciterId: string, surahNumber: number): boolean {
  return surahNumber === getLastAvailableSurah(reciterId);
}

/**
 * Get next available surah after given surah number
 */
export function getNextAvailableSurah(reciterId: string, currentSurahNumber: number): number | null {
  const available = getAvailableSurahs(reciterId);
  const currentIndex = available.indexOf(currentSurahNumber);

  if (currentIndex === -1 || currentIndex === available.length - 1) {
    return null;
  }

  return available[currentIndex + 1];
}

/**
 * Get previous available surah before given surah number
 */
export function getPreviousAvailableSurah(reciterId: string, currentSurahNumber: number): number | null {
  const available = getAvailableSurahs(reciterId);
  const currentIndex = available.indexOf(currentSurahNumber);

  if (currentIndex <= 0) {
    return null;
  }

  return available[currentIndex - 1];
}

/**
 * Get total count of available surahs for a reciter
 */
export function getAvailableSurahCount(reciterId: string): number {
  return getAvailableSurahs(reciterId).length;
}

/**
 * Update reciter surahs data from CDN and persist to AsyncStorage
 */
export async function updateReciterSurahsFromCdn(data: ReciterSurahs): Promise<void> {
  await applyData(data);

  // Persist to AsyncStorage for next app launch
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  console.log('[ReciterSurahs] Updated and persisted to AsyncStorage');
}

/**
 * Get cached data version (for sync comparison)
 */
export function getReciterSurahsVersion(): string {
  return cachedData?.version || '0.0.0';
}

/**
 * Reset data (for testing)
 */
export function __resetReciterSurahs(): void {
  cachedData = null;
  missingSurahsMap.clear();
  isInitialized = false;
  initPromise = null;
}

/**
 * Check if initialized
 */
export function isReady(): boolean {
  return isInitialized;
}
```

---

## CDN Metadata (`backend/r2/metadata/db.json`)

Add `reciter_surahs` to the root:

```json
{
  "version": "1.0.1",
  "settings": {
    "cdn_base_url": "https://qariee-storage.y3f.me",
    "app_name": "Qariee",
    "support_email": "yousef.contact.apps@gmail.com",
    "app_version": "1.0.0",
    "min_app_version": "1.0.0"
  },
  "reciters": [
    {
      "id": "hussary",
      "name_en": "Mahmoud Khalil Al-Hussary",
      "name_ar": "محمود خليل الحصري",
      "color_primary": "#4A90E2",
      "color_secondary": "#8CB4FF"
    },
    {
      "id": "partial-reciter",
      "name_en": "Partial Reciter",
      "name_ar": "قارئ جزئي",
      "color_primary": "#E91E63",
      "color_secondary": "#F8BBD0"
    }
  ],
  "reciter_surahs": {
    "version": "1.0.0",
    "reciters": [
      {
        "id": "partial-reciter",
        "missing_surahs": [1, 5, 10, 15, 20]
      }
    ]
  }
}
```

**Note:** Increment `db.version` when `reciter_surahs` changes.

---

## Sync Service Changes (`app/src/services/syncService.ts`)

### 1. Import ReciterSurahs Type

```typescript
import { AppDatabase, Reciter, ReciterSurahs } from '../types';
import { updateReciterSurahsFromCdn, getReciterSurahsVersion } from './reciterSurahsService';
```

### 2. Update validateCdnResponse

```typescript
/**
 * Validates CDN response structure
 * Returns error message if invalid, null if valid
 */
const validateCdnResponse = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') {
    return 'invalid response: not an object';
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.version !== 'string') {
    return 'invalid response: missing version';
  }

  if (!Array.isArray(obj.reciters)) {
    return 'invalid response: missing reciters array';
  }

  // Validate each reciter has required fields
  for (const reciter of obj.reciters) {
    if (!isValidReciter(reciter)) {
      return 'invalid response: invalid reciter data';
    }
  }

  // NEW: Validate reciter_surahs if present
  if (obj.reciter_surahs !== undefined) {
    const reciterSurahsError = validateReciterSurahs(obj.reciter_surahs);
    if (reciterSurahsError) {
      return reciterSurahsError;
    }
  }

  return null;
};

/**
 * Validates reciter_surahs structure
 */
const validateReciterSurahs = (obj: unknown): string | null => {
  if (!obj || typeof obj !== 'object') {
    return 'invalid reciter_surahs: not an object';
  }

  const rs = obj as Record<string, unknown>;

  if (typeof rs.version !== 'string') {
    return 'invalid reciter_surahs: missing version';
  }

  if (!Array.isArray(rs.reciters)) {
    return 'invalid reciter_surahs: missing reciters array';
  }

  for (const item of rs.reciters) {
    if (!isValidReciterSurahs(item)) {
      return 'invalid reciter_surahs: invalid item data';
    }
  }

  return null;
};

/**
 * Validates a reciter_surahs item
 */
const isValidReciterSurahs = (obj: unknown): boolean => {
  if (!obj || typeof obj !== 'object') return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    Array.isArray(r.missing_surahs) &&
    r.missing_surahs.every((s: unknown) => typeof s === 'number')
  );
};
```

### 3. Update Sync Logic

```typescript
export const sync = async (): Promise<SyncResult> => {
  // ... existing code up to upsertReciters ...

  // Upsert reciters (transactional, safe)
  await upsertReciters(cdnData.reciters);

  // NEW: Sync reciter_surahs if present
  if (cdnData.reciter_surahs) {
    const localVersion = getReciterSurahsVersion();
    if (localVersion !== cdnData.reciter_surahs.version) {
      await updateReciterSurahsFromCdn(cdnData.reciter_surahs);
      console.log('[SyncService] Updated reciter_surahs to version', cdnData.reciter_surahs.version);
    }
  }

  // Update data version
  await setDataVersion(cdnData.version);

  // ... rest of existing code ...
};
```

---

## App Initialization (`app/app/_layout.tsx`)

Add `loadReciterSurahs()` to the initialization sequence:

```typescript
import { loadReciterSurahs } from "../src/services/reciterSurahsService"

// In the prepare() function, after fonts are loaded:
useEffect(() => {
    async function prepare() {
        try {
            // ... existing database steps ...

            // Step 4.5: Load reciter surahs availability (BLOCKING)
            // This MUST complete before allowing user interaction
            await loadReciterSurahs()

            // Step 5: Trigger background sync (debounced, non-blocking)
            requestSync()

            setIsReady(true)
        } catch (error) {
            console.error("App initialization error:", error)
            setIsReady(true)
        }
    }

    prepare()
}, [])
```

**Important:** `await loadReciterSurahs()` ensures data is loaded before the app becomes interactive. This fixes the race condition (#1).

---

## Audio Service Changes (`app/src/services/audioService.ts`)

### 1. Import Helper

```typescript
import { isSurahAvailable, getAvailableSurahs } from './reciterSurahsService';
```

### 2. Update Queue Filtering (FIXES #4)

Filter queue during construction, NOT during iteration:

```typescript
/**
 * Filter queue to only include available surahs
 */
private filterAvailableTracks(tracks: Track[]): Track[] {
  return tracks.filter(track => isSurahAvailable(track.reciterId, track.surahNumber));
}

/**
 * Play a track
 */
async play(
    track: Track,
    queue: Track[] = [],
    isNewSession: boolean = true,
) {
    if (!this.player) {
        console.error("[AudioService] ❌ play() - Player not initialized")
        throw new Error("Audio player not initialized")
    }

    this.currentTrack = track

    // NEW: Filter queue by availability BEFORE any processing
    queue = this.filterAvailableTracks(queue);

    // Filter queue based on offline status
    let filteredQueue = [...queue]
    if (this.isOffline && queue.length > 0) {
        // When offline, only include downloaded tracks in queue
        const downloadedTracks = await Promise.all(
            queue.map(async (t) => {
                const localPath = await downloadService.getLocalPath(
                    t.reciterId,
                    t.surahNumber,
                )
                return localPath ? t : null
            }),
        )
        filteredQueue = downloadedTracks.filter(
            (t): t is Track => t !== null,
        )
    }

    if (isNewSession) {
        this.originalQueue = [...filteredQueue] // Keep filtered original order for new session
        // ... rest of existing code ...
    }
    // ... rest of existing code ...
}

/**
 * Load a track without auto-playing
 */
async loadTrack(track: Track, queue: Track[] = []) {
    // ... existing code ...

    // NEW: Filter by availability first
    queue = this.filterAvailableTracks(queue);

    // ... rest of existing code ...
}
```

### 3. Remove playNext() Availability Check

No need to check availability in `playNext()` since queue is pre-filtered. The existing logic remains unchanged.

---

## Download Service Changes (`app/src/services/downloadService.ts`)

### 1. Import and Check Availability

```typescript
import { isSurahAvailable } from './reciterSurahsService';
```

### 2. Update downloadSurah Method

```typescript
async downloadSurah(
  reciterId: string,
  surahNumber: number,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  const key = this.getDownloadKey(reciterId, surahNumber);

  // NEW: Check availability BEFORE adding to queue
  if (!isSurahAvailable(reciterId, surahNumber)) {
    // Notify immediately (not in queue)
    if (onProgress) {
      onProgress({
        reciterId,
        surahNumber,
        progress: 0,
        totalBytes: 0,
        downloadedBytes: 0,
        status: 'failed',
        error: 'This surah is not available for this reciter',
      });
    }
    return; // Don't add to queue, don't save callback (FIXES #10)
  }

  // Check if already downloaded
  if (await this.isDownloaded(reciterId, surahNumber)) {
    return;
  }

  // Check if already downloading or queued
  if (this.activeDownloads.has(key) || this.downloadQueue.some(task => this.getDownloadKey(task.reciterId, task.surahNumber) === key)) {
    if (onProgress) {
      this.addProgressCallback(key, onProgress);
    }
    return;
  }

  // ... rest of existing download logic ...
}
```

**Fixes #10:** Returns early before adding callback, no leak.

**Fixes #11:** Specific error message for unavailable vs 404.

---

## UI Changes

### 1. Reciter Detail Screen (`app/app/reciter/[id].tsx`)

```typescript
import {
  getAvailableSurahs,
  getAvailableSurahCount,
  isSurahAvailable
} from '../../src/services/reciterSurahsService';

export default function ReciterDetailScreen() {
  // ... existing state ...

  // NEW: Get available surah numbers for this reciter
  const availableSurahNumbers = useMemo(() => {
    if (!reciter) return [];
    return getAvailableSurahs(reciter.id);
  }, [reciter]);

  // Update filteredSurahs to filter by availability FIRST
  const filteredSurahs = useMemo(() => {
    return surahs
      .filter((s) => availableSurahNumbers.includes(s.number))  // FIXES #9: Search only available
      .filter((surah) => {
        if (!searchQuery) return true;
        const name = getSurahName(surah).toLowerCase();
        return name.includes(searchQuery.toLowerCase());
      });
  }, [surahs, availableSurahNumbers, searchQuery]);

  // Update download stats (FIXES #16)
  const downloadedCount = filteredSurahs.filter((surah) =>
    checkDownloaded(reciter?.id || "", surah.number),
  ).length;
  const totalCount = filteredSurahs.length; // Reflects available only
  const allDownloaded = downloadedCount === totalCount && totalCount > 0;

  // NEW: Show surah count indicator
  const totalAvailable = availableSurahNumbers.length;

  // Update renderSection to fix section counts (FIXES #17)
  const renderSection = (division: (typeof QURAN_DIVISIONS)[0]) => {
    const isExpanded = expandedSections.has(division.id);
    const sectionSurahs = filteredSurahs.filter((s) =>
      division.surahNumbers.includes(s.number),
    );

    if (searchQuery && sectionSurahs.length === 0) return null;

    return (
      <View key={division.id} style={styles.section}>
        <TouchableOpacity
          /* ... existing props ... */
        >
          <Text /* ... */ >
            {t(division.nameKey)} ({sectionSurahs.length})
          </Text>
          {/* ... */}
        </TouchableOpacity>
        {/* ... */}
      </View>
    );
  };

  // Update handlePlayShuffle to work with available surahs only
  const handlePlayShuffle = async () => {
    if (!reciter || filteredSurahs.length === 0) return;

    // Check if reciter has NO available surahs (FIXES #6)
    if (availableSurahNumbers.length === 0) {
      Alert.alert(t("error"), t("no_surahs_available"));
      return;
    }

    // ... rest of existing logic using filteredSurahs ...
  };

  // Update header to show surah count (optional)
  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* ... */}
      <LinearGradient /* ... */ >
        <Image /* ... */ />
        <Text /* ... */ >
          {getReciterName()}
        </Text>
        {totalAvailable < 114 && (
          <Text style={styles.surahCount}>
            {t("surahs_count", { count: totalAvailable })}
          </Text>
        )}
      </LinearGradient>
      {/* ... */}
    </SafeAreaView>
  );
}
```

**Fixes:** #6 (empty list), #9 (search), #16 (download count), #17 (section counts)

### 2. Player Screen (`app/app/player.tsx`)

```typescript
import {
  isSurahAvailable,
  getAvailableSurahs,
  isFirstAvailableSurah,
  isLastAvailableSurah,
  getNextAvailableSurah,
  getPreviousAvailableSurah,
} from '../src/services/reciterSurahsService';

export default function PlayerScreen() {
  // ... existing state ...

  // Update first/last checks (FIXES #7)
  const isFirstSurah = currentTrack
    ? isFirstAvailableSurah(currentTrack.reciterId, currentTrack.surahNumber)
    : false;
  const isLastSurah = currentTrack
    ? isLastAvailableSurah(currentTrack.reciterId, currentTrack.surahNumber)
    : false;

  // Update handlePlayNextSurah (FIXES #5)
  const handlePlayNextSurah = async () => {
    if (!currentTrack || isProcessingTrackChange.current) return;

    // Find next AVAILABLE surah
    const nextSurahNumber = getNextAvailableSurah(
      currentTrack.reciterId,
      currentTrack.surahNumber,
    );

    if (!nextSurahNumber) return; // No next available

    isProcessingTrackChange.current = true;

    try {
      const allSurahs = await getAllSurahs();
      const nextSurah = allSurahs.find((s) => s.number === nextSurahNumber);
      if (!nextSurah) return;

      const isNextDownloaded = checkDownloaded(
        currentTrack.reciterId,
        nextSurah.number,
      );

      if (isOffline && !isNextDownloaded) {
        Alert.alert(t("offline"), t("download_required_offline"));
        return;
      }

      // Build queue with ONLY available surahs
      const availableSurahs = getAvailableSurahs(currentTrack.reciterId);
      const queue: Track[] = availableSurahs
        .filter((s) => s > nextSurahNumber)
        .map((s) => allSurahs.find((surah) => surah.number === s))
        .filter((s): s is Surah => s !== undefined)
        .map((s) => ({
          reciterId: currentTrack.reciterId,
          reciterName: currentTrack.reciterName,
          reciterColorPrimary: currentTrack.reciterColorPrimary || "#282828",
          reciterColorSecondary: currentTrack.reciterColorSecondary || "#404040",
          surahNumber: s.number,
          surahName: rtl ? s.name_ar : s.name_en,
          audioUrl: getAudioUrl(currentTrack.reciterId, s.number),
          isDownloaded: checkDownloaded(currentTrack.reciterId, s.number),
        }));

      const track: Track = {
        reciterId: currentTrack.reciterId,
        reciterName: currentTrack.reciterName,
        reciterColorPrimary: currentTrack.reciterColorPrimary || "#282828",
        reciterColorSecondary: currentTrack.reciterColorSecondary || "#404040",
        surahNumber: nextSurah.number,
        surahName: rtl ? nextSurah.name_ar : nextSurah.name_en,
        audioUrl: getAudioUrl(currentTrack.reciterId, nextSurah.number),
        isDownloaded: isNextDownloaded,
      };

      await playTrack(track, queue);
    } finally {
      isProcessingTrackChange.current = false;
    }
  };

  // Update handlePlayPreviousSurah similarly
  const handlePlayPreviousSurah = async () => {
    if (!currentTrack || isProcessingTrackChange.current) return;

    const prevSurahNumber = getPreviousAvailableSurah(
      currentTrack.reciterId,
      currentTrack.surahNumber,
    );

    if (!prevSurahNumber) return;

    // Similar logic to handlePlayNextSurah...
  };

  // ... rest of component ...
}
```

**Fixes:** #5 (next/previous logic), #7 (first/last checks), #18 (offline message still valid - unavailable surahs can't be downloaded)

---

## Translations

### `app/src/locales/en.json`

```json
{
  "surah_not_available": "This surah is not available for this reciter",
  "no_surahs_available": "No surahs are available for this reciter",
  "surahs_count": "{{count}} surahs"
}
```

### `app/src/locales/ar.json`

```json
{
  "surah_not_available": "هذه السورة غير متوفرة لهذا القارئ",
  "no_surahs_available": "لا توجد سور متوفرة لهذا القارئ",
  "surahs_count": "سورة"
}
```

---

## Design Decisions Summary

| Issue | Decision | Rationale |
|-------|----------|-----------|
| #12 Data Duplication | CDN-first with AsyncStorage fallback | Single source of truth, cached locally |
| #13 missing vs available | Use `missing_surahs` | Most reciters are nearly complete; shorter list |
| #14 Versioning | Use single `db.version` | Increment when reciter_surahs changes |
| #15 Existing Downloads | Keep playing if downloaded | User already has the file; don't delete |

**For #15:** If a surah is marked missing but user has it downloaded:
- It won't appear in the UI (filtered out)
- If currently playing, it continues to work
- New downloads blocked
- Manual delete still works

---

## Implementation Order

1. **Create JSON file** (`reciter-surahs.json` - empty)
2. **Update types** (add `ReciterSurahs`, update `AppDatabase`)
3. **Create service** (`reciterSurahsService.ts`) with all helpers
4. **Update app initialization** (blocking `loadReciterSurahs()`)
5. **Update sync service** (validation + sync logic)
6. **Update download service** (block unavailable + fix leak)
7. **Update audio service** (filter during queue construction)
8. **Update reciter detail screen** (filter surahs, fix counts)
9. **Update player screen** (next/previous with available surahs)
10. **Add translations**
11. **Comprehensive testing**

---

## Testing Checklist

- [ ] App startup with default JSON (all available)
- [ ] CDN sync updates AsyncStorage
- [ ] App restart uses cached AsyncStorage data
- [ ] Partial reciter shows only available surahs
- [ ] Search only returns available surahs
- [ ] Download blocked for unavailable surahs
- [ ] Sequential playback skips unavailable
- [ ] Shuffle mode works with partial reciters
- [ ] Next/Previous buttons respect availability
- [ ] First/Last button states correct
- [ ] Section counts reflect available surahs
- [ ] Download All shows correct counts
- [ ] Empty available list shows message
- [ ] Offline mode messages appropriate
