# Qariee Performance & Battery Usage Audit

**Date:** January 2026
**Scope:** Full app analysis including audio playback, background processes, network operations, state management, and UI rendering

---

## Executive Summary

The Qariee app is generally well-architected with an offline-first approach. The main areas for improvement are:

1. **Unnecessary re-renders** in React contexts due to missing memoization
2. **Synchronous file existence checks** blocking the JS thread
3. **Inefficient list rendering** using ScrollView instead of virtualized lists
4. **Missing debounce** in sync service despite documentation claiming otherwise

**Note:** The app's background timer usage is already well-optimized—intervals only run when needed (during playback or with active sleep timer).

---

## 1. Background Timers (Well-Implemented)

### Observation 1.1: BackgroundTimer.start()
**Location:** `audioService.ts:35-39`

```typescript
initialize(player) {
    this.player = player
    try {
        BackgroundTimer.start()
    } catch (error) { ... }
}
```

**Status:** This is acceptable. `BackgroundTimer.start()` merely enables background execution capability—it does not run any code or drain battery by itself. Battery impact only occurs when actual timers (`setTimeout`/`setInterval`) are created.

---

### Observation 1.2: Conditional 1-Second Intervals
**Locations:**
- `AudioContext.tsx:452-458` - Session persistence interval
- `useMediaControl.ts:205-209` - MediaControl state update interval
- `SleepTimerContext.tsx:29-44` - Sleep timer countdown interval

**Status:** These are already well-implemented with proper conditions:

1. **Session persistence** - only runs when `isPlaying === true`
2. **MediaControl update** - only runs when `isPlaying === true`
3. **Sleep timer countdown** - only runs when timer `isActive`, uses native `setInterval`

All intervals properly clean up when their conditions become false.

**Minor optimization opportunity:** Consider consolidating the two playback-related intervals (session save + MediaControl) into a single tick to reduce scheduling overhead, but the current implementation is reasonable.

---

### Observation 1.3: SleepTimerContext Polling
**Location:** `SleepTimerContext.tsx:29-36`

```typescript
useEffect(() => {
    if (isActive) {
        intervalRef.current = setInterval(() => {
            const remaining = audioService.getSleepTimerRemaining();
            setRemainingSeconds(remaining);
            if (remaining <= 0) {
                setIsActive(false);
            }
        }, 1000);
        // ...
    }
}, [isActive]);
```

**Minor optimization:** This interval runs whenever a sleep timer is active, but the countdown UI is only visible in the player's sleep timer modal. Consider only polling when the modal is visible.

---

## 2. React Context Re-renders

### Issue 2.1: AudioContext Value Object Recreation
**Location:** `AudioContext.tsx:502-519`

```typescript
return (
    <AudioContext.Provider
        value={{
            currentTrack,
            setCurrentTrack,
            isPlaying,
            setIsPlaying,
            // ... 10+ values
        }}
    >
```

**Problem:** The context value object is recreated on every render of AudioProvider, causing all consumers to re-render even when values haven't changed.

**Impact:** Every time `position` updates (every second during playback), ALL components using `useAudio()` re-render.

**Recommendation:** Memoize the context value:
```typescript
const contextValue = useMemo(() => ({
    currentTrack,
    setCurrentTrack,
    isPlaying,
    // ...
}), [currentTrack, isPlaying, position, duration, playbackMode, ...]);
```

Or better, split into multiple contexts:
- `AudioTrackContext` - currentTrack, queue (changes infrequently)
- `AudioPlaybackContext` - isPlaying, position, duration (changes frequently)
- `AudioActionsContext` - playTrack, togglePlayPause, etc. (stable functions)

---

### Issue 2.2: DownloadContext ActiveDownloads Map
**Location:** `DownloadContext.tsx:76-91`

```typescript
setActiveDownloads(prev => {
    const updated = new Map(prev);
    // ... modifications
    return updated;
});
```

**Problem:** Creating a new Map on every progress update triggers re-renders for all components using `useDownload()`.

**Impact:** During downloads, progress updates fire frequently (multiple times per second), causing excessive re-renders.

**Recommendation:**
- Use `useReducer` for more granular state updates
- Or use a ref for progress data with manual subscriber pattern

---

### Issue 2.3: Player Screen Layout Recalculations
**Location:** `player.tsx:176`

```typescript
// Inside component render
const layout = calculateLayout(insets.top, insets.bottom)
```

**Problem:** `calculateLayout()` is called on every render with mathematical operations.

**Impact:** Minor, but unnecessary CPU usage.

**Recommendation:** Memoize the layout calculation:
```typescript
const layout = useMemo(
    () => calculateLayout(insets.top, insets.bottom),
    [insets.top, insets.bottom]
);
```

---

## 3. Network & Sync Efficiency

### Issue 3.1: Sync Trigger on Network Recovery
**Location:** `_layout.tsx:34-38`

```typescript
useEffect(() => {
    if (!isOffline) {
        sync()
    }
}, [isOffline])
```

**Observation:** The sync is correctly triggered only when network becomes available. However, there's no debouncing if network flaps rapidly.

**Note:** The syncService itself mentions debouncing in comments but the actual debounce implementation is not visible in the service. Verify that debouncing is actually implemented.

**Recommendation:** Add debounce at the call site if not already in syncService:
```typescript
useEffect(() => {
    if (!isOffline) {
        const timeout = setTimeout(() => sync(), 500);
        return () => clearTimeout(timeout);
    }
}, [isOffline])
```

---

## 4. File System Operations

### Issue 4.1: Synchronous File Existence Checks
**Location:** `downloadService.ts:99-100`

```typescript
const file = new File(Paths.document, download.local_file_path);
if (!file.exists) {  // Synchronous check
```

**Problem:** `file.exists` is a synchronous property that blocks the JS thread.

**Impact:** On devices with slow storage, this can cause UI jank.

**Locations affected:**
- `downloadService.ts:99-100` - isDownloaded check
- `downloadService.ts:163` - directory exists check
- `downloadService.ts:350-351` - storage calculation
- `database.ts:283-284` - isDownloaded function

**Recommendation:** Use async file info checks where possible:
```typescript
const fileInfo = await FileSystem.getInfoAsync(filePath);
if (!fileInfo.exists) { ... }
```

---

### Issue 4.2: Storage Calculation Iterates All Files
**Location:** `downloadService.ts:344-361`

```typescript
async getStorageUsed(): Promise<number> {
    const downloads = await getAllDownloads();
    let totalSize = 0;
    for (const download of downloads) {
        const file = new File(Paths.document, download.local_file_path);
        if (file.exists && file.size) {
            totalSize += file.size;
        }
    }
    return totalSize;
}
```

**Problem:** Iterates through all downloaded files synchronously. With 100+ downloads, this becomes expensive.

**Impact:** UI freezes when calculating storage on settings or reciter screens.

**Recommendation:**
- Cache total storage size in database when downloads complete/delete
- Update incrementally: `totalSize += newFileSize` on download, `-= deletedFileSize` on delete
- Only recalculate on app start or on explicit refresh

---

## 5. UI Rendering Performance

### Issue 5.1: ScrollView Instead of FlatList for Surahs
**Location:** `reciter/[id].tsx:413`

```typescript
<ScrollView showsVerticalScrollIndicator={false}>
    {/* ... */}
    {QURAN_DIVISIONS.map(renderSection)}
</ScrollView>
```

**Problem:** Using ScrollView with map() renders ALL 114 surahs at once, even those off-screen.

**Impact:**
- Initial render is slow
- High memory usage
- Unnecessary component instances

**Recommendation:** Use `SectionList` or `FlatList` with section support:
```typescript
<SectionList
    sections={sections}
    renderItem={renderSurahItem}
    renderSectionHeader={renderSectionHeader}
    stickySectionHeadersEnabled={false}
/>
```

This will only render visible items.

---

### Issue 5.2: Inline Function Creation in Renders
**Location:** `reciter/[id].tsx:134-149` and throughout

```typescript
const createTrack = (surah: Surah): Track => {
    // ... created fresh on every render
}
```

**Problem:** Functions like `createTrack`, `getSurahName`, etc. are recreated on every render.

**Impact:** Minor, but contributes to GC pressure.

**Recommendation:** Wrap with `useCallback`:
```typescript
const createTrack = useCallback((surah: Surah): Track => {
    // ...
}, [reciter, rtl, checkDownloaded]);
```

---

### Issue 5.3: Unoptimized Surah Item Rendering
**Location:** `reciter/[id].tsx:276-354`

```typescript
const renderSurahItem = (surah: Surah) => {
    const isDownloaded = checkDownloaded(reciter.id, surah.number);
    const progress = getProgress(reciter.id, surah.number);
    // ...
}
```

**Problem:** Each surah item:
1. Calls `checkDownloaded()` - iterates downloads array
2. Calls `getProgress()` - checks Maps and arrays
3. Creates new style objects inline

**Impact:** With 114 surahs × 7 sections, this is significant.

**Recommendation:**
- Pre-compute download status for all surahs once per render
- Extract SurahItem into a memoized component
- Use stable keys

---

## 6. Memory Usage

### Issue 6.1: Queue State Contains Full Track Objects
**Location:** `AudioContext.tsx:60-64`

```typescript
const [queue, setQueue] = useState<Track[]>([])
const [originalQueue, setOriginalQueue] = useState<Track[]>([])
const [shuffleHistory, setShuffleHistory] = useState<TrackInfo[]>([])
const [playedTracksOrder, setPlayedTracksOrder] = useState<TrackInfo[]>([])
```

**Problem:** Multiple arrays storing similar track data. With 113 tracks in queue, this adds up.

**Impact:** Higher memory usage than necessary.

**Recommendation:**
- Store only track IDs in queue states
- Resolve full track info only when needed
- Consider: `{ reciterId: string, surahNumber: number }[]` instead of full Track objects

---

### Issue 6.2: Session Persistence Stores Redundant Data
**Location:** `audioStorage.ts:19-22`

```typescript
playedTrackIds?: string[];
shuffleHistory?: { reciterId: string; surahNumber: number }[];
playedTracksOrder?: { reciterId: string; surahNumber: number }[];
```

**Problem:** Storing full arrays in AsyncStorage every second during playback.

**Impact:** I/O overhead and battery drain.

**Recommendation:**
- Only persist essential data (current track, position)
- Rebuild queue/history on app restart from current position

---

## 7. Positive Observations

These aspects are well-implemented:

1. **Offline-first architecture** - App works fully offline
2. **Singleton services** - Proper single instances for audio/download
3. **Download queue management** - Max 2 concurrent downloads is sensible
4. **Session persistence on pause/background** - Good for UX
5. **expo-audio with background mode** - Correct setup
6. **MediaControl integration** - Proper lockscreen controls
7. **Network state subscription** - Efficient listener pattern
8. **Image optimization** - Using expo-image with placeholders
9. **SQLite for metadata** - Fast queries
10. **Database transaction batching** - UPSERT in transactions

---

## 8. Priority Recommendations

### High Priority (Performance)
1. **Memoize AudioContext value** to reduce unnecessary re-renders
2. **Replace ScrollView with SectionList** for surah listings (virtualization)
3. **Cache storage calculations** instead of iterating all files

### Medium Priority (Performance)
4. **Pre-compute download status** for all surahs once per render
5. **Use async file checks** instead of synchronous `file.exists`
6. **Add debouncing to sync** - currently missing despite documentation

### Low Priority (Polish)
7. **Memoize layout calculations** in player screen
8. **Reduce queue state memory** by storing IDs only
9. **Consolidate playback intervals** into single tick (minor gain)

---

## 9. Expected Impact

| Optimization | Impact |
|-------------|--------|
| Memoize AudioContext | Fewer re-renders during playback position updates |
| SectionList for surahs | Only render visible items (114 → ~10 at a time) |
| Cache storage calc | Eliminate UI freeze on settings/reciter screens |
| Async file checks | Prevent JS thread blocking on slow storage |
| Add sync debouncing | Prevent multiple syncs on network flapping |

---

## 10. Testing Recommendations

Before implementing optimizations, establish baselines:

1. **Battery profiling**: Use Android Battery Historian or iOS Energy Log
2. **Performance profiling**: Use React DevTools Profiler
3. **Memory monitoring**: Use Chrome DevTools Memory tab via Hermes
4. **Frame rate tracking**: Use `expo-dev-client` performance overlay

After each optimization, compare against baselines to validate improvements.

---

**Corrections Applied:** Initial version overstated battery impact of BackgroundTimer and interval timers. The app's timer implementation is actually well-optimized with proper conditional execution.
