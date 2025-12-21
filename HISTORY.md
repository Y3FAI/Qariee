# Session 1: Playback Modes Implementation - Comprehensive Summary

## Overview
Implemented reliable playback modes (shuffle, repeat, sequential) with proper queue management, auto-advance logic, and offline support for the Quran audio app "Rabi".

## Core Implementation Details

### 1. Playback Mode System
- **Three Modes**: `sequential` → `shuffle` → `repeat` (cycling)
- **Type Definition**: `type PlaybackMode = 'sequential' | 'shuffle' | 'repeat'`
- **State Management**: Stored in `AudioService` class with persistence using AsyncStorage
- **Visual Indication**: UI shows current mode with clear icons/text

### 2. Queue Architecture
- **Dual Queue System**:
  - `originalQueue`: Preserves original track order for unshuffling
  - `queue`: Active playback queue (shuffled or sequential)
- **Queue Initialization**: When `play()` is called with track + queue array
- **Offline Filtering**: Queue filtered based on download status when offline

### 3. Mode-Specific Logic

#### **Sequential Mode**
- Plays tracks in original order (Surah 1 → 2 → 3...)
- Uses filtered queue directly (no shuffling)
- Auto-advance to next track in queue when current finishes

#### **Shuffle Mode**
- **Shuffle Algorithm**: Fisher-Yates implementation in `shuffleArray()` method
- **Queue Preservation**: Original order stored in `originalQueue` for mode switching
- **Re-shuffling**: New shuffle when new tracks added to queue
- **Offline Consideration**: Only shuffles downloaded tracks when offline

#### **Repeat Mode**
- **Single Track Repeat**: Replays current track from beginning when it ends
- **Implementation**: In `playNext()`, checks if `playbackMode === 'repeat'`
- **Queue Behavior**: Does not advance to next track in queue
- **Position Reset**: Seeks to 0:00 and plays again

### 4. Auto-Advance & Completion Detection

#### **Playback Monitor**
- **Interval**: 500ms monitoring via `setInterval`
- **Completion Detection**: Track considered finished when `duration - position < 0.5s`
- **Flag System**: `hasPlayedNext` prevents duplicate auto-advance calls
- **Monitor Management**: `startPlaybackMonitor()` / `stopPlaybackMonitor()` methods

#### **playNext() Method**
- **Race Condition Prevention**: `isProcessingNext` flag with timestamp tracking
- **Mode-Specific Logic**:
  - Repeat mode: Replay current track
  - Other modes: Advance to next in queue
- **Error Handling**: Try-catch with fallback to pause()
- **Queue Empty Handling**: Natural playback end with proper state cleanup

#### **playPrevious() Method**
- Similar structure to `playNext()` with reverse logic
- Handles edge cases (beginning of queue, repeat mode)

### 5. Offline Mode Integration

#### **Queue Filtering**
- **Filter Logic**: When `isOffline === true`, filter queue to only downloaded tracks
- **Async Check**: `downloadService.getLocalPath()` for each track
- **Error Prevention**: Throw error if trying to play non-downloaded track offline

#### **Track Source Selection**
- **Priority**: Local file path → Remote URL
- **Implementation**: `const audioSource = localPath || track.audioUrl`
- **Auto-switching**: Seamless transition between local/remote based on availability

### 6. State Management & Reliability

#### **Duplicate Call Prevention**
- `isProcessingNext`: Boolean flag to prevent concurrent `playNext()` calls
- `isProcessingNextSince`: Timestamp for debugging/timeout handling
- `try-finally` pattern: Ensures flag reset even on errors

#### **Session Persistence**
- **Auto-save**: Position saved every 5 seconds during playback
- **Restoration**: On app launch, show mini player with saved track
- **Expiration**: Sessions older than 7 days auto-expired
- **No Auto-play**: Restoration shows UI but doesn't auto-play

### 7. Media Controls Integration

#### **Notification/Lock Screen**
- **Metadata**: Reciter name, surah name, artwork (512x512 images)
- **Playback State**: Sync with actual player state (play/pause)
- **Color Theme**: Brand green (#1DB954) for notification color
- **Artwork URLs**: `getReciterPhotoUrl()` for CDN-based images

#### **Command Handling**
- Play/pause from notification → `play()`/`pause()`
- Skip next/previous → `playNext()`/`playPrevious()`
- Seek commands → `seekTo()`

### 8. Sleep Timer Integration

#### **Fade-out System**
- **Gradual Volume Reduction**: Linear fade over 30 seconds before pause
- **Timer Management**: `sleepTimerTimeout` and `fadeOutTimeout`
- **User Experience**: Smooth transition to silence

#### **UI Integration**
- **Context**: `SleepTimerContext` for global state
- **Modal**: Preset options (5, 10, 15, 30, 45, 60 minutes)
- **Visual Feedback**: Active timer indicator on sleep timer button

### 9. Error Handling & Edge Cases

#### **Network Errors**
- **Streaming Failures**: Fallback to local files if available
- **Offline Detection**: `isOffline` flag managed by network service
- **User Feedback**: Clear error messages for unrecoverable situations

#### **Player State Management**
- **Broken State Recovery**: On play error → pause + stop monitor
- **Buffer Handling**: Wait periods after `replace()` and `play()` calls
- **Verification**: Double-check `player.playing` state after operations

### 10. Performance Optimizations

#### **Memory Management**
- **Interval Cleanup**: `clearInterval()` in `stopPlaybackMonitor()`
- **Timeout Cleanup**: `clearTimeout()` for sleep/fade timers
- **Queue Size**: Reasonable limits for shuffled arrays

#### **Efficient Filtering**
- **Parallel Checks**: `Promise.all()` for offline track verification
- **Early Returns**: Skip unnecessary operations when possible
- **Debounced Updates**: Media control metadata updates

## Key Technical Achievements

1. **Reliable Mode Switching**: Seamless transitions between shuffle/sequential/repeat
2. **Offline-First Design**: Queue automatically adapts to network conditions
3. **Race Condition Prevention**: Robust flags prevent duplicate operations
4. **Background Compatibility**: Works with iOS/Android background audio
5. **Media Session Sync**: Notification controls reflect actual player state
6. **Graceful Degradation**: Error handling prevents app crashes
7. **State Persistence**: Listening sessions survive app restarts
8. **User Experience**: Smooth fade-out for sleep timer, clear mode indicators

## Code Architecture Patterns Used

1. **Service Pattern**: `AudioService` as singleton managing playback
2. **Observer Pattern**: Playback monitoring via interval observer
3. **Strategy Pattern**: Different algorithms per playback mode
4. **Facade Pattern**: Simplified API for complex audio operations
5. **State Pattern**: `isOffline`, `playbackMode` as state variables

## Files Modified/Affected (from previous session)
- `app/src/services/audioService.ts` - Core implementation
- `app/src/contexts/AudioContext.tsx` - React context wrapper
- `app/src/contexts/SleepTimerContext.tsx` - Timer integration
- UI components for mode display/controls
- `app/src/services/downloadService.ts` - Offline integration

## Lessons Learned & Best Practices

1. **Audio Timing**: Need wait periods after `replace()`/`play()` operations
2. **Background Timers**: `react-native-background-timer` for reliable intervals
3. **Media Session**: Artwork requirements (512x512 for iOS/Android)
4. **Queue Management**: Preserve original order for mode switching
5. **Error Recovery**: Clean up broken states to prevent stuck playback
6. **User Feedback**: Visual indicators for mode changes and errors

---

*Note: This implementation was removed via `git reset --hard` but represents the comprehensive work done in Session 1.*