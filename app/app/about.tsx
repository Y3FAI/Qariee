import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { isArabic } from '../src/services/i18n';
import { getFontFamily } from '../src/utils/fonts';
import Constants from 'expo-constants';

export default function About() {
  const { t } = useTranslation();
  const arabic = isArabic();

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

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* App Name & Version */}
        <View style={styles.appInfo}>
          <Text style={[styles.appName, { fontFamily: getFontFamily(arabic, 'bold') }]}>
            {t('app_name')}
          </Text>
          <Text style={[styles.infoText, { fontFamily: getFontFamily(arabic, 'regular') }]}>
            {t('version')}: {Constants.expoConfig?.version || '1.0.0'}
          </Text>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={[styles.description, { fontFamily: getFontFamily(arabic, 'regular') }]}>
            {t('about_description')}
          </Text>
        </View>

        {/* Features */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: getFontFamily(arabic, 'semibold') }]}>
            {t('features')}
          </Text>
          <View style={styles.featuresList}>
            <View style={styles.featureItem}>
              <Ionicons name="radio" size={18} color="#1DB954" />
              <Text style={[styles.featureText, { fontFamily: getFontFamily(arabic, 'regular') }]}>
                {t('feature_streaming')}
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="download" size={18} color="#1DB954" />
              <Text style={[styles.featureText, { fontFamily: getFontFamily(arabic, 'regular') }]}>
                {t('feature_offline')}
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="time" size={18} color="#1DB954" />
              <Text style={[styles.featureText, { fontFamily: getFontFamily(arabic, 'regular') }]}>
                {t('feature_timer')}
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="phone-portrait" size={18} color="#1DB954" />
              <Text style={[styles.featureText, { fontFamily: getFontFamily(arabic, 'regular') }]}>
                {t('feature_interface')}
              </Text>
            </View>
          </View>
        </View>

        {/* Sources */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: getFontFamily(arabic, 'semibold') }]}>
            {t('sources_title')}
          </Text>
          <Text style={[styles.bodyText, { fontFamily: getFontFamily(arabic, 'regular') }]}>
            {t('sources_description')}
          </Text>
          <Text style={[styles.bodyText, { fontFamily: getFontFamily(arabic, 'regular'), marginTop: 8 }]}>
            {t('sources_thanks')}
          </Text>
        </View>

        {/* Developer */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { fontFamily: getFontFamily(arabic, 'semibold') }]}>
            {t('developer')}
          </Text>
          <Text style={[styles.bodyText, { fontFamily: getFontFamily(arabic, 'regular') }]}>
            {t('developer_name')}
          </Text>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={handleEmailContact}
            activeOpacity={0.7}
          >
            <Ionicons name="mail" size={20} color="#1DB954" />
            <Text style={[styles.contactText, { fontFamily: getFontFamily(arabic, 'regular') }]}>
              {t('contact')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Thank you */}
        <View style={styles.thankYouSection}>
          <Text style={[styles.thankYouText, { fontFamily: getFontFamily(arabic, 'medium') }]}>
            {t('thank_you')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    paddingTop: 16,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 239, 213, 0.1)',
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
  appInfo: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  appName: {
    fontSize: 28,
    color: '#efefd5',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(239, 239, 213, 0.6)',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#efefd5',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: 'rgba(239, 239, 213, 0.8)',
    lineHeight: 24,
  },
  featuresList: {
    gap: 10,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: 'rgba(239, 239, 213, 0.8)',
  },
  bodyText: {
    fontSize: 15,
    color: 'rgba(239, 239, 213, 0.8)',
    lineHeight: 22,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 8,
  },
  contactText: {
    fontSize: 15,
    color: '#1DB954',
  },
  thankYouSection: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  thankYouText: {
    fontSize: 16,
    color: '#efefd5',
  },
});
