import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import translation files
import en from '../locales/en.json';
import ar from '../locales/ar.json';

const LANGUAGE_STORAGE_KEY = '@qariee:language';

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

// Helper to get current language
export const getCurrentLanguage = (): 'ar' | 'en' => {
  return (i18n.language as 'ar' | 'en') || 'ar';
};

// Helper to change language and persist it
export const changeLanguage = async (lang: 'ar' | 'en'): Promise<void> => {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
};

// Helper to get saved or detected language
const getInitialLanguage = async (): Promise<'ar' | 'en'> => {
  try {
    const savedLang = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLang === 'ar' || savedLang === 'en') {
      return savedLang;
    }
  } catch (error) {
    console.error('Error loading saved language:', error);
  }

  // Default to Arabic
  return 'ar';
};

// Initialize i18n with detected/saved language
const initI18n = async () => {
  const initialLanguage = await getInitialLanguage();

  await i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'ar',
    compatibilityJSON: 'v4', // For React Native
    interpolation: {
      escapeValue: false,
    },
  });
};

// Start initialization (non-blocking)
initI18n();

export default i18n;
