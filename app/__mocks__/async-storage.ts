/**
 * Mock for @react-native-async-storage/async-storage
 * Simple Map-based mock
 */

let mockStorage: Map<string, string> = new Map();

const AsyncStorage = {
  getItem: jest.fn(async (key: string): Promise<string | null> => {
    return mockStorage.get(key) ?? null;
  }),

  setItem: jest.fn(async (key: string, value: string): Promise<void> => {
    mockStorage.set(key, value);
  }),

  removeItem: jest.fn(async (key: string): Promise<void> => {
    mockStorage.delete(key);
  }),

  clear: jest.fn(async (): Promise<void> => {
    mockStorage.clear();
  }),

  getAllKeys: jest.fn(async (): Promise<string[]> => {
    return Array.from(mockStorage.keys());
  }),

  multiGet: jest.fn(async (keys: string[]): Promise<[string, string | null][]> => {
    return keys.map((key) => [key, mockStorage.get(key) ?? null]);
  }),

  multiSet: jest.fn(async (keyValuePairs: [string, string][]): Promise<void> => {
    keyValuePairs.forEach(([key, value]) => {
      mockStorage.set(key, value);
    });
  }),

  multiRemove: jest.fn(async (keys: string[]): Promise<void> => {
    keys.forEach((key) => {
      mockStorage.delete(key);
    });
  }),

  mergeItem: jest.fn(async (key: string, value: string): Promise<void> => {
    const existing = mockStorage.get(key);
    if (existing) {
      try {
        const merged = { ...JSON.parse(existing), ...JSON.parse(value) };
        mockStorage.set(key, JSON.stringify(merged));
      } catch {
        mockStorage.set(key, value);
      }
    } else {
      mockStorage.set(key, value);
    }
  }),

  multiMerge: jest.fn(async (keyValuePairs: [string, string][]): Promise<void> => {
    for (const [key, value] of keyValuePairs) {
      await AsyncStorage.mergeItem(key, value);
    }
  }),
};

// Test utilities
export const __resetMockStorage = () => {
  mockStorage = new Map();
  jest.clearAllMocks();
};

export const __getMockStorage = () => Object.fromEntries(mockStorage);

export const __setMockStorage = (data: Record<string, string>) => {
  mockStorage = new Map(Object.entries(data));
};

export default AsyncStorage;
