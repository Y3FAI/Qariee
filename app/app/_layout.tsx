import { useEffect, useState, useRef, useCallback } from "react"
import { Drawer } from "expo-router/drawer"
import { View, Text, ActivityIndicator, StyleSheet } from "react-native"
import { SafeAreaProvider } from "react-native-safe-area-context"
import * as SplashScreen from "expo-splash-screen"
import { AudioProvider } from "../src/contexts/AudioContext"
import { DownloadProvider } from "../src/contexts/DownloadContext"
import { NetworkProvider, useNetwork } from "../src/contexts/NetworkContext"
import { SleepTimerProvider } from "../src/contexts/SleepTimerContext"
import CustomDrawer from "../src/components/CustomDrawer"
import "../src/services/i18n" // Initialize i18n

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync()

// New simplified data initialization
import {
    copyBundledDatabaseIfNeeded,
    ensureSQLiteDirectoryExists,
    runMigrations,
    healthCheck,
    initDatabase,
} from "../src/services/database"
import { requestSync } from "../src/services/syncService"
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

function AppContent() {
    const { isOffline } = useNetwork()
    const wasOfflineRef = useRef(isOffline)

    // Detect when network comes online and trigger sync
    useEffect(() => {
        if (wasOfflineRef.current && !isOffline) {
            // Network just became available - request sync (debounced)
            requestSync()
        }
        wasOfflineRef.current = isOffline
    }, [isOffline])

    return (
        <View style={{ flex: 1, backgroundColor: "#121212" }}>
            <AudioProvider>
                <SleepTimerProvider>
                    <DownloadProvider>
                        <Drawer
                            drawerContent={(props) => <CustomDrawer {...props} />}
                            screenOptions={{
                                headerShown: false,
                                drawerPosition: "left",
                                drawerStyle: {
                                    backgroundColor: "#121212",
                                    width: 280,
                                },
                                drawerType: "front",
                                swipeEnabled: true,
                                overlayColor: "rgba(0, 0, 0, 0.5)",
                            }}
                        >
                            <Drawer.Screen
                                name="index"
                                options={{
                                    drawerItemStyle: { display: "none" },
                                }}
                            />
                            <Drawer.Screen
                                name="player"
                                options={{
                                    drawerItemStyle: { display: "none" },
                                    swipeEnabled: false,
                                }}
                            />
                            <Drawer.Screen
                                name="reciter/[id]"
                                options={{
                                    drawerItemStyle: { display: "none" },
                                    swipeEnabled: false,
                                }}
                            />
                            <Drawer.Screen
                                name="settings"
                                options={{
                                    drawerItemStyle: { display: "none" },
                                }}
                            />
                            <Drawer.Screen
                                name="about"
                                options={{
                                    drawerItemStyle: { display: "none" },
                                }}
                            />
                        </Drawer>
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
                // Step 1: Ensure SQLite directory exists (Android)
                await ensureSQLiteDirectoryExists()

                // Step 2: Copy bundled database on first install
                const wasCopied = await copyBundledDatabaseIfNeeded()

                if (wasCopied) {
                    console.log("Bundled database copied successfully")
                }

                // Step 3: Run migrations (for existing users after updates)
                await runMigrations()

                // Step 4: Health check - verify database integrity
                const health = await healthCheck()

                if (!health.isHealthy) {
                    // Database is corrupted or empty - reinitialize
                    console.warn("Database health check failed, reinitializing:", health.errors)
                    await initDatabase()
                }

                // Step 5: Trigger background sync (debounced, non-blocking)
                requestSync()

                setIsReady(true)
            } catch (error) {
                console.error("App initialization error:", error)
                // Continue anyway - bundled database should have data
                setIsReady(true)
            }
        }

        prepare()
    }, [])

    const onLayoutRootView = useCallback(async () => {
        if (isReady && fontsLoaded) {
            // Hide the splash screen after the root view has laid out
            await SplashScreen.hideAsync()
        }
    }, [isReady, fontsLoaded])

    if (!isReady || !fontsLoaded) {
        return null // Keep showing native splash screen
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

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        backgroundColor: "#121212",
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: {
        marginTop: 16,
        color: "#efefd5",
        fontSize: 16,
    },
})
