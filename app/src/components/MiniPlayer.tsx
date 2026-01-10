import { View, Text, TouchableOpacity, StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import { getReciterPhotoUrl } from "../constants/config"
import { useAudio } from "../contexts/AudioContext"
import { hexToRgba } from "../utils/color"

// ===========================
// UI CONFIGURATION KNOBS
// ===========================

// Sizing
const ARTWORK_SIZE = 48
const ARTWORK_BORDER_RADIUS = 4
const CONTAINER_HEIGHT = 60 // Fixed height - prevents growing with padding
const CONTAINER_BORDER_RADIUS = 12 // Rounded top corners

// Control Button Sizes
const PLAY_ICON_SIZE = 28

// Progress Bar
const PROGRESS_HEIGHT = 2
const PROGRESS_COLOR = "#efefd5"
const PROGRESS_BG_COLOR = "#404040"

// Gradient
const GRADIENT_OPACITY = 0.2

// Typography
const SURAH_NAME_SIZE = 14
const RECITER_NAME_SIZE = 12

// Spacing
const CONTAINER_PADDING_HORIZONTAL = 12
const CONTAINER_PADDING_TOP = 8
const CONTAINER_PADDING_BOTTOM = 8
const ARTWORK_MARGIN_RIGHT = 12

// Safe Area
const MIN_BOTTOM_SAFE_AREA = 8 // Minimum padding for Android nav bar

// ===========================

export default function MiniPlayer() {
    const router = useRouter()
    const insets = useSafeAreaInsets()
    const {
        currentTrack,
        isPlaying,
        togglePlayPause,
        position,
        duration,
    } = useAudio()

    if (!currentTrack) {
        return null
    }

    const primaryColor = currentTrack.reciterColorPrimary || "#282828"

    // Calculate progress percentage
    const progressPercentage = duration > 0 ? (position / duration) * 100 : 0

    // Ensure minimum bottom margin for Android nav bar
    const bottomMargin = Math.max(insets.bottom, MIN_BOTTOM_SAFE_AREA)

    return (
        <LinearGradient
            colors={[
                hexToRgba(primaryColor, GRADIENT_OPACITY, [40, 40, 40]),
                hexToRgba(primaryColor, GRADIENT_OPACITY * 0.7, [40, 40, 40]),
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.gradientContainer, { marginBottom: bottomMargin }]}
        >
            <TouchableOpacity
                style={styles.container}
                activeOpacity={0.9}
                onPress={() => {
                    router.push("/player")
                }}
            >
                <TouchableOpacity
                    onPress={(e) => {
                        e.stopPropagation()
                        togglePlayPause()
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.playButton}
                >
                    <View style={!isPlaying && styles.playIconOffset}>
                        <Ionicons
                            name={isPlaying ? "pause" : "play"}
                            size={PLAY_ICON_SIZE}
                            color="#efefd5"
                        />
                    </View>
                </TouchableOpacity>

                <View style={styles.leftSection}>
                    <Image
                        source={{
                            uri: getReciterPhotoUrl(currentTrack.reciterId),
                        }}
                        style={styles.artwork}
                        placeholder={require("../../assets/images/placeholder.png")}
                        placeholderContentFit="cover"
                        contentFit="cover"
                    />
                    <View style={styles.info}>
                        <Text style={styles.surahName} numberOfLines={1}>
                            {currentTrack.surahName}
                        </Text>
                        <Text style={styles.reciterName} numberOfLines={1}>
                            {currentTrack.reciterName}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>

            {/* Progress bar - always flows right to left */}
            <View style={styles.progressBarContainer}>
                <View style={styles.progressBar}>
                    <View
                        style={[
                            styles.progress,
                            { width: `${progressPercentage}%` },
                        ]}
                    />
                </View>
            </View>
        </LinearGradient>
    )
}

const styles = StyleSheet.create({
    gradientContainer: {
        borderTopWidth: 0.5,
        borderTopColor: "#404040",
        borderTopLeftRadius: CONTAINER_BORDER_RADIUS,
        borderTopRightRadius: CONTAINER_BORDER_RADIUS,
        borderBottomLeftRadius: CONTAINER_BORDER_RADIUS,
        borderBottomRightRadius: CONTAINER_BORDER_RADIUS,
        overflow: "hidden", // Ensure children respect border radius
    },
    container: {
        height: CONTAINER_HEIGHT,
        paddingHorizontal: CONTAINER_PADDING_HORIZONTAL,
        paddingTop: CONTAINER_PADDING_TOP,
        paddingBottom: CONTAINER_PADDING_BOTTOM,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    leftSection: {
        flexDirection: "row-reverse",
        alignItems: "center",
        flex: 1,
        marginStart: 12,
    },
    artwork: {
        width: ARTWORK_SIZE,
        height: ARTWORK_SIZE,
        borderRadius: ARTWORK_BORDER_RADIUS,
        backgroundColor: "#404040",
    },
    info: {
        flex: 1,
    },
    surahName: {
        textAlign: "right",
        marginRight: 20,
        color: "#efefd5",
        fontSize: SURAH_NAME_SIZE,
        fontWeight: "600",
        marginBottom: 2,
    },
    reciterName: {
        textAlign: "right",
        marginRight: 20,
        color: "#B3B3B3",
        fontSize: RECITER_NAME_SIZE,
    },
    playIconOffset: {
        marginLeft: 2,
    },
    playButton: {
        marginLeft: 12,
    },
    progressBarContainer: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: PROGRESS_HEIGHT,
        transform: [{ scaleX: -1 }],
    },
    progressBar: {
        width: "100%",
        height: PROGRESS_HEIGHT,
        backgroundColor: PROGRESS_BG_COLOR,
    },
    progress: {
        height: PROGRESS_HEIGHT,
        backgroundColor: PROGRESS_COLOR,
    },
})
