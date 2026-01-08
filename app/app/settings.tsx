import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { isArabic, isRTL, changeLanguage, getCurrentLanguage } from '../src/services/i18n';
import { getFontFamily } from '../src/utils/fonts';

export default function Settings() {
  const { t } = useTranslation();
  const arabic = isArabic();
  const rtl = isRTL();
  const [currentLang, setCurrentLang] = useState<'ar' | 'en'>(getCurrentLanguage());

  const handleLanguageChange = async (lang: 'ar' | 'en') => {
    if (lang === currentLang) return;
    setCurrentLang(lang);
    await changeLanguage(lang);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, rtl && styles.headerRTL]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={28}
            color="#efefd5"
          />
        </TouchableOpacity>
        <Text style={[styles.title, { fontFamily: getFontFamily(arabic, 'bold') }]}>
          {t('settings')}
        </Text>
      </View>

      {/* Settings Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Language Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: getFontFamily(arabic, 'medium') }]}>
            {t('language')}
          </Text>

          {/* English Option */}
          <TouchableOpacity
            style={[styles.option, currentLang === 'en' && styles.optionActive]}
            onPress={() => handleLanguageChange('en')}
            activeOpacity={0.7}
          >
            <View style={styles.optionContent}>
              <Text style={[styles.optionText, { fontFamily: getFontFamily(arabic, 'regular') }]}>
                {t('english')}
              </Text>
            </View>
            {currentLang === 'en' && (
              <Ionicons name="checkmark-circle" size={24} color="#1DB954" />
            )}
          </TouchableOpacity>

          {/* Arabic Option */}
          <TouchableOpacity
            style={[styles.option, currentLang === 'ar' && styles.optionActive]}
            onPress={() => handleLanguageChange('ar')}
            activeOpacity={0.7}
          >
            <View style={styles.optionContent}>
              <Text style={[styles.optionText, { fontFamily: getFontFamily(arabic, 'regular') }]}>
                {t('arabic')}
              </Text>
            </View>
            {currentLang === 'ar' && (
              <Ionicons name="checkmark-circle" size={24} color="#1DB954" />
            )}
          </TouchableOpacity>
        </View>

        {/* Coming Soon Text */}
        <View style={styles.section}>
          <Text style={[styles.comingSoonText, { fontFamily: getFontFamily(arabic, 'regular') }]}>
            المزيد من الإعدادات قريباً...
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 239, 213, 0.1)',
  },
  headerRTL: {
    flexDirection: 'row-reverse',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 24,
    color: '#efefd5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    color: 'rgba(239, 239, 213, 0.5)',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionActive: {
    borderColor: '#1DB954',
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    color: '#efefd5',
  },
  comingSoonText: {
    fontSize: 14,
    color: 'rgba(239, 239, 213, 0.5)',
    textAlign: 'center',
    marginTop: 20,
  },
});
