// Mock for expo-media-control
export enum Command {
  PLAY = 'play',
  PAUSE = 'pause',
  NEXT_TRACK = 'nextTrack',
  PREVIOUS_TRACK = 'previousTrack',
  STOP = 'stop',
}

export enum PlaybackState {
  PLAYING = 'playing',
  PAUSED = 'paused',
  STOPPED = 'stopped',
}

export default {
  enableMediaControls: jest.fn().mockResolvedValue(undefined),
  disableMediaControls: jest.fn().mockResolvedValue(undefined),
  updateMetadata: jest.fn().mockResolvedValue(undefined),
  updatePlaybackState: jest.fn().mockResolvedValue(undefined),
  addListener: jest.fn().mockReturnValue({
    remove: jest.fn(),
  }),
  removeAllListeners: jest.fn(),
};

// Named exports
export { Command, PlaybackState };