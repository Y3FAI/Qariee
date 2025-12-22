// Mock for expo-file-system
export const Directory = jest.fn().mockImplementation((base, path) => ({
  exists: false,
  create: jest.fn().mockResolvedValue(undefined),
}));

export const File = jest.fn().mockImplementation((base, path) => ({
  exists: true,
  uri: `file://mock/${path}`,
}));

export const Paths = {
  document: 'mock-document-dir',
};

// Legacy module for download resumable
export const DownloadResumable = jest.fn().mockImplementation(() => ({
  downloadAsync: jest.fn().mockResolvedValue({}),
  pauseAsync: jest.fn().mockResolvedValue(undefined),
  resumeAsync: jest.fn().mockResolvedValue(undefined),
  savable: jest.fn().mockReturnValue({}),
}));

// Mock the legacy module export
export default {
  Directory,
  File,
  Paths,
  DownloadResumable,
};