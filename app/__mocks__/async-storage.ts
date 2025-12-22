// Mock for @react-native-async-storage/async-storage
const mockStorage = new Map();

export default {
  setItem: jest.fn().mockImplementation((key, value) => {
    mockStorage.set(key, value);
    return Promise.resolve();
  }),
  getItem: jest.fn().mockImplementation((key) => {
    return Promise.resolve(mockStorage.get(key) || null);
  }),
  removeItem: jest.fn().mockImplementation((key) => {
    mockStorage.delete(key);
    return Promise.resolve();
  }),
  clear: jest.fn().mockImplementation(() => {
    mockStorage.clear();
    return Promise.resolve();
  }),

  // For tests to inspect/control storage
  __mockStorage: mockStorage,
  __clearMockStorage: () => mockStorage.clear(),
};