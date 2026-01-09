/**
 * Sync Service
 *
 * Simple CDN synchronization:
 * - Fetch latest data from CDN
 * - Validate response
 * - UPSERT reciters if version changed
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

export interface SyncResult {
  success: boolean;
  updated: boolean;
  error?: string;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Sync with CDN
 * - Fetches latest data
 * - Validates response
 * - Updates local DB if version changed
 */
export const sync = async (): Promise<SyncResult> => {
  try {
    const response = await fetch(getAppDatabaseUrl());

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
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
      return { success: true, updated: false };
    }

    // Update CDN base URL if provided
    if (cdnData.settings?.cdn_base_url) {
      setCdnBaseUrl(cdnData.settings.cdn_base_url);
      await setMetadata('cdn_base_url', cdnData.settings.cdn_base_url);
    }

    // Upsert reciters
    await upsertReciters(cdnData.reciters);

    // Update version
    await setDataVersion(cdnData.version);

    return { success: true, updated: true };
  } catch (error) {
    return {
      success: false,
      updated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

// =============================================================================
// Validation
// =============================================================================

const validateCdnResponse = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') {
    return 'Invalid response: not an object';
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.version !== 'string') {
    return 'Invalid response: missing version';
  }

  if (!Array.isArray(obj.reciters)) {
    return 'Invalid response: missing reciters array';
  }

  for (const reciter of obj.reciters) {
    if (!isValidReciter(reciter)) {
      return 'Invalid response: invalid reciter data';
    }
  }

  return null;
};

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
