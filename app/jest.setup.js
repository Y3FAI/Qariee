// Global test setup
import '@testing-library/jest-native/extend-expect';

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Keep console.error for test failures but mock for app code
  console.log = jest.fn();
  console.warn = jest.fn();
  // console.error is left intact for Jest to report errors
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});