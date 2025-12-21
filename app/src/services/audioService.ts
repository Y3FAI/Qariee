import { useAudioPlayer, AudioSource } from 'expo-audio';
import { downloadService } from './downloadService';
import MediaControl, { Command, PlaybackState as MediaPlaybackState } from 'expo-media-control';
import { getReciterPhotoUrl } from '../constants/config';
import * as Linking from 'expo-linking';

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
  private player: ReturnType<typeof useAudioPlayer> | null = null;
  private currentTrack: Track | null = null;
  private queue: Track[] = [];
  private originalQueue: Track[] = []; // Keep original order for shuffle/unshuffle
  private playbackMode: PlaybackMode = 'sequential';
  private isOffline: boolean = false;
  private isProcessingNext: boolean = false; // Prevent duplicate playNext calls
  private playbackMonitorInterval: ReturnType<typeof setInterval> | null = null; // Monitor playback completion
  private hasPlayedNext: boolean = false; // Track if we've already advanced to next
  private sleepTimerTimeout: ReturnType<typeof setTimeout> | null = null; // Sleep timer
  private fadeOutTimeout: ReturnType<typeof setTimeout> | null = null; // Fade out timer

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
   * Start monitoring playback to auto-advance to next track
   */
  private startPlaybackMonitor() {
    // Stop any existing monitor
    this.stopPlaybackMonitor();

    this.hasPlayedNext = false;

    // Monitor playback every 500ms
    this.playbackMonitorInterval = setInterval(() => {
      if (!this.player || !this.currentTrack) return;

      const duration = this.player.duration || 0;
      const position = this.player.currentTime || 0;

      // Check if track has finished (within 0.5 seconds of end)
      if (duration > 0 && position > 0) {
        const isNearEnd = duration - position < 0.5;

        if (isNearEnd && !this.player.playing && !this.hasPlayedNext) {
          console.log('[AudioService] Track finished, auto-advancing to next');
          this.hasPlayedNext = true;
          this.playNext();
        } else if (!isNearEnd && position < duration - 2) {
          // Reset flag when clearly not near end
          this.hasPlayedNext = false;
        }
      }
    }, 500);

    console.log('[AudioService] Playback monitor started');
  }

  /**
   * Stop monitoring playback
   */
  private stopPlaybackMonitor() {
    if (this.playbackMonitorInterval) {
      clearInterval(this.playbackMonitorInterval);
      this.playbackMonitorInterval = null;
      console.log('[AudioService] Playback monitor stopped');
    }
  }

  /**
   * Set offline status for the audio service
   */
  setOfflineStatus(isOffline: boolean) {
    this.isOffline = isOffline;
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
        console.log('[MediaControl] Event received:', event.command);

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
              this.play(this.currentTrack, this.queue);
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
    console.log('📀 [loadTrack] START');
    console.log('📀 [loadTrack] Track:', track.surahName);
    console.log('📀 [loadTrack] player.playing before:', this.player?.playing);

    if (!this.player) {
      throw new Error('Audio player not initialized');
    }

    this.currentTrack = track;
    this.originalQueue = [...queue];

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

    // Apply shuffle if in shuffle mode
    if (this.playbackMode === 'shuffle' && filteredQueue.length > 0) {
      this.queue = this.shuffleArray(filteredQueue);
    } else {
      this.queue = filteredQueue;
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
        console.log('📀 [loadTrack] Pausing existing playback');
        this.player.pause();
      }

      // Replace audio but don't play yet
      console.log('📀 [loadTrack] Replacing audio source');
      this.player.replace(audioSource as AudioSource);
      console.log('📀 [loadTrack] player.playing after replace:', this.player.playing);

      // Wait for audio to load
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('📀 [loadTrack] player.playing after wait:', this.player.playing);

      await this.updateMediaControlMetadata(track);
      console.log('📀 [loadTrack] END');
    } catch (error) {
      console.error('[AudioService] Error loading track:', error);
      throw error;
    }
  }

  /**
   * Play a track
   */
  async play(track: Track, queue: Track[] = []) {
    if (!this.player) {
      throw new Error('Audio player not initialized');
    }

    this.currentTrack = track;
    this.originalQueue = [...queue]; // Keep original order

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

    // Apply shuffle if in shuffle mode, otherwise keep sequential order
    if (this.playbackMode === 'shuffle' && filteredQueue.length > 0) {
      this.queue = this.shuffleArray(filteredQueue);
    } else {
      this.queue = filteredQueue; // Sequential and repeat modes use filtered order
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
      if (this.player.playing) this.player.pause();

      // Replace and play
      this.player.replace(audioSource as AudioSource);
      await new Promise(resolve => setTimeout(resolve, 50));
      this.player.play();

      // Verify playback started
      await new Promise(resolve => setTimeout(resolve, 200));
      if (!this.player.playing) this.player.play();

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

      console.log('[AudioService] Setting notification artwork:', artworkUri);

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
    } catch (error) {
      console.error('Error updating media control metadata:', error);
    }
  }

  /**
   * Update media control position (call periodically during playback)
   */
  async updateMediaControlPosition() {
    if (!this.player || !this.currentTrack) return;

    try {
      const position = this.player.currentTime;
      const duration = this.player.duration || 0;
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

      if (this.player.playing) {
        await MediaControl.updatePlaybackState(MediaPlaybackState.PLAYING, position);
      }
    } catch (error) {
      console.error('Error updating media control position:', error);
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

  /**
   * Pause playback
   */
  async pause() {
    console.log('⏸️ [pause] Called');
    console.log('⏸️ [pause] player.playing before:', this.player?.playing);

    if (!this.player) {
      console.warn('[AudioService] Cannot pause - player not initialized');
      return;
    }

    try {
      this.player.pause();
      console.log('⏸️ [pause] player.playing after:', this.player.playing);

      // Stop playback monitoring when paused
      this.stopPlaybackMonitor();

      // Update media control state with current position
      const position = this.player.currentTime;
      await MediaControl.updatePlaybackState(MediaPlaybackState.PAUSED, position);
      console.log('⏸️ [pause] Complete');
    } catch (error) {
      console.error('[AudioService] Error pausing:', error);
    }
  }

  /**
   * Resume playback
   */
  async resume() {
    console.log('▶️ [resume] Called');
    console.log('▶️ [resume] player.playing before:', this.player?.playing);
    console.log('▶️ [resume] player.currentTime:', this.player?.currentTime);

    if (!this.player) {
      console.warn('[AudioService] Cannot resume - player not initialized');
      return;
    }

    try {
      this.player.play();
      console.log('▶️ [resume] player.play() called');
      console.log('▶️ [resume] player.playing after:', this.player.playing);

      // Start playback monitoring when resumed
      this.startPlaybackMonitor();

      // Update media control state with current position
      const position = this.player.currentTime;
      await MediaControl.updatePlaybackState(MediaPlaybackState.PLAYING, position);
      console.log('▶️ [resume] Complete');
    } catch (error) {
      console.error('[AudioService] Error resuming:', error);

      // If player was released, try to reinitialize playback
      if (error instanceof Error && error.message.includes('released')) {
        console.log('[AudioService] Player was released, attempting to reload track');
        if (this.currentTrack) {
          await this.play(this.currentTrack, this.queue);
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
    console.log('⏩ [seekTo] Called with seconds:', seconds);
    console.log('⏩ [seekTo] player.currentTime before:', this.player?.currentTime);

    if (this.player) {
      this.player.seekTo(seconds);
      // Give it a moment to process
      await new Promise(resolve => setTimeout(resolve, 50));
      console.log('⏩ [seekTo] player.currentTime after:', this.player.currentTime);
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

    // Schedule fade-out to start 10 seconds before the timer ends
    this.fadeOutTimeout = setTimeout(() => {
      console.log('[AudioService] Starting sleep timer fade-out');
      this.fadeOut(fadeMs);
    }, timeUntilFade);

    // Schedule pause when timer completes
    this.sleepTimerTimeout = setTimeout(() => {
      console.log('[AudioService] Sleep timer complete - pausing playback');
      this.pause();
      this.resetVolume();
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
      clearTimeout(this.fadeOutTimeout);
      this.fadeOutTimeout = null;
    }
    if (this.sleepTimerTimeout) {
      clearTimeout(this.sleepTimerTimeout);
      this.sleepTimerTimeout = null;
    }
    // Reset volume in case fade was in progress
    this.resetVolume();
    console.log('[AudioService] Sleep timer cleared');
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

    try {
      // In repeat mode, replay current track
      if (this.playbackMode === 'repeat' && this.currentTrack) {
        try {
          // Check if track is downloaded and use local file if available
          const localPath = await downloadService.getLocalPath(
            this.currentTrack.reciterId,
            this.currentTrack.surahNumber
          );
          const audioSource = localPath || this.currentTrack.audioUrl;

          // Replace and play the current track again
          this.player?.replace(audioSource as AudioSource);
          this.player?.play();

          // Update media controls
          await this.updateMediaControlMetadata(this.currentTrack);
        } catch (error) {
          console.error('Error repeating track:', error);
        }
        return;
      }

      // Check if queue is empty
      if (this.queue.length === 0) {
        // Queue is empty - playback ends naturally
        // In sequential mode at the last surah, just stop
        return;
      }

      const nextTrack = this.queue.shift();
      if (nextTrack) {
        try {
          await this.play(nextTrack, this.queue);
        } catch (error) {
          // If offline error, stop playback and clear state
          console.error('[AudioService] Error playing next track:', error);

          // Put track back in queue if play failed
          if (nextTrack) {
            this.queue.unshift(nextTrack);
          }

          // Stop playback on error
          await this.pause();

          throw error; // Re-throw to let caller handle
        }
      }
    } finally {
      this.isProcessingNext = false;
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
      if (mode === 'shuffle') {
        // Shuffle the remaining queue
        this.queue = this.shuffleArray([...this.originalQueue]);
      } else if (mode === 'sequential' || mode === 'repeat') {
        // Restore original sequential order
        this.queue = [...this.originalQueue];
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
    this.stopPlaybackMonitor(); // Stop monitoring when clearing
    if (this.player) {
      this.player.pause();
    }
  }
}

// Singleton instance
export const audioService = new AudioService();
