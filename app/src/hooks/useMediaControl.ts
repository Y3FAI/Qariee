import { useRef, useEffect, useCallback } from "react"
import BackgroundTimer from "react-native-background-timer"
import MediaControl, { PlaybackState, Command } from "expo-media-control"
import { audioService } from "../services/audioService"
import { getReciterPhotoUrl } from "../constants/config"

interface TrackInfo {
    reciterId: string
    reciterName: string
    surahName: string
    surahNumber: number
}

interface UseMediaControlOptions {
    currentTrack: TrackInfo | null
    isPlaying: boolean
    duration: number
    onNext: () => void
    onPrevious: () => void
}

export function useMediaControl({
    currentTrack,
    isPlaying,
    duration,
    onNext,
    onPrevious,
}: UseMediaControlOptions) {
    const enabledRef = useRef(false)
    const listenerSetupRef = useRef(false)
    const isInitializingRef = useRef(true)
    const lastMetadataRef = useRef<{
        title?: string
        artist?: string
        artworkUrl?: string
        duration?: number
    } | null>(null)

    // Refs for callbacks (to avoid stale closures in listener)
    const onNextRef = useRef(onNext)
    const onPreviousRef = useRef(onPrevious)

    useEffect(() => { onNextRef.current = onNext }, [onNext])
    useEffect(() => { onPreviousRef.current = onPrevious }, [onPrevious])

    const updateMetadata = useCallback(async (metadata: {
        title?: string
        artist?: string
        artworkUrl?: string
        duration?: number
    }) => {
        lastMetadataRef.current = metadata

        if (!enabledRef.current) return

        try {
            await MediaControl.updateMetadata({
                title: metadata.title,
                artist: metadata.artist,
                duration: metadata.duration,
                ...(metadata.artworkUrl && { artwork: { uri: metadata.artworkUrl } })
            })
        } catch (error) {
            console.error('[MediaControl] Failed to update metadata:', error)
        }
    }, [])

    const updatePlaybackState = useCallback(async (playing: boolean, pos?: number) => {
        if (!enabledRef.current) return

        try {
            await MediaControl.updatePlaybackState(
                playing ? PlaybackState.PLAYING : PlaybackState.PAUSED,
                pos ?? audioService.getCurrentTime(),
                playing ? 1.0 : 0.0
            )
        } catch (error) {
            console.error('[MediaControl] Failed to update state:', error)
        }
    }, [])

    const hide = useCallback(async () => {
        if (!enabledRef.current) return

        try {
            await MediaControl.disableMediaControls()
            enabledRef.current = false
        } catch (error) {
            console.error('[MediaControl] Failed to hide:', error)
        }
    }, [])

    const show = useCallback(async () => {
        if (enabledRef.current) return

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
                notification: { showWhenClosed: true },
            })
            enabledRef.current = true

            // Re-apply metadata
            if (lastMetadataRef.current) {
                await updateMetadata(lastMetadataRef.current)
            }
        } catch (error) {
            console.error('[MediaControl] Failed to show:', error)
        }
    }, [updateMetadata])

    // Setup listener once
    useEffect(() => {
        const setup = async () => {
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
                    notification: { showWhenClosed: true },
                })

                if (!listenerSetupRef.current) {
                    listenerSetupRef.current = true

                    MediaControl.addListener((event) => {
                        // Ignore PLAY during initialization
                        if (isInitializingRef.current && event.command === Command.PLAY) {
                            return
                        }

                        try {
                            switch (event.command) {
                                case Command.PLAY:
                                    audioService.resume()
                                    break
                                case Command.PAUSE:
                                    audioService.pause()
                                    break
                                case Command.NEXT_TRACK:
                                    onNextRef.current()
                                    break
                                case Command.PREVIOUS_TRACK:
                                    onPreviousRef.current()
                                    break
                                case Command.STOP:
                                    audioService.stop()
                                    hide()
                                    break
                                case Command.SKIP_FORWARD:
                                    audioService.seekTo(
                                        Math.min(audioService.getCurrentTime() + 15, audioService.getDuration())
                                    )
                                    break
                                case Command.SKIP_BACKWARD:
                                    audioService.seekTo(
                                        Math.max(audioService.getCurrentTime() - 15, 0)
                                    )
                                    break
                                case Command.SEEK:
                                    if (event.data?.position !== undefined) {
                                        audioService.seekTo(event.data.position)
                                    }
                                    break
                            }
                        } catch (error) {
                            console.warn('[MediaControl] Event handling failed:', error)
                        }
                    })
                }

                enabledRef.current = true
            } catch (error) {
                console.error('[MediaControl] Setup failed:', error)
            }
        }

        setup()
    }, [hide])

    // Update playback state immediately on play/pause changes
    // Periodic updates are handled by AudioContext's consolidated interval
    useEffect(() => {
        if (!currentTrack) return
        updatePlaybackState(isPlaying)
    }, [currentTrack, isPlaying, updatePlaybackState])

    // Update metadata when track changes
    useEffect(() => {
        if (!currentTrack) return

        updateMetadata({
            title: currentTrack.surahName,
            artist: currentTrack.reciterName,
            artworkUrl: getReciterPhotoUrl(currentTrack.reciterId),
            duration: duration > 0 ? duration : undefined,
        })
    }, [currentTrack, duration, updateMetadata])

    const markInitialized = useCallback(() => {
        isInitializingRef.current = false
    }, [])

    return {
        show,
        hide,
        markInitialized,
        updatePlaybackState,
    }
}
