// Mock for expo-audio
const mockAudioPlayer = {
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 1.0,

  // Methods
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn().mockResolvedValue(undefined),
  replace: jest.fn().mockResolvedValue(undefined),
  seekTo: jest.fn().mockResolvedValue(undefined),
  addListener: jest.fn().mockReturnValue({
    remove: jest.fn(),
  }),

  // Event listeners
  listeners: {},
};

export const useAudioPlayer = jest.fn(() => mockAudioPlayer);
export const setAudioModeAsync = jest.fn().mockResolvedValue(undefined);
export const AudioStatus = {
  playing: false,
  currentTime: 0,
  duration: 0,
  didJustFinish: false,
};

// Export mock player for tests to access
export const mockAudioPlayerInstance = mockAudioPlayer;