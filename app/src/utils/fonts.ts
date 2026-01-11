import { useFonts } from 'expo-font';

// Load Inter fonts as local assets
const Inter_400Regular = require('../../assets/fonts/Inter_400Regular.ttf');
const Inter_500Medium = require('../../assets/fonts/Inter_500Medium.ttf');
const Inter_600SemiBold = require('../../assets/fonts/Inter_600SemiBold.ttf');
const Inter_700Bold = require('../../assets/fonts/Inter_700Bold.ttf');

// Load Tajawal fonts as local assets
const Tajawal_400Regular = require('../../assets/fonts/Tajawal_400Regular.ttf');
const Tajawal_500Medium = require('../../assets/fonts/Tajawal_500Medium.ttf');
const Tajawal_700Bold = require('../../assets/fonts/Tajawal_700Bold.ttf');

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
