"use client"

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react"

// Telegram WebApp types (API 9.1)
interface SafeAreaInset {
    top: number
    bottom: number
    left: number
    right: number
}

interface DeviceStorageItem {
    key: string
    value: string
}

interface TelegramWebApp {
    ready: () => void
    expand: () => void
    close: () => void
    isExpanded: boolean
    viewportHeight: number
    viewportStableHeight: number
    headerColor: string
    backgroundColor: string
    isVerticalSwipesEnabled: boolean
    platform: string
    colorScheme: "light" | "dark"
    isFullscreen: boolean
    isActive: boolean
    safeAreaInset: SafeAreaInset
    contentSafeAreaInset: SafeAreaInset
    MainButton: {
        text: string
        color: string
        textColor: string
        isVisible: boolean
        isActive: boolean
        show: () => void
        hide: () => void
        enable: () => void
        disable: () => void
        onClick: (callback: () => void) => void
        offClick: (callback: () => void) => void
        showProgress: (leaveActive: boolean) => void
        hideProgress: () => void
        setParams: (params: {
            text?: string
            color?: string
            text_color?: string
            is_active?: boolean
            is_visible?: boolean
        }) => void
    }
    BackButton: {
        isVisible: boolean
        show: () => void
        hide: () => void
        onClick: (callback: () => void) => void
        offClick: (callback: () => void) => void
    }
    HapticFeedback: {
        impactOccurred: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void
        notificationOccurred: (type: "error" | "success" | "warning") => void
        selectionChanged: () => void
    }
    DeviceStorage: {
        getItem: (key: string, callback: (error: Error | null, value: string | null) => void) => void
        setItem: (key: string, value: string, callback: (error: Error | null, success: boolean) => void) => void
        removeItem: (key: string, callback: (error: Error | null, success: boolean) => void) => void
        getItems: (keys: string[], callback: (error: Error | null, items: DeviceStorageItem[]) => void) => void
        removeItems: (keys: string[], callback: (error: Error | null, success: boolean) => void) => void
        getKeys: (callback: (error: Error | null, keys: string[]) => void) => void
        clear: (callback: (error: Error | null, success: boolean) => void) => void
    }
    themeParams: {
        bg_color?: string
        text_color?: string
        hint_color?: string
        link_color?: string
        button_color?: string
        button_text_color?: string
        secondary_bg_color?: string
        header_bg_color?: string
        bottom_bar_bg_color?: string
        accent_text_color?: string
        section_bg_color?: string
        section_header_text_color?: string
        subtitle_text_color?: string
        destructive_text_color?: string
    }
    enableVerticalSwipes: () => void
    disableVerticalSwipes: () => void
    setHeaderColor: (color: string) => void
    setBackgroundColor: (color: string) => void
    requestFullscreen: () => void
    exitFullscreen: () => void
    hideKeyboard: () => void
    onEvent: (eventType: string, eventHandler: (...args: unknown[]) => void) => void
    offEvent: (eventType: string, eventHandler: (...args: unknown[]) => void) => void
    initDataUnsafe: {
        user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
            language_code?: string
            is_premium?: boolean
        }
    }
}

interface TelegramContextType {
    webApp: TelegramWebApp | null
    user: TelegramWebApp["initDataUnsafe"]["user"] | null
    isReady: boolean
    platform: string
    colorScheme: "light" | "dark"
    isFullscreen: boolean
    haptic: TelegramWebApp["HapticFeedback"] | null
    storage: {
        get: (key: string) => Promise<string | null>
        set: (key: string, value: string) => Promise<boolean>
        remove: (key: string) => Promise<boolean>
    }
}

const TelegramContext = createContext<TelegramContextType>({
    webApp: null,
    user: null,
    isReady: false,
    platform: "unknown",
    colorScheme: "dark",
    isFullscreen: false,
    haptic: null,
    storage: {
        get: async () => null,
        set: async () => false,
        remove: async () => false,
    },
})

export function TelegramProvider({ children }: { children: React.ReactNode }) {
    const [isReady, setIsReady] = useState(false)
    const [webApp, setWebApp] = useState<TelegramWebApp | null>(null)

    // Update CSS variables when safe area changes
    const updateSafeAreaVars = useCallback((safeArea: SafeAreaInset, prefix: string) => {
        const root = document.documentElement
        root.style.setProperty(`--tg-${prefix}-inset-top`, `${safeArea.top}px`)
        root.style.setProperty(`--tg-${prefix}-inset-bottom`, `${safeArea.bottom}px`)
        root.style.setProperty(`--tg-${prefix}-inset-left`, `${safeArea.left}px`)
        root.style.setProperty(`--tg-${prefix}-inset-right`, `${safeArea.right}px`)
    }, [])

    // Update viewport CSS variables
    const updateViewportVars = useCallback(() => {
        if (!webApp) return
        const root = document.documentElement
        root.style.setProperty("--tg-viewport-height", `${webApp.viewportHeight}px`)
        root.style.setProperty("--tg-viewport-stable-height", `${webApp.viewportStableHeight}px`)
    }, [webApp])

    useEffect(() => {
        const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null
        if (!tg) return

        // Initialize
        tg.ready()
        tg.expand()
        tg.disableVerticalSwipes()

        // Set app colors to match our dark theme
        const bgColor = "#0a0a0a"
        tg.setHeaderColor(bgColor)
        tg.setBackgroundColor(bgColor)

        // Set initial CSS variables
        updateSafeAreaVars(tg.safeAreaInset, "safe-area")
        updateSafeAreaVars(tg.contentSafeAreaInset, "content-safe-area")

        const root = document.documentElement
        root.style.setProperty("--tg-viewport-height", `${tg.viewportHeight}px`)
        root.style.setProperty("--tg-viewport-stable-height", `${tg.viewportStableHeight}px`)

        // Listen for safe area changes
        const handleSafeAreaChanged = () => {
            updateSafeAreaVars(tg.safeAreaInset, "safe-area")
        }
        const handleContentSafeAreaChanged = () => {
            updateSafeAreaVars(tg.contentSafeAreaInset, "content-safe-area")
        }
        const handleViewportChanged = () => {
            root.style.setProperty("--tg-viewport-height", `${tg.viewportHeight}px`)
            root.style.setProperty("--tg-viewport-stable-height", `${tg.viewportStableHeight}px`)
        }

        tg.onEvent("safeAreaChanged", handleSafeAreaChanged)
        tg.onEvent("contentSafeAreaChanged", handleContentSafeAreaChanged)
        tg.onEvent("viewportChanged", handleViewportChanged)

        setWebApp(tg)
        setIsReady(true)

        return () => {
            tg.offEvent("safeAreaChanged", handleSafeAreaChanged)
            tg.offEvent("contentSafeAreaChanged", handleContentSafeAreaChanged)
            tg.offEvent("viewportChanged", handleViewportChanged)
        }
    }, [updateSafeAreaVars])

    // DeviceStorage wrapper with Promise API
    const storage = useMemo(() => ({
        get: (key: string): Promise<string | null> => {
            return new Promise((resolve) => {
                if (!webApp?.DeviceStorage) {
                    resolve(null)
                    return
                }
                webApp.DeviceStorage.getItem(key, (err, value) => {
                    resolve(err ? null : value)
                })
            })
        },
        set: (key: string, value: string): Promise<boolean> => {
            return new Promise((resolve) => {
                if (!webApp?.DeviceStorage) {
                    resolve(false)
                    return
                }
                webApp.DeviceStorage.setItem(key, value, (err, success) => {
                    resolve(!err && success)
                })
            })
        },
        remove: (key: string): Promise<boolean> => {
            return new Promise((resolve) => {
                if (!webApp?.DeviceStorage) {
                    resolve(false)
                    return
                }
                webApp.DeviceStorage.removeItem(key, (err, success) => {
                    resolve(!err && success)
                })
            })
        },
    }), [webApp])

    const value = useMemo<TelegramContextType>(() => ({
        webApp,
        isReady,
        user: webApp?.initDataUnsafe?.user ?? null,
        platform: webApp?.platform ?? "unknown",
        colorScheme: webApp?.colorScheme ?? "dark",
        isFullscreen: webApp?.isFullscreen ?? false,
        haptic: webApp?.HapticFeedback ?? null,
        storage,
    }), [webApp, isReady, storage])

    return (
        <TelegramContext.Provider value={value}>
            {children}
        </TelegramContext.Provider>
    )
}

export const useTelegram = () => useContext(TelegramContext)

// Type definition for window.Telegram
declare global {
    interface Window {
        Telegram: {
            WebApp: TelegramWebApp
        }
    }
}
