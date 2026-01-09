import { useEffect, useState, useCallback } from "react"
import { Stack } from "expo-router"
import { View } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"
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
                    </DownloadProvider>
                </SleepTimerProvider>
            </AudioProvider>
        </View>
    )
}

export default function RootLayout() {
    const [isReady, setIsReady] = useState(false)
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

                // Sync with CDN (non-blocking, fire and forget)
                sync()
            } catch (error) {
                console.error("Init failed:", error)
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
