# Rabi MVP - TODO List

## High Priority - Core Features

### 1. Reciter Detail Screen

-   [x] Create reciter detail screen with surah list
-   [x] Display reciter name and image at top
-   [x] Show all 114 surahs in scrollable list
-   [x] Add tap handler to play selected surah
-   [x] Show download status for each surah
-   [x] Navigate to this screen when reciter card is tapped

### 2. Audio Playback Integration

-   [x] Integrate expo-audio for playback
-   [x] Implement play/pause functionality
-   [x] Add next/previous track controls
-   [x] Handle audio streaming from R2
-   [x] Implement background playback (see section 6 for details)
-   [x] Add notification controls (media session) (see section 6 for details)
-   [x] Handle audio focus and interruptions

### 3. Full Player Screen

-   [x] Create full player modal/screen
-   [x] Large reciter image display
-   [x] Surah name in Arabic and English
-   [x] Playback progress slider
-   [x] Current time and duration display
-   [x] Play/pause and skip controls
-   [x] Download button in player

### 4. Download Functionality

-   [x] Implement surah download with expo-file-system
-   [x] Show download progress indicator
-   [x] Save downloaded files to local storage
-   [x] Update database with download status
-   [x] Handle download errors and retries
-   [x] Allow downloads during playback
-   [x] Calculate and display storage used
-   [x] Download queue management with max concurrent downloads
-   [x] Download/delete toggle in UI
-   [x] Integrate downloads with audio playback (auto-play from local files)
-   [ ] Download queue UI to show all active downloads
-   [ ] Storage management screen with usage stats
-   [x] Batch download progress indicator for "Download All"
-   [x] Change "Download All" button to show download state (disable or change to "Remove All")

### 5. Offline Mode

-   [x] Detect network connectivity (WiFi/cellular) using expo-network
-   [x] Show offline indicator in UI
-   [x] Disable streaming when offline
-   [x] Disable/gray out non-downloaded surahs when offline
-   [x] Only play downloaded surahs in shuffle mode when offline
-   [x] Disable download buttons when offline
-   [ ] Cache reciter images for offline use
-   [x] Handle offline state gracefully throughout the app

### 6. Background Playback & Notifications

-   [x] Implement background audio playback (keep playing when screen is off)
-   [x] Add media session controls in notification area (using expo-media-control)
-   [x] Show playback controls in notification (using expo-media-control)
-   [x] Handle play/pause from notification
-   [x] Handle skip next/previous from notification
-   [x] Show current surah and reciter in notification
-   [x] Lock screen controls (iOS & Android via expo-media-control)
-   [x] Bluetooth/headphone controls integration
-   [x] Add reciter artwork to lock screen and notifications (512x512 images)
-   [x] Configure notification color with brand green (#1DB954)

### 7. Playback Modes

-   [x] Shuffle mode
-   [x] Repeat mode
-   [x] Sequential/Play Next mode (play surahs in order)
-   [x] Cycle through modes: Sequential → Shuffle → Repeat
-   [x] Persist playback mode preference using AsyncStorage
-   [x] Visual indication of current mode

### 8. Sleep Timer

-   [x] Implement sleep timer functionality
-   [x] Create SleepTimerContext with countdown logic
-   [x] Create SleepTimerModal with preset options (5, 10, 15, 30, 45, 60 minutes)
-   [x] Auto-pause audio when timer reaches zero
-   [x] Show active indicator on sleep timer button
-   [x] Add sleep timer translations (English & Arabic)

### 9. Back Button Handling

-   [x] Handle Android hardware back button throughout the app
-   [x] Player screen: Close modal if open, otherwise navigate back
-   [x] Reciter detail screen: Navigate back to home
-   [x] Home screen: Double-tap to exit with confirmation alert
-   [x] Add translations for exit confirmation (English & Arabic)

### 10. Session Persistence

-   [x] Save listening session to AsyncStorage (track + position)
-   [x] Restore session on app launch (show mini player with saved track)
-   [x] Periodically save position during playback (every 5 seconds)
-   [x] Resume playback from saved position when user taps play
-   [x] Auto-expire sessions older than 7 days
-   [x] Handle session restoration without auto-playing

## Medium Priority - Polish & UX

### 8. UI Polish & Refinements

-   [x] Disable prev button when at surah 1 in player
-   [x] Disable next button when at surah 114 in player
-   [x] Make back button static (not overlay) in reciter screen
-   [x] Reduce gray color intensity in reciter profile (download button, search, surah cards)
-   [x] Fix mini player progress bar direction in RTL mode
-   [ ] Add loading states for reciter grid
-   [ ] Add loading states for audio buffering
-   [x] Show download progress animations
-   [ ] Add shimmer effects for better UX

### 9. Error Handling

-   [ ] Handle network errors gracefully
-   [ ] Show retry options for failed operations
-   [ ] Display offline mode indicators
-   [ ] Handle corrupted download files
-   [ ] Add error boundaries for crashes

### 10. Mini Player Enhancements

-   [x] Connect mini player to actual audio playback
-   [x] Update progress bar in real-time
-   [x] Show correct play/pause state
-   [x] Display current surah and reciter
-   [ ] Add swipe gestures for skip

### 11. Update Banner Improvements

-   [ ] Add app store link to update button
-   [ ] Handle different update scenarios (optional vs mandatory)
-   [ ] Persist dismissed state (don't show again for this version)
-   [ ] Test version comparison logic

## Low Priority - Future Enhancements

### 12. Performance Optimization

-   [ ] Optimize reciter grid rendering
-   [ ] Implement image caching
-   [ ] Lazy load surah lists
-   [ ] Reduce app bundle size
-   [ ] Optimize database queries

### 13. Accessibility

-   [ ] Add screen reader support
-   [ ] Ensure proper focus management
-   [ ] Add accessibility labels
-   [ ] Support dynamic font sizes

### 14. Analytics & Monitoring

-   [ ] Add crash reporting (Sentry?)
-   [ ] Track key user actions
-   [ ] Monitor download success rates
-   [ ] Track playback errors
-   [ ] Monitor app performance

### 15. Testing

-   [ ] Add unit tests for utility functions
-   [ ] Test version comparison logic
-   [ ] Test database operations
-   [ ] Test audio playback functionality
-   [ ] Integration tests for key flows

## Content & Data

### 16. Audio Content

-   [ ] Source high-quality MP3 files for 3 reciters
-   [ ] Ensure all 114 surahs per reciter
-   [ ] Optimize file sizes (128-192 kbps)
-   [ ] Upload all audio files to R2
-   [ ] Verify CDN access and streaming

### 17. Images & Assets

-   [ ] Get professional reciter photos
-   [ ] Optimize image sizes
-   [ ] Create app icon
-   [ ] Create splash screen
-   [ ] Add placeholder images

## Known Issues

### Bugs to Fix

-   [ ] None currently - add as discovered

### Technical Debt

-   [ ] Separate AudioContext into dedicated AppContext
-   [ ] Add proper TypeScript types for all components
-   [ ] Refactor dataSync to separate concerns
-   [ ] Add JSDoc comments for public functions

## Completed ✅

### Infrastructure

-   [x] Project setup with Expo
-   [x] TypeScript configuration
-   [x] SQLite database setup
-   [x] Background data sync
-   [x] i18n setup (English/Arabic)
-   [x] Safe area handling

### UI Components

-   [x] Home screen with reciter grid
-   [x] Mini player component
-   [x] Update banner component
-   [x] Loading screen

### Features

-   [x] Reciter metadata sync
-   [x] Color extraction from images
-   [x] Version checking
-   [x] Update notifications
-   [x] Remote configuration (db.json)
-   [x] CDN failover support

---

**Current Sprint:** Core Features (Playback & Downloads)

**Next Milestone:** Functional MVP with playback and downloads
