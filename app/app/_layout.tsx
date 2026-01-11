import { useEffect, useState, useCallback } from "react"
import { Stack } from "expo-router"
import { View, Text } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import { AudioProvider } from "../src/contexts/AudioContext"
import { DownloadProvider } from "../src/contexts/DownloadContext"
import { NetworkProvider, useNetwork } from "../src/contexts/NetworkContext"
import { SleepTimerProvider } from "../src/contexts/SleepTimerContext"
import { ThemeProvider, useTheme } from "../src/contexts/ThemeContext"
import "../src/services/i18n"

import { initDatabase } from "../src/services/database"
import { sync } from "../src/services/syncService"
import {
    useFonts,
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
} from "../src/utils/fonts"

SplashScreen.preventAutoHideAsync()

function AppContent() {
    const { isOffline } = useNetwork()
    const { colors } = useTheme()

    // Sync when network becomes available
    useEffect(() => {
        if (!isOffline) {
            sync()
        }
    }, [isOffline])

    // Helper to determine status bar style (light/dark text)
    const getStatusBarStyle = (color: string) => {
        // Simple brightness check
        const hex = color.replace("#", "")
        const r = parseInt(hex.substr(0, 2), 16)
        const g = parseInt(hex.substr(2, 2), 16)
        const b = parseInt(hex.substr(4, 2), 16)
        const brightness = (r * 299 + g * 587 + b * 114) / 1000
        return brightness > 128 ? "dark" : "light"
    }

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar
                style={getStatusBarStyle(colors.statusBar)}
                backgroundColor={colors.statusBar}
                animated={true}
            />
            <AudioProvider>
                <SleepTimerProvider>
                    <DownloadProvider>
                        <Stack
                            screenOptions={{
                                headerShown: false,
                                animation: "fade",
                            }}
                        >
                            <Stack.Screen name="index" />
                            <Stack.Screen
                                name="player"
                                options={{
                                    animation: "fade",
                                    animationDuration: 200,
                                }}
                            />
                            <Stack.Screen
                                name="reciter/[id]"
                                options={{
                                    animation: "fade",
                                    animationDuration: 200,
                                }}
                            />
                            <Stack.Screen name="settings" />
                            <Stack.Screen name="about" />
                        </Stack>
                    </DownloadProvider>
                </SleepTimerProvider>
            </AudioProvider>
        </View>
    )
}

export default function RootLayout() {
    const [isReady, setIsReady] = useState(false)
    const [initError, setInitError] = useState<string | null>(null)
    const [fontsLoaded] = useFonts({
        Tajawal_400Regular,
        Tajawal_500Medium,
        Tajawal_700Bold,
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
        SurahNames: require("../assets/fonts/surah_names.ttf"),
    })

    useEffect(() => {
        async function prepare() {
            try {
                // Initialize database (copies bundled DB on first install)
                await initDatabase()
            } catch (error) {
                console.error("Init failed:", error)
                setInitError(error instanceof Error ? error.message : 'Unknown error')
                setIsReady(true)
                return
            }
            setIsReady(true)
        }

        prepare()
    }, [])

    const onLayoutRootView = useCallback(async () => {
        if (isReady && fontsLoaded) {
            await SplashScreen.hideAsync()
        }
    }, [isReady, fontsLoaded])

    if (!isReady || !fontsLoaded) {
        return null
    }

    // Show error screen if initialization failed
    if (initError) {
        return (
            <View style={{ flex: 1, backgroundColor: "#121212", justifyContent: "center", alignItems: "center", padding: 20 }}>
                <Text style={{ color: "#efefd5", fontSize: 18, marginBottom: 10 }}>Initialization Error</Text>
                <Text style={{ color: "#B3B3B3", fontSize: 14, textAlign: "center" }}>{initError}</Text>
                <Text style={{ color: "#666", fontSize: 12, marginTop: 20 }}>Please restart the app</Text>
            </View>
        )
    }

    return (
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
            <SafeAreaProvider>
                <ThemeProvider>
                    <NetworkProvider>
                        <AppContent />
                    </NetworkProvider>
                </ThemeProvider>
            </SafeAreaProvider>
        </View>
    )
}
