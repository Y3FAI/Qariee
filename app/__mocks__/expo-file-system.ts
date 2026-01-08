/**
 * Mock for expo-file-system
 * Simulates file system operations using in-memory storage
 */

// In-memory file system
let mockFileSystem: Record<string, { content: string; size: number }> = {};
let mockDirectories: Set<string> = new Set(['/mock/documents', '/mock/cache']);

// Mock File class
export class File {
  uri: string;
  private path: string;

  constructor(directory: { uri: string } | string, filename: string) {
    const dirUri = typeof directory === 'string' ? directory : directory.uri;
    this.path = `${dirUri}/${filename}`;
    this.uri = `file://${this.path}`;
  }

  get exists(): boolean {
    return this.path in mockFileSystem;
  }

  get size(): number | undefined {
    return mockFileSystem[this.path]?.size;
  }

  async create(): Promise<void> {
    mockFileSystem[this.path] = { content: '', size: 0 };
  }

  async delete(): Promise<void> {
    delete mockFileSystem[this.path];
  }

  async copy(destination: File): Promise<void> {
    if (mockFileSystem[this.path]) {
      mockFileSystem[destination.uri.replace('file://', '')] = {
        ...mockFileSystem[this.path],
      };
    }
  }

  async text(): Promise<string> {
    return mockFileSystem[this.path]?.content || '';
  }

  async write(content: string): Promise<void> {
    mockFileSystem[this.path] = {
      content,
      size: content.length,
    };
  }
}

// Mock Directory class
export class Directory {
  uri: string;
  private path: string;

  constructor(basePath: { uri: string } | string, subPath?: string) {
    const baseUri = typeof basePath === 'string' ? basePath : basePath.uri;
    this.path = subPath ? `${baseUri}/${subPath}` : baseUri;
    this.uri = `file://${this.path}`;
  }

  get exists(): boolean {
    return mockDirectories.has(this.path);
  }

  async create(): Promise<void> {
    mockDirectories.add(this.path);
  }

  async delete(): Promise<void> {
    mockDirectories.delete(this.path);
    // Delete all files in directory
    Object.keys(mockFileSystem).forEach((key) => {
      if (key.startsWith(this.path)) {
        delete mockFileSystem[key];
      }
    });
  }

  list(): string[] {
    return Object.keys(mockFileSystem)
      .filter((key) => key.startsWith(this.path))
      .map((key) => key.replace(this.path + '/', ''));
  }
}

// Mock Paths
export const Paths = {
  document: { uri: '/mock/documents' },
  cache: { uri: '/mock/cache' },
  appleSharedContainers: {},
};

// Legacy API compatibility
export const documentDirectory = '/mock/documents/';
export const cacheDirectory = '/mock/cache/';

export const makeDirectoryAsync = jest.fn(
  async (uri: string, options?: { intermediates?: boolean }) => {
    const path = uri.replace('file://', '');
    if (options?.intermediates) {
      // Create all intermediate directories
      const parts = path.split('/');
      let current = '';
      for (const part of parts) {
        current += (current ? '/' : '') + part;
        mockDirectories.add(current);
      }
    } else {
      mockDirectories.add(path);
    }
  }
);

export const getInfoAsync = jest.fn(async (uri: string) => {
  const path = uri.replace('file://', '');
  if (mockDirectories.has(path)) {
    return { exists: true, isDirectory: true };
  }
  if (mockFileSystem[path]) {
    return {
      exists: true,
      isDirectory: false,
      size: mockFileSystem[path].size,
    };
  }
  return { exists: false };
});

export const deleteAsync = jest.fn(async (uri: string) => {
  const path = uri.replace('file://', '');
  delete mockFileSystem[path];
  mockDirectories.delete(path);
});

export const readAsStringAsync = jest.fn(async (uri: string) => {
  const path = uri.replace('file://', '');
  return mockFileSystem[path]?.content || '';
});

export const writeAsStringAsync = jest.fn(async (uri: string, content: string) => {
  const path = uri.replace('file://', '');
  mockFileSystem[path] = { content, size: content.length };
});

export const copyAsync = jest.fn(async (options: { from: string; to: string }) => {
  const fromPath = options.from.replace('file://', '');
  const toPath = options.to.replace('file://', '');
  if (mockFileSystem[fromPath]) {
    mockFileSystem[toPath] = { ...mockFileSystem[fromPath] };
  }
});

// Download resumable mock
export const createDownloadResumable = jest.fn(
  (
    uri: string,
    fileUri: string,
    options?: Record<string, unknown>,
    callback?: (progress: { totalBytesWritten: number; totalBytesExpectedToWrite: number }) => void
  ) => {
    return {
      downloadAsync: jest.fn(async () => {
        // Simulate progress
        if (callback) {
          callback({ totalBytesWritten: 50, totalBytesExpectedToWrite: 100 });
          callback({ totalBytesWritten: 100, totalBytesExpectedToWrite: 100 });
        }
        const path = fileUri.replace('file://', '');
        mockFileSystem[path] = { content: 'mock audio content', size: 1000 };
        return { uri: fileUri, status: 200 };
      }),
      pauseAsync: jest.fn(),
      resumeAsync: jest.fn(),
      cancelAsync: jest.fn(),
    };
  }
);

// Test utilities
export const __resetMockFileSystem = () => {
  mockFileSystem = {};
  mockDirectories = new Set(['/mock/documents', '/mock/cache']);
  jest.clearAllMocks();
};

export const __getMockFileSystem = () => mockFileSystem;

export const __setMockFileSystem = (files: Record<string, { content: string; size: number }>) => {
  mockFileSystem = files;
};

export const __addMockFile = (path: string, content: string) => {
  mockFileSystem[path] = { content, size: content.length };
};

export const __addMockDirectory = (path: string) => {
  mockDirectories.add(path);
};

export default {
  File,
  Directory,
  Paths,
  documentDirectory,
  cacheDirectory,
  makeDirectoryAsync,
  getInfoAsync,
  deleteAsync,
  readAsStringAsync,
  writeAsStringAsync,
  copyAsync,
  createDownloadResumable,
};
