/**
 * Mock for expo-audio
 */

// Mock AudioStatus enum
export const AudioStatus = {
  Idle: 'idle',
  Loading: 'loading',
  Playing: 'playing',
  Paused: 'paused',
  Stopped: 'stopped',
  Error: 'error',
  Buffering: 'buffering',
} as const;

export type AudioStatus = (typeof AudioStatus)[keyof typeof AudioStatus];

// Mock AudioSource
export const AudioSource = {
  createURI: (uri: string) => ({ uri }),
  createFromFile: (file: { uri: string }) => ({ uri: file.uri }),
};

// Mock listener type
export type AudioListener = (status: any) => void;

// Mock player state
let mockPlayerState = {
  playing: false,
  progress: 0,
  duration: 0,
  volume: 1.0,
  muted: false,
  rate: 1.0,
  playingState: 'idle' as AudioStatus,
  loop: false,
  isBuffering: false,
};

// Listener storage
const listeners: Set<AudioListener> = new Set();

// Reset function for tests
export const __resetMockAudioPlayer = () => {
  mockPlayerState = {
    playing: false,
    progress: 0,
    duration: 0,
    volume: 1.0,
    muted: false,
    rate: 1.0,
    playingState: 'idle' as AudioStatus,
    loop: false,
    isBuffering: false,
  };
  listeners.clear();
};

// Helper to notify listeners
export const __notifyPlaybackStatusChange = (status: any) => {
  listeners.forEach((listener) => listener(status));
};

// Set mock player state for testing
export const __setMockPlayerState = (state: Partial<typeof mockPlayerState>) => {
  mockPlayerState = { ...mockPlayerState, ...state };
};

// Get mock player state
export const __getMockPlayerState = () => ({ ...mockPlayerState });

// Mock useAudioPlayer hook
export const useAudioPlayer = () => {
  return {
    // State
    playing: mockPlayerState.playing,
    progress: mockPlayerState.progress,
    duration: mockPlayerState.duration,
    volume: mockPlayerState.volume,
    muted: mockPlayerState.muted,
    rate: mockPlayerState.rate,
    playingState: mockPlayerState.playingState,
    loop: mockPlayerState.loop,
    isBuffering: mockPlayerState.isBuffering,

    // Methods
    play: jest.fn(async () => {
      mockPlayerState.playing = true;
      mockPlayerState.playingState = 'playing';
      __notifyPlaybackStatusChange(mockPlayerState);
      return Promise.resolve();
    }),

    pause: jest.fn(async () => {
      mockPlayerState.playing = false;
      mockPlayerState.playingState = 'paused';
      __notifyPlaybackStatusChange(mockPlayerState);
    }),

    stop: jest.fn(async () => {
      mockPlayerState.playing = false;
      mockPlayerState.playingState = 'stopped';
      mockPlayerState.progress = 0;
      __notifyPlaybackStatusChange(mockPlayerState);
    }),

    replace: jest.fn(async (source: any) => {
      mockPlayerState.progress = 0;
      mockPlayerState.playingState = 'loading';
      __notifyPlaybackStatusChange({
        ...mockPlayerState,
        playingState: 'loading',
        didJustFinish: false,
      });

      // Simulate async loading
      await Promise.resolve();

      mockPlayerState.playingState = 'ready';
      mockPlayerState.duration = 600; // Default mock duration
      __notifyPlaybackStatusChange({
        ...mockPlayerState,
        playingState: 'ready',
        didJustFinish: false,
      });
      return Promise.resolve();
    }),

    seek: jest.fn(async (position: number) => {
      mockPlayerState.progress = position;
    }),

    setVolume: jest.fn(async (volume: number) => {
      mockPlayerState.volume = volume;
    }),

    setMuted: jest.fn(async (muted: boolean) => {
      mockPlayerState.muted = muted;
    }),

    setRate: jest.fn(async (rate: number) => {
      mockPlayerState.rate = rate;
    }),

    setLoop: jest.fn(async (loop: boolean) => {
      mockPlayerState.loop = loop;
    }),

    tryToPlay: jest.fn(async () => {
      mockPlayerState.playing = true;
      mockPlayerState.playingState = 'playing';
      __notifyPlaybackStatusChange(mockPlayerState);
    }),

    // Event listener
    addListener: jest.fn((event: string, callback: AudioListener) => {
      if (event === 'playbackStatusChange') {
        listeners.add(callback);
      }
      return {
        remove: jest.fn(() => {
          listeners.delete(callback);
        }),
      };
    }),
  };
};

// Mock setAudioModeAsync
export const setAudioModeAsync = jest.fn(async (config: any) => {
  return true;
});

// Mock for playingState
export const PlayingState = {
  Idle: 'idle',
  Loading: 'loading',
  Ready: 'ready',
  Playing: 'playing',
  Paused: 'paused',
  Stopped: 'stopped',
  Error: 'error',
  Buffering: 'buffering',
} as const;

export default {
  useAudioPlayer,
  AudioSource,
  AudioStatus,
  setAudioModeAsync,
  PlayingState,
};
