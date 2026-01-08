/**
 * Mock for react-native-background-timer
 */

// Use native setTimeout/setInterval to avoid recursion
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;

// Store active timeouts
const timeouts: Map<number, NodeJS.Timeout> = new Map();
let timeoutIdCounter = 1;

// Mock setTimeout
export const setTimeout = (callback: () => void, timeout: number): number => {
  const id = timeoutIdCounter++;
  const nodeTimeout = originalSetTimeout(callback, timeout);
  timeouts.set(id, nodeTimeout);
  return id;
};

// Mock clearTimeout
export const clearTimeout = (id: number) => {
  const nodeTimeout = timeouts.get(id);
  if (nodeTimeout) {
    originalClearTimeout(nodeTimeout);
    timeouts.delete(id);
  }
};

// Mock setInterval
export const setInterval = (callback: () => void, interval: number): number => {
  const id = timeoutIdCounter++;
  const nodeInterval = originalSetInterval(callback, interval);
  timeouts.set(id, nodeInterval);
  return id;
};

// Mock clearInterval
export const clearInterval = (id: number) => {
  const nodeTimeout = timeouts.get(id);
  if (nodeTimeout) {
    originalClearInterval(nodeTimeout as any);
    timeouts.delete(id);
  }
};

// Export default as a mock class
export default class BackgroundTimer {
  static setTimeout(callback: () => void, timeout: number): number {
    return setTimeout(callback, timeout);
  }

  static clearTimeout(id: number): void {
    clearTimeout(id);
  }

  static setInterval(callback: () => void, interval: number): number {
    return setInterval(callback, interval);
  }

  static clearInterval(id: number): void {
    clearInterval(id);
  }
}
