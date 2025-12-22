# Production Readiness Todo List

## Summary
This document combines findings from both robustness reviews to create a comprehensive todo list for making Rabi app production-ready, reliable, and robust.

## Already Fixed (During This Session)

### ✅ **Sleep Timer Synchronization**
- Added `sleepTimerEndTime` state persistence in `audioService.ts`
- Added `isSleepTimerActive()` and `getSleepTimerEndTime()` getter methods
- Added state sync on mount in `SleepTimerContext.tsx`
- Fixed timer cleanup after completion

### ✅ **Dead Code Removal**
- Removed `import * as Linking from 'expo-linking'` from `audioService.ts`
- Removed unused `updateMediaControlPosition()` method from `audioService.ts`
- Fixed type mismatch in `checkForUpdates()` function in `dataSync.ts`

### ✅ **Architecture Verification**
- Verified audio service ↔ network context integration
- Verified offline queue filtering logic
- Verified native playback event handling for background/foreground sync

---

## Critical Issues (Must Fix Before Production)

### 🚨 **1. Stack Overflow Risk in `playNext()`**
**Problem**: Current `playNext()` implementation can cause stack overflow when offline with many undownloaded tracks. Error handling pauses entire playback instead of skipping to next track.

**File**: `app/src/services/audioService.ts`

**Solution**: Replace with iterative while loop that:
- Pre-checks file existence before attempting playback when offline
- Continues to next track if current track fails to play
- Only pauses when queue is exhausted or no playable tracks found

```typescript
// Replace existing playNext() with robust version
async playNext() {
    console.log('[AudioService] 🔄 playNext() START');

    // Prevent re-entry
    if (this.isProcessingNext) return;
    this.isProcessingNext = true;

    try {
      // 1. Handle Repeat Mode
      if (this.playbackMode === 'repeat' && this.currentTrack) {
        await this.seekTo(0);
        this.player?.play();
        return;
      }

      // 2. Iterative Queue Processing (Prevent Stack Overflow)
      let nextTrack: Track | undefined;
      let playableFound = false;
      let attempts = 0;
      const MAX_ATTEMPTS = this.queue.length + 1; // Safety breaker

      // Loop until we find a playable track or exhaust the queue
      while (this.queue.length > 0 && !playableFound && attempts < MAX_ATTEMPTS) {
        attempts++;
        nextTrack = this.queue.shift();

        if (!nextTrack) break;

        // PRE-CHECK: If offline, verify file exists BEFORE trying to play
        if (this.isOffline) {
           const hasFile = await downloadService.isDownloaded(nextTrack.reciterId, nextTrack.surahNumber);
           if (!hasFile) {
             console.log(`[AudioService] ⏭️ Skipping undownloaded track in offline mode: ${nextTrack.surahName}`);
             continue; // Skip this iteration, try next track
           }
        }

        try {
          // Attempt to play
          await this.play(nextTrack, this.queue, false);
          playableFound = true; // Success!
        } catch (error) {
          console.error(`[AudioService] ❌ Failed to play ${nextTrack.surahName}, skipping...`, error);
          // Loop continues to next track automatically
        }
      }

      // 3. If queue empty or no playable tracks found
      if (!playableFound) {
        console.log('[AudioService] ⏹️ No playable tracks remaining. Stopping.');
        await this.pause();
      }

    } finally {
      this.isProcessingNext = false;
    }
}
```

### 🚨 **2. Download Deletion Race Condition**
**Problem**: User can delete a track while it's playing, causing playback to freeze or crash when player tries to buffer next chunk.

**File**: `app/src/contexts/DownloadContext.tsx`

**Solution**: Add check in `deleteDownload()` method to:
- Detect if track being deleted is currently playing
- Either stop playback or skip to next track before deletion
- Import `useAudio` hook to access current track state

```typescript
// Add to DownloadContext.tsx
import { useAudio } from './AudioContext';

// Inside DownloadProvider component, modify deleteDownload function:
const deleteDownload = async (reciterId: string, surahNumber: number) => {
  const key = getDownloadKey(reciterId, surahNumber);

  try {
    // [ROBUSTNESS CHECK] Is this track currently playing?
    if (currentTrack &&
        currentTrack.reciterId === reciterId &&
        currentTrack.surahNumber === surahNumber) {

      console.log('[DownloadContext] ⚠️ User deleting currently playing track!');

      // Option 2 (Better UX): Skip to next track before deleting
      if (isPlaying) {
          await playNext();
      }
    }

    // Proceed with deletion...
  }
  // ...
}
```

### 🚨 **3. App Foreground UI Synchronization**
**Problem**: `AudioContext` lacks robust "On App Foreground" synchronization check. If track changes while screen is off, UI may not update when app comes to foreground.

**File**: `app/src/contexts/AudioContext.tsx`

**Solution**: Add `AppState` event listener in `AudioContext` to sync state from audio service when app comes to foreground (similar to `SleepTimerContext`).

```typescript
// Add to AudioContext.tsx useEffect
useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      // App came to foreground - sync state from audio service
      syncStateFromService();
    }
  });

  return () => subscription.remove();
}, [syncStateFromService]);
```

---

## High Priority Issues

### 🔥 **4. Console.log Spam Cleanup**
**Problem**: Excessive console logging throughout codebase, especially in audio service.

**Files**: All files, especially:
- `app/src/services/audioService.ts`
- `app/src/contexts/AudioContext.tsx`
- `app/src/contexts/SleepTimerContext.tsx`

**Solution**:
- Remove non-essential console.log statements
- Keep critical error logs and warnings
- Consider implementing logging levels for development vs production
- Remove debug stack trace logging (line 94 in audioService.ts, line 580)

### 🔥 **5. Sleep Timer Final Validation**
**Problem**: Need to verify sleep timer synchronization works correctly after our fixes.

**Files**:
- `app/src/services/audioService.ts`
- `app/src/contexts/SleepTimerContext.tsx`

**Validation Steps**:
1. Set sleep timer, kill app, restart app - UI should show correct remaining time
2. Set sleep timer, let it expire in background - audio should pause and UI should update
3. Set sleep timer, cancel timer - all state should clear properly

---

## Medium Priority Issues

### ⚠️ **6. Unused Imports & Variables Cleanup**
**Problem**: Several unused imports and variables identified in code analysis.

**Files** (from review):
- `app/src/contexts/AudioContext.tsx`: `useRef`, `setAudioModeAsync`
- `app/src/components/MiniPlayer.tsx`: `useSafeAreaInsets`, `useRouter` (unused variable), `playNext` (destructured but unused)
- `app/src/components/SleepTimerModal.tsx`: `Platform`, unused `primaryColor` and `secondaryColor` props
- `app/src/components/CustomDrawer.tsx`: `ScrollView`, `DrawerContentComponentProps`
- `app/src/components/UpdateBanner.tsx`: `Linking` (commented TODO)

**Solution**: Remove unused imports and variables to reduce bundle size and improve code clarity.

### ⚠️ **7. Image Caching for Reciter Photos**
**Problem**: Missing image caching for reciter photos, causing repeated network requests.

**Files**: Components displaying reciter images

**Solution**: Implement image caching using Expo's `Image` component with cache control or third-party library like `react-native-fast-image`.

### ⚠️ **8. Responsive Design Improvements**
**Problem**: App needs better responsive design for tablets and different screen sizes.

**Files**: All UI components

**Solution**:
- Use relative units (%, flex) instead of absolute pixels
- Implement responsive breakpoints for tablet layouts
- Test on multiple device sizes

---

## Low Priority / Future Enhancements

### 📝 **9. Error Reporting**
**Problem**: No error reporting for playback failures.

**Solution**: Implement basic error logging to track playback success rates and common failures.

### 📝 **10. Battery Optimization**
**Problem**: Background timers and playback may impact battery life.

**Solution**:
- Reduce background timer precision when not needed
- Implement audio session management for battery optimization

### 📝 **11. Memory Management**
**Problem**: Audio buffers may not be cleared properly.

**Solution**: Implement proper audio buffer cleanup when tracks change or app backgrounds.

---

## Implementation Order

### Phase 1: Critical Reliability (Must Do)
1. **Fix `playNext()` stack overflow risk** - Critical for offline mode stability
2. **Fix download deletion race condition** - Prevents playback crashes
3. **Add app foreground UI sync** - Ensures UI consistency

### Phase 2: Cleanup & Polish
4. **Cleanup console.log spam** - Production readiness
5. **Remove unused imports/variables** - Code quality
6. **Remove debug stack traces** - Performance improvement
7. **Validate sleep timer fixes** - Ensure synchronization works

### Phase 3: User Experience
8. **Implement image caching** - Performance improvement
9. **Improve responsive design** - Better tablet support

### Phase 4: Monitoring & Optimization
10. **Add error reporting** - Production monitoring
11. **Battery optimization** - User experience
12. **Memory management** - Long-term stability

---

## Testing Checklist

### Audio Playback
- [ ] Sequential mode with online/offline transitions
- [ ] Shuffle mode with history tracking
- [ ] Repeat mode seeking vs replace efficiency
- [ ] Queue rebuilding when offline status changes
- [ ] Background/foreground transitions
- [ ] Native media control integration

### Sleep Timer
- [ ] Timer works when screen is off
- [ ] UI sync on app restart
- [ ] Fade-out functionality
- [ ] Timer cancellation
- [ ] Volume restoration after timer

### Error Handling
- [ ] Offline playback of undownloaded tracks
- [ ] Network loss during streaming
- [ ] Corrupted audio files
- [ ] Delete while playing protection
- [ ] `playNext()` error recovery

### State Persistence
- [ ] Listening session save/restore
- [ ] Playback mode persistence
- [ ] Played tracks history
- [ ] Queue state across app restarts

---

## Success Metrics

### Reliability
- No crashes during 24-hour playback test
- 99% success rate for track transitions
- Proper error recovery for all edge cases

### Performance
- < 2 second playback startup time
- < 100ms track transition time
- Memory usage stable during 8-hour playback

### User Experience
- UI always in sync with actual playback state
- Smooth background/foreground transitions
- Accurate sleep timer countdown
- Offline mode works seamlessly

---

## Notes

### Already Completed Work
- Sleep timer synchronization fixes
- Dead code removal (`Linking` import, `updateMediaControlPosition()`)
- `dataSync.ts` type mismatch fix
- Architecture verification

### Code Review Findings Addressed
- ✅ Sleep timer duplicate state fixed
- ✅ Unused imports partially cleaned up
- ❌ `playNext()` error handling needs improvement
- ❌ Download deletion race condition needs fixing
- ❌ App foreground sync needs implementation

This todo list represents the minimum work needed to make Rabi app production-ready with reliable, robust audio playback.