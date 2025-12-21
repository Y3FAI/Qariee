import { useFonts, Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold } from '@expo-google-fonts/tajawal';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

export { useFonts, Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold };

/**
 * Get font family based on language and weight
 */
export const getFontFamily = (isArabic: boolean, weight: 'regular' | 'medium' | 'semibold' | 'bold' = 'regular'): string => {
  if (isArabic) {
    switch (weight) {
      case 'medium':
        return 'Tajawal_500Medium';
      case 'bold':
        return 'Tajawal_700Bold';
      default:
        return 'Tajawal_400Regular';
    }
  } else {
    switch (weight) {
      case 'medium':
        return 'Inter_500Medium';
      case 'semibold':
        return 'Inter_600SemiBold';
      case 'bold':
        return 'Inter_700Bold';
      default:
        return 'Inter_400Regular';
    }
  }
};
