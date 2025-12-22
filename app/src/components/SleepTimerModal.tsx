import React from "react"
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Platform,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as Haptics from "expo-haptics"
import { useTranslation } from "react-i18next"
import { useSleepTimer } from "../contexts/SleepTimerContext"
import { isArabic } from "../services/i18n"
import { getFontFamily } from "../utils/fonts"

interface SleepTimerModalProps {
    visible: boolean
    onClose: () => void
    primaryColor?: string
    secondaryColor?: string
}

const TIMER_OPTIONS = [5, 10, 15, 30, 45, 60]

const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, "0")}:${secs
            .toString()
            .padStart(2, "0")}`
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`
}

export default function SleepTimerModal({
    visible,
    onClose,
}: SleepTimerModalProps) {
    const { t } = useTranslation()
    const { isActive, remainingSeconds, setTimer, clearTimer } = useSleepTimer()
    const arabic = isArabic()

    const handleSetTimer = (minutes: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        setTimer(minutes)
        onClose()
    }

    const handleClearTimer = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        clearTimer()
        onClose()
    }

    const handleClose = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onClose()
    }

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={handleClose}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={(e) => e.stopPropagation()}
                    style={styles.sheetContainer}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text
                            style={[
                                styles.title,
                                { fontFamily: getFontFamily(arabic, "bold") },
                            ]}
                        >
                            {isActive ? t("timer_active") : t("sleep_timer")}
                        </Text>

                        <TouchableOpacity
                            onPress={handleClose}
                            style={styles.closeButton}
                            hitSlop={{
                                top: 15,
                                bottom: 15,
                                left: 15,
                                right: 15,
                            }}
                        >
                            <Ionicons name="close" size={24} color="#8E8E93" />
                        </TouchableOpacity>
                    </View>

                    {/* Active Timer Countdown (Minimalist Hero) */}
                    {isActive && (
                        <View style={styles.activeTimerContainer}>
                            <Text
                                style={[
                                    styles.countdownText,
                                    {
                                        fontFamily: getFontFamily(
                                            false,
                                            "bold",
                                        ),
                                    },
                                ]}
                            >
                                {formatTime(remainingSeconds)}
                            </Text>
                            <TouchableOpacity
                                style={styles.stopButton}
                                onPress={handleClearTimer}
                                activeOpacity={0.8}
                            >
                                <Ionicons
                                    name="stop"
                                    size={14}
                                    color="#FF453A"
                                    style={{ marginRight: 6 }}
                                />
                                <Text
                                    style={[
                                        styles.stopButtonText,
                                        {
                                            fontFamily: getFontFamily(
                                                arabic,
                                                "medium",
                                            ),
                                        },
                                    ]}
                                >
                                    {t("cancel_timer")}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Grid Layout */}
                    <View style={styles.gridContainer}>
                        {TIMER_OPTIONS.map((minutes) => (
                            <TouchableOpacity
                                key={minutes}
                                style={[styles.gridItem, styles.shadow]}
                                onPress={() => handleSetTimer(minutes)}
                                activeOpacity={0.7}
                            >
                                {/* Text is direct child of Centered Grid Item now */}
                                <Text
                                    style={[
                                        styles.optionTime,
                                        {
                                            fontFamily: getFontFamily(
                                                false,
                                                "bold",
                                            ),
                                        },
                                    ]}
                                >
                                    {minutes}
                                </Text>
                                <Text
                                    style={[
                                        styles.optionLabel,
                                        {
                                            fontFamily: getFontFamily(
                                                arabic,
                                                "regular",
                                            ),
                                        },
                                    ]}
                                >
                                    {arabic ? "دقيقة" : "min"}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    )
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        justifyContent: "flex-end",
    },
    sheetContainer: {
        backgroundColor: "#1C1C1E", // Dark Grey Base
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: 24,
        paddingHorizontal: 20,
        paddingBottom: 40,
        width: "100%",
        alignSelf: "center",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        color: "#FFFFFF",
        letterSpacing: 0.5,
    },
    closeButton: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding: 6,
    },

    // Active Timer
    activeTimerContainer: {
        alignItems: "center",
        marginBottom: 32,
        marginTop: 8,
    },
    countdownText: {
        fontSize: 56,
        color: "#FFFFFF",
        marginBottom: 16,
        fontVariant: ["tabular-nums"],
    },
    stopButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(255, 69, 58, 0.15)",
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    stopButtonText: {
        color: "#FF453A",
        fontSize: 14,
    },

    // Grid
    gridContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 12,
    },
    gridItem: {
        width: "30%", // Fits 3 items perfectly
        aspectRatio: 1.25, // Slightly rectangular
        backgroundColor: "#2C2C2E",
        borderRadius: 16,
        paddingBottom: 6,
        // Critical for centering:
        justifyContent: "center",
        alignItems: "center",
    },
    // Shadow Logic
    shadow: {
        ...Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    optionTime: {
        fontSize: 28,
        color: "#FFFFFF",
        marginBottom: 4, // Slight gap between number and text
        textAlign: "center",
        lineHeight: 34, // Ensures vertical alignment is predictable
    },
    optionLabel: {
        fontSize: 13,
        color: "#98989D",
        textAlign: "center",
    },
})
