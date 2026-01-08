module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js', '@testing-library/jest-native/extend-expect'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|expo|@expo|@unimodules|unimodules|expo-modules-core|expo-audio|expo-file-system|expo-media-control|react-native-background-timer|expo-modules)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  collectCoverageFrom: [
    'src/services/**/*.{ts,tsx}',
    '!src/services/**/*.d.ts',
  ],
  coverageThreshold: {
    './src/services/database.ts': {
      branches: 70,
      functions: 70,
      lines: 65,
      statements: 70,
    },
    './src/services/syncService.ts': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    './src/services/audioStorage.ts': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    './src/services/downloadService.ts': {
      branches: 65,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    './src/services/audioService.ts': {
      branches: 15,
      functions: 30,
      lines: 25,
      statements: 25,
    },
  },
  moduleNameMapper: {
    '^expo-audio$': '<rootDir>/__mocks__/expo-audio.ts',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-file-system.ts',
    '^expo-file-system/legacy$': '<rootDir>/__mocks__/expo-file-system.ts',
    '^expo-sqlite$': '<rootDir>/__mocks__/expo-sqlite.ts',
    '^expo-asset$': '<rootDir>/__mocks__/expo-asset.ts',
    '^react-native-background-timer$': '<rootDir>/__mocks__/react-native-background-timer.ts',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/async-storage.ts',
    '^expo-media-control$': '<rootDir>/__mocks__/expo-media-control.ts',
  },
};