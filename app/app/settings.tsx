import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { isArabic, isRTL } from '../src/services/i18n';
import { getFontFamily } from '../src/utils/fonts';

export default function Settings() {
  const { t } = useTranslation();
  const arabic = isArabic();
  const rtl = isRTL();

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
        {/* Settings coming soon */}
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
    marginTop: 30,
  },
  sectionTitle: {
    fontSize: 16,
    color: 'rgba(239, 239, 213, 0.7)',
    marginBottom: 12,
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
