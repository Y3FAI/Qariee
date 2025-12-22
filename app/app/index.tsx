import { useState, useEffect, useRef } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useRouter, useNavigation } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAllReciters } from '../src/services/database';
import { getReciterPhotoUrl } from '../src/constants/config';
import { Reciter } from '../src/types';
import MiniPlayer from '../src/components/MiniPlayer';
import UpdateBanner from '../src/components/UpdateBanner';
import OfflineIndicator from '../src/components/OfflineIndicator';
import { useAudio } from '../src/contexts/AudioContext';
import { isArabic } from '../src/services/i18n';
import { getFontFamily } from '../src/utils/fonts';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 columns with padding

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const navigation = useNavigation();
  const { needsUpdate, setNeedsUpdate } = useAudio();
  const [reciters, setReciters] = useState<Reciter[]>([]);
  const [loading, setLoading] = useState(true);
  const arabic = isArabic();
  const backPressedOnce = useRef(false);

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
    <SafeAreaView style={styles.container} edges={['top']}>
      {needsUpdate && <UpdateBanner onDismiss={() => setNeedsUpdate(false)} />}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
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
