/**
 * Test utilities and factories for database/sync tests
 */

import type { Reciter, Surah, Download, AppDatabase, AppSettings } from '../../types';

// ============================================================================
// FACTORIES
// ============================================================================

/**
 * Create a mock Reciter with optional overrides
 */
export function createReciter(overrides: Partial<Reciter> = {}): Reciter {
  return {
    id: 'test-reciter',
    name_en: 'Test Reciter',
    name_ar: 'قارئ اختبار',
    color_primary: '#4A90E2',
    color_secondary: '#8CB4FF',
    ...overrides,
  };
}

/**
 * Create multiple mock Reciters
 */
export function createReciters(count: number): Reciter[] {
  return Array.from({ length: count }, (_, i) =>
    createReciter({
      id: `reciter-${i + 1}`,
      name_en: `Reciter ${i + 1}`,
      name_ar: `قارئ ${i + 1}`,
    })
  );
}

/**
 * Create mock reciters matching the actual CDN data
 */
export function createCdnReciters(): Reciter[] {
  return [
    {
      id: 'hussary',
      name_en: 'Mahmoud Khalil Al-Hussary',
      name_ar: 'محمود خليل الحصري',
      color_primary: '#4A90E2',
      color_secondary: '#8CB4FF',
    },
    {
      id: 'mishary-alafasy',
      name_en: 'Mishary Alafasy',
      name_ar: 'مشاري العفاسي',
      color_primary: '#E8E8E8',
      color_secondary: '#F5F5F5',
    },
    {
      id: 'abdul-basit',
      name_en: 'Abdul Basit Abdul Samad',
      name_ar: 'عبد الباسط عبد الصمد',
      color_primary: '#FF6B6B',
      color_secondary: '#FFA5A5',
    },
  ];
}

/**
 * Create a mock Surah with optional overrides
 */
export function createSurah(overrides: Partial<Surah> = {}): Surah {
  return {
    number: 1,
    name_ar: 'الفاتحة',
    name_en: 'Al-Fatiha',
    ...overrides,
  };
}

/**
 * Create multiple mock Surahs
 */
export function createSurahs(count: number): Surah[] {
  const names = [
    { ar: 'الفاتحة', en: 'Al-Fatiha' },
    { ar: 'البقرة', en: 'Al-Baqara' },
    { ar: 'آل عمران', en: 'Aal-Imran' },
    { ar: 'النساء', en: 'An-Nisa' },
    { ar: 'المائدة', en: 'Al-Maida' },
  ];

  return Array.from({ length: count }, (_, i) =>
    createSurah({
      number: i + 1,
      name_ar: names[i % names.length].ar,
      name_en: names[i % names.length].en,
    })
  );
}

/**
 * Create a mock Download with optional overrides
 */
export function createDownload(overrides: Partial<Download> = {}): Download {
  return {
    reciter_id: 'test-reciter',
    surah_number: 1,
    local_file_path: 'audio/test-reciter/001.mp3',
    downloaded_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create mock AppSettings
 */
export function createAppSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    cdn_base_url: 'https://qariee-storage.y3f.me',
    app_name: 'Qariee',
    support_email: 'test@example.com',
    app_version: '1.0.0',
    min_app_version: '1.0.0',
    ...overrides,
  };
}

/**
 * Create mock AppDatabase (CDN response)
 */
export function createAppDatabase(overrides: Partial<AppDatabase> = {}): AppDatabase {
  return {
    version: '1.0.0',
    settings: createAppSettings(),
    reciters: createCdnReciters(),
    ...overrides,
  };
}

// ============================================================================
// MOCK RESPONSE HELPERS
// ============================================================================

/**
 * Create a mock fetch response for CDN data
 */
export function createMockFetchResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  };
}

/**
 * Create a mock fetch that returns CDN database
 */
export function mockFetchCdnDatabase(database: AppDatabase = createAppDatabase()) {
  return jest.fn().mockResolvedValue(createMockFetchResponse(database));
}

/**
 * Create a mock fetch that fails with network error
 */
export function mockFetchNetworkError() {
  return jest.fn().mockRejectedValue(new Error('Network request failed'));
}

/**
 * Create a mock fetch that returns invalid JSON
 */
export function mockFetchInvalidJson() {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
  });
}

/**
 * Create a mock fetch that returns HTTP error
 */
export function mockFetchHttpError(status = 500) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: jest.fn().mockResolvedValue({ error: 'Server error' }),
  });
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate Reciter structure
 */
export function isValidReciter(obj: unknown): obj is Reciter {
  if (!obj || typeof obj !== 'object') return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.name_en === 'string' &&
    typeof r.name_ar === 'string' &&
    typeof r.color_primary === 'string' &&
    typeof r.color_secondary === 'string'
  );
}

/**
 * Validate Surah structure
 */
export function isValidSurah(obj: unknown): obj is Surah {
  if (!obj || typeof obj !== 'object') return false;
  const s = obj as Record<string, unknown>;
  return (
    typeof s.number === 'number' &&
    typeof s.name_ar === 'string' &&
    typeof s.name_en === 'string'
  );
}

/**
 * Validate AppDatabase structure (CDN response)
 */
export function isValidAppDatabase(obj: unknown): obj is AppDatabase {
  if (!obj || typeof obj !== 'object') return false;
  const db = obj as Record<string, unknown>;
  return (
    typeof db.version === 'string' &&
    db.settings !== null &&
    typeof db.settings === 'object' &&
    Array.isArray(db.reciters) &&
    db.reciters.every(isValidReciter)
  );
}

// ============================================================================
// TIMING HELPERS
// ============================================================================

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Flush all pending promises
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

// ============================================================================
// RESET HELPERS
// ============================================================================

/**
 * Reset all mocks (call this in beforeEach)
 */
export function resetAllMocks(): void {
  jest.clearAllMocks();
  jest.resetModules();
}
