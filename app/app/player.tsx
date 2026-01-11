import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    BackHandler,
    Alert,
} from "react-native"
import { useState, useEffect, useRef } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import Slider from "@react-native-community/slider"
import { useAudio } from "../src/contexts/AudioContext"
import { useDownload } from "../src/contexts/DownloadContext"
import { useSleepTimer } from "../src/contexts/SleepTimerContext"
import { useNetwork } from "../src/contexts/NetworkContext"
import { useTheme } from "../src/contexts/ThemeContext"
import { useTranslation } from "react-i18next"
import { getReciterPhotoUrl, getAudioUrl } from "../src/constants/config"
import { isRTL, isArabic } from "../src/services/i18n"
import { getFontFamily } from "../src/utils/fonts"
import { hexToRgba } from "../src/utils/color"
import { formatTime } from "../src/utils/time"
import SurahName from "../src/components/SurahName"
import CircularProgress from "../src/components/CircularProgress"
import SleepTimerModal from "../src/components/SleepTimerModal"
import { getAllSurahs } from "../src/services/database"
import { Track } from "../src/services/audioService"

const { width, height } = Dimensions.get("window")

// ===========================
// RESPONSIVE LAYOUT CALCULATOR
// ===========================

/**
 * Calculate responsive layout dimensions based on screen size and safe area insets
 *
 * This function ensures the player UI adapts to different device screens by:
 * 1. Calculating available vertical space after accounting for fixed elements and insets
 * 2. Sizing the artwork to fit within available space (max 50% of vertical space)
 * 3. Distributing remaining space proportionally for margins
 * 4. Scaling down fonts on smaller screens (< 700px height)
 * 5. Using flexbox (justifyContent: center) to vertically center content
 *
 * Now accepts safe area insets for dynamic calculation during render.
 */
const calculateLayout = (insetTop: number = 0, insetBottom: number = 0) => {
    // Use actual insets instead of estimate
    const SAFE_AREA_TOTAL = insetTop + insetBottom
    const SLIDER_AREA = 60 // Slider height
    const TIME_DISPLAY = 20 // Time text area
    const SIDE_CONTROLS = 50 // Side controls row
    const PLAY_BUTTON_AREA = 140 // Play button + skip buttons
    const FIXED_ELEMENTS_HEIGHT =
        SAFE_AREA_TOTAL +
        SLIDER_AREA +
        TIME_DISPLAY +
        SIDE_CONTROLS +
        PLAY_BUTTON_AREA

    // Available space for artwork + info + margins
    const AVAILABLE_VERTICAL_SPACE = height - FIXED_ELEMENTS_HEIGHT

    // Calculate optimal photo size based on screen size
    const PHOTO_SIZE_FROM_WIDTH = width * 0.75
    const isLargeScreen = height > 800
    const MAX_HEIGHT_RATIO = isLargeScreen ? 0.6 : 0.5
    const MAX_PHOTO_SIZE_FROM_HEIGHT =
        AVAILABLE_VERTICAL_SPACE * MAX_HEIGHT_RATIO
    const PHOTO_SIZE = Math.min(
        PHOTO_SIZE_FROM_WIDTH,
        MAX_PHOTO_SIZE_FROM_HEIGHT,
        width * 0.85,
    )

    // Calculate responsive margins based on available space
    const REMAINING_SPACE = AVAILABLE_VERTICAL_SPACE - PHOTO_SIZE - 100

    // Scale margins based on screen size
    const ARTWORK_BOTTOM_MARGIN = isLargeScreen
        ? Math.max(12, Math.min(24, REMAINING_SPACE * 0.14))
        : Math.max(6, Math.min(18, REMAINING_SPACE * 0.12))
    const INFO_BOTTOM_MARGIN = isLargeScreen
        ? Math.max(16, Math.min(36, REMAINING_SPACE * 0.2))
        : Math.max(12, Math.min(30, REMAINING_SPACE * 0.18))
    const SIDE_CONTROLS_MARGIN = isLargeScreen
        ? Math.max(16, Math.min(24, REMAINING_SPACE * 0.14))
        : Math.max(12, Math.min(20, REMAINING_SPACE * 0.12))
    const CONTROLS_TOP_MARGIN = isLargeScreen
        ? Math.max(28, Math.min(48, REMAINING_SPACE * 0.22))
        : Math.max(20, Math.min(40, REMAINING_SPACE * 0.2))

    // Font sizes - scale down on very small screens
    const SURAH_NAME_SIZE = height < 700 ? 32 : 42
    const RECITER_NAME_SIZE = height < 700 ? 16 : 18

    // Dynamic spacing values based on screen height
    const TOP_BUTTON_POSITION = isLargeScreen ? 50 : 40
    const CONTENT_TOP_PADDING = TOP_BUTTON_POSITION + 50
    const CONTROLS_BOTTOM_MARGIN = isLargeScreen ? 32 : 24

    return {
        PHOTO_SIZE,
        ARTWORK_BOTTOM_MARGIN,
        INFO_BOTTOM_MARGIN,
        SIDE_CONTROLS_MARGIN,
        CONTROLS_TOP_MARGIN,
        SURAH_NAME_SIZE,
        RECITER_NAME_SIZE,
        TOP_BUTTON_POSITION,
        CONTENT_TOP_PADDING,
        CONTROLS_BOTTOM_MARGIN,
        isLargeScreen,
    }
}

// Default layout for static style values (will be overridden by dynamic calculation)
const defaultLayout = calculateLayout(50, 34)

// ===========================
// UI CONFIGURATION KNOBS
// ===========================

// Layout & Sizing (using defaults, dynamic values calculated in component)
const PHOTO_BORDER_RADIUS = 16

// Gradient Configuration
const GRADIENT_PRIMARY_OPACITY = 0.8
const GRADIENT_SECONDARY_OPACITY_TOP = 0.3
const GRADIENT_SECONDARY_OPACITY_BOTTOM = 0.0
const GRADIENT_LOCATIONS: readonly [number, number, number, number] = [
    0, 0.2, 0.7, 1,
] // Color stop positions

// Slider Configuration
const SLIDER_HEIGHT = 60
const SLIDER_PLAYED_COLOR = "#efefd5"
const SLIDER_UNPLAYED_OPACITY = 0.3
const SLIDER_TIME_PADDING = 16

// Control Button Sizes
const SIDE_BUTTON_SIZE = 28 // Download & Shuffle
const SKIP_BUTTON_SIZE = 40 // Previous & Next
const PLAY_PAUSE_ICON_SIZE = 54
const PLAY_BUTTON_SIZE = 88

// Spacing & Margins
const SCREEN_HORIZONTAL_PADDING = 5

// Typography & Colors
const TIME_TEXT_SIZE = 12
const RECITER_NAME_OPACITY = 0.7
const TIME_TEXT_OPACITY = 0.6

// ===========================

export default function PlayerScreen() {
    const router = useRouter()
    const { t } = useTranslation()
    const { setColors } = useTheme()
    const insets = useSafeAreaInsets()

    // Calculate layout dynamically based on actual safe area insets
    const layout = calculateLayout(insets.top, insets.bottom)
    const {
        currentTrack,
        isPlaying,
        position,
        duration,
        playbackMode,
        setPlaybackMode,
        togglePlayPause,
        seekTo,
        playTrack,
    } = useAudio()
    const {
        downloadSurah,
        deleteDownload,
        isDownloaded: checkDownloaded,
        getProgress,
    } = useDownload()
    const { isActive: isSleepTimerActive } = useSleepTimer()
    const { isOffline } = useNetwork()
    const rtl = isRTL()
    const arabic = isArabic()

    // Slider state for smooth seeking
    const [isSliding, setIsSliding] = useState(false)
    const [slidingPosition, setSlidingPosition] = useState(0)
    const seekingToRef = useRef<number | null>(null)

    // Sleep timer modal state
    const [sleepTimerModalVisible, setSleepTimerModalVisible] = useState(false)

    // Update theme colors when current track changes
    useEffect(() => {
        if (currentTrack) {
            setColors({
                statusBar: currentTrack.reciterColorSecondary || '#121212',
                background: '#121212',
            })
        }
    }, [currentTrack, setColors])

    // Debouncing for prev/next buttons
    const isProcessingTrackChange = useRef(false)

    // Handle Android hardware back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                // If modal is open, close it and prevent navigation
                if (sleepTimerModalVisible) {
                    setSleepTimerModalVisible(false)
                    return true // Prevent default back behavior
                }
                // Always go to reciter page
                if (currentTrack) {
                    router.replace(`/reciter/${currentTrack.reciterId}`)
                }
                return true // Prevent default back behavior
            },
        )

        return () => backHandler.remove()
    }, [sleepTimerModalVisible, currentTrack, router])

    // Reset seeking state when position catches up
    useEffect(() => {
        if (seekingToRef.current !== null) {
            const diff = Math.abs(position - seekingToRef.current)
            if (diff < 1) {
                // Position has caught up
                seekingToRef.current = null
            }
        }
    }, [position])

    // Use sliding position while sliding or seeking, otherwise use actual position
    const displayPosition =
        isSliding || seekingToRef.current !== null ? slidingPosition : position

    // Unified handler for playing adjacent surah (next or previous)
    const handlePlayAdjacentSurah = async (direction: "next" | "prev") => {
        if (!currentTrack || isProcessingTrackChange.current) return

        const targetSurahNumber =
            direction === "next"
                ? currentTrack.surahNumber + 1
                : currentTrack.surahNumber - 1

        // Boundary check
        if (targetSurahNumber < 1 || targetSurahNumber > 114) return

        isProcessingTrackChange.current = true

        try {
            const allSurahs = await getAllSurahs()
            const targetSurah = allSurahs.find(
                (s) => s.number === targetSurahNumber,
            )
            if (!targetSurah) return

            const isTargetDownloaded = checkDownloaded(
                currentTrack.reciterId,
                targetSurah.number,
            )

            // Check if offline and not downloaded
            if (isOffline && !isTargetDownloaded) {
                Alert.alert(t("offline"), t("download_required_offline"))
                return
            }

            const track: Track = {
                reciterId: currentTrack.reciterId,
                reciterName: currentTrack.reciterName,
                reciterColorPrimary:
                    currentTrack.reciterColorPrimary || "#282828",
                reciterColorSecondary:
                    currentTrack.reciterColorSecondary || "#404040",
                surahNumber: targetSurah.number,
                surahName: rtl ? targetSurah.name_ar : targetSurah.name_en,
                audioUrl: getAudioUrl(currentTrack.reciterId, targetSurah.number),
                isDownloaded: isTargetDownloaded,
            }

            // Build queue (surahs after target)
            const queue: Track[] = allSurahs
                .filter((s) => s.number > targetSurahNumber)
                .map((s) => ({
                    reciterId: currentTrack.reciterId,
                    reciterName: currentTrack.reciterName,
                    reciterColorPrimary:
                        currentTrack.reciterColorPrimary || "#282828",
                    reciterColorSecondary:
                        currentTrack.reciterColorSecondary || "#404040",
                    surahNumber: s.number,
                    surahName: rtl ? s.name_ar : s.name_en,
                    audioUrl: getAudioUrl(currentTrack.reciterId, s.number),
                    isDownloaded: checkDownloaded(
                        currentTrack.reciterId,
                        s.number,
                    ),
                }))

            await playTrack(track, queue)
        } finally {
            isProcessingTrackChange.current = false
        }
    }

    const handlePlayNextSurah = () => handlePlayAdjacentSurah("next")
    const handlePlayPreviousSurah = () => handlePlayAdjacentSurah("prev")

    if (!currentTrack) {
        return (
            <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                <View style={styles.centerContainer}>
                    <Text style={styles.emptyText}>No track playing</Text>
                </View>
            </View>
        )
    }

    const primaryColor = currentTrack.reciterColorPrimary || "#282828"
    const secondaryColor = currentTrack.reciterColorSecondary || "#404040"
    const isDownloaded = checkDownloaded(
        currentTrack.reciterId,
        currentTrack.surahNumber,
    )
    const progress = getProgress(
        currentTrack.reciterId,
        currentTrack.surahNumber,
    )
    const isDownloading =
        progress &&
        (progress.status === "downloading" || progress.status === "queued")

    // Check if we're at boundaries
    const isFirstSurah = currentTrack.surahNumber === 1
    const isLastSurah = currentTrack.surahNumber === 114

    const handleDownloadToggle = async () => {
        if (isDownloaded) {
            await deleteDownload(
                currentTrack.reciterId,
                currentTrack.surahNumber,
            )
        } else {
            // Check if offline before downloading
            if (isOffline) {
                Alert.alert(t("offline"), t("download_requires_internet"))
                return
            }

            await downloadSurah(
                currentTrack.reciterId,
                currentTrack.surahNumber,
            )
        }
    }

    return (
        <LinearGradient
            colors={[
                hexToRgba(primaryColor, GRADIENT_PRIMARY_OPACITY),
                hexToRgba(primaryColor, GRADIENT_SECONDARY_OPACITY_TOP),
                hexToRgba(primaryColor, GRADIENT_SECONDARY_OPACITY_BOTTOM),
                "#121212",
            ]}
            locations={GRADIENT_LOCATIONS}
            style={styles.container}
        >
            <View style={[styles.safeArea, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
                {/* Back Button - Always on left */}
                <TouchableOpacity
                    style={[styles.backButton, { top: insets.top + layout.TOP_BUTTON_POSITION - 40 }]}
                    onPress={() => {
                        // Always go to reciter page
                        if (currentTrack) {
                            router.replace(`/reciter/${currentTrack.reciterId}`)
                        }
                    }}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="chevron-back"
                        size={28}
                        color="#efefd5"
                        style={{ opacity: 0.5 }}
                    />
                </TouchableOpacity>

                {/* Content Container - uses flex: 1 with justifyContent: center
                    to vertically center artwork and info, utilizing all available
                    space and preventing empty gaps at bottom */}
                <View style={[styles.contentContainer, { paddingTop: layout.CONTENT_TOP_PADDING }]}>
                    {/* Album Art */}
                    <View style={[styles.artworkContainer, { marginBottom: layout.ARTWORK_BOTTOM_MARGIN }]}>
                        <Image
                            source={{
                                uri: getReciterPhotoUrl(currentTrack.reciterId),
                            }}
                            style={[styles.artwork, { width: layout.PHOTO_SIZE, height: layout.PHOTO_SIZE }]}
                            placeholder={require('../assets/images/placeholder.png')}
                            placeholderContentFit="cover"
                            contentFit="cover"
                            transition={200}
                        />
                    </View>

                    {/* Track Info */}
                    <View style={[styles.infoContainer, { marginBottom: layout.INFO_BOTTOM_MARGIN }]}>
                        <SurahName
                            surahNumber={currentTrack.surahNumber}
                            fallbackName={currentTrack.surahName}
                            fontSize={layout.SURAH_NAME_SIZE}
                            style={styles.surahName}
                            numberOfLines={1}
                        />
                        <Text
                            style={[
                                styles.reciterName,
                                { fontFamily: getFontFamily(arabic, "medium"), fontSize: layout.RECITER_NAME_SIZE },
                            ]}
                            numberOfLines={1}
                        >
                            {currentTrack.reciterName}
                        </Text>
                    </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                    <Slider
                        style={styles.slider}
                        minimumValue={0}
                        maximumValue={duration || 1}
                        value={displayPosition}
                        onSlidingStart={() => setIsSliding(true)}
                        onValueChange={(value) => setSlidingPosition(value)}
                        onSlidingComplete={async (value) => {
                            setIsSliding(false)
                            seekingToRef.current = value
                            await seekTo(value)
                        }}
                        minimumTrackTintColor={SLIDER_PLAYED_COLOR}
                        maximumTrackTintColor={`rgba(255, 255, 255, ${SLIDER_UNPLAYED_OPACITY})`}
                        thumbTintColor={SLIDER_PLAYED_COLOR}
                        inverted={rtl}
                    />
                    <View
                        style={[
                            styles.timeContainer,
                            rtl && styles.timeContainerRTL,
                        ]}
                    >
                        <Text style={styles.timeText}>
                            {formatTime(displayPosition)}
                        </Text>
                        <Text style={styles.timeText}>
                            {formatTime(duration)}
                        </Text>
                    </View>

                    {/* Side Controls (Playback Mode, Sleep Timer & Download) */}
                    <View style={[styles.sideControlsRow, { marginTop: layout.SIDE_CONTROLS_MARGIN }]}>
                        <TouchableOpacity
                            onPress={() => {
                                setPlaybackMode((prev) => {
                                    if (prev === "sequential") return "shuffle"
                                    if (prev === "shuffle") return "repeat"
                                    return "sequential"
                                })
                            }}
                            hitSlop={{
                                top: 15,
                                bottom: 15,
                                left: 15,
                                right: 15,
                            }}
                        >
                            <Ionicons
                                name={
                                    playbackMode === "sequential"
                                        ? rtl
                                            ? "play-back"
                                            : "play-forward"
                                        : playbackMode === "shuffle"
                                        ? "shuffle"
                                        : "repeat"
                                }
                                size={SIDE_BUTTON_SIZE}
                                color="#efefd5"
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setSleepTimerModalVisible(true)}
                            hitSlop={{
                                top: 15,
                                bottom: 15,
                                left: 15,
                                right: 15,
                            }}
                        >
                            <Ionicons
                                name={
                                    isSleepTimerActive ? "moon" : "moon-outline"
                                }
                                size={SIDE_BUTTON_SIZE}
                                color={
                                    isSleepTimerActive ? "#1DB954" : "#efefd5"
                                }
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleDownloadToggle}
                            hitSlop={{
                                top: 15,
                                bottom: 15,
                                left: 15,
                                right: 15,
                            }}
                        >
                            {isDownloading ? (
                                <CircularProgress
                                    size={SIDE_BUTTON_SIZE}
                                    progress={progress?.progress || 0}
                                    strokeWidth={2.5}
                                    color="#1DB954"
                                />
                            ) : (
                                <Ionicons
                                    name={
                                        isDownloaded
                                            ? "checkmark-circle"
                                            : "arrow-down-circle-outline"
                                    }
                                    size={SIDE_BUTTON_SIZE}
                                    color="#efefd5"
                                />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Main Playback Controls */}
                <View
                    style={[
                        styles.mainControlsRow,
                        { marginTop: layout.CONTROLS_TOP_MARGIN, marginBottom: layout.CONTROLS_BOTTOM_MARGIN },
                        rtl && styles.mainControlsRowRTL,
                    ]}
                >
                    {/* Previous Button */}
                    <TouchableOpacity
                        style={styles.skipButton}
                        onPress={handlePlayPreviousSurah}
                        disabled={isFirstSurah}
                        hitSlop={{
                            top: 15,
                            bottom: 15,
                            left: 15,
                            right: 15,
                        }}
                    >
                        <Ionicons
                            name={rtl ? "play-skip-forward" : "play-skip-back"}
                            size={SKIP_BUTTON_SIZE}
                            color={isFirstSurah ? "#404040" : "#efefd5"}
                        />
                    </TouchableOpacity>

                    {/* Play/Pause Button */}
                    <TouchableOpacity
                        style={styles.playButton}
                        onPress={togglePlayPause}
                        activeOpacity={0.8}
                    >
                        <View style={!isPlaying && (rtl ? styles.playIconOffset : styles.playIconOffsetLTR)}>
                            <Ionicons
                                name={isPlaying ? "pause" : "play"}
                                size={PLAY_PAUSE_ICON_SIZE}
                                color="#121212"
                                style={rtl && styles.playIconFlip}
                            />
                        </View>
                    </TouchableOpacity>

                    {/* Next Button */}
                    <TouchableOpacity
                        style={styles.skipButton}
                        onPress={handlePlayNextSurah}
                        disabled={isLastSurah}
                        hitSlop={{
                            top: 15,
                            bottom: 15,
                            left: 15,
                            right: 15,
                        }}
                    >
                        <Ionicons
                            name={rtl ? "play-skip-back" : "play-skip-forward"}
                            size={SKIP_BUTTON_SIZE}
                            color={isLastSurah ? "#404040" : "#efefd5"}
                        />
                    </TouchableOpacity>
                </View>

                {/* Sleep Timer Modal */}
                <SleepTimerModal
                    visible={sleepTimerModalVisible}
                    onClose={() => setSleepTimerModalVisible(false)}
                />
            </View>
        </LinearGradient>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#121212",
    },
    safeArea: {
        flex: 1,
        paddingHorizontal: SCREEN_HORIZONTAL_PADDING,
    },
    contentContainer: {
        flex: 1,
        justifyContent: "center",
        // paddingTop is now applied dynamically
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    emptyText: {
        color: "#B3B3B3",
        fontSize: 16,
    },
    backButton: {
        position: "absolute",
        // top is now applied dynamically based on insets
        left: 20,
        zIndex: 10,
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.3)",
        borderRadius: 20,
        opacity: 0.7,
    },
    artworkContainer: {
        alignItems: "center",
        marginBottom: defaultLayout.ARTWORK_BOTTOM_MARGIN,
    },
    artwork: {
        width: defaultLayout.PHOTO_SIZE,
        height: defaultLayout.PHOTO_SIZE,
        borderRadius: PHOTO_BORDER_RADIUS,
        backgroundColor: "#282828",
    },
    infoContainer: {
        alignItems: "center",
        marginBottom: defaultLayout.INFO_BOTTOM_MARGIN,
    },
    surahName: {
        fontSize: defaultLayout.SURAH_NAME_SIZE,
        color: "#efefd5",
        marginBottom: 5,
        textAlign: "center",
    },
    reciterName: {
        fontSize: defaultLayout.RECITER_NAME_SIZE,
        color: `rgba(255, 255, 255, ${RECITER_NAME_OPACITY})`,
        textAlign: "center",
    },
    progressContainer: {
        marginBottom: 0,
    },
    slider: {
        width: "100%",
        height: SLIDER_HEIGHT,
    },
    timeContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: SLIDER_TIME_PADDING,
        marginTop: -10,
    },
    timeContainerRTL: {
        flexDirection: "row-reverse",
    },
    timeText: {
        fontSize: TIME_TEXT_SIZE,
        color: `rgba(255, 255, 255, ${TIME_TEXT_OPACITY})`,
    },
    sideControlsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: defaultLayout.SIDE_CONTROLS_MARGIN,
        paddingHorizontal: SLIDER_TIME_PADDING,
    },
    mainControlsRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: defaultLayout.CONTROLS_TOP_MARGIN,
        marginBottom: defaultLayout.CONTROLS_BOTTOM_MARGIN,
    },
    mainControlsRowRTL: {
        flexDirection: "row-reverse",
    },
    skipButton: {
        padding: 18,
    },
    playButton: {
        width: PLAY_BUTTON_SIZE,
        height: PLAY_BUTTON_SIZE,
        borderRadius: PLAY_BUTTON_SIZE / 2,
        backgroundColor: "#efefd5",
        justifyContent: "center",
        alignItems: "center",
    },
    playIconOffset: {
        marginRight: 6,
    },
    playIconOffsetLTR: {
        marginLeft: 6,
    },
    playIconFlip: {
        transform: [{ scaleX: -1 }],
    },
})
