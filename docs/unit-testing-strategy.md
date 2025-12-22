# Unit Testing Strategy for Rabi App

## Overview
This document outlines which tests from `tests.md` can be automated as unit tests vs. which require manual testing. The goal is to create automated unit tests for core business logic while leaving UI and integration tests for manual validation.

## Test Categories Analysis

### 1. Audio Playback & Background Operation (tests.md section 1)
**Unit Testable:**
- AudioService.play() method - track loading and playback initiation
- AudioService.pause()/resume() methods
- AudioService.togglePlayPause() method
- AudioService.seekTo() method
- AudioService.setVolume()/getVolume() methods

**Requires Manual Testing:**
- Actual audio output through speakers/headphones
- Background playback (requires real device/background)
- Interruptions (phone calls, other audio apps)
- Device volume button integration

### 2. Sleep Timer Reliability (tests.md section 2)
**Unit Testable:**
- AudioService.setSleepTimer() logic
- AudioService.clearSleepTimer() logic
- AudioService.isSleepTimerActive() method
- AudioService.getSleepTimerEndTime() method
- AudioService.fadeOut() volume reduction logic
- Timer persistence calculations

**Requires Manual Testing:**
- Actual timer expiration in background
- Audio fade-out perception
- App restart with active timer (requires storage)
- Lock screen/notification updates

### 3. Offline Download & Playback (tests.md section 3)
**Unit Testable:**
- DownloadService.isDownloaded() method
- DownloadService.getLocalPath() method
- DownloadService.initialize() directory creation
- AudioService.rebuildQueue() offline filtering logic
- Queue filtering based on downloaded tracks

**Requires Manual Testing:**
- Actual file download progress
- Network failure handling
- Storage space management
- Download cancellation UI

### 4. Playback Modes (tests.md section 4)
**Highly Unit Testable (CORE BUSINESS LOGIC):**
- AudioService.setPlaybackMode() and queue rebuilding
- AudioService.playNext() in sequential mode
- AudioService.playNext() in shuffle mode (randomness + history)
- AudioService.playNext() in repeat mode
- AudioService.playPrevious() history navigation
- shuffleWithHistory() algorithm
- playedTrackIds tracking

### 5. UI State Synchronization (tests.md section 5)
**Unit Testable:**
- AudioContext.syncStateFromService() logic
- AppState event handling in AudioContext
- Position/duration state updates

**Requires Manual Testing:**
- Actual UI updates on screen
- Mini player synchronization
- Background/foreground transitions

### 6. Media Controls & Notifications (tests.md section 6)
**Requires Manual Testing:**
- All notification/lock screen functionality (native platform specific)

### 7. Network State Handling (tests.md section 7)
**Unit Testable:**
- AudioService.setOfflineStatus() method
- Queue rebuilding on network change
- AudioService.play() offline validation

**Requires Manual Testing:**
- Actual network switching behavior
- Buffering and reconnection

### 8. App Lifecycle & State Restoration (tests.md section 8)
**Unit Testable:**
- AudioStorage.saveListeningSession()/loadListeningSession()
- AudioStorage.savePlaybackMode()/loadPlaybackMode()
- Session data structure serialization/deserialization
- Playback mode restoration

**Requires Manual Testing:**
- Actual app force quit/restore
- Low memory handling

## Priority Order for Unit Test Implementation

### Phase 1: Core Audio Service Logic (HIGHEST PRIORITY)
1. **AudioService.playNext()** - All modes (sequential, shuffle, repeat)
2. **AudioService.playPrevious()** - History navigation
3. **AudioService.setPlaybackMode()** - Queue rebuilding
4. **shuffleWithHistory() algorithm** - No repeats in recent history

### Phase 2: State Management
5. **AudioStorage methods** - Session persistence
6. **AudioContext state sync** - App foreground/background

### Phase 3: Network & Download Integration
7. **AudioService.rebuildQueue()** - Offline filtering
8. **DownloadService core methods** - File existence checks

### Phase 4: Sleep Timer Logic
9. **AudioService.setSleepTimer()/clearSleepTimer()**
10. **AudioService.fadeOut()** - Volume reduction

## Test Implementation Plan

### 1. Jest Setup
- Install Jest and related dependencies
- Configure jest.config.js for Expo/TypeScript
- Create mock modules for native dependencies

### 2. Mock Dependencies
**Core mocks needed:**
- `expo-audio` - Mock AudioPlayer with controlled state
- `expo-file-system` - Mock file operations
- `react-native-background-timer` - Mock timers
- `@react-native-async-storage/async-storage` - Mock storage
- `expo-media-control` - Mock media controls

### 3. Test File Structure
```
/__tests__/
  /services/
    audioService.test.ts
    downloadService.test.ts
    audioStorage.test.ts
  /utils/
    mocks/
      expo-audio.mock.ts
      file-system.mock.ts
      background-timer.mock.ts
```

### 4. Test Coverage Goals
- Core business logic: 80%+ coverage
- Error handling paths: Test all error scenarios
- Edge cases: Empty queues, offline mode, etc.

## Mapping to tests.md Checklist

As unit tests are completed, we will update tests.md with checkmarks (✓) for automated tests and notes on which tests are covered by unit tests vs. manual testing.

## Success Criteria
- Unit tests run without requiring physical device
- Tests are deterministic (no flaky tests)
- Core business logic fully tested
- Mock all external dependencies (native modules, network, file system)
- Tests can run in CI environment