import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initDatabase,
  insertReciter,
  insertSurah,
  getAllReciters,
  deleteAllReciters,
  setMetadata,
  getMetadata,
} from './database';
import { getAppDatabaseUrl, setCdnBaseUrl, getCdnBaseUrl } from '../constants/config';
import { AppDatabase, ReciterMetadata } from '../types';
import surahsData from '../../assets/data/surahs.json';
import recitersData from '../../assets/data/reciters.json';

const FIRST_LAUNCH_KEY = 'first_launch_complete';
const APP_VERSION = '1.0.0'; // Should match package.json version

/**
 * Initialize app on first launch or subsequent launches
 * - First launch: Loads data with loading screen
 * - Subsequent launches: Returns immediately, updates in background
 */
export const initializeApp = async (): Promise<{
  isFirstLaunch: boolean;
  needsUpdate: boolean;
}> => {
  // Always initialize database
  await initDatabase();

  // Load cached CDN URL if available
  const cachedCdnUrl = await getMetadata('cdn_base_url');
  if (cachedCdnUrl) {
    setCdnBaseUrl(cachedCdnUrl);
    console.log(`Using cached CDN URL: ${cachedCdnUrl}`);
  }

  const isFirstLaunch = (await AsyncStorage.getItem(FIRST_LAUNCH_KEY)) === null;

  if (isFirstLaunch) {
    // First launch: Load all data synchronously
    await loadInitialData();
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, 'true');
    return { isFirstLaunch: true, needsUpdate: false };
  } else {
    // Subsequent launch: Check for updates
    const needsUpdate = await checkForUpdates();

    // Update in background
    updateDataInBackground();

    return {
      isFirstLaunch: false,
      needsUpdate
    };
  }
};

/**
 * Check if app needs update by comparing versions
 */
const checkForUpdates = async (): Promise<boolean> => {
  try {
    // Add cache-busting parameter to force fresh fetch
    const url = `${getAppDatabaseUrl()}?t=${Date.now()}`;
    const response = await fetch(url, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

    if (!response.ok) {
      return false;
    }

    const data: AppDatabase = await response.json();

    // Compare current app version with server version
    const serverVersion = data.settings.app_version;
    const minVersion = data.settings.min_app_version;

    // Simple version comparison (assumes semver format: major.minor.patch)
    const needsUpdate = compareVersions(APP_VERSION, serverVersion) < 0;
    const isMandatory = compareVersions(APP_VERSION, minVersion) < 0;

    return needsUpdate;
  } catch (error) {
    // Network unavailable - skip update check
    return false;
  }
};

/**
 * Compare two semver version strings
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;

    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
  }

  return 0;
};

/**
 * Load initial data on first launch
 */
const loadInitialData = async (): Promise<void> => {
  try {
    // Load reciters from R2
    await fetchAndSaveReciters();

    // Load bundled surahs data
    await loadSurahsData();
  } catch (error) {
    console.error('Error loading initial data:', error);
    throw error;
  }
};

/**
 * Fetch app database from R2 and save settings and reciters
 * Falls back to bundled data if network fails
 */
const fetchAndSaveReciters = async (): Promise<void> => {
  try {
    // Try to fetch from R2
    const url = `${getAppDatabaseUrl()}?t=${Date.now()}`;
    const response = await fetch(url, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch app database: ${response.status}`);
    }

    const data: AppDatabase = await response.json();

    // Save app settings
    await setMetadata('cdn_base_url', data.settings.cdn_base_url);
    await setMetadata('app_name', data.settings.app_name);
    await setMetadata('support_email', data.settings.support_email);
    await setMetadata('app_version', data.settings.app_version);
    await setMetadata('min_app_version', data.settings.min_app_version);
    await setMetadata('db_version', data.version);

    // Update CDN URL in config
    setCdnBaseUrl(data.settings.cdn_base_url);

    // Clear existing reciters
    await deleteAllReciters();

    // Insert new reciters
    for (const reciter of data.reciters) {
      await insertReciter(reciter);
    }
  } catch (error) {
    // Use bundled data as fallback
    await loadBundledReciters();
  }
};

/**
 * Load bundled reciters data as fallback
 */
const loadBundledReciters = async (): Promise<void> => {
  try {
    // Clear existing reciters
    await deleteAllReciters();

    // Insert bundled reciters
    const typedRecitersData = recitersData as ReciterMetadata;
    for (const reciter of typedRecitersData.reciters) {
      await insertReciter(reciter);
    }

    // Set default settings
    const currentCdnUrl = getCdnBaseUrl();
    await setMetadata('cdn_base_url', currentCdnUrl);
    await setMetadata('app_name', 'Qariee');
    await setMetadata('support_email', 'support@qariee.app');
    await setMetadata('app_version', APP_VERSION);
    await setMetadata('min_app_version', APP_VERSION);
    await setMetadata('db_version', '1.0.0');
  } catch (error) {
    console.error('Error loading bundled reciters:', error);
    throw error;
  }
};

/**
 * Load bundled surahs data into database
 */
const loadSurahsData = async (): Promise<void> => {
  try {
    // Check if surahs already loaded
    const surahsLoaded = await getMetadata('surahs_loaded');

    if (surahsLoaded === 'true') {
      return;
    }

    // Insert all surahs
    for (const surah of surahsData.surahs) {
      await insertSurah(surah);
    }

    await setMetadata('surahs_loaded', 'true');
  } catch (error) {
    console.error('Error loading surahs:', error);
    throw error;
  }
};

/**
 * Update data in background (fire and forget)
 */
const updateDataInBackground = (): void => {
  (async () => {
    try {
      // Fetch latest app database with cache-busting
      const url = `${getAppDatabaseUrl()}?t=${Date.now()}`;
      const response = await fetch(url, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });

      if (!response.ok) {
        return;
      }

      const data: AppDatabase = await response.json();

      // Update app settings
      await setMetadata('cdn_base_url', data.settings.cdn_base_url);
      await setMetadata('app_name', data.settings.app_name);
      await setMetadata('support_email', data.settings.support_email);
      await setMetadata('app_version', data.settings.app_version);
      await setMetadata('min_app_version', data.settings.min_app_version);
      await setMetadata('db_version', data.version);

      // Update CDN URL in config
      setCdnBaseUrl(data.settings.cdn_base_url);

      // Always update database
      await deleteAllReciters();
      for (const reciter of data.reciters) {
        await insertReciter(reciter);
      }
    } catch (error) {
      // Fail silently - network unavailable, will retry on next launch
    }
  })();
};

/**
 * Trigger background update (for when network becomes available)
 */
export const triggerBackgroundUpdate = (): void => {
  updateDataInBackground();
};

/**
 * Force refresh data (manual refresh)
 */
export const refreshData = async (): Promise<void> => {
  await fetchAndSaveReciters();
};
