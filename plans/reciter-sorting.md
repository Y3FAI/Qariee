# Reciter Sorting Feature

## Overview
Add a `sort_order` field to reciters to control their display order on the home screen.

> **Note:** No migration needed - app has no users yet.

## Files to Modify

| File | Changes |
|------|---------|
| `app/src/types/index.ts` | Add `sort_order: number` to `Reciter` interface |
| `app/src/services/database.ts` | Update CREATE TABLE, upsert, and query |
| `backend/r2/metadata/db.json` | Add `sort_order` to each reciter |
| `app/assets/data/database.db` | Regenerate bundled database |

## Implementation Steps

### 1. Update TypeScript Type
**File:** `app/src/types/index.ts`

```typescript
export interface Reciter {
  id: string;
  name_en: string;
  name_ar: string;
  color_primary: string;
  color_secondary: string;
  sort_order: number;  // NEW - display order (1, 2, 3...)
}
```

### 2. Update Database Schema
**File:** `app/src/services/database.ts`

- Update `initDatabase()` CREATE TABLE for reciters:
  ```sql
  CREATE TABLE IF NOT EXISTS reciters (
    id TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    color_primary TEXT NOT NULL,
    color_secondary TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
  ```
- Update `upsertReciters()` to include `sort_order` column
- Update `insertReciter()` to handle `sort_order`
- Update `getAllReciters()` ORDER BY clause: `ORDER BY sort_order`

### 3. Update db.json
**File:** `backend/r2/metadata/db.json`

Add `sort_order` property to each reciter. Example ordering:

| Reciter | sort_order |
|---------|------------|
| Mishary Alafasy | 1 |
| Abdur-Rahman As-Sudais | 2 |
| Mahmoud Khalil Al-Hussary | 3 |
| Abdul Basit Abdul Samad | 4 |
| Maher Al-Muaiqly | 5 |
| Abdullah Al Juhany | 6 |
| Saud Al-Shuraim | 7 |
| Mohamed Ayoub | 8 |
| Muhammad Siddiq Al Minshawi | 9 |
| Ali Jaber | 10 |
| Abdullah Al-Khayat | 11 |
| Yasir al-Dawsari | 12 |
| Badr Al-Turki | 13 |
| Ali al-Hudhayfi | 14 |

### 4. Regenerate Bundled Database
Run: `npm run generate-db`

This updates `app/assets/data/database.db` with the new schema and data.

## Testing Checklist

- [ ] New installs show reciters in correct order
- [ ] Reciters display in order defined by sort_order
- [ ] Sync service preserves sort_order on UPSERT
