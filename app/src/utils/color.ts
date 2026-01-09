/**
 * Convert hex color to rgba with opacity
 * @param hex - Hex color string (e.g., "#FF5500" or "FF5500")
 * @param alpha - Opacity value between 0 and 1
 * @param fallbackRgb - RGB values to use when hex is null/undefined (default: dark gray)
 * @returns rgba string
 */
export const hexToRgba = (
    hex: string | null | undefined,
    alpha: number,
    fallbackRgb: [number, number, number] = [18, 18, 18],
): string => {
    if (!hex) return `rgba(${fallbackRgb[0]}, ${fallbackRgb[1]}, ${fallbackRgb[2]}, ${alpha})`

    const num = parseInt(hex.replace("#", ""), 16)
    const r = (num >> 16) & 0xff
    const g = (num >> 8) & 0xff
    const b = num & 0xff

    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
