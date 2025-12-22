declare module "react-native-background-timer" {
    type TimerId = number

    interface BackgroundTimerStatic {
        setTimeout(
            fn: (...args: any[]) => void,
            timeout?: number,
            ...args: any[]
        ): TimerId
        clearTimeout(id: TimerId): void
        setInterval(
            fn: (...args: any[]) => void,
            interval?: number,
            ...args: any[]
        ): TimerId
        clearInterval(id: TimerId): void
        stop(): void
        start(): void
    }

    const BackgroundTimer: BackgroundTimerStatic
    export default BackgroundTimer
}
