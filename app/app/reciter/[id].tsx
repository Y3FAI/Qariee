import { useState, useEffect, useCallback } from "react"
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    Dimensions,
    BackHandler,
    Alert,
} from "react-native"
import { Image } from "expo-image"
import { useLocalSearchParams, useRouter } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { getReciterPhotoUrl, getAudioUrl } from "../../src/constants/config"
import {
    QURAN_DIVISIONS,
    STANDALONE_SURAHS,
} from "../../src/constants/quranDivisions"
import { Reciter, Surah } from "../../src/types"
import { getAllSurahs, getReciterById } from "../../src/services/database"
import { isRTL, isArabic } from "../../src/services/i18n"
import { getFontFamily } from "../../src/utils/fonts"
import { useAudio } from "../../src/contexts/AudioContext"
import { useDownload } from "../../src/contexts/DownloadContext"
import { useNetwork } from "../../src/contexts/NetworkContext"
import { Track } from "../../src/services/audioService"
import MiniPlayer from "../../src/components/MiniPlayer"
import CircularProgress from "../../src/components/CircularProgress"

const { height } = Dimensions.get("window")
const PHOTO_SIZE = 200
const isLargeScreen = height > 800
const TOP_BUTTON_POSITION = isLargeScreen ? 50 : 40

/**
 * Convert hex color to rgba with opacity
 */
const hexToRgba = (hex: string | null | undefined, alpha: number): string => {
    if (!hex) return `rgba(18, 18, 18, ${alpha})`

    const num = parseInt(hex.replace("#", ""), 16)
    const r = (num >> 16) & 0xff
    const g = (num >> 8) & 0xff
    const b = num & 0xff

    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function ReciterDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>()
    const router = useRouter()
    const { t } = useTranslation()
    const { playTrack } = useAudio()
    const {
        downloadSurah,
        deleteDownload,
        cancelDownload,
        isDownloaded: checkDownloaded,
        getProgress,
    } = useDownload()
    const { isOffline } = useNetwork()
    const [reciter, setReciter] = useState<Reciter | null>(null)
    const [surahs, setSurahs] = useState<Surah[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(["seven_long"]), // First section expanded by default
    )
    const [isBatchDownloading, setIsBatchDownloading] = useState(false)

    const rtl = isRTL()
    const arabic = isArabic()

    // Define data loader before effects so it can be referenced safely
    const loadData = useCallback(async () => {
        try {
            // Load reciter from database
            const reciterData = await getReciterById(id as string)
            setReciter(reciterData)

            // Load all surahs
            const allSurahs = await getAllSurahs()
            setSurahs(allSurahs)
        } catch (error) {
            console.error("Error loading reciter:", error)
        }
    }, [id])

    // Auto-expand all sections when searching
    useEffect(() => {
        if (searchQuery) {
            // Expand all sections when searching
            setExpandedSections(new Set(QURAN_DIVISIONS.map((d) => d.id)))
        } else {
            // Reset to default (only first section expanded)
            setExpandedSections(new Set(["seven_long"]))
        }
    }, [searchQuery])

    useEffect(() => {
        // Clear reciter data immediately when ID changes to prevent flash
        setReciter(null)
        setSurahs([])
        loadData()
    }, [id, loadData])

    // Handle Android hardware back button
    useEffect(() => {
        const backHandler = BackHandler.addEventListener(
            "hardwareBackPress",
            () => {
                router.replace("/")
                return true // Prevent default back behavior
            },
        )

        return () => backHandler.remove()
    }, [router])

    const toggleSection = (sectionId: string) => {
        const newExpanded = new Set(expandedSections)
        if (newExpanded.has(sectionId)) {
            newExpanded.delete(sectionId)
        } else {
            newExpanded.add(sectionId)
        }
        setExpandedSections(newExpanded)
    }

    const createTrack = (surah: Surah): Track => {
        if (!reciter) throw new Error("No reciter")

        const isDownloaded = checkDownloaded(reciter.id, surah.number)

        return {
            reciterId: reciter.id,
            reciterName: rtl ? reciter.name_ar : reciter.name_en,
            reciterColorPrimary: reciter.color_primary,
            reciterColorSecondary: reciter.color_secondary,
            surahNumber: surah.number,
            surahName: getSurahName(surah),
            audioUrl: getAudioUrl(reciter.id, surah.number),
            isDownloaded,
        }
    }

    const handlePlayShuffle = async () => {
        if (!reciter || filteredSurahs.length === 0) return

        // Check if offline and no downloaded surahs
        const downloadedSurahs = filteredSurahs.filter((s) =>
            checkDownloaded(reciter.id, s.number),
        )

        if (isOffline && downloadedSurahs.length === 0) {
            Alert.alert(t("offline"), t("download_required_offline"))
            return
        }

        // Use only downloaded surahs when offline
        const surahsToPlay = isOffline ? downloadedSurahs : filteredSurahs

        // Shuffle the surahs
        const shuffled = [...surahsToPlay].sort(() => Math.random() - 0.5)
        const firstTrack = createTrack(shuffled[0])
        const queue = shuffled.slice(1).map(createTrack)

        await playTrack(firstTrack, queue)
        router.push("/player")
    }

    const handleDownloadAll = async () => {
        if (!reciter || isBatchDownloading) return

        // Check if offline before downloading
        if (isOffline && !allDownloaded) {
            Alert.alert(t("offline"), t("download_requires_internet"))
            return
        }

        setIsBatchDownloading(true)

        try {
            if (allDownloaded) {
                // Remove all downloaded surahs
                for (const surah of filteredSurahs) {
                    if (checkDownloaded(reciter.id, surah.number)) {
                        await deleteDownload(reciter.id, surah.number)
                    }
                }
            } else {
                // Download all non-downloaded surahs
                for (const surah of filteredSurahs) {
                    if (!checkDownloaded(reciter.id, surah.number)) {
                        await downloadSurah(reciter.id, surah.number)
                    }
                }
            }
        } finally {
            setIsBatchDownloading(false)
        }
    }

    const handlePlaySurah = async (surah: Surah) => {
        if (!reciter) return

        // Create queue: all surahs after the selected one
        const currentIndex = filteredSurahs.findIndex(
            (s) => s.number === surah.number,
        )
        const queue = filteredSurahs.slice(currentIndex + 1).map(createTrack)

        const track = createTrack(surah)
        await playTrack(track, queue)
        router.push("/player")
    }

    const handleDownloadSurah = async (surah: Surah) => {
        if (!reciter) return

        const isAlreadyDownloaded = checkDownloaded(reciter.id, surah.number)
        const progress = getProgress(reciter.id, surah.number)
        const isCurrentlyDownloading = !!(
            progress &&
            (progress.status === "downloading" || progress.status === "queued")
        )

        if (isCurrentlyDownloading) {
            // Cancel if actively downloading
            await cancelDownload(reciter.id, surah.number)
        } else if (isAlreadyDownloaded) {
            // Delete if already downloaded
            await deleteDownload(reciter.id, surah.number)
        } else {
            // Download if not downloaded
            await downloadSurah(reciter.id, surah.number)
        }
    }

    const getSurahName = (surah: Surah): string => {
        return rtl ? surah.name_ar : surah.name_en
    }

    const getReciterName = (): string => {
        if (!reciter) return ""
        return rtl ? reciter.name_ar : reciter.name_en
    }

    const filteredSurahs = surahs.filter((surah) => {
        if (!searchQuery) return true
        const name = getSurahName(surah).toLowerCase()
        return name.includes(searchQuery.toLowerCase())
    })

    // Calculate download stats
    const downloadedCount = filteredSurahs.filter((surah) =>
        checkDownloaded(reciter?.id || "", surah.number),
    ).length
    const totalCount = filteredSurahs.length
    const allDownloaded = downloadedCount === totalCount && totalCount > 0

    const renderSurahItem = (surah: Surah) => {
        if (!reciter) return null

        const name = getSurahName(surah)
        const isDownloaded = checkDownloaded(reciter.id, surah.number)
        const progress = getProgress(reciter.id, surah.number)
        const isDownloading = !!(
            progress &&
            (progress.status === "downloading" || progress.status === "queued")
        )
        const isDeleting = !!(
            progress && (progress.status as any) === "deleting"
        )

        // Disable non-downloaded surahs when offline
        const isDisabled = isOffline && !isDownloaded

        return (
            <TouchableOpacity
                key={surah.number}
                style={[
                    styles.surahItem,
                    rtl && styles.surahItemRTL,
                    isDisabled && styles.surahItemDisabled,
                ]}
                onPress={() => handlePlaySurah(surah)}
                activeOpacity={isDisabled ? 1 : 0.7}
                disabled={isDisabled}
            >
                <Text
                    style={[
                        styles.surahName,
                        rtl && styles.surahNameRTL,
                        { fontFamily: getFontFamily(arabic, "regular") },
                        isDisabled && styles.surahNameDisabled,
                    ]}
                >
                    {name}
                </Text>
                <TouchableOpacity
                    onPress={(e) => {
                        e.stopPropagation()
                        handleDownloadSurah(surah)
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    disabled={isOffline || isDownloading || isDeleting}
                >
                    {isDownloading || isDeleting ? (
                        <View style={{ direction: "ltr" }}>
                            <CircularProgress
                                size={24}
                                progress={
                                    isDeleting ? 0 : progress?.progress || 0
                                }
                                strokeWidth={2.5}
                                color={isDeleting ? "#FF3B30" : "#1DB954"}
                            />
                        </View>
                    ) : (
                        <Ionicons
                            name={
                                isDownloaded
                                    ? "checkmark-circle"
                                    : "arrow-down-circle-outline"
                            }
                            size={24}
                            color={
                                isDownloaded
                                    ? "#efefd5"
                                    : isOffline
                                    ? "#4A4A4A"
                                    : "#B3B3B3"
                            }
                        />
                    )}
                </TouchableOpacity>
            </TouchableOpacity>
        )
    }

    const renderSection = (division: (typeof QURAN_DIVISIONS)[0]) => {
        const isExpanded = expandedSections.has(division.id)
        const sectionSurahs = filteredSurahs.filter((s) =>
            division.surahNumbers.includes(s.number),
        )

        if (searchQuery && sectionSurahs.length === 0) return null

        return (
            <View key={division.id} style={styles.section}>
                <TouchableOpacity
                    style={[
                        styles.sectionHeader,
                        rtl && styles.sectionHeaderRTL,
                    ]}
                    onPress={() => toggleSection(division.id)}
                    activeOpacity={0.7}
                >
                    <Text
                        style={[
                            styles.sectionTitle,
                            { fontFamily: getFontFamily(arabic, "semibold") },
                        ]}
                    >
                        {t(division.nameKey)} ({sectionSurahs.length})
                    </Text>
                    <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={20}
                        color="#B3B3B3"
                    />
                </TouchableOpacity>
                {isExpanded && (
                    <View style={styles.sectionContent}>
                        {sectionSurahs.map(renderSurahItem)}
                    </View>
                )}
            </View>
        )
    }

    if (!reciter) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centerContainer}>
                    <Text style={styles.loadingText}>{t("loading")}</Text>
                </View>
            </SafeAreaView>
        )
    }

    const standaloneSurahs = filteredSurahs.filter((s) =>
        STANDALONE_SURAHS.includes(s.number),
    )

    return (
        <SafeAreaView style={styles.container} edges={[]}>
            {/* Back Button - Above header */}
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.replace("/")}
                activeOpacity={0.7}
            >
                <Ionicons
                    name="chevron-back"
                    size={28}
                    color="#efefd5"
                    style={{ opacity: 0.5 }}
                />
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header with gradient */}
                <LinearGradient
                    colors={[
                        hexToRgba(reciter.color_primary, 0.4),
                        hexToRgba(reciter.color_secondary, 0.3),
                        hexToRgba(reciter.color_secondary, 0.2),
                        "#121212",
                    ]}
                    style={styles.header}
                >
                    <Image
                        source={{ uri: getReciterPhotoUrl(reciter.id) }}
                        style={styles.reciterPhoto}
                        placeholder={require("../../assets/images/placeholder.png")}
                        placeholderContentFit="cover"
                        contentFit="cover"
                        transition={200}
                    />
                    <Text
                        style={[
                            styles.reciterName,
                            { fontFamily: getFontFamily(arabic, "bold") },
                        ]}
                    >
                        {getReciterName()}
                    </Text>
                </LinearGradient>

                {/* Action Buttons */}
                <View
                    style={[
                        styles.actionButtons,
                        rtl && styles.actionButtonsRTL,
                    ]}
                >
                    <TouchableOpacity
                        style={styles.playButton}
                        onPress={handlePlayShuffle}
                        activeOpacity={0.8}
                    >
                        <Text
                            style={[
                                styles.playButtonText,
                                {
                                    fontFamily: getFontFamily(
                                        arabic,
                                        "semibold",
                                    ),
                                },
                            ]}
                        >
                            {t("play")}
                        </Text>
                        <View style={rtl && styles.playIconFlip}>
                            <Ionicons name="play" size={24} color="#121212" />
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.downloadAllButton,
                            (isBatchDownloading || isOffline) &&
                                styles.downloadAllButtonDisabled,
                        ]}
                        onPress={handleDownloadAll}
                        activeOpacity={0.8}
                        disabled={isBatchDownloading || isOffline}
                    >
                        <Text
                            style={[
                                styles.downloadAllText,
                                {
                                    fontFamily: getFontFamily(
                                        arabic,
                                        "semibold",
                                    ),
                                },
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                        >
                            {isBatchDownloading
                                ? `${
                                      allDownloaded
                                          ? t("removing")
                                          : t("downloading")
                                  }... ${downloadedCount}/${totalCount}`
                                : allDownloaded
                                ? t("remove_all")
                                : t("download_all")}
                        </Text>
                        <Ionicons
                            name={allDownloaded ? "close-circle-outline" : "arrow-down-circle"}
                            size={24}
                            color="#efefd5"
                        />
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <View
                        style={[styles.searchBar, rtl && styles.searchBarRTL]}
                    >
                        <Ionicons
                            name="search"
                            size={18}
                            color="rgba(255, 255, 255, 0.4)"
                        />
                        <TextInput
                            style={[
                                styles.searchInput,
                                rtl && styles.searchInputRTL,
                            ]}
                            placeholder={t("search_surahs")}
                            placeholderTextColor="rgba(255, 255, 255, 0.4)"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>

                {/* Standalone Surahs (Al-Fatihah) */}
                {standaloneSurahs.length > 0 && (
                    <View style={styles.standaloneSection}>
                        {standaloneSurahs.map(renderSurahItem)}
                    </View>
                )}

                {/* Quran Divisions */}
                <View style={styles.divisionsContainer}>
                    {QURAN_DIVISIONS.map(renderSection)}
                </View>
            </ScrollView>
            <MiniPlayer />
        </SafeAreaView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#121212",
    },
    centerContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        color: "#efefd5",
        fontSize: 16,
    },
    backButton: {
        position: "absolute",
        top: TOP_BUTTON_POSITION,
        left: 20,
        zIndex: 100,
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "rgba(0, 0, 0, 0.3)",
        borderRadius: 20,
        opacity: 0.7,
    },
    header: {
        alignItems: "center",
        paddingTop: 80,
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    reciterPhoto: {
        width: PHOTO_SIZE,
        height: PHOTO_SIZE,
        borderRadius: 24,
        backgroundColor: "#282828",
        marginBottom: 20,
    },
    reciterName: {
        fontSize: 28,
        color: "#efefd5",
        textAlign: "center",
        minHeight: 36,
    },
    actionButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 24,
        gap: 12,
    },
    actionButtonsRTL: {
        flexDirection: "row-reverse",
    },
    playButton: {
        flex: 1,
        backgroundColor: "#efefd5",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        borderRadius: 30,
        gap: 8,
    },
    playButtonText: {
        color: "#121212",
        fontSize: 16,
    },
    playIconFlip: {
        transform: [{ scaleX: -1 }],
    },
    downloadAllButton: {
        flex: 1,
        backgroundColor: "#2A2A2A",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        borderRadius: 30,
        gap: 8,
    },
    downloadAllButtonDisabled: {
        opacity: 0.5,
    },
    downloadAllText: {
        color: "#efefd5",
        fontSize: 16,
        flexShrink: 1,
    },
    searchContainer: {
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 20,
    },
    searchBar: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        borderRadius: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 10,
    },
    searchBarRTL: {
        flexDirection: "row-reverse",
    },
    searchInput: {
        flex: 1,
        color: "#efefd5",
        fontSize: 14,
        textAlign: "left",
        paddingVertical: 0,
    },
    searchInputRTL: {
        textAlign: "right",
    },
    standaloneSection: {
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    divisionsContainer: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    section: {
        marginBottom: 4,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 16,
        paddingHorizontal: 16,
        backgroundColor: "#1A1A1A",
        borderRadius: 8,
    },
    sectionHeaderRTL: {
        flexDirection: "row-reverse",
    },
    sectionTitle: {
        fontSize: 16,
        color: "#efefd5",
        textAlign: "right",
    },
    sectionContent: {
        paddingTop: 8,
        paddingBottom: 8,
    },
    surahItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: "#1E1E1E",
        marginBottom: 4,
        borderRadius: 6,
    },
    surahItemRTL: {
        flexDirection: "row-reverse",
    },
    surahName: {
        fontSize: 16,
        color: "#efefd5",
        flex: 1,
        marginEnd: 12,
        textAlign: "left",
    },
    surahNameRTL: {
        textAlign: "right",
    },
    surahItemDisabled: {
        opacity: 0.4,
    },
    surahNameDisabled: {
        color: "#808080",
    },
})
