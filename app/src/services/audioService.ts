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
    private mediaControlsEnabled = false
    private currentMetadata: {
        title?: string
        artist?: string
        artwork?: string
        duration?: number
    } = {}

    initialize(player: ReturnType<typeof import('expo-audio').useAudioPlayer>) {
        this.player = player
        this.startStatusListener()
        this.setupMediaControls()
        // Enable BackgroundTimer for sleep timer when screen is off
        BackgroundTimer.start()
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

            MediaControl.addListener((event) => {
                console.log('[MediaControl] Event:', event.command)
                switch (event.command) {
                    case Command.PLAY:
                        this.resume()
                        break
                    case Command.PAUSE:
                        this.pause()
                        break
                    case Command.NEXT_TRACK:
                        // This will be handled by AudioContext
                        if (this.onPlaybackFinish) {
                            this.onPlaybackFinish()
                        }
                        break
                    case Command.PREVIOUS_TRACK:
                        // This will be handled by AudioContext
                        break
                    case Command.STOP:
                        this.stop()
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

    setOnPlaybackFinish(callback: () => void) {
        this.onPlaybackFinish = callback
    }

    async play(audioSource: string) {
        if (!this.player) throw new Error('Player not initialized')

        this.player.replace(audioSource)
        await new Promise(r => setTimeout(r, 100))
        this.player.play()
    }

    pause() {
        this.player?.pause()
    }

    resume() {
        this.player?.play()
    }

    stop() {
        this.player?.pause()
    }

    seekTo(position: number) {
        this.player?.seekTo(position)
    }

    getPlaying() {
        return this.player?.playing ?? false
    }

    getCurrentTime() {
        return this.player?.currentTime ?? 0
    }

    getDuration() {
        return this.player?.duration ?? 0
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
