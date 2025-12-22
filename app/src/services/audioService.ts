import { useAudioPlayer, AudioSource, AudioStatus } from 'expo-audio';
import { EventSubscription } from 'expo-modules-core';
import { downloadService } from './downloadService';
// eslint-disable-next-line import/no-named-as-default
import MediaControl, { Command, PlaybackState as MediaPlaybackState } from 'expo-media-control';
import { getReciterPhotoUrl } from '../constants/config';
import BackgroundTimer from 'react-native-background-timer';

export interface Track {
  reciterId: string;
  reciterName: string;
  reciterColorPrimary: string;
  reciterColorSecondary: string;
  surahNumber: number;
  surahName: string;
  audioUrl: string;
  isDownloaded: boolean;
}

export type PlaybackMode = 'sequential' | 'shuffle' | 'repeat';

class AudioService {
  private static readonly METADATA_UPDATE_THROTTLE_MS = 1000; // Throttle metadata updates to reduce console spam

  private player: ReturnType<typeof useAudioPlayer> | null = null;
  private currentTrack: Track | null = null;
  private queue: Track[] = [];
  private originalQueue: Track[] = []; // Keep original order for shuffle/unshuffle
  private playbackMode: PlaybackMode = 'sequential';
  private isOffline: boolean = false;
  private isProcessingNext: boolean = false; // Prevent duplicate playNext calls
  private isProcessingPrevious: boolean = false; // Prevent duplicate playPrevious calls
  private playbackStatusSubscription: EventSubscription | null = null; // Native event subscription for playback status
  private sleepTimerTimeout: number | null = null; // Sleep timer (BackgroundTimer timeout ID)
  private fadeOutTimeout: number | null = null; // Fade out timer (BackgroundTimer timeout ID)
  private sleepTimerEndTime: number | null = null; // When sleep timer will end (timestamp)
  private playedTrackIds: Set<string> = new Set(); // Track IDs of played tracks (reciterId:surahNumber)
  private shuffleHistory: Track[] = []; // Recently played tracks in shuffle mode (max 5)
  private playedTracksOrder: Track[] = []; // Tracks played in order (for previous navigation)
  private lastMetadataUpdateTime: number = 0; // Throttle metadata updates to reduce spam
  private isProcessingNextSince: number = 0; // When isProcessingNext was set to true (for safety timeout)

  private getTrackId(track: Track): string {
    return `${track.reciterId}:${track.surahNumber}`;
  }

  /**
   * Initialize the audio player and media controls
   */
  async initialize(player: ReturnType<typeof useAudioPlayer>) {
    console.log('[AudioService] Initializing with new player instance');
    this.player = player;

    // Only initialize media controls once, not every time player changes
    if (!this.mediaControlsInitialized) {
      await this.initializeMediaControls();
      this.mediaControlsInitialized = true;
    }
  }

  private mediaControlsInitialized = false;

  /**
   * Handle playback status updates from native events
   */
  private handlePlaybackStatusUpdate(status: AudioStatus) {
    if (!this.currentTrack) {
      return;
    }

    // Safety check: if isProcessingNext is stuck for too long (30 seconds), reset it
    if (this.isProcessingNext && this.isProcessingNextSince > 0) {
      const stuckForMs = Date.now() - this.isProcessingNextSince;
      if (stuckForMs > 30000) { // 30 seconds timeout
        console.warn('[AudioService] 🚨 handlePlaybackStatusUpdate - isProcessingNext stuck for', stuckForMs, 'ms, RESETTING');
        this.isProcessingNext = false;
        this.isProcessingNextSince = 0;
      }
    }

    // Update media controls with real-time position from native event
    this.updateMediaControlPositionFromStatus(status);

    // Check if track just finished using native didJustFinish flag
    if (status.didJustFinish && !this.isProcessingNext) {
      this.playNext();
    }
  }

  /**
   * Start monitoring playback to auto-advance to next track
   */
  private startPlaybackMonitor() {
    // Stop any existing monitor
    this.stopPlaybackMonitor();



    // Subscribe to native playback status updates
    if (this.player) {
      this.playbackStatusSubscription = this.player.addListener(
        'playbackStatusUpdate',
        (status: AudioStatus) => {
          this.handlePlaybackStatusUpdate(status);
        }
      );
    }

    console.log('[AudioService] Native playback monitor started');
  }

  /**
   * Stop monitoring playback
   */
  private stopPlaybackMonitor() {

    // Remove native event subscription
    if (this.playbackStatusSubscription) {
      this.playbackStatusSubscription.remove();
      this.playbackStatusSubscription = null;
    }

    console.log('[AudioService] Playback monitor stopped');
  }

  /**
   * Set offline status for the audio service and rebuild queue if needed
   */
  async setOfflineStatus(isOffline: boolean) {
    const wasOffline = this.isOffline;
    this.isOffline = isOffline;

    // If offline status changed
    if (wasOffline !== isOffline) {
      // Check if current track is still playable
      if (this.currentTrack && this.isOffline) {
        try {
          const localPath = await downloadService.getLocalPath(
            this.currentTrack.reciterId,
            this.currentTrack.surahNumber
          );
          if (!localPath) {
            // Current track not downloaded, stop playback
            console.log('[AudioService] Going offline, current track not downloaded - stopping playback');
            await this.pause();
            // Clear current track since it's not playable offline
            this.currentTrack = null;
          }
        } catch (error) {
          console.error('[AudioService] Error checking current track download status:', error);
        }
      }

      // Rebuild queue with new offline status
      try {
        await this.rebuildQueue();
      } catch (error) {
        console.error('[AudioService] Error rebuilding queue:', error);
      }
    }
  }

  /**
   * Rebuild queue based on current offline status, played tracks, and playback mode
   */
  private async rebuildQueue() {
    if (this.originalQueue.length === 0) {
      return;
    }

    // Filter out already played tracks
    let remainingTracks = this.originalQueue.filter(
      track => !this.playedTrackIds.has(this.getTrackId(track))
    );

    // If offline, filter to only downloaded tracks
    if (this.isOffline && remainingTracks.length > 0) {
      const downloadedTracks = await Promise.all(
        remainingTracks.map(async (track) => {
          const localPath = await downloadService.getLocalPath(track.reciterId, track.surahNumber);
          return localPath ? track : null;
        })
      );
      remainingTracks = downloadedTracks.filter((t): t is Track => t !== null);
    }

    // Apply shuffle if in shuffle mode
    if (this.playbackMode === 'shuffle' && remainingTracks.length > 0) {
      this.queue = this.shuffleWithHistory([...remainingTracks]);
    } else {
      this.queue = [...remainingTracks];
    }
  }

  /**
   * Initialize media controls for lock screen and notifications
   */
  private async initializeMediaControls() {
    try {
      // Enable media controls with all capabilities and notification styling
      await MediaControl.enableMediaControls({
        capabilities: [
          Command.PLAY,
          Command.PAUSE,
          Command.NEXT_TRACK,
          Command.PREVIOUS_TRACK,
          Command.STOP,
        ],
        notification: {
          icon: 'notification_icon', // Defined in app.json plugin config
          color: '#1DB954', // Spotify-like green for Islamic/spiritual theme
        },
      });

      // Set up event listener for media control commands
      MediaControl.addListener((event) => {
        switch (event.command) {
          case Command.PLAY:
            this.resume();
            break;

          case Command.PAUSE:
            this.pause();
            break;

          case Command.NEXT_TRACK:
            this.playNext();
            break;

          case Command.PREVIOUS_TRACK:
            // For Quran, we could replay current surah or go to previous in queue
            // For now, just replay current surah
            if (this.currentTrack) {
              this.play(this.currentTrack, this.queue, false);
            }
            break;

          case Command.STOP:
            this.stop();
            break;
        }
      });
    } catch (error) {
      console.error('Error initializing media controls:', error);
    }
  }

  /**
   * Load a track without auto-playing (for resuming at specific position)
   */
  async loadTrack(track: Track, queue: Track[] = []) {
    if (!this.player) {
      throw new Error('Audio player not initialized');
    }

    this.currentTrack = track;

    // Filter queue based on offline status
    let filteredQueue = [...queue];
    if (this.isOffline && queue.length > 0) {
      const downloadedTracks = await Promise.all(
        queue.map(async (t) => {
          const localPath = await downloadService.getLocalPath(t.reciterId, t.surahNumber);
          return localPath ? t : null;
        })
      );
      filteredQueue = downloadedTracks.filter((t): t is Track => t !== null);
    }

    this.originalQueue = [...filteredQueue]; // Keep filtered original order
    this.playedTrackIds.clear(); // Clear played tracks (saved session, treat as new)
    this.shuffleHistory = []; // Clear shuffle history for saved session
    this.playedTrackIds.add(this.getTrackId(track)); // Mark current track as played
    this.playedTracksOrder.push(track); // Add to played tracks order
    if (this.playbackMode === 'shuffle') {
      this.addToShuffleHistory(track);
    }

    // Apply shuffle if in shuffle mode
    if (this.playbackMode === 'shuffle' && filteredQueue.length > 0) {
      this.queue = this.shuffleWithHistory([...filteredQueue]);
    } else {
      this.queue = [...filteredQueue];
    }

    try {
      // Check if track is downloaded
      const localPath = await downloadService.getLocalPath(track.reciterId, track.surahNumber);

      if (this.isOffline && !localPath) {
        throw new Error('Cannot stream while offline. Please download the surah first.');
      }

      const audioSource = localPath || track.audioUrl;

      // Pause existing playback
      if (this.player.playing) {
        this.player.pause();
      }

      // Replace audio but don't play yet
      this.player.replace(audioSource as AudioSource);

      // Wait for audio to load
      await new Promise(resolve => setTimeout(resolve, 100));

      await this.updateMediaControlMetadata(track);
    } catch (error) {
      console.error('[AudioService] Error loading track:', error);
      throw error;
    }
  }

  /**
   * Play a track
   */
  async play(track: Track, queue: Track[] = [], isNewSession: boolean = true) {
    if (!this.player) {
      console.error('[AudioService] ❌ play() - Player not initialized');
      throw new Error('Audio player not initialized');
    }

    this.currentTrack = track;

    // Filter queue based on offline status
    let filteredQueue = [...queue];
    if (this.isOffline && queue.length > 0) {
      // When offline, only include downloaded tracks in queue
      const downloadedTracks = await Promise.all(
        queue.map(async (t) => {
          const localPath = await downloadService.getLocalPath(t.reciterId, t.surahNumber);
          return localPath ? t : null;
        })
      );
      filteredQueue = downloadedTracks.filter((t): t is Track => t !== null);
    }

    if (isNewSession) {
      this.originalQueue = [...filteredQueue]; // Keep filtered original order for new session
      this.playedTrackIds.clear(); // Clear played tracks for new playback session
      this.shuffleHistory = []; // Clear shuffle history for new session
      this.playedTracksOrder = []; // Clear played tracks order for new session
    }
    this.playedTrackIds.add(this.getTrackId(track)); // Mark current track as played
    this.playedTracksOrder.push(track); // Add to played tracks order
    if (this.playbackMode === 'shuffle') {
      this.addToShuffleHistory(track);
    }

    // Apply shuffle if in shuffle mode, otherwise keep sequential order
    if (this.playbackMode === 'shuffle' && filteredQueue.length > 0) {
      this.queue = this.shuffleWithHistory([...filteredQueue]);
    } else {
      this.queue = [...filteredQueue]; // Sequential and repeat modes use filtered order
    }

    try {
      // Check if track is downloaded and use local file if available
      const localPath = await downloadService.getLocalPath(track.reciterId, track.surahNumber);

      // If offline and track is not downloaded, throw error
      if (this.isOffline && !localPath) {
        throw new Error('Cannot stream while offline. Please download the surah first.');
      }

      const audioSource = localPath || track.audioUrl;

      // Pause existing playback
      if (this.player.playing) {
        this.player.pause();
      }

      // Replace and play
      this.player.replace(audioSource as AudioSource);

      // Small buffer to allow native player to process the replace
      await new Promise(resolve => setTimeout(resolve, 100));

      this.player.play();

      // Verify playback started with INCREASED ROBUSTNESS
      let playbackStarted = false;

      // Attempt for up to 3 seconds (30 * 100ms)
      // This allows time for buffering without crashing the queue logic
      for (let attempt = 0; attempt < 30; attempt++) {
        if (this.player.playing) {
          playbackStarted = true;
          break;
        }

        // Wait 100ms between checks
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Final attempt to kickstart if still not playing after 3 seconds
      if (!playbackStarted) {
        this.player.play();
        // Give it one last 500ms grace period
        await new Promise(resolve => setTimeout(resolve, 500));
        if (this.player.playing) {
            playbackStarted = true;
        }
      }

      if (!playbackStarted) {
        console.error('[AudioService] ❌ play() - Failed to start playback after extended wait');
        throw new Error('Failed to start playback - timed out');
      }

      await this.updateMediaControlMetadata(track);

      // Start monitoring playback for auto-advance
      this.startPlaybackMonitor();
    } catch (error) {
      console.error('[AudioService] Error playing track:', error);
      // If playback fails, clear the broken state
      if (this.player) {
        this.player.pause();
        this.stopPlaybackMonitor();
      }
      throw error;
    }
  }

  /**
   * Update media control metadata for lock screen and notifications
   */
  private async updateMediaControlMetadata(track: Track) {
    try {
      const artworkUri = getReciterPhotoUrl(track.reciterId);
      const duration = this.player?.duration || 0;
      const position = this.player?.currentTime || 0;

      await MediaControl.updateMetadata({
        title: track.surahName,
        artist: track.reciterName,
        artwork: artworkUri ? {
          uri: artworkUri,
        } : undefined,
        duration,
        elapsedTime: position,
      });

      // Update playback state to playing with position
      await MediaControl.updatePlaybackState(MediaPlaybackState.PLAYING, position);

      // Reset throttle timestamp to ensure immediate updates for new track
      this.lastMetadataUpdateTime = Date.now();
    } catch (error) {
      console.error('Error updating media control metadata:', error);
    }
  }


  /**
   * Update media control position from native playback status
   */
  private async updateMediaControlPositionFromStatus(status: AudioStatus) {
    if (!this.currentTrack) return;

    // Throttle metadata updates to reduce console spam
    const now = Date.now();
    if (now - this.lastMetadataUpdateTime < AudioService.METADATA_UPDATE_THROTTLE_MS) {
      return;
    }

    // Update throttle timestamp BEFORE making the call to prevent race conditions
    this.lastMetadataUpdateTime = now;

    try {
      const position = status.currentTime;
      const duration = status.duration || 0;
      const artworkUri = getReciterPhotoUrl(this.currentTrack.reciterId);

      await MediaControl.updateMetadata({
        title: this.currentTrack.surahName,
        artist: this.currentTrack.reciterName,
        artwork: artworkUri ? {
          uri: artworkUri,
        } : undefined,
        duration,
        elapsedTime: position,
      });

      if (status.playing) {
        await MediaControl.updatePlaybackState(MediaPlaybackState.PLAYING, position);
      } else if (!status.playing && position > 0) {
        // If not playing but has position (paused), update state
        await MediaControl.updatePlaybackState(MediaPlaybackState.PAUSED, position);
      }
    } catch (error) {
      console.error('Error updating media control position from status:', error);
    }
  }

  /**
   * Shuffle an array using Fisher-Yates algorithm
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private shuffleWithHistory(tracks: Track[]): Track[] {
    // Filter out tracks in recent shuffle history
    const availableTracks = tracks.filter(
      track => !this.shuffleHistory.some(
        historyTrack => this.getTrackId(historyTrack) === this.getTrackId(track)
      )
    );

    // If no tracks available after filtering, clear history and use all tracks
    const tracksToShuffle = availableTracks.length > 0 ? availableTracks : [...tracks];
    if (availableTracks.length === 0) {
      this.shuffleHistory = [];
    }

    const shuffled = this.shuffleArray(tracksToShuffle);
    return shuffled;
  }

  private addToShuffleHistory(track: Track) {
    // Add to beginning of history
    this.shuffleHistory.unshift(track);
    // Keep only last 5 tracks
    if (this.shuffleHistory.length > 5) {
      this.shuffleHistory = this.shuffleHistory.slice(0, 5);
    }
  }

  /**
   * Pause playback
   */
  async pause() {
    if (!this.player) {
      console.warn('[AudioService] Cannot pause - player not initialized');
      return;
    }

    try {
      this.player.pause();

      // Stop playback monitoring when paused
      this.stopPlaybackMonitor();

      // Update media control state with current position
      const position = this.player.currentTime;
      await MediaControl.updatePlaybackState(MediaPlaybackState.PAUSED, position);
    } catch (error) {
      console.error('[AudioService] Error pausing:', error);
    }
  }

  /**
   * Resume playback
   */
  async resume() {
    if (!this.player) {
      console.warn('[AudioService] Cannot resume - player not initialized');
      return;
    }

    try {
      this.player.play();

      // Start playback monitoring when resumed
      this.startPlaybackMonitor();

      // Update media control state with current position
      const position = this.player.currentTime;
      await MediaControl.updatePlaybackState(MediaPlaybackState.PLAYING, position);
    } catch (error) {
      console.error('[AudioService] Error resuming:', error);

      // If player was released, try to reinitialize playback
      if (error instanceof Error && error.message.includes('released')) {
        if (this.currentTrack) {
          await this.play(this.currentTrack, this.queue, false);
        }
      }
    }
  }

  /**
   * Toggle play/pause
   */
  togglePlayPause() {
    if (!this.player) return;

    if (this.player.playing) {
      this.pause();
    } else {
      this.resume();
    }
  }

  /**
   * Seek to position in seconds
   */
  async seekTo(seconds: number) {
    if (this.player) {
      this.player.seekTo(seconds);
      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume: number) {
    if (this.player) {
      this.player.volume = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.player?.volume ?? 1.0;
  }

  /**
   * Fade out audio over specified duration
   */
  async fadeOut(durationMs: number = 10000): Promise<void> {
    return new Promise((resolve) => {
      if (!this.player) {
        resolve();
        return;
      }

      const startVolume = this.player.volume;
      const steps = 50; // Number of volume changes
      const stepDuration = durationMs / steps;
      const volumeDecrement = startVolume / steps;
      let currentStep = 0;

      const fadeInterval = setInterval(() => {
        currentStep++;
        const newVolume = Math.max(0, startVolume - (volumeDecrement * currentStep));

        if (this.player) {
          this.player.volume = newVolume;
        }

        if (currentStep >= steps || newVolume <= 0) {
          clearInterval(fadeInterval);
          if (this.player) {
            this.player.volume = 0;
          }
          resolve();
        }
      }, stepDuration);
    });
  }

  /**
   * Reset volume to full
   */
  resetVolume() {
    if (this.player) {
      this.player.volume = 1.0;
    }
  }

  /**
   * Set a sleep timer that will fade out and pause playback after the specified duration
   * This works independently of React and will function even when the screen is off
   */
  setSleepTimer(minutes: number, onComplete?: () => void) {
    // Clear any existing sleep timer
    this.clearSleepTimer();

    const totalMs = minutes * 60 * 1000;
    const fadeMs = 10000; // 10 second fade-out
    const timeUntilFade = totalMs - fadeMs;

    console.log('[AudioService] Sleep timer set for', minutes, 'minutes');
    this.sleepTimerEndTime = Date.now() + totalMs;

    // Schedule fade-out to start 10 seconds before the timer ends
    this.fadeOutTimeout = BackgroundTimer.setTimeout(() => {
      console.log('[AudioService] Starting sleep timer fade-out');
      this.fadeOut(fadeMs);
    }, timeUntilFade);

    // Schedule pause when timer completes
    this.sleepTimerTimeout = BackgroundTimer.setTimeout(() => {
      console.log('[AudioService] Sleep timer complete - pausing playback');
      this.pause();
      this.resetVolume();
      this.clearSleepTimer(); // Clear timer references after completion
      if (onComplete) {
        onComplete();
      }
    }, totalMs);
  }

  /**
   * Clear the sleep timer
   */
  clearSleepTimer() {
    if (this.fadeOutTimeout) {
      BackgroundTimer.clearTimeout(this.fadeOutTimeout);
      this.fadeOutTimeout = null;
    }
    if (this.sleepTimerTimeout) {
      BackgroundTimer.clearTimeout(this.sleepTimerTimeout);
      this.sleepTimerTimeout = null;
    }
    // Reset volume in case fade was in progress
    this.resetVolume();
    this.sleepTimerEndTime = null;
    console.log('[AudioService] Sleep timer cleared');
  }

  /**
   * Check if sleep timer is active
   */
  isSleepTimerActive(): boolean {
    return this.sleepTimerTimeout !== null;
  }

  /**
   * Get sleep timer end time (timestamp)
   */
  getSleepTimerEndTime(): number | null {
    return this.sleepTimerEndTime;
  }

  /**
   * Play next track in queue (or repeat current if in repeat mode)
   */
  async playNext() {
    // Prevent duplicate calls
    if (this.isProcessingNext) {
      return;
    }
    this.isProcessingNext = true;
    this.isProcessingNextSince = Date.now();

    try {
      // In repeat mode, replay current track from beginning
      if (this.playbackMode === 'repeat' && this.currentTrack) {
        try {
          // Seek to beginning and play (more efficient than replace)
          await this.seekTo(0);
          this.player?.play();

          // Update media control position to 0
          if (this.currentTrack) {
            await MediaControl.updateMetadata({
              title: this.currentTrack.surahName,
              artist: this.currentTrack.reciterName,
              artwork: getReciterPhotoUrl(this.currentTrack.reciterId) ? {
                uri: getReciterPhotoUrl(this.currentTrack.reciterId),
              } : undefined,
              duration: this.player?.duration || 0,
              elapsedTime: 0,
            });
            await MediaControl.updatePlaybackState(MediaPlaybackState.PLAYING, 0);
          }
        } catch (error) {
          console.error('Error repeating track:', error);
          // Fallback to replace if seek fails
          try {
            const localPath = await downloadService.getLocalPath(
              this.currentTrack.reciterId,
              this.currentTrack.surahNumber
            );
            const audioSource = localPath || this.currentTrack.audioUrl;
            this.player?.replace(audioSource as AudioSource);
            this.player?.play();
            await this.updateMediaControlMetadata(this.currentTrack);
          } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
          }
        }
        return;
      }

      // Iterative Queue Processing (Prevent Stack Overflow)
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

      // If queue empty or no playable tracks found
      if (!playableFound) {
        await this.pause();
      }

    } finally {
      this.isProcessingNext = false;
      this.isProcessingNextSince = 0;
    }
  }

  /**
   * Play previous track from played history
   */
  async playPrevious() {
    // Prevent duplicate calls
    if (this.isProcessingPrevious) {
      return;
    }
    this.isProcessingPrevious = true;

    try {
      // If no current track or no previous track, do nothing
      if (!this.currentTrack || this.playedTracksOrder.length <= 1) {
        // If we have a current track but no previous, seek to beginning
        if (this.currentTrack && this.player) {
          await this.seekTo(0);
          this.player.play();
        }
        return;
      }

      // Get previous track (second last in order, since last is current)
      const previousTrack = this.playedTracksOrder[this.playedTracksOrder.length - 2];
      if (!previousTrack) {
        return;
      }

      // Remove current track from played tracks order (we'll keep it in playedTrackIds and shuffleHistory)
      const currentTrack = this.playedTracksOrder.pop(); // Remove current
      if (currentTrack) {
        // Keep current track in playedTrackIds (it was played)
        // Keep in shuffle history if shuffle mode
        // Add current track back to front of queue (since we're going back)
        this.queue.unshift(currentTrack);
      }

      // Also remove previous track from playedTracksOrder (we'll re-add when we play it)
      this.playedTracksOrder.pop(); // Remove previous track (now last element after popping current)

      // Load and play previous track
      await this.play(previousTrack, this.queue, false);
    } finally {
      this.isProcessingPrevious = false;
    }
  }

  /**
   * Get current track
   */
  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  /**
   * Get queue
   */
  getQueue(): Track[] {
    return this.queue;
  }

  /**
   * Get player instance
   */
  getPlayer() {
    return this.player;
  }

  /**
   * Set playback mode and rebuild queue intelligently
   */
  setPlaybackMode(mode: PlaybackMode) {
    const previousMode = this.playbackMode;
    this.playbackMode = mode;

    // If we have a queue, rebuild it based on new mode
    if (this.originalQueue.length > 0) {
      // Filter out already played tracks from originalQueue
      const remainingTracks = this.originalQueue.filter(
        track => !this.playedTrackIds.has(this.getTrackId(track))
      );

      if (mode === 'shuffle') {
        // Shuffle the remaining tracks, avoiding recently played ones
        this.queue = this.shuffleWithHistory([...remainingTracks]);
      } else if (mode === 'sequential' || mode === 'repeat') {
        // Use remaining tracks in original order
        this.queue = [...remainingTracks];
      }
    }
  }

  /**
   * Get current playback mode
   */
  getPlaybackMode(): PlaybackMode {
    return this.playbackMode;
  }

  /**
   * Get played track IDs (as Set)
   */
  getPlayedTrackIds(): Set<string> {
    return this.playedTrackIds;
  }

  /**
   * Get shuffle history (recently played tracks in shuffle mode)
   */
  getShuffleHistory(): Track[] {
    return this.shuffleHistory;
  }

  /**
   * Get played tracks in order (for previous navigation)
   */
  getPlayedTracksOrder(): Track[] {
    return this.playedTracksOrder;
  }

  /**
   * Set played track IDs (from stored array)
   */
  setPlayedTrackIds(ids: string[]): void {
    this.playedTrackIds = new Set(ids);
  }

  /**
   * Set shuffle history (from stored tracks)
   */
  setShuffleHistory(history: Track[]): void {
    this.shuffleHistory = history;
  }

  /**
   * Set played tracks order (from stored tracks)
   */
  setPlayedTracksOrder(order: Track[]): void {
    this.playedTracksOrder = order;
  }

  /**
   * Get whether there's a next track available
   */
  hasNext(): boolean {
    return this.queue.length > 0 || this.playbackMode === 'repeat';
  }

  /**
   * Check if we're at the last track
   */
  isLastTrack(): boolean {
    return this.queue.length === 0 && this.playbackMode !== 'repeat';
  }

  /**
   * Replay current track from beginning
   */
  async replayCurrent() {
    if (!this.currentTrack || !this.player) return;

    try {
      const localPath = await downloadService.getLocalPath(
        this.currentTrack.reciterId,
        this.currentTrack.surahNumber
      );
      const audioSource = localPath || this.currentTrack.audioUrl;

      // Seek to beginning and play
      this.player.seekTo(0);
      this.player.replace(audioSource as AudioSource);
      this.player.play();

      await this.updateMediaControlMetadata(this.currentTrack);
    } catch (error) {
      console.error('Error replaying current track:', error);
    }
  }

  /**
   * Stop playback and clear notification
   */
  async stop() {
    console.log('[AudioService] Stop called - clearing notification');
    if (this.player) {
      this.player.pause();
    }

    // Stop playback monitoring
    this.stopPlaybackMonitor();

    try {
      // Disable media controls to dismiss notification
      await MediaControl.updatePlaybackState(MediaPlaybackState.STOPPED, 0);
      await MediaControl.disableMediaControls();

      // Re-enable immediately for next playback
      if (this.mediaControlsInitialized) {
        await this.initializeMediaControls();
      }
    } catch (error) {
      console.error('[AudioService] Error stopping:', error);
    }
  }

  /**
   * Clear current track and queue
   */
  clear() {
    this.currentTrack = null;
    this.queue = [];
    this.originalQueue = [];
    this.playedTrackIds.clear();
    this.shuffleHistory = [];
    this.playedTracksOrder = [];
    this.stopPlaybackMonitor(); // Stop monitoring when clearing
    if (this.player) {
      this.player.pause();
    }
  }
}

// Singleton instance
export const audioService = new AudioService();
