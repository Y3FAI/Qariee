/**
 * Audio Storage Tests
 */

// Mock modules before imports
jest.mock('@react-native-async-storage/async-storage');

import AsyncStorage from '@react-native-async-storage/async-storage';
import { audioStorage, ListeningSession } from '../audioStorage';

// Mock the audioService module to avoid importing its dependencies
jest.mock('../audioService', () => ({
  PlaybackMode: {
    SEQUENTIAL: 'sequential',
    SHUFFLE: 'shuffle',
    REPEAT: 'repeat',
  },
}));

describe('AudioStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Playback Mode
  // ==========================================================================
  describe('savePlaybackMode', () => {
    it('saves playback mode to AsyncStorage', async () => {
      await audioStorage.savePlaybackMode('sequential');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@qariee:playback_mode',
        'sequential'
      );
    });

    it('saves shuffle mode', async () => {
      await audioStorage.savePlaybackMode('shuffle');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@qariee:playback_mode',
        'shuffle'
      );
    });

    it('saves repeat mode', async () => {
      await audioStorage.savePlaybackMode('repeat');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@qariee:playback_mode',
        'repeat'
      );
    });

    it('handles storage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage full')
      );

      await audioStorage.savePlaybackMode('sequential');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error saving playback mode:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('loadPlaybackMode', () => {
    it('loads playback mode from AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('shuffle');

      const mode = await audioStorage.loadPlaybackMode();

      expect(mode).toBe('shuffle');
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@qariee:playback_mode');
    });

    it('returns null when no mode is saved', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const mode = await audioStorage.loadPlaybackMode();

      expect(mode).toBeNull();
    });

    it('handles storage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage error')
      );

      const mode = await audioStorage.loadPlaybackMode();

      expect(mode).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading playback mode:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Listening Session
  // ==========================================================================
  describe('saveListeningSession', () => {
    const mockSession: ListeningSession = {
      reciterId: 'mishary',
      reciterName: 'Mishary Rashid Alafasy',
      reciterColorPrimary: '#1a1a2e',
      reciterColorSecondary: '#16213e',
      surahNumber: 1,
      surahName: 'Al-Fatihah',
      position: 45.5,
      duration: 120,
      timestamp: Date.now(),
    };

    it('saves session to AsyncStorage with timestamp', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValueOnce(now);

      await audioStorage.saveListeningSession(mockSession);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@qariee:listening_session',
        expect.any(String)
      );

      // Verify JSON structure
      const savedJson = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const savedData = JSON.parse(savedJson);
      expect(savedData.reciterId).toBe('mishary');
      expect(savedData.surahNumber).toBe(1);
      expect(savedData.position).toBe(45.5);
      expect(savedData.timestamp).toBe(now);
    });

    it('saves session with playedTrackIds and shuffleHistory', async () => {
      const sessionWithHistory: ListeningSession = {
        ...mockSession,
        playedTrackIds: ['mishary-1', 'mishary-2'],
        shuffleHistory: [
          { reciterId: 'mishary', surahNumber: 1 },
          { reciterId: 'mishary', surahNumber: 2 },
        ],
        playedTracksOrder: [
          { reciterId: 'mishary', surahNumber: 1 },
        ],
      };

      await audioStorage.saveListeningSession(sessionWithHistory);

      const savedJson = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
      const savedData = JSON.parse(savedJson);
      expect(savedData.playedTrackIds).toEqual(['mishary-1', 'mishary-2']);
      expect(savedData.shuffleHistory).toHaveLength(2);
      expect(savedData.playedTracksOrder).toHaveLength(1);
    });

    it('handles storage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage full')
      );

      await audioStorage.saveListeningSession(mockSession);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error saving listening session:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('loadListeningSession', () => {
    it('loads valid session from AsyncStorage', async () => {
      const recentSession = {
        reciterId: 'mishary',
        reciterName: 'Mishary Rashid Alafasy',
        surahNumber: 1,
        surahName: 'Al-Fatihah',
        position: 45.5,
        duration: 120,
        timestamp: Date.now() - 1000, // 1 second ago
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(recentSession)
      );

      const session = await audioStorage.loadListeningSession();

      expect(session).not.toBeNull();
      expect(session?.reciterId).toBe('mishary');
      expect(session?.position).toBe(45.5);
    });

    it('returns null when no session is saved', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const session = await audioStorage.loadListeningSession();

      expect(session).toBeNull();
    });

    it('clears and returns null for sessions older than 7 days', async () => {
      const EIGHT_DAYS_AGO = Date.now() - 8 * 24 * 60 * 60 * 1000;
      const oldSession = {
        reciterId: 'mishary',
        reciterName: 'Mishary Rashid Alafasy',
        surahNumber: 1,
        surahName: 'Al-Fatihah',
        position: 45.5,
        duration: 120,
        timestamp: EIGHT_DAYS_AGO,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(oldSession)
      );

      const session = await audioStorage.loadListeningSession();

      expect(session).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        '@qariee:listening_session'
      );
    });

    it('keeps sessions exactly 7 days old', async () => {
      const EXACTLY_SEVEN_DAYS = Date.now() - 7 * 24 * 60 * 60 * 1000 + 1000; // Just under 7 days
      const session = {
        reciterId: 'mishary',
        reciterName: 'Mishary Rashid Alafasy',
        surahNumber: 1,
        surahName: 'Al-Fatihah',
        position: 45.5,
        duration: 120,
        timestamp: EXACTLY_SEVEN_DAYS,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(session)
      );

      const loadedSession = await audioStorage.loadListeningSession();

      expect(loadedSession).not.toBeNull();
      expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('handles corrupted JSON gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        'not valid json {'
      );

      const session = await audioStorage.loadListeningSession();

      expect(session).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading listening session:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it('handles storage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage error')
      );

      const session = await audioStorage.loadListeningSession();

      expect(session).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading listening session:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('clearListeningSession', () => {
    it('removes session from AsyncStorage', async () => {
      await audioStorage.clearListeningSession();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        '@qariee:listening_session'
      );
    });

    it('handles storage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(
        new Error('Storage error')
      );

      await audioStorage.clearListeningSession();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error clearing listening session:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });
});
