import { createContext, useContext, useState, ReactNode } from "react"

interface ThemeColors {
    statusBar: string // For status bar background
    background: string // For general background
}

interface ThemeContextType {
    colors: ThemeColors
    setColors: (colors: ThemeColors) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const DEFAULT_COLORS: ThemeColors = {
    statusBar: "#121212",
    background: "#121212",
}

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [colors, setColors] = useState<ThemeColors>(DEFAULT_COLORS)

    return (
        <ThemeContext.Provider value={{ colors, setColors }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider")
    }
    return context
}
