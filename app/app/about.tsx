import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, BackHandler, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { isArabic } from '../src/services/i18n';
import { getFontFamily } from '../src/utils/fonts';
import Constants from 'expo-constants';
import { useEffect } from 'react';

export default function About() {
  const { t } = useTranslation();
  const arabic = isArabic();
  const isRTL = arabic || I18nManager.isRTL;

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/');
      return true;
    });
    return () => backHandler.remove();
  }, []);

  const handleEmailContact = () => {
    Linking.openURL('mailto:yousef.contact.apps@gmail.com');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="chevron-back"
            size={28}
            color="#efefd5"
          />
        </TouchableOpacity>
        <Text style={[styles.title, { fontFamily: getFontFamily(arabic, 'bold') }]}>
          {t('about')}
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* App Name & Version */}
        <View style={styles.appInfo}>
          <Text style={[styles.appName, { fontFamily: getFontFamily(arabic, 'bold') }]}>
            {t('app_name')}
          </Text>
          <Text style={[styles.versionText, { fontFamily: getFontFamily(arabic, 'regular') }]}>
            {t('version')} {Constants.expoConfig?.version || '1.0.0'}
          </Text>
        </View>

        {/* Description */}
        <Text style={[styles.description, { fontFamily: getFontFamily(arabic, 'regular') }]}>
          {t('about_description')}
        </Text>

        {/* Free Badge */}
        <View style={styles.freeBadgeContainer}>
          <View style={styles.freeBadge}>
            <Text style={[styles.freeBadgeText, { fontFamily: getFontFamily(arabic, 'semibold') }]}>
              {t('free_forever')}
            </Text>
          </View>
        </View>

        {/* Features */}
        <View style={styles.card}>
          <Text style={[
            styles.cardTitle,
            { fontFamily: getFontFamily(arabic, 'semibold'), textAlign: isRTL ? 'right' : 'left' }
          ]}>
            {t('features')}
          </Text>
          <View style={styles.featuresList}>
            <FeatureItem text={t('feature_streaming')} arabic={arabic} isRTL={isRTL} />
            <FeatureItem text={t('feature_offline')} arabic={arabic} isRTL={isRTL} />
            <FeatureItem text={t('feature_reciters')} arabic={arabic} isRTL={isRTL} />
            <FeatureItem text={t('feature_sleep_timer')} arabic={arabic} isRTL={isRTL} />
          </View>
        </View>

        {/* Audio Source */}
        <View style={styles.card}>
          <Text style={[
            styles.cardTitle,
            { fontFamily: getFontFamily(arabic, 'semibold'), textAlign: isRTL ? 'right' : 'left' }
          ]}>
            {t('audio_source')}
          </Text>
          <Text style={[
            styles.cardText,
            { fontFamily: getFontFamily(arabic, 'regular'), textAlign: isRTL ? 'right' : 'left' }
          ]}>
            {t('audio_source_text')}
          </Text>
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <Text style={[styles.contactLabel, { fontFamily: getFontFamily(arabic, 'regular'), textAlign: isRTL ? 'right' : 'left' }]}>
            {t('contact_text')}
          </Text>
          <TouchableOpacity
            onPress={handleEmailContact}
            activeOpacity={0.7}
          >
            <Text style={[styles.emailText, { fontFamily: getFontFamily(arabic, 'regular') }]}>
              yousef.contact.apps@gmail.com
            </Text>
          </TouchableOpacity>
        </View>

        {/* Thank You */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { fontFamily: getFontFamily(arabic, 'medium') }]}>
            {t('thank_you')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureItem({ text, arabic, isRTL }: { text: string; arabic: boolean; isRTL: boolean }) {
  return (
    <View style={[styles.featureItem, isRTL && styles.featureItemRTL]}>
      <View style={styles.bullet} />
      <Text style={[
        styles.featureText,
        { fontFamily: getFontFamily(arabic, 'regular'), textAlign: isRTL ? 'right' : 'left' }
      ]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 239, 213, 0.08)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    color: '#efefd5',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 24,
  },
  appInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appName: {
    fontSize: 28,
    color: '#efefd5',
    letterSpacing: 1,
  },
  versionText: {
    fontSize: 13,
    color: 'rgba(239, 239, 213, 0.5)',
    marginTop: 4,
  },
  description: {
    fontSize: 15,
    color: 'rgba(239, 239, 213, 0.8)',
    lineHeight: 26,
    marginBottom: 24,
    textAlign: 'center',
  },
  freeBadgeContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  freeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  freeBadgeText: {
    fontSize: 14,
    color: '#4ade80',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    color: '#efefd5',
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    color: 'rgba(239, 239, 213, 0.7)',
    lineHeight: 22,
  },
  featuresList: {
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureItemRTL: {
    flexDirection: 'row-reverse',
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(239, 239, 213, 0.4)',
  },
  featureText: {
    fontSize: 14,
    color: 'rgba(239, 239, 213, 0.7)',
    flex: 1,
    lineHeight: 22,
  },
  contactLabel: {
    fontSize: 14,
    color: 'rgba(239, 239, 213, 0.7)',
    lineHeight: 22,
    marginBottom: 8,
  },
  emailText: {
    fontSize: 14,
    color: 'rgba(239, 239, 213, 0.7)',
    textAlign: 'center',
  },
  footer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: 'rgba(239, 239, 213, 0.5)',
  },
});
