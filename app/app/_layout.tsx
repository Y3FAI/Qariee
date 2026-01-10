import { useEffect, useState, useCallback } from "react"
import { Stack } from "expo-router"
import { View, Text } from "react-native"
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"
import * as SplashScreen from "expo-splash-screen"
import { AudioProvider } from "../src/contexts/AudioContext"
import { DownloadProvider } from "../src/contexts/DownloadContext"
import { NetworkProvider, useNetwork } from "../src/contexts/NetworkContext"
import { SleepTimerProvider } from "../src/contexts/SleepTimerContext"
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

    // Sync when network becomes available
    useEffect(() => {
        if (!isOffline) {
            sync()
        }
    }, [isOffline])

    return (
        <View style={{ flex: 1, backgroundColor: "#121212" }}>
            <AudioProvider>
                <SleepTimerProvider>
                    <DownloadProvider>
                        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                            <Stack
                                screenOptions={{
                                    headerShown: false,
                                }}
                            >
                                <Stack.Screen name="index" />
                                <Stack.Screen name="player" />
                                <Stack.Screen name="reciter/[id]" />
                                <Stack.Screen name="settings" />
                                <Stack.Screen name="about" />
                            </Stack>
                        </SafeAreaView>
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
                <NetworkProvider>
                    <AppContent />
                </NetworkProvider>
            </SafeAreaProvider>
        </View>
    )
}
