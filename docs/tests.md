# Rabi App - Manual Validation Tests

This document contains manual tests to validate core functionality and reliability of the Rabi Quran app. Each test should be performed by the user to ensure the app works correctly in real-world scenarios.

## Unit Test Coverage Summary

The following tests have automated unit test coverage (88 tests total, 68 passing):

### ✅ Covered by Unit Tests
- **AudioService core logic**: `playNext()`, `playPrevious()`, `setPlaybackMode()`, `shuffleWithHistory()`, `rebuildQueue()` methods
- **DownloadService**: `isDownloaded()`, `getLocalPath()`, `initialize()`, queue management, progress tracking
- **AudioStorage**: `savePlaybackMode()`/`loadPlaybackMode()`, `saveListeningSession()`/`loadListeningSession()`
- **Network state handling**: `setOfflineStatus()`, queue filtering for offline mode
- **Playback modes**: Sequential, shuffle, repeat logic

### ⚠️ Partially Covered
- **Audio playback**: Basic methods (`play()`, `pause()`, `resume()`, `seekTo()`) have unit tests but require native audio player integration
- **Sleep timer**: Logic tested but requires background timer integration

### ❌ Requires Manual Testing
- **UI synchronization**: Requires actual UI rendering
- **Media controls & notifications**: Requires native platform integration
- **Background playback**: Requires actual background execution
- **Network switching**: Requires actual network state changes
- **App lifecycle**: Some state restoration tested, but full app restart requires manual test

See `unit-testing-strategy.md` for detailed mapping of unit tests to business logic.

## Test Categories

### 1. Audio Playback & Background Operation
### 2. Sleep Timer Reliability
### 3. Offline Download & Playback
### 4. Playback Modes (Sequential, Shuffle, Repeat)
### 5. UI State Synchronization
### 6. Media Controls & Notifications
### 7. Network State Handling
### 8. App Lifecycle & State Restoration

---

## 1. Audio Playback & Background Operation

**Objective:** Verify audio plays reliably and continues in background.

### 1.1 Basic Playback
- [ ] Start playing a surah (Partially Unit Tested - play() method)
- [ ] Verify audio plays through speakers/headphones (Manual Testing Required - hardware output)
- [ ] Adjust volume using device buttons - audio should respond (Manual Testing Required - hardware integration)
- [ ] Seek forward/backward using player controls (Partially Unit Tested - seekTo() method)
- [ ] Pause and resume playback (Partially Unit Tested - pause()/resume() methods)

### 1.2 Background Playback
- [ ] Start playing a surah (Manual Testing Required - background execution)
- [ ] Press home button (send app to background) (Manual Testing Required - background execution)
- [ ] Verify audio continues playing (Manual Testing Required - background execution)
- [ ] Lock device screen (Manual Testing Required - background execution)
- [ ] Verify audio continues playing (Manual Testing Required - background execution)
- [ ] Use media controls (lock screen/notification) to pause/resume (Manual Testing Required - media controls integration)

### 1.3 App Switching
- [ ] Start playing a surah (Manual Testing Required - UI synchronization)
- [ ] Switch to another app (e.g., browser) (Manual Testing Required - app switching)
- [ ] Verify audio continues playing (Manual Testing Required - background execution)
- [ ] Return to Rabi app (Manual Testing Required - UI synchronization)
- [ ] Verify player UI shows correct track and position (Manual Testing Required - UI synchronization)

### 1.4 Interruptions
- [ ] Start playing a surah (Manual Testing Required - native interruptions)
- [ ] Receive a phone call (Manual Testing Required - native interruptions)
- [ ] Audio should pause automatically (Manual Testing Required - native interruptions)
- [ ] End phone call (Manual Testing Required - native interruptions)
- [ ] Audio should resume automatically (or can be resumed manually) (Manual Testing Required - native interruptions)
- [ ] Test with other audio apps (e.g., play music in Spotify, then switch to Rabi) (Manual Testing Required - native interruptions)

---

## 2. Sleep Timer Reliability

**Objective:** Verify sleep timer works correctly in all states.

### 2.1 Basic Sleep Timer
- [ ] Set sleep timer for 1 minute (Partially Unit Tested - setSleepTimer() logic)
- [ ] Verify UI shows remaining time (Manual Testing Required - UI update)
- [ ] Let timer expire - audio should fade out and pause (Partially Unit Tested - fadeOut() logic, actual expiration manual)
- [ ] UI should update to show timer inactive (Manual Testing Required - UI update)

### 2.2 Sleep Timer in Background
- [ ] Set sleep timer for 2 minutes (Manual Testing Required - background execution)
- [ ] Send app to background (Manual Testing Required - background execution)
- [ ] Wait for timer to expire (Manual Testing Required - background execution)
- [ ] Audio should fade out and pause (even with app in background) (Manual Testing Required - background execution)
- [ ] Return to app - UI should show timer inactive (Manual Testing Required - background execution & UI update)

### 2.3 Sleep Timer Cancellation
- [ ] Set sleep timer for 5 minutes (Partially Unit Tested - setSleepTimer() logic)
- [ ] Cancel timer after 1 minute (Partially Unit Tested - clearSleepTimer() logic)
- [ ] Audio should continue playing at normal volume (Partially Unit Tested - volume reset logic)
- [ ] UI should update immediately (Manual Testing Required - UI update)

### 2.4 App Restart with Active Timer
- [ ] Set sleep timer for 10 minutes (Partially Unit Tested - setSleepTimer() logic)
- [ ] Force quit the app (Manual Testing Required - app lifecycle)
- [ ] Reopen the app (Manual Testing Required - app lifecycle)
- [ ] UI should show correct remaining time (Manual Testing Required - UI update & persistence)
- [ ] Timer should still be active and expire correctly (Partially Unit Tested - timer persistence logic, expiration manual)

### 2.5 Multiple Timer Operations
- [ ] Set timer for 5 minutes (Partially Unit Tested - setSleepTimer() logic)
- [ ] Change to 10 minutes before 5 minutes elapse (Partially Unit Tested - clearSleepTimer() + setSleepTimer() logic)
- [ ] Timer should reset to 10 minutes (Partially Unit Tested - timer logic)
- [ ] Cancel and set new timer multiple times (Partially Unit Tested - clearSleepTimer() + setSleepTimer() logic)

---

## 3. Offline Download & Playback

**Objective:** Verify downloads work and playback functions offline.

### 3.1 Single Surah Download
- [ ] Go to reciter detail page (Manual Testing Required - UI navigation)
- [ ] Download a single surah (tap download icon) (Partially Unit Tested - downloadSurah() method)
- [ ] Verify progress indicator shows correctly (Manual Testing Required - UI progress)
- [ ] Wait for download to complete (Partially Unit Tested - download completion logic)
- [ ] Verify checkmark appears (Manual Testing Required - UI update)
- [ ] Turn on airplane mode (Manual Testing Required - network state change)
- [ ] Try to play the downloaded surah - should work (Partially Unit Tested - isDownloaded() & getLocalPath() methods)
- [ ] Try to play non-downloaded surah - should show error/be disabled (Partially Unit Tested - offline validation logic)

### 3.2 Batch Download/Delete
- [ ] Tap "Download All" on reciter page (Partially Unit Tested - queue management)
- [ ] Verify progress shows for multiple surahs (Manual Testing Required - UI progress)
- [ ] Cancel some downloads mid-way (Partially Unit Tested - cancelDownload() method)
- [ ] Delete some downloaded surahs while others are downloading (Partially Unit Tested - deleteDownload() method, race condition handling)
- [ ] Verify no crashes or weird states (Partially Unit Tested - error handling)

### 3.3 Offline Playback Modes
- [ ] Download multiple surahs from a reciter (Partially Unit Tested - download service)
- [ ] Go offline (Manual Testing Required - network state change)
- [ ] Test sequential playback - should only play downloaded surahs (Unit Tested - rebuildQueue() offline filtering)
- [ ] Test shuffle playback - should only shuffle downloaded surahs (Unit Tested - rebuildQueue() offline filtering + shuffle algorithm)
- [ ] Test repeat mode - should repeat current downloaded surah (Unit Tested - repeat mode logic)

### 3.4 Download During Playback
- [ ] Start playing a surah (Partially Unit Tested - play() method)
- [ ] While playing, download another surah from same reciter (Partially Unit Tested - download during playback race condition)
- [ ] Verify playback continues uninterrupted (Manual Testing Required - audio continuity)
- [ ] Delete currently playing surah (Partially Unit Tested - deleteDownload race condition handling)
- [ ] App should skip to next track (if available) or stop gracefully (Partially Unit Tested - playNext() logic)

### 3.5 Storage Management
- [ ] Download many surahs (Partially Unit Tested - download service)
- [ ] Check storage usage in settings (Manual Testing Required - UI display)
- [ ] Delete some surahs (Partially Unit Tested - deleteDownload() method)
- [ ] Verify storage usage decreases (Partially Unit Tested - storage calculation logic)

---

## 4. Playback Modes (Sequential, Shuffle, Repeat)

**Objective:** Verify all playback modes work correctly.

### 4.1 Sequential Mode
- [ ] Play first surah in a reciter's list (Partially Unit Tested - play() method)
- [ ] Let it finish - should auto-advance to next surah (Unit Tested - playNext() on track finish)
- [ ] Use next button - should go to next surah in order (Unit Tested - playNext() sequential mode)
- [ ] Use previous button - should go to previous surah (Unit Tested - playPrevious() method)
- [ ] Verify at end of list, next button does nothing (or stops) (Unit Tested - hasNext() & isLastTrack() logic)

### 4.2 Shuffle Mode
- [ ] Set playback mode to shuffle (Unit Tested - setPlaybackMode() method)
- [ ] Play a surah (Partially Unit Tested - play() method)
- [ ] Use next button - should play random surah (not in recent history) (Unit Tested - playNext() shuffle mode + shuffleWithHistory())
- [ ] Play 10 surahs in shuffle mode (Unit Tested - shuffle algorithm)
- [ ] Verify no repeats within recent 5 surahs (shuffle history) (Unit Tested - shuffleWithHistory() algorithm)
- [ ] Verify shuffle history is maintained after app restart (Partially Unit Tested - shuffle history persistence)

### 4.3 Repeat Mode
- [ ] Set playback mode to repeat (Unit Tested - setPlaybackMode() method)
- [ ] Play a surah (Partially Unit Tested - play() method)
- [ ] Let it finish - should replay same surah from beginning (Unit Tested - playNext() repeat mode)
- [ ] Use next button - should replay same surah (Unit Tested - playNext() repeat mode)
- [ ] Use previous button - should replay same surah (Unit Tested - playPrevious() in repeat mode)

### 4.4 Mode Switching During Playback
- [ ] Start in sequential mode, play a few surahs (Partially Unit Tested - play() method)
- [ ] Switch to shuffle mode - next track should be random (Unit Tested - setPlaybackMode() method)
- [ ] Switch to repeat mode - current track should repeat (Unit Tested - setPlaybackMode() method)
- [ ] Switch back to sequential - should continue from current position in queue (Unit Tested - setPlaybackMode() method)

### 4.5 Offline Mode Integration
- [ ] Download surahs 1, 3, 5 from a reciter (Partially Unit Tested - downloadSurah() method)
- [ ] Go offline (Manual Testing Required - network state change)
- [ ] Test sequential mode - should play 1, then 3, then 5 (Unit Tested - rebuildQueue() offline filtering)
- [ ] Test shuffle mode - should shuffle 1, 3, 5 (Unit Tested - rebuildQueue() offline filtering + shuffle algorithm)
- [ ] Test repeat mode - should repeat current downloaded surah (Unit Tested - repeat mode logic with offline filtering)

---

## 5. UI State Synchronization

**Objective:** Verify UI always shows correct state.

### 5.1 Background State Updates
- [ ] Start playing a surah (Partially Unit Tested - play() method)
- [ ] Send app to background (Manual Testing Required - background execution)
- [ ] Use media controls to change track (Partially Unit Tested - media control integration)
- [ ] Return to app - UI should show new track and position (Manual Testing Required - UI synchronization)

### 5.2 Screen Off/On
- [ ] Start playing a surah (Partially Unit Tested - play() method)
- [ ] Turn screen off (Manual Testing Required - hardware interaction)
- [ ] Wait 30 seconds (Manual Testing Required - time passage)
- [ ] Turn screen on - player UI should show updated position (Manual Testing Required - UI synchronization)

### 5.3 App Foreground Sync
- [ ] Start playing a surah (Partially Unit Tested - play() method)
- [ ] Switch to another app for 1 minute (Manual Testing Required - app switching)
- [ ] Return to Rabi app (Manual Testing Required - app switching)
- [ ] Player UI should show correct current time (not stale) (Manual Testing Required - UI synchronization)

### 5.4 Mini Player Sync
- [ ] Play a surah from reciter detail page (Partially Unit Tested - play() method)
- [ ] Navigate to other screens (home, settings) (Manual Testing Required - UI navigation)
- [ ] Verify mini player shows correct track and progress (Manual Testing Required - UI rendering)
- [ ] Use mini player controls (play/pause) - should work (Manual Testing Required - UI interaction)

### 5.5 Player Screen Sync
- [ ] Open full player screen (Manual Testing Required - UI navigation)
- [ ] Verify all information matches mini player (Manual Testing Required - UI rendering)
- [ ] Use controls on player screen (Manual Testing Required - UI interaction)
- [ ] Return to previous screen - mini player should reflect changes (Manual Testing Required - UI synchronization)

---

## 6. Media Controls & Notifications

**Objective:** Verify lock screen/notification controls work.

### 6.1 Lock Screen Controls
- [ ] Start playing a surah (Partially Unit Tested - play() method)
- [ ] Lock device (Manual Testing Required - hardware interaction)
- [ ] Wake screen (don't unlock) (Manual Testing Required - hardware interaction)
- [ ] Verify notification shows with correct track info (Manual Testing Required - notification rendering)
- [ ] Use play/pause, next, previous buttons - should work (Partially Unit Tested - media control integration)

### 6.2 Notification Controls
- [ ] Start playing a surah (Partially Unit Tested - play() method)
- [ ] Swipe down notification shade (Manual Testing Required - OS interaction)
- [ ] Verify notification shows with artwork and controls (Manual Testing Required - notification rendering)
- [ ] Use notification controls (Partially Unit Tested - media control integration)

### 6.3 Notification Accuracy
- [ ] Change track using in-app controls (Partially Unit Tested - play()/playNext() methods)
- [ ] Verify notification updates within 1 second (Manual Testing Required - notification update timing)
- [ ] Seek within track (Partially Unit Tested - seekTo() method)
- [ ] Verify notification progress updates (Manual Testing Required - notification update)

### 6.4 Notification Persistence
- [ ] Start playing, then force quit app (Partially Unit Tested - play() method, manual app quit)
- [ ] Notification should disappear (or show stopped state) (Manual Testing Required - notification behavior)
- [ ] Restart app, resume playback (Manual Testing Required - app lifecycle)
- [ ] Notification should reappear (Manual Testing Required - notification behavior)

---

## 7. Network State Handling

**Objective:** Verify app handles network changes gracefully.

### 7.1 Online → Offline Transition
- [ ] Start streaming a surah (Partially Unit Tested - play() method with streaming)
- [ ] Turn on airplane mode mid-playback (Manual Testing Required - network state change)
- [ ] App should handle gracefully (pause, show error, or continue if buffered) (Unit Tested - setOfflineStatus() logic)
- [ ] Try to play non-downloaded surah - should show appropriate message (Unit Tested - offline validation logic)

### 7.2 Offline → Online Transition
- [ ] Go offline, try to play non-downloaded surah (should fail) (Unit Tested - offline validation logic)
- [ ] Turn off airplane mode (Manual Testing Required - network state change)
- [ ] Try to play same surah - should now work (Unit Tested - play() method with streaming)
- [ ] Verify download buttons re-enable when online (Manual Testing Required - UI update)

### 7.3 Network Switching
- [ ] Start streaming on WiFi (Partially Unit Tested - play() method with streaming)
- [ ] Disable WiFi (switch to cellular) (Manual Testing Required - network state change)
- [ ] Playback should continue if buffered, or reconnect (Manual Testing Required - network resilience)
- [ ] Test opposite (cellular → WiFi) (Manual Testing Required - network state change)

---

## 8. App Lifecycle & State Restoration

**Objective:** Verify app restores state correctly after being killed.

### 8.1 Basic State Restoration
- [ ] Play a surah, pause at 30 seconds (Partially Unit Tested - play()/pause() methods)
- [ ] Force quit the app (Manual Testing Required - app lifecycle)
- [ ] Reopen the app (Manual Testing Required - app lifecycle)
- [ ] Should restore to same surah at ~30 seconds position (Unit Tested - saveListeningSession()/loadListeningSession())
- [ ] Playback should be paused (Unit Tested - playback state persistence)

### 8.2 Queue Restoration
- [ ] Play a surah with queue (multiple surahs remaining) (Partially Unit Tested - play() method with queue)
- [ ] Force quit the app (Manual Testing Required - app lifecycle)
- [ ] Reopen the app (Manual Testing Required - app lifecycle)
- [ ] Verify queue is restored (next surahs should be correct) (Unit Tested - queue persistence in ListeningSession)

### 8.3 Playback Mode Restoration
- [ ] Set shuffle mode, play a few surahs (Unit Tested - setPlaybackMode() method)
- [ ] Force quit the app (Manual Testing Required - app lifecycle)
- [ ] Reopen the app (Manual Testing Required - app lifecycle)
- [ ] Should still be in shuffle mode with correct shuffle history (Unit Tested - playback mode persistence + shuffle history persistence)

### 8.4 Sleep Timer Restoration
- [ ] Set sleep timer for 5 minutes (Partially Unit Tested - setSleepTimer() logic)
- [ ] Force quit the app (Manual Testing Required - app lifecycle)
- [ ] Reopen after 1 minute (Manual Testing Required - app lifecycle)
- [ ] UI should show ~4 minutes remaining (Unit Tested - sleep timer persistence)
- [ ] Timer should still expire correctly (Partially Unit Tested - timer persistence logic, expiration manual)

### 8.5 Low Memory Handling
- [ ] Play audio, open other memory-intensive apps (Manual Testing Required - system interaction)
- [ ] Let system kill Rabi app in background (Manual Testing Required - system behavior)
- [ ] Return to Rabi app (Manual Testing Required - app lifecycle)
- [ ] Should restore state correctly (Unit Tested - state persistence, manual app lifecycle)

---

## 9. Edge Cases & Stress Tests

### 9.1 Rapid User Actions
- [ ] Rapidly tap play/pause button 10 times (Partially Unit Tested - togglePlayPause() race condition handling)
- [ ] Rapidly switch playback modes (Partially Unit Tested - setPlaybackMode() method)
- [ ] Rapidly seek forward/backward (Partially Unit Tested - seekTo() method)
- [ ] App should not crash or become unresponsive (Manual Testing Required - UI responsiveness)

### 9.2 Multiple Reciters
- [ ] Start playing from one reciter (Partially Unit Tested - play() method)
- [ ] Switch to different reciter mid-playback (Partially Unit Tested - play() method with different reciter)
- [ ] Verify clean transition, no audio glitches (Manual Testing Required - audio continuity)

### 9.3 Very Long Sessions
- [ ] Play entire reciter's collection (114 surahs) (Partially Unit Tested - playNext() loop handling)
- [ ] Let it run for 1+ hours (Manual Testing Required - time passage)
- [ ] Verify no memory leaks, crashes, or playback issues (Manual Testing Required - system stability)

### 9.4 Battery Saver Mode
- [ ] Enable battery saver/ low power mode (Manual Testing Required - system settings)
- [ ] Test playback and background operation (Manual Testing Required - system behavior)
- [ ] Some features may be limited (expected) (Manual Testing Required - feature verification)

---

## Testing Notes

- **Test Devices:** Test on multiple devices (different iOS/Android versions)
- **Test Environments:** Test with good/poor network conditions
- **Document Failures:** Note any failures with exact steps to reproduce
- **Performance:** Note any UI lag, audio glitches, or battery drain issues

## Success Criteria

All tests should pass without:
- App crashes
- Audio glitches or stutters
- UI showing incorrect state
- Memory leaks
- Excessive battery drain