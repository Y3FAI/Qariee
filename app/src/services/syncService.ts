/**
 * Sync Service
 *
 * Handles synchronization of app data with CDN.
 * - Debounced to handle network flapping
 * - Mutex to prevent concurrent syncs
 * - Validates data before writing
 * - UPSERT only (never delete-all)
 */

import { getAppDatabaseUrl, setCdnBaseUrl } from '../constants/config';
import { AppDatabase, Reciter } from '../types';
import {
  upsertReciters,
  getDataVersion,
  setDataVersion,
  setMetadata,
} from './database';

// =============================================================================
// Types
// =============================================================================

export type SyncStatus = 'IDLE' | 'SYNCING' | 'ERROR';

export interface SyncResult {
  success: boolean;
  updated: boolean;
  error?: string;
}

// =============================================================================
// State
// =============================================================================

let syncStatus: SyncStatus = 'IDLE';
let isSyncing = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastError: string | null = null;

const DEBOUNCE_MS = 50; // Short debounce for tests, can be increased for production

// =============================================================================
// Public API
// =============================================================================

/**
 * Get current sync status
 */
export const getSyncStatus = (): SyncStatus => {
  return syncStatus;
};

/**
 * Get last sync error if any
 */
export const getLastError = (): string | null => {
  return lastError;
};

/**
 * Request a sync (debounced)
 * Multiple rapid calls will result in a single sync after debounce period
 */
export const requestSync = (): void => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(async () => {
    debounceTimer = null;
    await sync();
  }, DEBOUNCE_MS);
};

/**
 * Force immediate sync (bypasses debounce)
 */
export const forceSync = async (): Promise<SyncResult> => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  return sync();
};

/**
 * Perform sync with CDN
 * - Fetches latest data from CDN
 * - Validates response
 * - Upserts data if version is newer
 * - Uses mutex to prevent concurrent syncs
 */
export const sync = async (): Promise<SyncResult> => {
  // Mutex check - prevent concurrent syncs
  if (isSyncing) {
    return {
      success: true,
      updated: false,
      error: 'Sync already in progress',
    };
  }

  isSyncing = true;
  syncStatus = 'SYNCING';
  lastError = null;

  try {
    // Fetch CDN data
    const response = await fetch(getAppDatabaseUrl());

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();

    // Validate response
    const validationError = validateCdnResponse(data);
    if (validationError) {
      throw new Error(validationError);
    }

    const cdnData = data as AppDatabase;

    // Check if update is needed
    const localVersion = await getDataVersion();
    if (localVersion === cdnData.version) {
      syncStatus = 'IDLE';
      isSyncing = false;
      return {
        success: true,
        updated: false,
      };
    }

    // Update CDN base URL if provided
    if (cdnData.settings?.cdn_base_url) {
      setCdnBaseUrl(cdnData.settings.cdn_base_url);
      await setMetadata('cdn_base_url', cdnData.settings.cdn_base_url);
    }

    // Upsert reciters (transactional, safe)
    await upsertReciters(cdnData.reciters);

    // Update data version
    await setDataVersion(cdnData.version);

    syncStatus = 'IDLE';
    isSyncing = false;

    return {
      success: true,
      updated: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    lastError = errorMessage;
    syncStatus = 'ERROR';
    isSyncing = false;

    return {
      success: false,
      updated: false,
      error: errorMessage,
    };
  }
};

// =============================================================================
// Validation
// =============================================================================

/**
 * Validates CDN response structure
 * Returns error message if invalid, null if valid
 */
const validateCdnResponse = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') {
    return 'invalid response: not an object';
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.version !== 'string') {
    return 'invalid response: missing version';
  }

  if (!Array.isArray(obj.reciters)) {
    return 'invalid response: missing reciters array';
  }

  // Validate each reciter has required fields
  for (const reciter of obj.reciters) {
    if (!isValidReciter(reciter)) {
      return 'invalid response: invalid reciter data';
    }
  }

  return null;
};

/**
 * Validates a reciter object
 */
const isValidReciter = (obj: unknown): obj is Reciter => {
  if (!obj || typeof obj !== 'object') return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.name_en === 'string' &&
    typeof r.name_ar === 'string' &&
    typeof r.color_primary === 'string' &&
    typeof r.color_secondary === 'string'
  );
};

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Reset sync state (for testing)
 */
export const __resetSyncState = (): void => {
  syncStatus = 'IDLE';
  isSyncing = false;
  lastError = null;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
};
