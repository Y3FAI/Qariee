import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface UpdateBannerProps {
  onDismiss: () => void;
}

export default function UpdateBanner({ onDismiss }: UpdateBannerProps) {
  const { t } = useTranslation();

  const handleUpdate = () => {
    // TODO: Open app store link
    // For Android: Play Store link
    // For iOS: App Store link
    console.log('Open store for update');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="information-circle" size={24} color="#1DB954" />
        <Text style={styles.message}>{t('update_available')}</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={handleUpdate} style={styles.updateButton}>
          <Text style={styles.updateText}>{t('update')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={20} color="#B3B3B3" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#282828',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  message: {
    color: '#efefd5',
    fontSize: 13,
    marginLeft: 12,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  updateButton: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  updateText: {
    color: '#efefd5',
    fontSize: 13,
    fontWeight: '600',
  },
});
