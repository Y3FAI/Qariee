import AsyncStorage from '@react-native-async-storage/async-storage';
import { PlaybackMode } from './audioService';

const STORAGE_KEYS = {
  PLAYBACK_MODE: '@qariee:playback_mode',
  LISTENING_SESSION: '@qariee:listening_session',
};

export interface ListeningSession {
  reciterId: string;
  reciterName: string;
  reciterColorPrimary?: string;
  reciterColorSecondary?: string;
  surahNumber: number;
  surahName: string;
  position: number; // Current position in seconds
  duration: number;
  timestamp: number; // When this was saved
}

/**
 * Audio Storage Service
 * Handles persistence of playback mode and listening session state
 */
class AudioStorage {
  /**
   * Save playback mode preference
   */
  async savePlaybackMode(mode: PlaybackMode): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PLAYBACK_MODE, mode);
    } catch (error) {
      console.error('Error saving playback mode:', error);
    }
  }

  /**
   * Load playback mode preference
   */
  async loadPlaybackMode(): Promise<PlaybackMode | null> {
    try {
      const mode = await AsyncStorage.getItem(STORAGE_KEYS.PLAYBACK_MODE);
      return mode as PlaybackMode | null;
    } catch (error) {
      console.error('Error loading playback mode:', error);
      return null;
    }
  }

  /**
   * Save current listening session
   */
  async saveListeningSession(session: ListeningSession): Promise<void> {
    try {
      const sessionData = {
        ...session,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.LISTENING_SESSION,
        JSON.stringify(sessionData)
      );
    } catch (error) {
      console.error('Error saving listening session:', error);
    }
  }

  /**
   * Load listening session
   */
  async loadListeningSession(): Promise<ListeningSession | null> {
    try {
      const sessionJson = await AsyncStorage.getItem(STORAGE_KEYS.LISTENING_SESSION);
      if (!sessionJson) return null;

      const session = JSON.parse(sessionJson) as ListeningSession;

      // Only restore sessions that are less than 7 days old
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - session.timestamp > SEVEN_DAYS) {
        await this.clearListeningSession();
        return null;
      }

      return session;
    } catch (error) {
      console.error('Error loading listening session:', error);
      return null;
    }
  }

  /**
   * Clear listening session
   */
  async clearListeningSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.LISTENING_SESSION);
    } catch (error) {
      console.error('Error clearing listening session:', error);
    }
  }
}

// Singleton instance
export const audioStorage = new AudioStorage();
