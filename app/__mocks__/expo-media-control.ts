/**
 * Mock for expo-media-control
 */

export const Command = {
  Play: 'play',
  Pause: 'pause',
  Stop: 'stop',
  Next: 'next',
  Previous: 'previous',
  Seek: 'seek',
} as const;

export type Command = (typeof Command)[keyof typeof Command];

export const PlaybackState = {
  Playing: 'playing',
  Paused: 'paused',
  Stopped: 'stopped',
} as const;

export type PlaybackState = (typeof PlaybackState)[keyof typeof PlaybackState];

// Mock enableMediaControls function
export const enableMediaControls = jest.fn(async (config: any) => {
  return true;
});

// Mock MediaControl object
export const MediaControl = {
  setEnabled: jest.fn(async (enabled: boolean) => {}),
  setPlayback: jest.fn(async (state: PlaybackState) => {}),
  setMetadata: jest.fn(async (metadata: any) => {}),
  setName: jest.fn(async (name: string) => {}),
  setArtwork: jest.fn(async (artwork: string) => {}),
  setPlaybackState: jest.fn(async (state: PlaybackState) => {}),
  addCommand: jest.fn((command: Command, callback: () => void) => {
    return {
      remove: jest.fn(),
    };
  }),
  removeCommand: jest.fn((command: Command) => {}),
  resetTransportControls: jest.fn(() => {}),
  enableMediaControls,
};

// Export default as well
const MockMediaControl = {
  ...MediaControl,
  default: MediaControl,
};

export default MockMediaControl;
