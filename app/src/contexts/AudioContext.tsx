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
import { downloadService } from "../services/downloadService"
import { getAudioUrl } from "../constants/config"

interface CurrentTrack {
    reciterId: string
    reciterName: string
    surahName: string
    surahNumber: number
    reciterColorPrimary?: string
    reciterColorSecondary?: string
}

// TrackReference is used for history tracking (doesn't need audioUrl/isDownloaded)
interface TrackReference {
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

export function AudioProvider({ children }: { children: ReactNode }) {
    const player = useAudioPlayer()
    const { isOffline } = useNetwork()
    const sessionLoadedRef = useRef(false)

    // ==========================================================================
    // State
    // ==========================================================================
    const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [position, setPosition] = useState(0)
    const [duration, setDuration] = useState(0)
    const [playbackMode, setPlaybackModeState] = useState<PlaybackMode>("sequential")
    const [queue, setQueue] = useState<Track[]>([])
    const [originalQueue, setOriginalQueue] = useState<Track[]>([])
    const [playedTrackIds, setPlayedTrackIds] = useState<Set<string>>(new Set())
    const [shuffleHistory, setShuffleHistory] = useState<TrackReference[]>([])
    const [playedTracksOrder, setPlayedTracksOrder] = useState<TrackReference[]>([])

    // ==========================================================================
    // Initialize
    // ==========================================================================
    useEffect(() => {
        audioService.initialize(player)

        setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            interruptionModeAndroid: "duckOthers",
            interruptionMode: "mixWithOthers",
        })

        loadSavedState()

        return () => {}
    }, [player])

    // ==========================================================================
    // Refs for latest values (to avoid closure issues in callbacks)
    // ==========================================================================
    const queueRef = useRef(queue)
    const currentTrackRef = useRef(currentTrack)
    const playbackModeRef = useRef(playbackMode)

    useEffect(() => { queueRef.current = queue }, [queue])
    useEffect(() => { currentTrackRef.current = currentTrack }, [currentTrack])
    useEffect(() => { playbackModeRef.current = playbackMode }, [playbackMode])

    // ==========================================================================
    // Track finish handler (defined before effects that use it)
    // ==========================================================================
    const handleTrackFinished = useCallback(() => {
        const current = currentTrackRef.current
        if (!current) return

        console.log('[AudioContext] Track finished, handling auto-advance')
        console.log('[AudioContext] Queue length:', queueRef.current.length)

        // Mark current track as played
        setPlayedTrackIds(prev => new Set([...prev, `${current.reciterId}:${current.surahNumber}`]))

        if (playbackModeRef.current === "repeat") {
            // Replay from beginning
            console.log('[AudioContext] Repeat mode - restarting track')
            audioService.seekTo(0)
            audioService.resume()
        } else if (queueRef.current.length > 0) {
            // Play next in queue
            console.log('[AudioContext] Playing next track')
            const nextTrack = queueRef.current[0]
            const remainingQueue = queueRef.current.slice(1)

            // Update played order
            setPlayedTracksOrder(prev => [...prev, current])

            // Set current track to next
            setCurrentTrack({
                reciterId: nextTrack.reciterId,
                reciterName: nextTrack.reciterName,
                surahName: nextTrack.surahName,
                surahNumber: nextTrack.surahNumber,
                reciterColorPrimary: nextTrack.reciterColorPrimary,
                reciterColorSecondary: nextTrack.reciterColorSecondary,
            })

            // Update queue
            setQueue(remainingQueue)

            // Play the next track
            downloadService.getLocalPath(nextTrack.reciterId, nextTrack.surahNumber).then(localPath => {
                const audioSource = localPath || nextTrack.audioUrl
                console.log('[AudioContext] Auto-advancing to:', nextTrack.surahName)
                audioService.play(audioSource)
            })
        } else {
            console.log('[AudioContext] No more tracks in queue')
            audioService.pause()
        }
    }, [])

    // ==========================================================================
    // Player events - handles status updates AND auto-advance
    // ==========================================================================
    useEffect(() => {
        if (!player) return

        const subscription = player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
            setIsPlaying(status.playing)
            if (sessionLoadedRef.current) {
                setPosition(status.currentTime)
                setDuration(status.duration || 0)
            }

            // Handle track finish for auto-advance
            if (status.didJustFinish) {
                console.log('[AudioContext] didJustFinish detected')
                handleTrackFinished()
            }
        })

        return () => subscription.remove()
    }, [player, handleTrackFinished])

    // ==========================================================================
    // Media Controls - Update playback state periodically
    // ==========================================================================
    useEffect(() => {
        if (!currentTrack) return

        // Update playback state every second when playing
        const interval = setInterval(() => {
            if (isPlaying) {
                audioService.updatePlaybackState(isPlaying, position)
            }
        }, 1000)

        // Also update immediately when isPlaying changes
        audioService.updatePlaybackState(isPlaying, position)

        return () => clearInterval(interval)
    }, [currentTrack, isPlaying, position])

    // ==========================================================================
    // Media Controls - Update metadata when track changes
    // ==========================================================================
    useEffect(() => {
        if (!currentTrack) return

        const updateMetadata = async () => {
            const { getReciterPhotoUrl } = await import("../constants/config")
            await audioService.updateMediaMetadata({
                title: currentTrack.surahName,
                artist: currentTrack.reciterName,
                artworkUrl: getReciterPhotoUrl(currentTrack.reciterId),
                duration: duration > 0 ? duration : undefined,
            })
        }

        updateMetadata()
    }, [currentTrack])

    // ==========================================================================
    // Load saved state
    // ==========================================================================
    const loadSavedState = useCallback(async () => {
        const savedMode = await audioStorage.loadPlaybackMode()
        if (savedMode) {
            setPlaybackModeState(savedMode)
        }

        const savedSession = await audioStorage.loadListeningSession()
        if (savedSession) {
            setPlayedTrackIds(new Set(savedSession.playedTrackIds || []))

            const track: CurrentTrack = {
                reciterId: savedSession.reciterId,
                reciterName: savedSession.reciterName,
                surahName: savedSession.surahName,
                surahNumber: savedSession.surahNumber,
                reciterColorPrimary: savedSession.reciterColorPrimary,
                reciterColorSecondary: savedSession.reciterColorSecondary,
            }
            setCurrentTrack(track)
            setPosition(savedSession.position)
            setDuration(savedSession.duration)

            await preloadSavedSession(savedSession)
        }
    }, [])

    const preloadSavedSession = async (savedSession: ListeningSession) => {
        const { getAllSurahs } = await import("../services/database")
        const { isRTL } = await import("../services/i18n")

        const allSurahs = await getAllSurahs()
        const currentSurah = allSurahs.find(s => s.number === savedSession.surahNumber)
        if (!currentSurah) return

        const rtl = isRTL()
        const track: Track = {
            reciterId: savedSession.reciterId,
            reciterName: savedSession.reciterName,
            surahNumber: savedSession.surahNumber,
            surahName: rtl ? currentSurah.name_ar : currentSurah.name_en,
            audioUrl: getAudioUrl(savedSession.reciterId, savedSession.surahNumber),
            isDownloaded: false,
            reciterColorPrimary: savedSession.reciterColorPrimary,
            reciterColorSecondary: savedSession.reciterColorSecondary,
        }

        const trackQueue: Track[] = allSurahs
            .filter(s => s.number > savedSession.surahNumber)
            .map(surah => ({
                reciterId: savedSession.reciterId,
                reciterName: savedSession.reciterName,
                surahNumber: surah.number,
                surahName: rtl ? surah.name_ar : surah.name_en,
                audioUrl: getAudioUrl(savedSession.reciterId, surah.number),
                isDownloaded: false,
                reciterColorPrimary: savedSession.reciterColorPrimary,
                reciterColorSecondary: savedSession.reciterColorSecondary,
            }))

        setQueue(trackQueue)
        setOriginalQueue(trackQueue)

        // Load the track into player but DON'T auto-play
        // User must click play to resume - better UX
        const localPath = await downloadService.getLocalPath(track.reciterId, track.surahNumber)
        const audioSource = localPath || track.audioUrl

        // Just replace the source, don't play
        player.replace(audioSource)
        if (savedSession.position > 0) {
            audioService.seekTo(savedSession.position)
        }

        sessionLoadedRef.current = true
    }

    // ==========================================================================
    // Shuffle
    // ==========================================================================
    const shuffleArray = <T,>(array: T[]): T[] => {
        const shuffled = [...array]
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled
    }

    const getShuffledQueue = useCallback((tracks: Track[]): Track[] => {
        // Filter out recently played (last 5)
        const recentIds = shuffleHistory.slice(0, 5).map(t => `${t.reciterId}:${t.surahNumber}`)
        const available = tracks.filter(t => !recentIds.includes(`${t.reciterId}:${t.surahNumber}`))

        if (available.length === 0) {
            // All tracks played recently, shuffle full queue
            return shuffleArray(tracks)
        }

        return shuffleArray(available)
    }, [shuffleHistory])

    // ==========================================================================
    // Actions
    // ==========================================================================
    const playTrack = async (track: Track, trackQueue: Track[] = []) => {
        sessionLoadedRef.current = true

        // Build queue if offline
        let filteredQueue = trackQueue
        if (isOffline && trackQueue.length > 0) {
            const downloaded = await Promise.all(
                trackQueue.map(async t => {
                    const localPath = await downloadService.getLocalPath(t.reciterId, t.surahNumber)
                    return localPath ? t : null
                })
            )
            filteredQueue = downloaded.filter((t): t is Track => t !== null)
        }

        // Apply shuffle if needed
        let finalQueue = filteredQueue
        if (playbackMode === "shuffle" && filteredQueue.length > 0) {
            finalQueue = getShuffledQueue(filteredQueue)
        }

        setQueue(finalQueue)
        setOriginalQueue(filteredQueue)
        setPlayedTrackIds(new Set())
        setShuffleHistory([])
        setPlayedTracksOrder([])

        setCurrentTrack({
            reciterId: track.reciterId,
            reciterName: track.reciterName,
            surahName: track.surahName,
            surahNumber: track.surahNumber,
            reciterColorPrimary: track.reciterColorPrimary,
            reciterColorSecondary: track.reciterColorSecondary,
        })

        const localPath = await downloadService.getLocalPath(track.reciterId, track.surahNumber)
        const audioSource = localPath || track.audioUrl

        await audioService.play(audioSource)
    }

    const togglePlayPause = () => {
        const isAtEnd = duration > 0 && position > 0 && duration - position < 1
        if (isAtEnd && !player.playing && currentTrack) {
            audioService.seekTo(0)
            audioService.resume()
        } else if (isPlaying) {
            audioService.pause()
        } else {
            audioService.resume()
        }
    }

    const seekTo = async (seconds: number) => {
        await audioService.seekTo(seconds)
    }

    const playNext = async () => {
        if (queue.length === 0) {
            audioService.pause()
            return
        }

        const nextTrack = queue[0]
        const remainingQueue = queue.slice(1)

        // Update played order
        if (currentTrack) {
            setPlayedTracksOrder(prev => [...prev, currentTrack])
        }
        if (playbackMode === "shuffle") {
            setShuffleHistory(prev => [currentTrack!, ...prev].slice(0, 5))
        }

        // Build next queue (filter for offline)
        let nextQueue = remainingQueue
        if (isOffline && remainingQueue.length > 0) {
            const downloaded = await Promise.all(
                remainingQueue.map(async t => {
                    const localPath = await downloadService.getLocalPath(t.reciterId, t.surahNumber)
                    return localPath ? t : null
                })
            )
            nextQueue = downloaded.filter((t): t is Track => t !== null)
        }

        // Re-shuffle if needed
        if (playbackMode === "shuffle") {
            // Add current track to history before shuffling
            const updatedHistory = currentTrack ? [currentTrack, ...shuffleHistory].slice(0, 5) : shuffleHistory
            setShuffleHistory(updatedHistory)

            // Re-shuffle remaining queue
            const recentIds = updatedHistory.map(t => `${t.reciterId}:${t.surahNumber}`)
            const available = nextQueue.filter(t => !recentIds.includes(`${t.reciterId}:${t.surahNumber}`))

            if (available.length > 0) {
                nextQueue = shuffleArray(available)
            }
        }

        setQueue(nextQueue)
        setCurrentTrack({
            reciterId: nextTrack.reciterId,
            reciterName: nextTrack.reciterName,
            surahName: nextTrack.surahName,
            surahNumber: nextTrack.surahNumber,
            reciterColorPrimary: nextTrack.reciterColorPrimary,
            reciterColorSecondary: nextTrack.reciterColorSecondary,
        })

        const localPath = await downloadService.getLocalPath(nextTrack.reciterId, nextTrack.surahNumber)
        const audioSource = localPath || nextTrack.audioUrl

        console.log('[AudioContext] playNext: playing', nextTrack.surahName)
        await audioService.play(audioSource)
    }

    const playPrevious = async () => {
        if (playedTracksOrder.length === 0) return

        const prevTrack = playedTracksOrder[playedTracksOrder.length - 1]
        const newOrder = playedTracksOrder.slice(0, -1)
        setPlayedTracksOrder(newOrder)

        // Rebuild queue with this track and everything after
        const { getAllSurahs } = await import("../services/database")
        const { isRTL } = await import("../services/i18n")

        const allSurahs = await getAllSurahs()
        const rtl = isRTL()

        const rebuildQueue: Track[] = allSurahs
            .filter(s => s.number > prevTrack.surahNumber)
            .map(surah => ({
                reciterId: prevTrack.reciterId,
                reciterName: prevTrack.reciterName,
                surahNumber: surah.number,
                surahName: rtl ? surah.name_ar : surah.name_en,
                audioUrl: getAudioUrl(prevTrack.reciterId, surah.number),
                isDownloaded: false,
                reciterColorPrimary: prevTrack.reciterColorPrimary,
                reciterColorSecondary: prevTrack.reciterColorSecondary,
            }))

        if (playbackMode === "shuffle") {
            setQueue(shuffleArray(rebuildQueue))
        } else {
            setQueue(rebuildQueue)
        }
        setOriginalQueue(rebuildQueue)

        setCurrentTrack({
            reciterId: prevTrack.reciterId,
            reciterName: prevTrack.reciterName,
            surahName: prevTrack.surahName,
            surahNumber: prevTrack.surahNumber,
            reciterColorPrimary: prevTrack.reciterColorPrimary,
            reciterColorSecondary: prevTrack.reciterColorSecondary,
        })

        const localPath = await downloadService.getLocalPath(prevTrack.reciterId, prevTrack.surahNumber)
        const audioSource = localPath || getAudioUrl(prevTrack.reciterId, prevTrack.surahNumber)

        await audioService.play(audioSource)
    }

    const setPlaybackMode = (mode: PlaybackMode | ((prev: PlaybackMode) => PlaybackMode)) => {
        const newMode = typeof mode === "function" ? mode(playbackMode) : mode
        setPlaybackModeState(newMode)
        audioStorage.savePlaybackMode(newMode)

        // Re-shuffle current queue if switching to shuffle
        if (newMode === "shuffle" && queue.length > 0) {
            const shuffled = getShuffledQueue(queue)
            setQueue(shuffled)
            setOriginalQueue(queue)
        } else if (newMode === "sequential" && originalQueue.length > 0) {
            setQueue([...originalQueue])
        }
    }

    // ==========================================================================
    // Session persistence
    // ==========================================================================
    useEffect(() => {
        if (!currentTrack || !sessionLoadedRef.current || !isPlaying) return

        const saveInterval = setInterval(() => {
            const currentPosition = audioService.getCurrentTime()
            const currentDuration = audioService.getDuration()

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
                playedTrackIds: Array.from(playedTrackIds),
                shuffleHistory: shuffleHistory.map(t => ({
                    reciterId: t.reciterId,
                    surahNumber: t.surahNumber,
                })),
                playedTracksOrder: playedTracksOrder.map(t => ({
                    reciterId: t.reciterId,
                    surahNumber: t.surahNumber,
                })),
            })
        }, 1000)

        return () => clearInterval(saveInterval)
    }, [currentTrack, isPlaying, playedTrackIds, shuffleHistory, playedTracksOrder])

    useEffect(() => {
        if (!isPlaying && currentTrack && duration > 0 && sessionLoadedRef.current) {
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
                playedTrackIds: Array.from(playedTrackIds),
                shuffleHistory: shuffleHistory.map(t => ({
                    reciterId: t.reciterId,
                    surahNumber: t.surahNumber,
                })),
                playedTracksOrder: playedTracksOrder.map(t => ({
                    reciterId: t.reciterId,
                    surahNumber: t.surahNumber,
                })),
            })
        }
    }, [isPlaying, currentTrack, duration, position, playedTrackIds, shuffleHistory, playedTracksOrder])

    // ==========================================================================
    // App state changes
    // ==========================================================================
    useEffect(() => {
        const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
            if (nextAppState === "background" || nextAppState === "inactive") {
                if (currentTrack && sessionLoadedRef.current) {
                    const currentPosition = audioService.getCurrentTime()
                    const currentDuration = audioService.getDuration()

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
                        playedTrackIds: Array.from(playedTrackIds),
                        shuffleHistory: shuffleHistory.map(t => ({
                            reciterId: t.reciterId,
                            surahNumber: t.surahNumber,
                        })),
                        playedTracksOrder: playedTracksOrder.map(t => ({
                            reciterId: t.reciterId,
                            surahNumber: t.surahNumber,
                        })),
                    })
                }
            }
        })

        return () => subscription.remove()
    }, [currentTrack, playedTrackIds, shuffleHistory, playedTracksOrder])

    // ==========================================================================
    // Offline handling
    // ==========================================================================
    useEffect(() => {
        // If going offline and current track not downloaded, stop
        if (isOffline && currentTrack) {
            downloadService.isDownloaded(currentTrack.reciterId, currentTrack.surahNumber).then(
                isDownloaded => {
                    if (!isDownloaded && isPlaying) {
                        audioService.pause()
                    }
                }
            )
        }
    }, [isOffline])

    // ==========================================================================
    // Context value
    // ==========================================================================
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
