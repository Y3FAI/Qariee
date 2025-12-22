// Mock for react-native-background-timer
const mockSetTimeout = jest.fn().mockReturnValue(123);
const mockClearTimeout = jest.fn();

export default {
  setTimeout: mockSetTimeout,
  clearTimeout: mockClearTimeout,
  setInterval: jest.fn().mockReturnValue(456),
  clearInterval: jest.fn(),
};

// Export for tests to access
export const mockSetTimeoutFn = mockSetTimeout;
export const mockClearTimeoutFn = mockClearTimeout;