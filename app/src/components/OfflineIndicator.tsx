import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNetwork } from '../contexts/NetworkContext';
import { getFontFamily } from '../utils/fonts';
import { isArabic } from '../services/i18n';

export default function OfflineIndicator() {
  const { isOffline } = useNetwork();
  const { t } = useTranslation();
  const arabic = isArabic();

  if (!isOffline) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Ionicons name="cloud-offline" size={16} color="#efefd5" style={styles.icon} />
      <Text style={[styles.text, { fontFamily: getFontFamily(arabic, 'medium') }]}>
        {t('offline_mode')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 239, 213, 0.1)',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    color: '#efefd5',
    fontSize: 14,
  },
});
