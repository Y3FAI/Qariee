import { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  BackHandler,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getAllReciters } from '../src/services/database';
import { getReciterPhotoUrl } from '../src/constants/config';
import { Reciter } from '../src/types';
import MiniPlayer from '../src/components/MiniPlayer';
import OfflineIndicator from '../src/components/OfflineIndicator';
import { isArabic } from '../src/services/i18n';
import { getFontFamily } from '../src/utils/fonts';
import { useTheme } from '../src/contexts/ThemeContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 columns with padding

// Static dark gradient - bright purple fading to dark
const GRADIENT_COLORS = ['#4a2c6a', '#2a1a3d', '#121212'] as const;

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { setColors } = useTheme();
  const insets = useSafeAreaInsets();
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [loading, setLoading] = useState(true);
  const arabic = isArabic();
  const backPressedOnce = useRef(false);

  useEffect(() => {
    loadReciters();
  }, []);

  // Set theme colors when screen is focused
  useFocusEffect(
    useCallback(() => {
      setColors({ statusBar: GRADIENT_COLORS[0], background: '#121212' });
    }, [setColors])
  );

  // Handle Android hardware back button with double-tap to exit
  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (backPressedOnce.current) {
          // Second press - exit app
          BackHandler.exitApp();
          return true;
        }

        // First press - show alert and set flag
        backPressedOnce.current = true;
        Alert.alert(
          t('exit_app'),
          t('press_back_again_to_exit'),
          [{ text: t('ok'), onPress: () => {} }],
          { cancelable: true }
        );

        // Reset flag after 2 seconds
        setTimeout(() => {
          backPressedOnce.current = false;
        }, 2000);

        return true; // Prevent default back behavior
      });

      return () => backHandler.remove();
    }, [t])
  );

  const loadReciters = async () => {
    try {
      const data = await getAllReciters();
      setReciters(data);
    } catch (error) {
      console.error('Error loading reciters:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderReciterCard = ({ item }: { item: Reciter }) => {
    const isRTL = i18n.language === 'ar';
    const name = isRTL ? item.name_ar : item.name_en;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => {
          router.push(`/reciter/${item.id}`);
        }}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: getReciterPhotoUrl(item.id) }}
          style={styles.reciterImage}
          placeholder={require('../assets/images/placeholder.png')}
          placeholderContentFit="cover"
          contentFit="cover"
          transition={200}
        />
        <View style={styles.cardInfo}>
          <Text
            style={[styles.reciterName, { fontFamily: getFontFamily(arabic, 'medium') }]}
            numberOfLines={2}
          >
            {name}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  if (reciters.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No reciters available</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={GRADIENT_COLORS}
      locations={[0, 0.4, 1]}
      style={styles.container}
    >
      <View style={[styles.safeArea, { paddingTop: insets.top }]}>
        <OfflineIndicator />
        <FlatList
          data={reciters}
          renderItem={renderReciterCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          ListHeaderComponent={
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => router.push('/settings')}
                activeOpacity={0.7}
              >
                <Ionicons name="settings-outline" size={24} color="#efefd5" />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { fontFamily: getFontFamily(arabic, 'bold') }]}>
                {t('reciters')}
              </Text>
            </View>
          }
        />
        <MiniPlayer />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 24,
    marginHorizontal: -16,
    paddingTop: 16,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    color: '#efefd5',
  },
  listContent: {
    padding: 16,
    paddingBottom: 0,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  card: {
    width: CARD_WIDTH,
    alignItems: 'center',
  },
  reciterImage: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: CARD_WIDTH / 2,
    backgroundColor: '#282828',
  },
  cardInfo: {
    paddingTop: 12,
    alignItems: 'center',
    width: CARD_WIDTH,
  },
  reciterName: {
    fontSize: 14,
    color: '#B3B3B3',
    textAlign: 'center',
    width: '100%',
  },
  loadingText: {
    color: '#efefd5',
    fontSize: 16,
  },
  emptyText: {
    color: '#B3B3B3',
    fontSize: 16,
  },
});
