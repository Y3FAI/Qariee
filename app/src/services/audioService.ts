/**
 * Audio Service - Thin wrapper around expo-audio
 * All state is managed by AudioContext
 */

import MediaControl, { PlaybackState, Command } from 'expo-media-control';
import BackgroundTimer from 'react-native-background-timer';

// =============================================================================
// Types
// =============================================================================

export interface Track {
    reciterId: string
    reciterName: string
    surahNumber: number
    surahName: string
    audioUrl: string
    isDownloaded: boolean
    reciterColorPrimary?: string
    reciterColorSecondary?: string
}

export type PlaybackMode = 'sequential' | 'shuffle' | 'repeat'

// =============================================================================
// Audio Service (Player Wrapper)
// =============================================================================

class AudioService {
    private player: ReturnType<typeof import('expo-audio').useAudioPlayer> | null = null
    private playbackStatusSubscription: ReturnType<ReturnType<typeof import('expo-audio').useAudioPlayer>['addListener']> | null = null
    private onPlaybackFinish: (() => void) | null = null
    private onNextTrack: (() => void) | null = null
    private onPreviousTrack: (() => void) | null = null
    private mediaControlsEnabled = false
    private mediaControlListenerSetup = false // Prevent duplicate listeners
    private isInitializing = true // Ignore media control events during startup
    private lastMetadata: {
        title?: string
        artist?: string
        artworkUrl?: string
        duration?: number
    } | null = null

    initialize(player: ReturnType<typeof import('expo-audio').useAudioPlayer>) {
        this.player = player
        this.startStatusListener()
        this.setupMediaControls()
        // Enable BackgroundTimer for sleep timer when screen is off
        try {
            BackgroundTimer.start()
        } catch (error) {
            console.warn('[AudioService] BackgroundTimer.start() failed:', error)
        }
    }

    // Call this when session restore is complete to allow MediaControl events
    markInitComplete() {
        this.isInitializing = false
        console.log('[AudioService] Initialization complete, MediaControl events enabled')
    }

    private startStatusListener() {
        if (!this.player) return

        this.playbackStatusSubscription?.remove()
        this.playbackStatusSubscription = this.player.addListener(
            'playbackStatusUpdate',
            (status) => {
                if (status.didJustFinish && this.onPlaybackFinish) {
                    this.onPlaybackFinish()
                }
            }
        )
    }

    private async setupMediaControls() {
        try {
            await MediaControl.enableMediaControls({
                capabilities: [
                    Command.PLAY,
                    Command.PAUSE,
                    Command.NEXT_TRACK,
                    Command.PREVIOUS_TRACK,
                    Command.STOP,
                    Command.SKIP_FORWARD,
                    Command.SKIP_BACKWARD,
                    Command.SEEK,
                ],
                notification: {
                    showWhenClosed: true,
                },
            })

            // Only add listener once to prevent duplicates
            if (this.mediaControlListenerSetup) {
                this.mediaControlsEnabled = true
                return
            }
            this.mediaControlListenerSetup = true

            MediaControl.addListener((event) => {
                console.log('[MediaControl] Event:', event.command)

                // Ignore PLAY events during initialization to prevent auto-play on app open
                if (this.isInitializing && event.command === Command.PLAY) {
                    console.log('[MediaControl] Ignoring PLAY during initialization')
                    return
                }

                try {
                    switch (event.command) {
                        case Command.PLAY:
                            this.resume()
                            break
                        case Command.PAUSE:
                            this.pause()
                            break
                        case Command.NEXT_TRACK:
                            if (this.onNextTrack) {
                                this.onNextTrack()
                            }
                            break
                        case Command.PREVIOUS_TRACK:
                            if (this.onPreviousTrack) {
                                this.onPreviousTrack()
                            }
                            break
                        case Command.STOP:
                            this.stop()
                            this.hideNotification()
                            break
                        case Command.SKIP_FORWARD:
                            this.seekTo(Math.min(this.getCurrentTime() + 15, this.getDuration()))
                            break
                        case Command.SKIP_BACKWARD:
                            this.seekTo(Math.max(this.getCurrentTime() - 15, 0))
                            break
                        case Command.SEEK:
                            if (event.data?.position !== undefined) {
                                this.seekTo(event.data.position)
                            }
                            break
                    }
                } catch (error) {
                    // Player may be released (e.g., offline with no downloaded track)
                    console.warn('[MediaControl] Failed to handle event:', event.command, error)
                }
            })

            this.mediaControlsEnabled = true
            console.log('[MediaControl] Enabled')
        } catch (error) {
            console.error('[MediaControl] Failed to enable:', error)
        }
    }

    async updateMediaMetadata(metadata: {
        title?: string
        artist?: string
        artworkUrl?: string
        duration?: number
    }) {
        // Store for re-applying after showNotification()
        this.lastMetadata = metadata

        if (!this.mediaControlsEnabled) return

        try {
            const mediaMetadata = {
                title: metadata.title,
                artist: metadata.artist,
                duration: metadata.duration,
                ...(metadata.artworkUrl && {
                    artwork: { uri: metadata.artworkUrl }
                })
            }
            await MediaControl.updateMetadata(mediaMetadata)
        } catch (error) {
            console.error('[MediaControl] Failed to update metadata:', error)
        }
    }

    async updatePlaybackState(playing: boolean, position?: number) {
        if (!this.mediaControlsEnabled) return

        try {
            await MediaControl.updatePlaybackState(
                playing ? PlaybackState.PLAYING : PlaybackState.PAUSED,
                position ?? this.getCurrentTime(),
                playing ? 1.0 : 0.0
            )
        } catch (error) {
            console.error('[MediaControl] Failed to update state:', error)
        }
    }

    async hideNotification() {
        if (!this.mediaControlsEnabled) return

        try {
            await MediaControl.disableMediaControls()
            this.mediaControlsEnabled = false
            console.log('[MediaControl] Disabled/hidden')
        } catch (error) {
            console.error('[MediaControl] Failed to disable:', error)
        }
    }

    async showNotification() {
        if (this.mediaControlsEnabled) return
        await this.setupMediaControls()

        // Re-apply last metadata after re-enabling controls
        if (this.lastMetadata) {
            await this.updateMediaMetadata(this.lastMetadata)
        }
    }

    setOnPlaybackFinish(callback: () => void) {
        this.onPlaybackFinish = callback
    }

    setOnNextTrack(callback: () => void) {
        this.onNextTrack = callback
    }

    setOnPreviousTrack(callback: () => void) {
        this.onPreviousTrack = callback
    }

    async play(audioSource: string) {
        if (!this.player) throw new Error('Player not initialized')

        // Re-enable notification if it was hidden
        await this.showNotification()

        try {
            this.player.replace(audioSource)
            await new Promise(r => setTimeout(r, 100))
            this.player.play()
        } catch (error) {
            console.warn('[AudioService] play() failed:', error)
            throw error // Re-throw so caller knows playback failed
        }
    }

    pause() {
        try {
            this.player?.pause()
        } catch (error) {
            console.warn('[AudioService] pause() failed:', error)
        }
    }

    resume() {
        try {
            this.player?.play()
        } catch (error) {
            console.warn('[AudioService] resume() failed:', error)
        }
    }

    stop() {
        try {
            this.player?.pause()
        } catch (error) {
            console.warn('[AudioService] stop() failed:', error)
        }
    }

    seekTo(position: number) {
        try {
            this.player?.seekTo(position)
        } catch (error) {
            console.warn('[AudioService] seekTo() failed:', error)
        }
    }

    getPlaying() {
        try {
            return this.player?.playing ?? false
        } catch {
            return false
        }
    }

    getCurrentTime() {
        try {
            return this.player?.currentTime ?? 0
        } catch {
            return 0
        }
    }

    getDuration() {
        try {
            return this.player?.duration ?? 0
        } catch {
            return 0
        }
    }

    getPlayer() {
        return this.player
    }

    // ==========================================================================
    // Sleep Timer Methods
    // ==========================================================================
    private sleepTimerEndTime: number | null = null
    private sleepTimerCallback: (() => void) | null = null

    setSleepTimer(minutes: number, callback: () => void) {
        const endTime = Date.now() + (minutes * 60 * 1000)
        this.sleepTimerEndTime = endTime
        this.sleepTimerCallback = callback

        // Use BackgroundTimer so it works when screen is off
        BackgroundTimer.setTimeout(() => {
            if (this.sleepTimerCallback) {
                this.sleepTimerCallback()
                this.clearSleepTimer()
            }
        }, minutes * 60 * 1000)
    }

    clearSleepTimer() {
        this.sleepTimerEndTime = null
        this.sleepTimerCallback = null
    }

    isSleepTimerActive(): boolean {
        return this.sleepTimerEndTime !== null
    }

    getSleepTimerEndTime(): number | null {
        return this.sleepTimerEndTime
    }

    resetVolume() {
        // Volume control not available in expo-audio, this is a no-op
        // Volume is controlled at system level
    }

    async fadeOut(duration: number) {
        // expo-audio doesn't support programmatic volume control
        // This is implemented by reducing volume over time
        // For now, just pause
        this.pause()
    }
}

// =============================================================================
// Singleton
// =============================================================================

export const audioService = new AudioService();
