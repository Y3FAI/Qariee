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
import BackgroundTimer from "react-native-background-timer"
import { useAudioPlayer, setAudioModeAsync, AudioStatus } from "expo-audio"
import { audioService, Track, PlaybackMode } from "../services/audioService"
import { useNetwork } from "./NetworkContext"
import { audioStorage, ListeningSession } from "../services/audioStorage"
import { downloadService } from "../services/downloadService"
import { getAudioUrl } from "../constants/config"
import { useMediaControl } from "../hooks/useMediaControl"

interface TrackInfo {
    reciterId: string
    reciterName: string
    surahName: string
    surahNumber: number
    reciterColorPrimary?: string
    reciterColorSecondary?: string
}

interface AudioContextType {
    currentTrack: TrackInfo | null
    setCurrentTrack: (track: TrackInfo | null) => void
    isPlaying: boolean
    setIsPlaying: (playing: boolean) => void
    position: number
    duration: number
    playbackMode: PlaybackMode
    setPlaybackMode: (mode: PlaybackMode | ((prev: PlaybackMode) => PlaybackMode)) => void
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
    const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [position, setPosition] = useState(0)
    const [duration, setDuration] = useState(0)
    const [playbackMode, setPlaybackModeState] = useState<PlaybackMode>("sequential")
    const [queue, setQueue] = useState<Track[]>([])
    const [originalQueue, setOriginalQueue] = useState<Track[]>([])
    const [playedTrackIds, setPlayedTrackIds] = useState<Set<string>>(new Set())
    const [shuffleHistory, setShuffleHistory] = useState<TrackInfo[]>([])
    const [playedTracksOrder, setPlayedTracksOrder] = useState<TrackInfo[]>([])

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
        const recentIds = shuffleHistory.slice(0, 5).map(t => `${t.reciterId}:${t.surahNumber}`)
        const available = tracks.filter(t => !recentIds.includes(`${t.reciterId}:${t.surahNumber}`))

        if (available.length === 0) {
            return shuffleArray(tracks)
        }
        return shuffleArray(available)
    }, [shuffleHistory])

    // ==========================================================================
    // Actions (defined early so they can be passed to useMediaControl)
    // ==========================================================================
    const playNext = useCallback(async () => {
        if (queueRef.current.length === 0) {
            audioService.pause()
            return
        }

        const nextTrack = queueRef.current[0]
        const remainingQueue = queueRef.current.slice(1)
        const current = currentTrackRef.current

        if (current) {
            setPlayedTracksOrder(prev => [...prev, current])
        }
        if (playbackModeRef.current === "shuffle" && current) {
            setShuffleHistory(prev => [current, ...prev].slice(0, 5))
        }

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

        if (playbackModeRef.current === "shuffle") {
            const recentIds = shuffleHistory.slice(0, 5).map(t => `${t.reciterId}:${t.surahNumber}`)
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
        await audioService.play(localPath || nextTrack.audioUrl)
    }, [isOffline, shuffleHistory])

    const playPrevious = useCallback(async () => {
        if (playedTracksOrder.length === 0) return

        const prevTrack = playedTracksOrder[playedTracksOrder.length - 1]
        setPlayedTracksOrder(prev => prev.slice(0, -1))

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

        setQueue(playbackModeRef.current === "shuffle" ? shuffleArray(rebuildQueue) : rebuildQueue)
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
        await audioService.play(localPath || getAudioUrl(prevTrack.reciterId, prevTrack.surahNumber))
    }, [playedTracksOrder])

    // ==========================================================================
    // MediaControl Hook
    // ==========================================================================
    const { show: showMediaControl, markInitialized } = useMediaControl({
        currentTrack,
        isPlaying,
        duration,
        onNext: playNext,
        onPrevious: playPrevious,
    })

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
    }, [player])

    // ==========================================================================
    // Track finish handler
    // ==========================================================================
    const handleTrackFinished = useCallback(() => {
        const current = currentTrackRef.current
        if (!current) return

        setPlayedTrackIds(prev => new Set([...prev, `${current.reciterId}:${current.surahNumber}`]))

        if (playbackModeRef.current === "repeat") {
            audioService.seekTo(0)
            audioService.resume()
        } else if (queueRef.current.length > 0) {
            const nextTrack = queueRef.current[0]
            const remainingQueue = queueRef.current.slice(1)

            setPlayedTracksOrder(prev => [...prev, current])
            setCurrentTrack({
                reciterId: nextTrack.reciterId,
                reciterName: nextTrack.reciterName,
                surahName: nextTrack.surahName,
                surahNumber: nextTrack.surahNumber,
                reciterColorPrimary: nextTrack.reciterColorPrimary,
                reciterColorSecondary: nextTrack.reciterColorSecondary,
            })
            setQueue(remainingQueue)

            downloadService.getLocalPath(nextTrack.reciterId, nextTrack.surahNumber).then(localPath => {
                const audioSource = localPath || nextTrack.audioUrl
                audioService.play(audioSource)
            })
        } else {
            audioService.pause()
        }
    }, [])

    // ==========================================================================
    // Player events
    // ==========================================================================
    useEffect(() => {
        if (!player) return

        const subscription = player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
            setIsPlaying(status.playing)
            if (sessionLoadedRef.current) {
                setPosition(status.currentTime)
                setDuration(status.duration || 0)
            }

            if (status.didJustFinish) {
                handleTrackFinished()
            }
        })

        return () => subscription.remove()
    }, [player, handleTrackFinished])

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

            setCurrentTrack({
                reciterId: savedSession.reciterId,
                reciterName: savedSession.reciterName,
                surahName: savedSession.surahName,
                surahNumber: savedSession.surahNumber,
                reciterColorPrimary: savedSession.reciterColorPrimary,
                reciterColorSecondary: savedSession.reciterColorSecondary,
            })
            setPosition(savedSession.position)
            setDuration(savedSession.duration)

            await preloadSavedSession(savedSession)
        }

        markInitialized()
    }, [markInitialized])

    const preloadSavedSession = async (savedSession: ListeningSession) => {
        const { getAllSurahs } = await import("../services/database")
        const { isRTL } = await import("../services/i18n")

        const allSurahs = await getAllSurahs()
        const currentSurah = allSurahs.find(s => s.number === savedSession.surahNumber)
        if (!currentSurah) return

        const rtl = isRTL()
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

        const localPath = await downloadService.getLocalPath(savedSession.reciterId, savedSession.surahNumber)
        const audioSource = localPath || getAudioUrl(savedSession.reciterId, savedSession.surahNumber)

        player.replace(audioSource)
        await new Promise(r => setTimeout(r, 100))
        audioService.pause()

        if (savedSession.position > 0) {
            audioService.seekTo(savedSession.position)
        }

        sessionLoadedRef.current = true
    }

    // ==========================================================================
    // Actions
    // ==========================================================================
    const playTrack = async (track: Track, trackQueue: Track[] = []) => {
        sessionLoadedRef.current = true

        await showMediaControl()

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
        audioService.seekTo(seconds)
    }

    const setPlaybackMode = (mode: PlaybackMode | ((prev: PlaybackMode) => PlaybackMode)) => {
        const newMode = typeof mode === "function" ? mode(playbackMode) : mode
        setPlaybackModeState(newMode)
        audioStorage.savePlaybackMode(newMode)

        if (newMode === "shuffle" && queue.length > 0) {
            setQueue(getShuffledQueue(queue))
            setOriginalQueue(queue)
        } else if (newMode === "sequential" && originalQueue.length > 0) {
            setQueue([...originalQueue])
        }
    }

    // ==========================================================================
    // Session persistence
    // ==========================================================================
    const buildSessionData = useCallback((
        track: TrackInfo,
        pos: number,
        dur: number,
    ): ListeningSession => ({
        reciterId: track.reciterId,
        reciterName: track.reciterName,
        surahName: track.surahName,
        surahNumber: track.surahNumber,
        reciterColorPrimary: track.reciterColorPrimary,
        reciterColorSecondary: track.reciterColorSecondary,
        position: pos,
        duration: dur,
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
    }), [playedTrackIds, shuffleHistory, playedTracksOrder])

    useEffect(() => {
        if (!currentTrack || !sessionLoadedRef.current || !isPlaying) return

        const interval = BackgroundTimer.setInterval(() => {
            audioStorage.saveListeningSession(
                buildSessionData(currentTrack, audioService.getCurrentTime(), audioService.getDuration())
            )
        }, 1000)

        return () => BackgroundTimer.clearInterval(interval)
    }, [currentTrack, isPlaying, buildSessionData])

    useEffect(() => {
        if (!isPlaying && currentTrack && duration > 0 && sessionLoadedRef.current) {
            audioStorage.saveListeningSession(buildSessionData(currentTrack, position, duration))
        }
    }, [isPlaying, currentTrack, duration, position, buildSessionData])

    // ==========================================================================
    // App state changes
    // ==========================================================================
    useEffect(() => {
        const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
            if (nextAppState === "background" || nextAppState === "inactive") {
                if (currentTrack && sessionLoadedRef.current) {
                    audioStorage.saveListeningSession(
                        buildSessionData(currentTrack, audioService.getCurrentTime(), audioService.getDuration())
                    )
                }
            }
        })

        return () => subscription.remove()
    }, [currentTrack, buildSessionData])

    // ==========================================================================
    // Offline handling
    // ==========================================================================
    useEffect(() => {
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
