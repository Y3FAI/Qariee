import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  BackHandler,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useRouter, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAllReciters } from '../src/services/database';
import { getReciterPhotoUrl } from '../src/constants/config';
import { Reciter } from '../src/types';
import MiniPlayer from '../src/components/MiniPlayer';
import OfflineIndicator from '../src/components/OfflineIndicator';
import { isArabic } from '../src/services/i18n';
import { getFontFamily } from '../src/utils/fonts';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 columns with padding

// Pre-defined subtle dark gradients - beautiful, noticeable tints
const SUBTLE_GRADIENTS = [
  ['#2a2a40', '#242430', '#1e1e28', '#121212'], // Blue tint
  ['#2a2a2a', '#242424', '#1e1e1e', '#121212'], // Pure dark tint
  ['#402a2a', '#302424', '#281e1e', '#121212'], // Red tint
  ['#2a402a', '#243024', '#1e281e', '#121212'], // Green tint
  ['#302a40', '#282430', '#241e28', '#121212'], // Purple tint
];

/**
 * Pick a random subtle gradient on app load
 */
const pickRandomGradient = (): readonly [string, string, string, string] => {
  return SUBTLE_GRADIENTS[Math.floor(Math.random() * SUBTLE_GRADIENTS.length)];
};

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [loading, setLoading] = useState(true);
  const arabic = isArabic();
  const backPressedOnce = useRef(false);
  const [gradientColors] = useState(() => pickRandomGradient());

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  useEffect(() => {
    loadReciters();
  }, []);

  // Handle Android hardware back button with double-tap to exit
  useEffect(() => {
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
  }, [t]);

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
          defaultSource={require('../assets/images/icon.png')}
          resizeMode="cover"
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
      colors={gradientColors}
      locations={[0, 0.3, 0.7, 1]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <OfflineIndicator />
        <View style={[styles.header, { direction: 'ltr' }]}>
          <TouchableOpacity
            style={styles.menuButton}
            onPress={openDrawer}
            activeOpacity={0.7}
          >
            <Ionicons name="menu" size={28} color="#efefd5" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontFamily: getFontFamily(arabic, 'bold'), textAlign: arabic ? 'right' : 'left', flex: 1 }]}>
            {t('reciters')}
          </Text>
        </View>
        <FlatList
          data={reciters}
          renderItem={renderReciterCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
        />
        <MiniPlayer />
      </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 32,
    color: '#efefd5',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
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
  },
  reciterName: {
    fontSize: 14,
    color: '#B3B3B3',
    textAlign: 'center',
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
