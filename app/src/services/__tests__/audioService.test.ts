/**
 * Audio Service Tests
 *
 * Tests for the audioService singleton.
 * Due to the complexity of playback verification, these tests focus on API surface and state management.
 */

jest.mock('../downloadService');
jest.mock('../../constants/config');

import { audioService, Track, PlaybackMode } from '../audioService';
import { downloadService } from '../downloadService';
import { getReciterPhotoUrl } from '../../constants/config';
import { useAudioPlayer } from 'expo-audio';

// Mock setup
(getReciterPhotoUrl as jest.Mock).mockImplementation((id: string) => `https://example.com/${id}.jpg`);

describe('AudioService', () => {
  let mockPlayer: ReturnType<typeof useAudioPlayer>;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPlayer = useAudioPlayer();

    // Mock downloadService responses
    (downloadService.getLocalPath as jest.Mock).mockResolvedValue('/storage/audio.mp3');

    // Initialize service
    await audioService.initialize(mockPlayer);
  });

  // ==========================================================================
  // Test Track Factory
  // ==========================================================================
  const createMockTrack = (overrides?: Partial<Track>): Track => ({
    reciterId: 'mishary',
    reciterName: 'Mishary Rashid Alafasy',
    reciterColorPrimary: '#1a1a2e',
    reciterColorSecondary: '#16213e',
    surahNumber: 1,
    surahName: 'Al-Fatihah',
    audioUrl: 'https://example.com/audio.mp3',
    isDownloaded: true,
    ...overrides,
  });

  // ==========================================================================
  // Initialization
  // ==========================================================================
  describe('initialize', () => {
    it('initializes with empty state', () => {
      expect(audioService.getCurrentTrack()).toBeNull();
      expect(audioService.getQueue()).toEqual([]);
      expect(audioService.getPlaybackMode()).toBe('sequential');
    });
  });

  // ==========================================================================
  // Playback Modes
  // ==========================================================================
  describe('setPlaybackMode', () => {
    it('sets shuffle mode', () => {
      audioService.setPlaybackMode('shuffle');
      expect(audioService.getPlaybackMode()).toBe('shuffle');
    });

    it('sets repeat mode', () => {
      audioService.setPlaybackMode('repeat');
      expect(audioService.getPlaybackMode()).toBe('repeat');
    });

    it('sets sequential mode', () => {
      audioService.setPlaybackMode('sequential');
      expect(audioService.getPlaybackMode()).toBe('sequential');
    });
  });

  // ==========================================================================
  // Offline Mode
  // ==========================================================================
  describe('setOfflineStatus', () => {
    it('sets offline mode', () => {
      audioService.setOfflineStatus(true);
      expect(audioService['isOffline']).toBe(true);

      audioService.setOfflineStatus(false);
      expect(audioService['isOffline']).toBe(false);
    });
  });

  // ==========================================================================
  // Sleep Timer
  // ==========================================================================
  describe('sleep timer', () => {
    it('sets sleep timer', () => {
      const onComplete = jest.fn();
      audioService.setSleepTimer(30, onComplete);

      const endTime = audioService.getSleepTimerEndTime();
      expect(endTime).toBeGreaterThan(Date.now() - 1000); // Within last second
    });
  });

  // ==========================================================================
  // Volume
  // ==========================================================================
  describe('volume', () => {
    it('sets and gets volume', () => {
      audioService.setVolume(0.5);
      expect(audioService.getVolume()).toBe(0.5);

      audioService.setVolume(1.0);
      expect(audioService.getVolume()).toBe(1.0);
    });
  });

  // ==========================================================================
  // Getters
  // ==========================================================================
  describe('getters', () => {
    it('returns current track when set', () => {
      const track = createMockTrack();
      audioService['currentTrack'] = track;

      expect(audioService.getCurrentTrack()).toEqual(track);
    });

    it('returns queue', () => {
      const tracks = [createMockTrack(), createMockTrack({ surahNumber: 2 })];
      audioService['queue'] = tracks;

      expect(audioService.getQueue()).toEqual(tracks);
    });

    it('returns playback mode', () => {
      audioService['playbackMode'] = 'shuffle';

      expect(audioService.getPlaybackMode()).toBe('shuffle');
    });

    it('returns played track IDs', () => {
      const ids = new Set(['mishary:1', 'mishary:2']);
      audioService['playedTrackIds'] = ids;

      expect(audioService.getPlayedTrackIds()).toEqual(ids);
    });

    it('returns shuffle history', () => {
      const history = [createMockTrack()];
      audioService['shuffleHistory'] = history;

      expect(audioService.getShuffleHistory()).toEqual(history);
    });

    it('returns played tracks order', () => {
      const order = [createMockTrack()];
      audioService['playedTracksOrder'] = order;

      expect(audioService.getPlayedTracksOrder()).toEqual(order);
    });
  });

  // ==========================================================================
  // State Setters
  // ==========================================================================
  describe('state setters', () => {
    it('sets played track IDs', () => {
      const ids = new Set(['mishary:1', 'mishary:2']);
      audioService.setPlayedTrackIds(ids);

      expect(audioService.getPlayedTrackIds()).toEqual(ids);
    });

    it('sets shuffle history', () => {
      const history = [createMockTrack(), createMockTrack({ surahNumber: 2 })];
      audioService.setShuffleHistory(history);

      expect(audioService.getShuffleHistory()).toEqual(history);
    });

    it('sets played tracks order', () => {
      const order = [createMockTrack(), createMockTrack({ surahNumber: 2 })];
      audioService.setPlayedTracksOrder(order);

      expect(audioService.getPlayedTracksOrder()).toEqual(order);
    });
  });
});
