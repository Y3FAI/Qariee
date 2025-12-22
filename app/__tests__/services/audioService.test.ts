import { audioService, Track, PlaybackMode } from '../../src/services/audioService';
import { downloadService } from '../../src/services/downloadService';
import { getReciterPhotoUrl } from '../../src/constants/config';
import { mockAudioPlayerInstance, useAudioPlayer } from 'expo-audio';
import MediaControl from 'expo-media-control';
import BackgroundTimer from 'react-native-background-timer';

// Mock dependencies
jest.mock('../../src/services/downloadService');
jest.mock('../../src/constants/config');
jest.mock('expo-audio');
jest.mock('expo-media-control');
jest.mock('react-native-background-timer');

// Mock database module used by downloadService
jest.mock('../../src/services/database', () => ({
  insertDownload: jest.fn(),
  deleteDownload: jest.fn(),
  getDownload: jest.fn(),
  getAllDownloads: jest.fn(),
}));

const mockDownloadService = downloadService as jest.Mocked<typeof downloadService>;
const mockGetReciterPhotoUrl = getReciterPhotoUrl as jest.MockedFunction<typeof getReciterPhotoUrl>;
const mockMediaControl = MediaControl as jest.Mocked<typeof MediaControl>;
const mockBackgroundTimer = BackgroundTimer as jest.Mocked<typeof BackgroundTimer>;

describe('AudioService', () => {
  // Use the singleton instance directly
  // Note: audioService is imported as the singleton instance

  // Sample test tracks
  const createTrack = (reciterId: string, surahNumber: number): Track => ({
    reciterId,
    reciterName: `Reciter ${reciterId}`,
    reciterColorPrimary: '#000000',
    reciterColorSecondary: '#ffffff',
    surahNumber,
    surahName: `Surah ${surahNumber}`,
    audioUrl: `https://example.com/audio/${reciterId}/${surahNumber}.mp3`,
    isDownloaded: false,
  });

  const track1 = createTrack('reciter1', 1);
  const track2 = createTrack('reciter1', 2);
  const track3 = createTrack('reciter1', 3);
  const track4 = createTrack('reciter1', 4);
  const track5 = createTrack('reciter1', 5);
  const track6 = createTrack('reciter1', 6);
  const track7 = createTrack('reciter1', 7);

  const sampleQueue = [track2, track3, track4, track5, track6, track7];

  beforeEach(async () => {
    // Reset all mocks but preserve mock implementations
    jest.resetAllMocks();

    // Use fake timers to avoid waiting in play() method
    jest.useFakeTimers();

    // Setup default mock implementations
    mockDownloadService.isDownloaded.mockResolvedValue(false);
    mockDownloadService.getLocalPath.mockResolvedValue(null);
    mockGetReciterPhotoUrl.mockReturnValue('https://example.com/photo.jpg');

    // Mock audio player
    useAudioPlayer.mockReturnValue(mockAudioPlayerInstance);
    mockAudioPlayerInstance.playing = false;
    mockAudioPlayerInstance.currentTime = 0;
    mockAudioPlayerInstance.duration = 300; // 5 minutes
    mockAudioPlayerInstance.volume = 1.0;
    mockAudioPlayerInstance.play.mockImplementation(() => {
      mockAudioPlayerInstance.playing = true;
      return Promise.resolve();
    });
    mockAudioPlayerInstance.pause.mockImplementation(() => {
      mockAudioPlayerInstance.playing = false;
      return Promise.resolve();
    });
    mockAudioPlayerInstance.replace.mockResolvedValue(undefined);
    mockAudioPlayerInstance.seekTo.mockResolvedValue(undefined);
    mockAudioPlayerInstance.addListener.mockReturnValue({
      remove: jest.fn(),
    });

    // Mock media control
    mockMediaControl.enableMediaControls.mockResolvedValue(undefined);
    mockMediaControl.updateMetadata.mockResolvedValue(undefined);
    mockMediaControl.updatePlaybackState.mockResolvedValue(undefined);
    mockMediaControl.disableMediaControls.mockResolvedValue(undefined);
    mockMediaControl.addListener.mockImplementation((callback) => {
      // Store callback for testing
      (mockMediaControl as any).lastCallback = callback;
      return { remove: jest.fn() };
    });

    // Mock background timer
    mockBackgroundTimer.setTimeout.mockReturnValue(123 as any);
    mockBackgroundTimer.clearTimeout.mockImplementation(() => {});

    // Clear the singleton state
    audioService.clear();

    // Initialize with mock player
    const mockPlayer = useAudioPlayer();
    await audioService.initialize(mockPlayer);
  });

  afterEach(() => {
    // Clear any timers
    jest.useRealTimers();
  });

  describe('Basic playback methods', () => {
    test('play() should load and play a track', async () => {
      const playPromise = audioService.play(track1, sampleQueue);

      // Run any pending timers that play() might be waiting for
      jest.runOnlyPendingTimers();

      await playPromise;

      expect(mockDownloadService.getLocalPath).toHaveBeenCalledWith('reciter1', 1);
      expect(mockAudioPlayerInstance.replace).toHaveBeenCalledWith(track1.audioUrl);
      expect(mockAudioPlayerInstance.play).toHaveBeenCalled();
      expect(mockMediaControl.updateMetadata).toHaveBeenCalled();
      expect(mockMediaControl.updatePlaybackState).toHaveBeenCalled();
      expect(audioService.getCurrentTrack()).toBe(track1);
      expect(audioService.getQueue()).toEqual(sampleQueue);
    });

    test('play() should use local path when track is downloaded', async () => {
      const localPath = 'file://local/path/track1.mp3';
      mockDownloadService.getLocalPath.mockResolvedValue(localPath);

      await audioService.play(track1, sampleQueue);

      expect(mockAudioPlayerInstance.replace).toHaveBeenCalledWith(localPath);
    });

    test('play() should throw error when offline and track not downloaded', async () => {
      await audioService.setOfflineStatus(true);
      mockDownloadService.getLocalPath.mockResolvedValue(null);

      await expect(audioService.play(track1, sampleQueue)).rejects.toThrow(
        'Cannot stream while offline. Please download the surah first.'
      );
    });

    test('play() should filter queue for offline mode', async () => {
      await audioService.setOfflineStatus(true);

      // Mock track2 as downloaded, track3 not downloaded
      mockDownloadService.getLocalPath
        .mockResolvedValueOnce(null) // Current track check
        .mockResolvedValueOnce('file://local/path/track2.mp3') // track2 in queue
        .mockResolvedValueOnce(null); // track3 in queue

      await audioService.play(track1, [track2, track3]);

      // Queue should only contain track2 (downloaded)
      expect(audioService.getQueue()).toEqual([track2]);
    });

    test('pause() should pause playback and update media controls', async () => {
      await audioService.play(track1, sampleQueue);
      await audioService.pause();

      expect(mockAudioPlayerInstance.pause).toHaveBeenCalled();
      expect(mockMediaControl.updatePlaybackState).toHaveBeenCalledWith(
        expect.any(Object), // MediaPlaybackState.PAUSED
        expect.any(Number)
      );
    });

    test('resume() should resume playback', async () => {
      await audioService.play(track1, sampleQueue);
      await audioService.pause();

      mockAudioPlayerInstance.playing = false;
      await audioService.resume();

      expect(mockAudioPlayerInstance.play).toHaveBeenCalled();
      expect(mockMediaControl.updatePlaybackState).toHaveBeenCalledWith(
        expect.any(Object), // MediaPlaybackState.PLAYING
        expect.any(Number)
      );
    });

    test('togglePlayPause() should toggle between play and pause', async () => {
      await audioService.play(track1, sampleQueue);

      // First call should pause
      audioService.togglePlayPause();
      expect(mockAudioPlayerInstance.pause).toHaveBeenCalled();

      // Reset mock and simulate paused state
      mockAudioPlayerInstance.pause.mockClear();
      mockAudioPlayerInstance.playing = false;

      // Second call should resume
      audioService.togglePlayPause();
      expect(mockAudioPlayerInstance.play).toHaveBeenCalled();
    });

    test('seekTo() should seek to position', async () => {
      await audioService.play(track1, sampleQueue);
      await audioService.seekTo(120); // 2 minutes

      expect(mockAudioPlayerInstance.seekTo).toHaveBeenCalledWith(120);
    });
  });

  describe('playNext() method', () => {
    test('playNext() in sequential mode should play next track in queue', async () => {
      await audioService.play(track1, [track2, track3]);

      // Mock successful playback of track2
      mockAudioPlayerInstance.play.mockClear();
      mockAudioPlayerInstance.replace.mockClear();

      await audioService.playNext();

      expect(mockAudioPlayerInstance.replace).toHaveBeenCalledWith(track2.audioUrl);
      expect(mockAudioPlayerInstance.play).toHaveBeenCalled();
      expect(audioService.getCurrentTrack()).toBe(track2);
      expect(audioService.getQueue()).toEqual([track3]);
    });

    test('playNext() in repeat mode should replay current track', async () => {
      audioService.setPlaybackMode('repeat');
      await audioService.play(track1, [track2, track3]);

      mockAudioPlayerInstance.seekTo.mockClear();
      mockAudioPlayerInstance.play.mockClear();

      await audioService.playNext();

      expect(mockAudioPlayerInstance.seekTo).toHaveBeenCalledWith(0);
      expect(mockAudioPlayerInstance.play).toHaveBeenCalled();
      expect(audioService.getCurrentTrack()).toBe(track1); // Still same track
      expect(audioService.getQueue()).toEqual([track2, track3]); // Queue unchanged
    });

    test('playNext() in shuffle mode should play shuffled track', async () => {
      // Mock Math.random for deterministic shuffle
      const mockMath = Object.create(global.Math);
      mockMath.random = jest.fn(() => 0.5);
      global.Math = mockMath;

      audioService.setPlaybackMode('shuffle');
      await audioService.play(track1, [track2, track3, track4, track5]);

      mockAudioPlayerInstance.play.mockClear();
      mockAudioPlayerInstance.replace.mockClear();

      await audioService.playNext();

      // Should call play with some track from queue
      expect(mockAudioPlayerInstance.replace).toHaveBeenCalled();
      expect(mockAudioPlayerInstance.play).toHaveBeenCalled();
      expect(audioService.getQueue()).toHaveLength(3); // One track removed
    });

    test('playNext() should skip tracks that fail to play', async () => {
      await audioService.play(track1, [track2, track3]);

      // Make track2 fail to play
      mockAudioPlayerInstance.replace.mockImplementationOnce(() => {
        throw new Error('Playback failed');
      });

      await audioService.playNext();

      // Should skip to track3
      expect(mockAudioPlayerInstance.replace).toHaveBeenCalledWith(track3.audioUrl);
      expect(audioService.getCurrentTrack()).toBe(track3);
    });

    test('playNext() should handle empty queue gracefully', async () => {
      await audioService.play(track1, []);

      mockAudioPlayerInstance.pause.mockClear();
      await audioService.playNext();

      expect(mockAudioPlayerInstance.pause).toHaveBeenCalled();
    });

    test('playNext() should prevent duplicate calls with isProcessingNext flag', async () => {
      await audioService.play(track1, [track2]);

      // Mock a slow play operation
      let resolvePlay: Function;
      const playPromise = new Promise<void>(resolve => {
        resolvePlay = resolve;
      });
      mockAudioPlayerInstance.play.mockImplementationOnce(() => playPromise);

      // Start first playNext (will be "processing")
      const firstCall = audioService.playNext();

      // Try to call playNext again while first is still processing
      await audioService.playNext();

      // Resolve the first call
      resolvePlay!();
      await firstCall;

      // Should only play once despite two calls
      expect(mockAudioPlayerInstance.replace).toHaveBeenCalledTimes(1);
    });

    test('playNext() should handle offline mode by skipping non-downloaded tracks', async () => {
      await audioService.setOfflineStatus(true);
      await audioService.play(track1, [track2, track3]);

      // Mock track2 not downloaded, track3 downloaded
      mockDownloadService.isDownloaded
        .mockResolvedValueOnce(false) // track2
        .mockResolvedValueOnce(true); // track3

      mockDownloadService.getLocalPath
        .mockResolvedValueOnce('file://local/path/track3.mp3'); // For track3 play

      await audioService.playNext();

      // Should skip track2 and play track3
      expect(mockDownloadService.isDownloaded).toHaveBeenCalledWith('reciter1', 2);
      expect(mockAudioPlayerInstance.replace).toHaveBeenCalledWith('file://local/path/track3.mp3');
      expect(audioService.getCurrentTrack()).toBe(track3);
    });

    test('playNext() iterative loop should handle MAX_ATTEMPTS safety breaker', async () => {
      const manyTracks = Array.from({ length: 10 }, (_, i) =>
        createTrack('reciter1', i + 2)
      );

      await audioService.play(track1, manyTracks);

      // Make all tracks fail to play
      mockAudioPlayerInstance.replace.mockImplementation(() => {
        throw new Error('Playback failed');
      });

      await audioService.playNext();

      // Should eventually give up and pause
      expect(mockAudioPlayerInstance.pause).toHaveBeenCalled();
      // All tracks should have been attempted
      expect(mockAudioPlayerInstance.replace).toHaveBeenCalledTimes(manyTracks.length);
    });
  });

  describe('playPrevious() method', () => {
    test('playPrevious() should play previous track from history', async () => {
      await audioService.play(track1, [track2, track3]);
      await audioService.playNext(); // Now playing track2
      await audioService.playNext(); // Now playing track3

      mockAudioPlayerInstance.play.mockClear();
      mockAudioPlayerInstance.replace.mockClear();

      await audioService.playPrevious();

      // Should go back to track2
      expect(mockAudioPlayerInstance.replace).toHaveBeenCalledWith(track2.audioUrl);
      expect(audioService.getCurrentTrack()).toBe(track2);

      // Current track (track3) should be back in queue
      expect(audioService.getQueue()).toContainEqual(track3);
    });

    test('playPrevious() with no previous track should seek to beginning', async () => {
      await audioService.play(track1, [track2]);

      mockAudioPlayerInstance.seekTo.mockClear();
      await audioService.playPrevious();

      expect(mockAudioPlayerInstance.seekTo).toHaveBeenCalledWith(0);
      expect(mockAudioPlayerInstance.play).toHaveBeenCalled();
    });

    test('playPrevious() should prevent duplicate calls with isProcessingPrevious flag', async () => {
      await audioService.play(track1, [track2]);
      await audioService.playNext(); // Now playing track2

      // Mock a slow play operation
      let resolvePlay: Function;
      const playPromise = new Promise<void>(resolve => {
        resolvePlay = resolve;
      });
      mockAudioPlayerInstance.play.mockImplementationOnce(() => playPromise);

      // Start first playPrevious (will be "processing")
      const firstCall = audioService.playPrevious();

      // Try to call playPrevious again while first is still processing
      await audioService.playPrevious();

      // Resolve the first call
      resolvePlay!();
      await firstCall;

      // Should only play once despite two calls
      expect(mockAudioPlayerInstance.replace).toHaveBeenCalledTimes(1);
    });
  });

  describe('setPlaybackMode() and queue rebuilding', () => {
    test('setPlaybackMode() should rebuild queue for shuffle mode', () => {
      audioService.setPlaybackMode('sequential');
      // @ts-ignore - accessing private property for testing
      audioService.originalQueue = [track1, track2, track3, track4, track5];
      // @ts-ignore
      audioService.playedTrackIds.add('reciter1:1'); // Mark track1 as played

      // Mock Math.random for deterministic shuffle
      const mockMath = Object.create(global.Math);
      mockMath.random = jest.fn(() => 0.5);
      global.Math = mockMath;

      audioService.setPlaybackMode('shuffle');

      const queue = audioService.getQueue();
      // Should have 4 tracks (excluding played track1)
      expect(queue).toHaveLength(4);
      // Should not contain track1 (already played)
      expect(queue).not.toContainEqual(track1);
      // Should be shuffled order
      expect(queue).not.toEqual([track2, track3, track4, track5]);
    });

    test('setPlaybackMode() should rebuild queue for sequential mode', () => {
      audioService.setPlaybackMode('shuffle');
      // @ts-ignore
      audioService.originalQueue = [track1, track2, track3, track4, track5];
      // @ts-ignore
      audioService.playedTrackIds.add('reciter1:1'); // Mark track1 as played

      // Set up a shuffled queue
      // @ts-ignore
      audioService.queue = [track4, track2, track5, track3];

      audioService.setPlaybackMode('sequential');

      const queue = audioService.getQueue();
      // Should have original order excluding played tracks
      expect(queue).toEqual([track2, track3, track4, track5]);
    });

    test('setPlaybackMode() should handle empty originalQueue', () => {
      // @ts-ignore
      audioService.originalQueue = [];

      // Should not throw error
      expect(() => {
        audioService.setPlaybackMode('shuffle');
      }).not.toThrow();

      expect(audioService.getQueue()).toEqual([]);
    });
  });

  describe('shuffleWithHistory() algorithm', () => {
    test('shuffleWithHistory() should avoid recently played tracks', () => {
      // @ts-ignore - accessing private method for testing
      const shuffleWithHistory = audioService.shuffleWithHistory.bind(audioService);

      // Set up shuffle history with track1 and track2
      // @ts-ignore
      audioService.shuffleHistory = [track1, track2];

      const tracks = [track1, track2, track3, track4, track5];
      const shuffled = shuffleWithHistory(tracks);

      // Should not contain track1 or track2 in first positions
      // (they're in history, so should be avoided if possible)
      expect(shuffled).toContainEqual(track3);
      expect(shuffled).toContainEqual(track4);
      expect(shuffled).toContainEqual(track5);

      // If all tracks are in history, should clear history and reshuffle all
      // @ts-ignore
      audioService.shuffleHistory = [track1, track2, track3, track4, track5];
      const allTracksShuffled = shuffleWithHistory([track1, track2, track3, track4, track5]);

      expect(allTracksShuffled).toHaveLength(5);
      // History should be cleared
      // @ts-ignore
      expect(audioService.shuffleHistory).toEqual([]);
    });

    test('addToShuffleHistory() should keep only last 5 tracks', () => {
      // @ts-ignore - accessing private method for testing
      const addToShuffleHistory = audioService.addToShuffleHistory.bind(audioService);

      // Add 6 tracks
      for (let i = 1; i <= 6; i++) {
        addToShuffleHistory(createTrack('reciter1', i));
      }

      // @ts-ignore
      const history = audioService.shuffleHistory;
      expect(history).toHaveLength(5);
      // Should keep the most recent 5 tracks (2-6, excluding track1)
      expect(history[0].surahNumber).toBe(6); // Most recent
      expect(history[4].surahNumber).toBe(2); // Oldest in history
    });
  });

  describe('rebuildQueue() offline filtering', () => {
    test('rebuildQueue() should filter non-downloaded tracks in offline mode', async () => {
      await audioService.setOfflineStatus(true);

      // @ts-ignore
      audioService.originalQueue = [track1, track2, track3];
      // @ts-ignore
      audioService.playedTrackIds.add('reciter1:1'); // Mark track1 as played

      // Mock track2 as downloaded, track3 not downloaded
      mockDownloadService.getLocalPath
        .mockResolvedValueOnce('file://local/path/track2.mp3')
        .mockResolvedValueOnce(null);

      // @ts-ignore - accessing private method for testing
      await audioService.rebuildQueue();

      const queue = audioService.getQueue();
      // Should only contain track2 (downloaded and not played)
      expect(queue).toEqual([track2]);
    });

    test('rebuildQueue() should apply shuffle in shuffle mode', async () => {
      audioService.setPlaybackMode('shuffle');
      // @ts-ignore
      audioService.originalQueue = [track1, track2, track3, track4, track5];

      // Mock Math.random for deterministic shuffle
      const mockMath = Object.create(global.Math);
      mockMath.random = jest.fn(() => 0.5);
      global.Math = mockMath;

      // @ts-ignore
      await audioService.rebuildQueue();

      const queue = audioService.getQueue();
      expect(queue).toHaveLength(5);
      // Should be shuffled, not original order
      expect(queue).not.toEqual([track1, track2, track3, track4, track5]);
    });
  });

  describe('Error handling and edge cases', () => {
    test('play() should throw error when player not initialized', async () => {
      // Clear the service to simulate uninitialized state
      audioService.clear();

      await expect(audioService.play(track1, []))
        .rejects.toThrow('Audio player not initialized');
    });

    test('pause() should handle missing player gracefully', async () => {
      // Clear the service to simulate uninitialized state
      audioService.clear();

      // Should not throw error
      await expect(audioService.pause()).resolves.not.toThrow();
    });

    test('resume() should handle player released error', async () => {
      await audioService.play(track1, [track2]);
      await audioService.pause();

      // Mock player.released error
      mockAudioPlayerInstance.play.mockImplementationOnce(() => {
        throw new Error('Player has been released');
      });

      // Should attempt to replay current track
      mockAudioPlayerInstance.replace.mockClear();
      await audioService.resume();

      expect(mockAudioPlayerInstance.replace).toHaveBeenCalledWith(track1.audioUrl);
    });

    test('setOfflineStatus() should stop playback if current track not downloaded', async () => {
      await audioService.play(track1, [track2, track3]);

      // Mock that current track is not downloaded when checking in setOfflineStatus
      mockDownloadService.getLocalPath.mockResolvedValueOnce('file://path/track1.mp3') // For initial play
                                   .mockResolvedValueOnce(null); // For setOfflineStatus check

      await audioService.setOfflineStatus(true);

      expect(mockAudioPlayerInstance.pause).toHaveBeenCalled();
      expect(audioService.getCurrentTrack()).toBeNull();
    });

    test('handlePlaybackStatusUpdate() should reset stuck isProcessingNext flag', async () => {
      // Need to set up current track for the method to not return early
      // Mock getLocalPath for playback
      mockDownloadService.getLocalPath.mockResolvedValue('file://path/track1.mp3');
      await audioService.play(track1, []);

      // @ts-ignore - accessing private property for testing
      audioService.isProcessingNext = true;
      // @ts-ignore
      audioService.isProcessingNextSince = Date.now() - 31000; // 31 seconds ago

      const mockStatus = {
        playing: true,
        currentTime: 100,
        duration: 300,
        didJustFinish: false,
      };

      // @ts-ignore - accessing private method for testing
      audioService.handlePlaybackStatusUpdate(mockStatus);

      // @ts-ignore
      expect(audioService.isProcessingNext).toBe(false);
      // @ts-ignore
      expect(audioService.isProcessingNextSince).toBe(0);
    });
  });

  describe('Media control integration', () => {
    test('Media control NEXT_TRACK command should trigger playNext()', async () => {
      // Mock getLocalPath to return a valid path for playback
      mockDownloadService.getLocalPath.mockResolvedValue('file://path/track1.mp3');

      await audioService.play(track1, [track2]);

      // Get the media control callback
      const mediaControlCallback = (mockMediaControl as any).lastCallback;
      expect(mediaControlCallback).toBeDefined();

      // Mock playNext to verify it's called
      const playNextSpy = jest.spyOn(audioService, 'playNext').mockResolvedValue();

      // Simulate NEXT_TRACK command
      mediaControlCallback({ command: 'nextTrack' });

      expect(playNextSpy).toHaveBeenCalled();
    });

    test('Media control PREVIOUS_TRACK command should replay current track', async () => {
      // Mock getLocalPath to return a valid path for playback
      mockDownloadService.getLocalPath.mockResolvedValue('file://path/track1.mp3');

      await audioService.play(track1, [track2]);

      const mediaControlCallback = (mockMediaControl as any).lastCallback;
      const playSpy = jest.spyOn(audioService, 'play').mockResolvedValue();

      mediaControlCallback({ command: 'previousTrack' });

      expect(playSpy).toHaveBeenCalledWith(track1, expect.any(Array), false);
    });
  });

  describe('Utility methods', () => {
    test('getTrackId() should generate correct ID', () => {
      // @ts-ignore - accessing private method for testing
      const trackId = audioService.getTrackId(track1);
      expect(trackId).toBe('reciter1:1');
    });

    test('hasNext() should return true when queue not empty', () => {
      audioService.setPlaybackMode('sequential');
      // @ts-ignore
      audioService.queue = [track2];

      expect(audioService.hasNext()).toBe(true);
    });

    test('hasNext() should return true in repeat mode even with empty queue', () => {
      audioService.setPlaybackMode('repeat');
      // @ts-ignore
      audioService.queue = [];

      expect(audioService.hasNext()).toBe(true);
    });

    test('isLastTrack() should return true when queue empty and not repeat mode', () => {
      audioService.setPlaybackMode('sequential');
      // @ts-ignore
      audioService.queue = [];

      expect(audioService.isLastTrack()).toBe(true);
    });

    test('clear() should reset all state', async () => {
      // Mock getLocalPath for playback
      mockDownloadService.getLocalPath.mockResolvedValue('file://path/track1.mp3');

      await audioService.play(track1, [track2, track3]);
      await audioService.playNext(); // Play track2

      audioService.clear();

      expect(audioService.getCurrentTrack()).toBeNull();
      expect(audioService.getQueue()).toEqual([]);
      // @ts-ignore
      expect(audioService.playedTrackIds.size).toBe(0);
      // @ts-ignore
      expect(audioService.shuffleHistory).toEqual([]);
      // @ts-ignore
      expect(audioService.playedTracksOrder).toEqual([]);
      expect(mockAudioPlayerInstance.pause).toHaveBeenCalled();
    });
  });
});