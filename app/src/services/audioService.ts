/**
 * Audio Service - Pure audio playback wrapper
 * No MediaControl logic - that's handled by AudioContext
 */

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
// Audio Service (Pure Player Wrapper)
// =============================================================================

class AudioService {
    private player: ReturnType<typeof import('expo-audio').useAudioPlayer> | null = null

    initialize(player: ReturnType<typeof import('expo-audio').useAudioPlayer>) {
        this.player = player
        // Enable BackgroundTimer for sleep timer when screen is off
        try {
            BackgroundTimer.start()
        } catch (error) {
            console.warn('[AudioService] BackgroundTimer.start() failed:', error)
        }
    }

    async play(audioSource: string) {
        if (!this.player) throw new Error('Player not initialized')

        try {
            this.player.replace(audioSource)
            await new Promise(r => setTimeout(r, 100))
            this.player.play()
        } catch (error) {
            console.warn('[AudioService] play() failed:', error)
            throw error
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

    getPlaying(): boolean {
        try {
            return this.player?.playing ?? false
        } catch {
            return false
        }
    }

    getCurrentTime(): number {
        try {
            return this.player?.currentTime ?? 0
        } catch {
            return 0
        }
    }

    getDuration(): number {
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
    // Sleep Timer
    // ==========================================================================
    private sleepTimerEndTime: number | null = null
    private sleepTimerId: number | null = null
    private fadeIntervalId: number | null = null
    private onTimerComplete: (() => void) | null = null

    setSleepTimer(minutes: number, onComplete?: () => void) {
        // Clear any existing timer first
        this.clearSleepTimer()

        const durationMs = minutes * 60 * 1000
        this.sleepTimerEndTime = Date.now() + durationMs
        this.onTimerComplete = onComplete ?? null

        this.sleepTimerId = BackgroundTimer.setTimeout(() => {
            this.handleTimerExpired()
        }, durationMs)
    }

    private handleTimerExpired() {
        // Fade out over 5 seconds then pause
        this.fadeOutAndPause(5000)
    }

    private fadeOutAndPause(durationMs: number) {
        if (!this.player) {
            this.finishTimer()
            return
        }

        const steps = 20
        const stepMs = durationMs / steps
        const volumeStep = 1 / steps
        let currentVolume = 1

        // Use BackgroundTimer for fade to work when screen is off
        this.fadeIntervalId = BackgroundTimer.setInterval(() => {
            currentVolume -= volumeStep
            if (currentVolume <= 0) {
                this.player?.pause()
                this.player!.volume = 1 // Reset volume for next playback
                if (this.fadeIntervalId !== null) {
                    BackgroundTimer.clearInterval(this.fadeIntervalId)
                    this.fadeIntervalId = null
                }
                this.finishTimer()
            } else {
                this.player!.volume = currentVolume
            }
        }, stepMs)
    }

    private finishTimer() {
        const callback = this.onTimerComplete
        this.sleepTimerEndTime = null
        this.sleepTimerId = null
        this.onTimerComplete = null
        callback?.()
    }

    clearSleepTimer() {
        if (this.sleepTimerId !== null) {
            BackgroundTimer.clearTimeout(this.sleepTimerId)
            this.sleepTimerId = null
        }
        if (this.fadeIntervalId !== null) {
            BackgroundTimer.clearInterval(this.fadeIntervalId)
            this.fadeIntervalId = null
        }
        // Reset volume in case we cancelled during fade
        if (this.player) {
            this.player.volume = 1
        }
        this.sleepTimerEndTime = null
        this.onTimerComplete = null
    }

    isSleepTimerActive(): boolean {
        return this.sleepTimerEndTime !== null
    }

    getSleepTimerEndTime(): number | null {
        return this.sleepTimerEndTime
    }

    getSleepTimerRemaining(): number {
        if (!this.sleepTimerEndTime) return 0
        return Math.max(0, Math.floor((this.sleepTimerEndTime - Date.now()) / 1000))
    }
}

// =============================================================================
// Singleton
// =============================================================================

export const audioService = new AudioService();
