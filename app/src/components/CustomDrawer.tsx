import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { isArabic } from '../services/i18n';
import { getFontFamily } from '../utils/fonts';
import { router } from 'expo-router';
import Constants from 'expo-constants';

export default function CustomDrawer(props: DrawerContentComponentProps) {
  const { t } = useTranslation();
  const arabic = isArabic();

  const menuItems = [
    {
      id: 'settings',
      label: t('settings'),
      icon: 'settings-outline' as const,
      route: '/settings',
    },
    {
      id: 'about',
      label: t('about'),
      icon: 'information-circle-outline' as const,
      route: '/about',
    },
  ];

  const handleItemPress = (item: typeof menuItems[0]) => {
    if (item.route) {
      router.push(item.route as any);
    }
  };

  return (
    <View style={[styles.container, { direction: 'ltr' }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.appName, { fontFamily: getFontFamily(arabic, 'bold'), textAlign: arabic ? 'right' : 'left' }]}>
          {t('app_name')}
        </Text>
        <Text style={[styles.version, { fontFamily: getFontFamily(arabic, 'regular'), textAlign: arabic ? 'right' : 'left' }]}>
          {t('version')} {Constants.expoConfig?.version || '1.0.0'}
        </Text>
      </View>

      {/* Menu Items */}
      <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
        {menuItems.map((item, index) => (
          <View key={item.id}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={item.icon}
                size={24}
                color="#efefd5"
                style={styles.menuIcon}
              />
              <Text style={[styles.menuLabel, { fontFamily: getFontFamily(arabic, 'medium'), textAlign: arabic ? 'right' : 'left', flex: 1 }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
            {index < menuItems.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
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
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(239, 239, 213, 0.1)',
  },
  appName: {
    fontSize: 28,
    color: '#efefd5',
    marginBottom: 4,
    width: '100%',
  },
  version: {
    fontSize: 14,
    color: 'rgba(239, 239, 213, 0.6)',
    width: '100%',
  },
  menuContainer: {
    flex: 1,
    paddingTop: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  menuIcon: {
    marginRight: 16,
    opacity: 0.9,
  },
  menuLabel: {
    fontSize: 16,
    color: '#efefd5',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(239, 239, 213, 0.05)',
    marginHorizontal: 20,
  },
});
