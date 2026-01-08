import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';
import * as Localization from 'expo-localization';

// Import translation files
import en from '../locales/en.json';
import ar from '../locales/ar.json';

const resources = {
  en: {
    translation: en,
  },
  ar: {
    translation: ar,
  },
};

// Helper to check if current language is RTL
export const isRTL = (): boolean => {
  return i18n.language === 'ar';
};

// Helper to check if current language is Arabic
export const isArabic = (): boolean => {
  return i18n.language === 'ar';
};

// Detect device language
const deviceLanguage = Localization.getLocales()[0]?.languageCode || 'en';
const initialLanguage = deviceLanguage === 'ar' ? 'ar' : 'en';

i18n.use(initReactI18next).init({
  resources,
  lng: 'ar', // Arabic only - RTL focused app
  fallbackLng: 'ar',
  compatibilityJSON: 'v4', // For React Native
  interpolation: {
    escapeValue: false,
  },
});

// Don't force RTL globally - handle at component level for better control
I18nManager.allowRTL(false);

export default i18n;
