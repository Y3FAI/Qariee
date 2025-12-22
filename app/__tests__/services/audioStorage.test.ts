import AsyncStorage from '@react-native-async-storage/async-storage';
import { audioStorage, ListeningSession } from '../../src/services/audioStorage';
import { PlaybackMode } from '../../src/services/audioService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

describe('AudioStorage', () => {
  // Clear mock storage before each test
  beforeEach(() => {
    (AsyncStorage as any).__clearMockStorage();
    jest.clearAllMocks();
  });

  describe('savePlaybackMode', () => {
    it('should save playback mode to AsyncStorage', async () => {
      const mode: PlaybackMode = 'shuffle';

      await audioStorage.savePlaybackMode(mode);

      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@qariee:playback_mode',
        mode
      );
    });

    it('should handle different playback modes', async () => {
      const modes: PlaybackMode[] = ['sequential', 'shuffle', 'repeat'];

      for (const mode of modes) {
        await audioStorage.savePlaybackMode(mode);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith(
          '@qariee:playback_mode',
          mode
        );
      }
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      await audioStorage.savePlaybackMode('sequential');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error saving playback mode:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('loadPlaybackMode', () => {
    it('should load playback mode from AsyncStorage', async () => {
      const mode: PlaybackMode = 'repeat';
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(mode);

      const result = await audioStorage.loadPlaybackMode();

      expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@qariee:playback_mode');
      expect(result).toBe(mode);
    });

    it('should return null when no playback mode is saved', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const result = await audioStorage.loadPlaybackMode();

      expect(result).toBeNull();
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      const result = await audioStorage.loadPlaybackMode();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading playback mode:',
        expect.any(Error)
      );
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe('saveListeningSession', () => {
    const baseSession: ListeningSession = {
      reciterId: 'reciter-123',
      reciterName: 'Mishary Rashid Alafasy',
      reciterColorPrimary: '#1E40AF',
      reciterColorSecondary: '#3B82F6',
      surahNumber: 1,
      surahName: 'Al-Fatihah',
      position: 120,
      duration: 300,
      timestamp: 1700000000000,
    };

    it('should save listening session with all required fields', async () => {
      await audioStorage.saveListeningSession(baseSession);

      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
      const callArgs = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe('@qariee:listening_session');

      const savedData = JSON.parse(callArgs[1]);
      expect(savedData.reciterId).toBe(baseSession.reciterId);
      expect(savedData.reciterName).toBe(baseSession.reciterName);
      expect(savedData.surahNumber).toBe(baseSession.surahNumber);
      expect(savedData.surahName).toBe(baseSession.surahName);
      expect(savedData.position).toBe(baseSession.position);
      expect(savedData.duration).toBe(baseSession.duration);
      expect(savedData.timestamp).toBeGreaterThan(baseSession.timestamp); // Should be updated
    });

    it('should save listening session with optional arrays', async () => {
      const sessionWithArrays: ListeningSession = {
        ...baseSession,
        playedTrackIds: ['track-1', 'track-2', 'track-3'],
        shuffleHistory: [
          { reciterId: 'reciter-1', surahNumber: 1 },
          { reciterId: 'reciter-2', surahNumber: 2 },
        ],
        playedTracksOrder: [
          { reciterId: 'reciter-1', surahNumber: 1 },
          { reciterId: 'reciter-1', surahNumber: 2 },
        ],
      };

      await audioStorage.saveListeningSession(sessionWithArrays);

      const callArgs = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedData = JSON.parse(callArgs[1]);

      expect(savedData.playedTrackIds).toEqual(sessionWithArrays.playedTrackIds);
      expect(savedData.shuffleHistory).toEqual(sessionWithArrays.shuffleHistory);
      expect(savedData.playedTracksOrder).toEqual(sessionWithArrays.playedTracksOrder);
    });

    it('should save listening session without optional arrays', async () => {
      const sessionWithoutArrays: ListeningSession = {
        reciterId: 'reciter-456',
        reciterName: 'Saad Al-Ghamdi',
        surahNumber: 2,
        surahName: 'Al-Baqarah',
        position: 180,
        duration: 600,
        timestamp: 1700000000000,
      };

      await audioStorage.saveListeningSession(sessionWithoutArrays);

      const callArgs = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedData = JSON.parse(callArgs[1]);

      expect(savedData.playedTrackIds).toBeUndefined();
      expect(savedData.shuffleHistory).toBeUndefined();
      expect(savedData.playedTracksOrder).toBeUndefined();
      expect(savedData.reciterColorPrimary).toBeUndefined();
      expect(savedData.reciterColorSecondary).toBeUndefined();
    });

    it('should update timestamp on save', async () => {
      const beforeSave = Date.now();
      await audioStorage.saveListeningSession(baseSession);
      const afterSave = Date.now();

      const callArgs = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const savedData = JSON.parse(callArgs[1]);

      expect(savedData.timestamp).toBeGreaterThanOrEqual(beforeSave);
      expect(savedData.timestamp).toBeLessThanOrEqual(afterSave);
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      await audioStorage.saveListeningSession(baseSession);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error saving listening session:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('loadListeningSession', () => {
    const validSession: ListeningSession = {
      reciterId: 'reciter-123',
      reciterName: 'Mishary Rashid Alafasy',
      reciterColorPrimary: '#1E40AF',
      reciterColorSecondary: '#3B82F6',
      surahNumber: 1,
      surahName: 'Al-Fatihah',
      position: 120,
      duration: 300,
      timestamp: Date.now() - 1000, // 1 second ago
      playedTrackIds: ['track-1', 'track-2'],
      shuffleHistory: [
        { reciterId: 'reciter-1', surahNumber: 1 },
        { reciterId: 'reciter-2', surahNumber: 2 },
      ],
      playedTracksOrder: [
        { reciterId: 'reciter-1', surahNumber: 1 },
        { reciterId: 'reciter-1', surahNumber: 2 },
      ],
    };

    it('should load valid listening session', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(validSession));

      const result = await audioStorage.loadListeningSession();

      expect(AsyncStorage.getItem).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('@qariee:listening_session');
      expect(result).toEqual(validSession);
    });

    it('should return null when no session is saved', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const result = await audioStorage.loadListeningSession();

      expect(result).toBeNull();
    });

    it('should return null for expired sessions (older than 7 days)', async () => {
      const expiredSession = {
        ...validSession,
        timestamp: Date.now() - (8 * 24 * 60 * 60 * 1000), // 8 days ago
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(expiredSession));

      const result = await audioStorage.loadListeningSession();

      expect(result).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@qariee:listening_session');
    });

    it('should handle corrupted JSON gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('{ invalid json }');

      const result = await audioStorage.loadListeningSession();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading listening session:',
        expect.any(Error)
      );
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      const result = await audioStorage.loadListeningSession();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading listening session:',
        expect.any(Error)
      );
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });

    it('should handle sessions without optional arrays', async () => {
      const sessionWithoutArrays = {
        reciterId: 'reciter-456',
        reciterName: 'Saad Al-Ghamdi',
        surahNumber: 2,
        surahName: 'Al-Baqarah',
        position: 180,
        duration: 600,
        timestamp: Date.now() - 1000,
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(sessionWithoutArrays));

      const result = await audioStorage.loadListeningSession();

      expect(result).toEqual(sessionWithoutArrays);
      expect((result as any).playedTrackIds).toBeUndefined();
      expect((result as any).shuffleHistory).toBeUndefined();
      expect((result as any).playedTracksOrder).toBeUndefined();
    });

    it('should preserve data types', async () => {
      const session = {
        ...validSession,
        surahNumber: 36, // Should remain number
        position: 150.5, // Should remain number
        duration: 300, // Should remain number
        timestamp: 1700000000000, // Should remain number
      };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(session));

      const result = await audioStorage.loadListeningSession();

      expect(typeof result?.surahNumber).toBe('number');
      expect(typeof result?.position).toBe('number');
      expect(typeof result?.duration).toBe('number');
      expect(typeof result?.timestamp).toBe('number');
      expect(Array.isArray(result?.playedTrackIds)).toBe(true);
      expect(Array.isArray(result?.shuffleHistory)).toBe(true);
      expect(Array.isArray(result?.playedTracksOrder)).toBe(true);
    });
  });

  describe('clearListeningSession', () => {
    it('should remove listening session from AsyncStorage', async () => {
      await audioStorage.clearListeningSession();

      expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@qariee:listening_session');
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));

      await audioStorage.clearListeningSession();

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error clearing listening session:',
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe('integration tests', () => {
    it('should save and load playback mode correctly', async () => {
      const mode: PlaybackMode = 'shuffle';

      await audioStorage.savePlaybackMode(mode);
      const loaded = await audioStorage.loadPlaybackMode();

      expect(loaded).toBe(mode);
    });

    it('should save and load listening session correctly', async () => {
      const session: ListeningSession = {
        reciterId: 'reciter-789',
        reciterName: 'Abdul Basit Abdul Samad',
        surahNumber: 36,
        surahName: 'Ya-Sin',
        position: 90,
        duration: 450,
        timestamp: 1700000000000,
        playedTrackIds: ['track-a', 'track-b'],
        shuffleHistory: [
          { reciterId: 'reciter-1', surahNumber: 1 },
        ],
      };

      await audioStorage.saveListeningSession(session);
      const loaded = await audioStorage.loadListeningSession();

      expect(loaded).not.toBeNull();
      expect(loaded?.reciterId).toBe(session.reciterId);
      expect(loaded?.reciterName).toBe(session.reciterName);
      expect(loaded?.surahNumber).toBe(session.surahNumber);
      expect(loaded?.surahName).toBe(session.surahName);
      expect(loaded?.position).toBe(session.position);
      expect(loaded?.duration).toBe(session.duration);
      expect(loaded?.playedTrackIds).toEqual(session.playedTrackIds);
      expect(loaded?.shuffleHistory).toEqual(session.shuffleHistory);
      expect(loaded?.timestamp).toBeGreaterThan(session.timestamp); // Updated on save
    });

    it('should clear listening session and return null on load', async () => {
      const session: ListeningSession = {
        reciterId: 'reciter-999',
        reciterName: 'Test Reciter',
        surahNumber: 1,
        surahName: 'Test Surah',
        position: 0,
        duration: 100,
        timestamp: Date.now(),
      };

      await audioStorage.saveListeningSession(session);
      await audioStorage.clearListeningSession();
      const loaded = await audioStorage.loadListeningSession();

      expect(loaded).toBeNull();
    });
  });
});