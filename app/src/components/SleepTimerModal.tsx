import { View, Text, Modal, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useSleepTimer } from '../contexts/SleepTimerContext';
import { isArabic } from '../services/i18n';
import { getFontFamily } from '../utils/fonts';

const { width } = Dimensions.get('window');

interface SleepTimerModalProps {
  visible: boolean;
  onClose: () => void;
  primaryColor?: string;
  secondaryColor?: string;
}

// Preset timer options in minutes
const TIMER_OPTIONS = [5, 10, 15, 30, 45, 60];

/**
 * Format remaining seconds to display format (e.g., "15:30" or "1:05:30")
 */
const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function SleepTimerModal({
  visible,
  onClose,
  primaryColor = '#282828',
  secondaryColor = '#404040',
}: SleepTimerModalProps) {
  const { t } = useTranslation();
  const { isActive, remainingSeconds, setTimer, clearTimer } = useSleepTimer();
  const arabic = isArabic();

  const handleSetTimer = (minutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimer(minutes);
    onClose();
  };

  const handleClearTimer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearTimer();
    onClose();
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      >
        {/* Modal Content */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={styles.modalContainer}
        >
          <LinearGradient
            colors={['#1a1a1a', '#121212', '#0a0a0a']}
            style={styles.modalContent}
            locations={[0, 0.5, 1]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Ionicons name="moon" size={28} color="#efefd5" />
              <Text style={[styles.title, { fontFamily: getFontFamily(arabic, 'bold') }]}>
                {t('sleep_timer')}
              </Text>
              <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={28} color="#efefd5" />
              </TouchableOpacity>
            </View>

            {/* Active Timer Display */}
            {isActive && (
              <View style={styles.activeTimerContainer}>
                <View style={styles.activeTimerContent}>
                  <Ionicons name="time" size={32} color="#1DB954" />
                  <Text style={[styles.activeTimerText, { fontFamily: getFontFamily(arabic, 'bold') }]}>
                    {formatTime(remainingSeconds)}
                  </Text>
                </View>
                <Text style={[styles.activeTimerLabel, { fontFamily: getFontFamily(arabic, 'regular') }]}>
                  {t('timer_active')}
                </Text>
              </View>
            )}

            {/* Timer Options Grid */}
            <View style={styles.optionsGrid}>
              {TIMER_OPTIONS.map((minutes) => (
                <TouchableOpacity
                  key={minutes}
                  style={styles.optionButton}
                  onPress={() => handleSetTimer(minutes)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionContent}>
                    <Text style={[styles.optionNumber, { fontFamily: getFontFamily(false, 'bold') }]}>
                      {minutes}
                    </Text>
                    <Text style={[styles.optionLabel, { fontFamily: getFontFamily(arabic, 'regular') }]}>
                      {t('minutes')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Cancel Button (only show if timer is active) */}
            {isActive && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClearTimer}
                activeOpacity={0.7}
              >
                <Text style={[styles.cancelButtonText, { fontFamily: getFontFamily(arabic, 'medium') }]}>
                  {t('cancel_timer')}
                </Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
  },
  modalContent: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    color: '#efefd5',
    flex: 1,
    textAlign: 'center',
  },
  activeTimerContainer: {
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.3)',
  },
  activeTimerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  activeTimerText: {
    fontSize: 36,
    color: '#efefd5',
    marginLeft: 12,
  },
  activeTimerLabel: {
    fontSize: 14,
    color: '#E0E0E0',
    textAlign: 'center',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionButton: {
    width: (width - 60) / 3, // 3 columns with gaps
    aspectRatio: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  optionContent: {
    alignItems: 'center',
  },
  optionNumber: {
    fontSize: 32,
    color: '#efefd5',
    marginBottom: 4,
  },
  optionLabel: {
    fontSize: 14,
    color: '#E0E0E0',
    fontWeight: '500',
  },
  cancelButton: {
    marginTop: 20,
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.4)',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#FF3B30',
  },
});
