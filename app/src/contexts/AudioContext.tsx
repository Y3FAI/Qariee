import {
    createContext,
    useContext,
    useState,
    ReactNode,
    useRef,
    useEffect,
    useCallback,
} from "react"
import { AppState, AppStateStatus } from "react-native"
import { useAudioPlayer, setAudioModeAsync, AudioStatus } from "expo-audio"
import { audioService, Track, PlaybackMode } from "../services/audioService"
import { useNetwork } from "./NetworkContext"
import { audioStorage, ListeningSession } from "../services/audioStorage"

interface CurrentTrack {
    reciterId: string
    reciterName: string
    surahName: string
    surahNumber: number
    reciterColorPrimary?: string
    reciterColorSecondary?: string
}

interface AudioContextType {
    currentTrack: CurrentTrack | null
    setCurrentTrack: (track: CurrentTrack | null) => void
    isPlaying: boolean
    setIsPlaying: (playing: boolean) => void
    position: number
    duration: number
    playbackMode: PlaybackMode
    setPlaybackMode: (
        mode: PlaybackMode | ((prev: PlaybackMode) => PlaybackMode),
    ) => void
    playTrack: (track: Track, queue?: Track[]) => Promise<void>
    togglePlayPause: () => void
    seekTo: (seconds: number) => Promise<void>
    playNext: () => Promise<void>
    playPrevious: () => Promise<void>
}

const AudioContext = createContext<AudioContextType | undefined>(undefined)

export function AudioProvider({
    children,
}: {
    children: ReactNode
}) {
    const player = useAudioPlayer()
    const { isOffline } = useNetwork()
    const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [position, setPosition] = useState(0)
    const [duration, setDuration] = useState(0)
    const [playbackMode, setPlaybackModeState] =
        useState<PlaybackMode>("sequential")
    const sessionLoadedRef = useRef(false)

    // Load saved state (declared before the initializer effect)
    const loadSavedState = useCallback(async () => {
        try {
            // Load playback mode
            const savedMode = await audioStorage.loadPlaybackMode()
            if (savedMode) {
                setPlaybackModeState(savedMode)
                audioService.setPlaybackMode(savedMode)
            }

            // Load listening session
            const savedSession = await audioStorage.loadListeningSession()

            if (savedSession) {
                // Restore played track IDs and shuffle history from saved session
                if (savedSession.playedTrackIds) {
                    audioService.setPlayedTrackIds(savedSession.playedTrackIds)
                }
                if (savedSession.shuffleHistory) {
                    // Need to convert simplified history back to Track objects
                    // We'll create minimal track objects with just reciterId and surahNumber
                    // The full track info will be loaded later
                    const historyTracks: Track[] =
                        savedSession.shuffleHistory.map(
                            (item: {
                                reciterId: string
                                surahNumber: number
                            }) => ({
                                reciterId: item.reciterId,
                                surahNumber: item.surahNumber,
                                reciterName: savedSession.reciterName,
                                surahName: "", // Will be filled later
                                audioUrl: "", // Will be filled later
                                isDownloaded: false,
                                reciterColorPrimary:
                                    savedSession.reciterColorPrimary ||
                                    "#282828",
                                reciterColorSecondary:
                                    savedSession.reciterColorSecondary ||
                                    "#404040",
                            }),
                        )
                    audioService.setShuffleHistory(historyTracks)
                }
                if (savedSession.playedTracksOrder) {
                    // Convert simplified played tracks order back to Track objects
                    const orderTracks: Track[] =
                        savedSession.playedTracksOrder.map(
                            (item: {
                                reciterId: string
                                surahNumber: number
                            }) => ({
                                reciterId: item.reciterId,
                                surahNumber: item.surahNumber,
                                reciterName: savedSession.reciterName,
                                surahName: "", // Will be filled later
                                audioUrl: "", // Will be filled later
                                isDownloaded: false,
                                reciterColorPrimary:
                                    savedSession.reciterColorPrimary ||
                                    "#282828",
                                reciterColorSecondary:
                                    savedSession.reciterColorSecondary ||
                                    "#404040",
                            }),
                        )
                    audioService.setPlayedTracksOrder(orderTracks)
                }

                // Set track info
                setCurrentTrack({
                    reciterId: savedSession.reciterId,
                    reciterName: savedSession.reciterName,
                    surahName: savedSession.surahName,
                    surahNumber: savedSession.surahNumber,
                    reciterColorPrimary: savedSession.reciterColorPrimary,
                    reciterColorSecondary: savedSession.reciterColorSecondary,
                })
                // Set position and duration immediately for UI
                setPosition(savedSession.position)
                setDuration(savedSession.duration)

                // Pre-load the audio immediately so clicking play is instant
                preloadSavedSession(savedSession)
            }
        } catch (error) {
            console.error("Error loading saved state:", error)
        }
    }, [])

    // Initialize audio service with player and configure audio mode
    useEffect(() => {
        console.log("[AudioContext] Initializing audio service with player")
        audioService.initialize(player)

        // Configure audio mode for background playback
        setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            interruptionModeAndroid: "duckOthers",
            interruptionMode: "mixWithOthers",
        })

        // Load saved playback mode and listening session
        loadSavedState()

        return () => {
            // Don't release the player here - it causes "released" errors
        }
    }, [player, loadSavedState])

    // Pre-load saved session audio in background
    const preloadSavedSession = async (savedSession: ListeningSession) => {
        try {
            const { getAudioUrl } = await import("../constants/config")
            const { getAllSurahs } = await import("../services/database")
            const { isRTL } = await import("../services/i18n")

            const allSurahs = await getAllSurahs()
            const currentSurah = allSurahs.find(
                (s) => s.number === savedSession.surahNumber,
            )
            if (!currentSurah) return

            const rtl = isRTL()
            const track: Track = {
                reciterId: savedSession.reciterId,
                reciterName: savedSession.reciterName,
                surahNumber: savedSession.surahNumber,
                surahName: rtl ? currentSurah.name_ar : currentSurah.name_en,
                reciterColorPrimary:
                    savedSession.reciterColorPrimary || "#282828",
                reciterColorSecondary:
                    savedSession.reciterColorSecondary || "#404040",
                audioUrl: getAudioUrl(
                    savedSession.reciterId,
                    savedSession.surahNumber,
                ),
                isDownloaded: false,
            }

            // Build queue
            const queue: Track[] = allSurahs
                .filter((surah) => surah.number > savedSession.surahNumber)
                .map((surah) => ({
                    reciterId: savedSession.reciterId,
                    reciterName: savedSession.reciterName,
                    surahNumber: surah.number,
                    surahName: rtl ? surah.name_ar : surah.name_en,
                    reciterColorPrimary:
                        savedSession.reciterColorPrimary || "#282828",
                    reciterColorSecondary:
                        savedSession.reciterColorSecondary || "#404040",
                    audioUrl: getAudioUrl(savedSession.reciterId, surah.number),
                    isDownloaded: false,
                }))

            // Load audio and seek to position (but don't play)
            // isNewSession: false to preserve restored history from loadSavedState
            await audioService.play(track, queue, { autoPlay: false, isNewSession: false })
            if (savedSession.position > 0) {
                await audioService.seekTo(savedSession.position)
            }

            // Mark as loaded - audio is ready, just paused
            sessionLoadedRef.current = true
        } catch (error) {
            console.error("[AudioContext] Error pre-loading session:", error)
        }
    }

    // **CENTRAL STATE SYNC** - Single source of truth
    const syncStateFromService = useCallback(() => {
        const track = audioService.getCurrentTrack()
        if (track) {
            setCurrentTrack({
                reciterId: track.reciterId,
                reciterName: track.reciterName,
                surahName: track.surahName,
                surahNumber: track.surahNumber,
                reciterColorPrimary: track.reciterColorPrimary,
                reciterColorSecondary: track.reciterColorSecondary,
            })
        }
    }, [])

    // Update offline status in audio service
    useEffect(() => {
        const updateOfflineStatus = async () => {
            try {
                await audioService.setOfflineStatus(isOffline)
            } catch (error) {
                console.error("Error updating offline status:", error)
            }
        }
        updateOfflineStatus()
    }, [isOffline])

    // Update state from native playback status events (works even when device is off)
    useEffect(() => {
        if (!player) return

        const subscription = player.addListener(
            "playbackStatusUpdate",
            (status: AudioStatus) => {
                setIsPlaying(status.playing)

                // Only update position/duration from player if session has been loaded
                // This prevents overwriting saved position with 0 before user clicks play
                if (sessionLoadedRef.current) {
                    setPosition(status.currentTime)
                    setDuration(status.duration || 0)
                }

                // Sync track state from audio service to ensure UI shows correct track
                // This is especially important when tracks auto-advance via native events
                // (e.g., when device screen is off)
                syncStateFromService()
            },
        )

        return () => {
            subscription.remove()
        }
    }, [player, isPlaying, syncStateFromService])

    // Media controls are now updated from native playback status events
    // in audioService.ts (updateMediaControlPositionFromStatus)
    // This ensures updates work even when device is off/backgrounded

    // Handle app state changes (pause when app goes to background)
    useEffect(() => {
        const subscription = AppState.addEventListener(
            "change",
            (nextAppState: AppStateStatus) => {
                if (
                    nextAppState === "background" ||
                    nextAppState === "inactive"
                ) {
                    // App going to background - save state but let audio continue
                    // Media controls will handle pause if user presses pause button
                    if (currentTrack && sessionLoadedRef.current) {
                        audioStorage.saveListeningSession({
                            reciterId: currentTrack.reciterId,
                            reciterName: currentTrack.reciterName,
                            surahName: currentTrack.surahName,
                            surahNumber: currentTrack.surahNumber,
                            reciterColorPrimary:
                                currentTrack.reciterColorPrimary,
                            reciterColorSecondary:
                                currentTrack.reciterColorSecondary,
                            position,
                            duration,
                            timestamp: Date.now(),
                            playedTrackIds: Array.from(
                                audioService.getPlayedTrackIds(),
                            ),
                            shuffleHistory: audioService
                                .getShuffleHistory()
                                .map((track) => ({
                                    reciterId: track.reciterId,
                                    surahNumber: track.surahNumber,
                                })),
                            playedTracksOrder: audioService
                                .getPlayedTracksOrder()
                                .map((track) => ({
                                    reciterId: track.reciterId,
                                    surahNumber: track.surahNumber,
                                })),
                        })
                    }
                } else if (nextAppState === "active") {
                    // App came to foreground - sync state from audio service
                    syncStateFromService()
                }
            },
        )

        return () => {
            subscription.remove()
        }
    }, [currentTrack, position, duration, syncStateFromService])

    // Note: Track finished detection is handled by audioService.ts via native playback status events
    // to ensure it works even when app is backgrounded. We don't duplicate it here.

    const playTrack = async (track: Track, queue: Track[] = []) => {
        try {
            sessionLoadedRef.current = true

            await audioService.play(track, queue)

            // Sync state after playing
            syncStateFromService()
        } catch (error) {
            console.error("Error playing track:", error)
        }
    }

    const togglePlayPause = () => {
        // Replay finished track
        const isAtEnd = duration > 0 && position > 0 && duration - position < 1
        if (isAtEnd && !player.playing && currentTrack) {
            audioService.seekTo(0)
            audioService.resume()
        } else {
            // Simple toggle - audio is already loaded
            audioService.togglePlayPause()
        }
    }

    const seekTo = async (seconds: number) => {
        await audioService.seekTo(seconds)
    }

    const playNext = async () => {
        try {
            await audioService.playNext()

            // Sync state after playing next
            syncStateFromService()
        } catch (error) {
            console.error("Error playing next track:", error)

            // If error is due to offline, stop playback and show message would be handled by UI
            // For now, just ensure we sync state even on error
            syncStateFromService()
        }
    }

    const playPrevious = async () => {
        try {
            await audioService.playPrevious()
            syncStateFromService()
        } catch (error) {
            console.error("Error playing previous track:", error)
            syncStateFromService()
        }
    }

    const setPlaybackMode = (
        mode: PlaybackMode | ((prev: PlaybackMode) => PlaybackMode),
    ) => {
        // Handle both direct value and function updater
        const newMode = typeof mode === "function" ? mode(playbackMode) : mode
        setPlaybackModeState(newMode)
        audioService.setPlaybackMode(newMode)

        // Persist playback mode
        audioStorage.savePlaybackMode(newMode)
    }

    // Save listening session every 1 second ONLY during playback
    useEffect(() => {
        if (!currentTrack || !sessionLoadedRef.current || !isPlaying) {
            return
        }

        const saveInterval = setInterval(() => {
            // Read position/duration from player to avoid stale closure
            const currentPosition = audioService.getPlayer()?.currentTime ?? 0
            const currentDuration = audioService.getPlayer()?.duration ?? 0
            if (currentTrack && currentDuration > 0) {
                audioStorage.saveListeningSession({
                    reciterId: currentTrack.reciterId,
                    reciterName: currentTrack.reciterName,
                    surahName: currentTrack.surahName,
                    surahNumber: currentTrack.surahNumber,
                    reciterColorPrimary: currentTrack.reciterColorPrimary,
                    reciterColorSecondary: currentTrack.reciterColorSecondary,
                    position: currentPosition,
                    duration: currentDuration,
                    timestamp: Date.now(),
                    playedTrackIds: Array.from(
                        audioService.getPlayedTrackIds(),
                    ),
                    shuffleHistory: audioService
                        .getShuffleHistory()
                        .map((track) => ({
                            reciterId: track.reciterId,
                            surahNumber: track.surahNumber,
                        })),
                    playedTracksOrder: audioService
                        .getPlayedTracksOrder()
                        .map((track) => ({
                            reciterId: track.reciterId,
                            surahNumber: track.surahNumber,
                        })),
                })
            }
        }, 1000) // Save every 1 second while playing

        return () => clearInterval(saveInterval)
    }, [currentTrack, isPlaying]) // Removed position/duration - read from player inside

    // Save once when pausing
    useEffect(() => {
        if (
            !isPlaying &&
            currentTrack &&
            duration > 0 &&
            sessionLoadedRef.current
        ) {
            audioStorage.saveListeningSession({
                reciterId: currentTrack.reciterId,
                reciterName: currentTrack.reciterName,
                surahName: currentTrack.surahName,
                surahNumber: currentTrack.surahNumber,
                reciterColorPrimary: currentTrack.reciterColorPrimary,
                reciterColorSecondary: currentTrack.reciterColorSecondary,
                position,
                duration,
                timestamp: Date.now(),
                playedTrackIds: Array.from(audioService.getPlayedTrackIds()),
                shuffleHistory: audioService
                    .getShuffleHistory()
                    .map((track) => ({
                        reciterId: track.reciterId,
                        surahNumber: track.surahNumber,
                    })),
                playedTracksOrder: audioService
                    .getPlayedTracksOrder()
                    .map((track) => ({
                        reciterId: track.reciterId,
                        surahNumber: track.surahNumber,
                    })),
            })
        }
    }, [isPlaying, currentTrack, duration, position])

    return (
        <AudioContext.Provider
            value={{
                currentTrack,
                setCurrentTrack,
                isPlaying,
                setIsPlaying,
                position,
                duration,
                playbackMode,
                setPlaybackMode,
                playTrack,
                togglePlayPause,
                seekTo,
                playNext,
                playPrevious,
            }}
        >
            {children}
        </AudioContext.Provider>
    )
}

export function useAudio() {
    const context = useContext(AudioContext)
    if (context === undefined) {
        throw new Error("useAudio must be used within an AudioProvider")
    }
    return context
}
