/**
 * Mock for expo-sqlite
 * Simulates SQLite database operations using in-memory storage
 */

type Row = Record<string, unknown>;
type Table = Row[];
type Database = Record<string, Table>;

// In-memory storage for mock database (shared across all instances)
let mockDatabase: Database = {
  reciters: [],
  surahs: [],
  downloads: [],
  app_metadata: [],
};

// Track if transaction is active
let inTransaction = false;
let transactionSnapshot: Database | null = null;

const createMockDb = () => ({
  execAsync: jest.fn(async (sql: string) => {
    // Handle CREATE TABLE
    const createMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
    if (createMatch) {
      const tableName = createMatch[1];
      if (!mockDatabase[tableName]) {
        mockDatabase[tableName] = [];
      }
    }
    // Handle DELETE
    const deleteMatch = sql.match(/DELETE FROM (\w+)/i);
    if (deleteMatch) {
      const tableName = deleteMatch[1];
      mockDatabase[tableName] = [];
    }
  }),

  runAsync: jest.fn(async (sql: string, params?: unknown[]) => {
    // Handle INSERT OR REPLACE
    const insertMatch = sql.match(/INSERT OR REPLACE INTO (\w+)\s*\(([^)]+)\)/i);
    if (insertMatch && params) {
      const tableName = insertMatch[1];
      const columns = insertMatch[2].split(',').map((c) => c.trim());

      if (!mockDatabase[tableName]) {
        mockDatabase[tableName] = [];
      }

      const row: Row = {};
      columns.forEach((col, i) => {
        row[col] = params[i];
      });

      // Find primary key (assume first column or 'id')
      const pkColumn = columns[0];
      const existingIndex = mockDatabase[tableName].findIndex(
        (r) => r[pkColumn] === row[pkColumn]
      );

      if (existingIndex >= 0) {
        mockDatabase[tableName][existingIndex] = row;
      } else {
        mockDatabase[tableName].push(row);
      }

      return { changes: 1, lastInsertRowId: mockDatabase[tableName].length };
    }

    // Handle INSERT ... ON CONFLICT DO UPDATE (handles multi-line SQL)
    const normalizedSql = sql.replace(/\s+/g, ' ').trim();
    const upsertMatch = normalizedSql.match(
      /INSERT INTO (\w+)\s*\(([^)]+)\)\s*VALUES\s*\([^)]+\)\s*ON CONFLICT/i
    );
    if (upsertMatch && params) {
      const tableName = upsertMatch[1];
      const columns = upsertMatch[2].split(',').map((c) => c.trim());

      if (!mockDatabase[tableName]) {
        mockDatabase[tableName] = [];
      }

      const row: Row = {};
      columns.forEach((col, i) => {
        row[col] = params[i];
      });

      const pkColumn = columns[0];
      const existingIndex = mockDatabase[tableName].findIndex(
        (r) => r[pkColumn] === row[pkColumn]
      );

      if (existingIndex >= 0) {
        mockDatabase[tableName][existingIndex] = {
          ...mockDatabase[tableName][existingIndex],
          ...row,
        };
      } else {
        mockDatabase[tableName].push(row);
      }

      return { changes: 1, lastInsertRowId: mockDatabase[tableName].length };
    }

    // Handle DELETE with WHERE
    const deleteMatch = sql.match(/DELETE FROM (\w+)\s+WHERE\s+(.+)/i);
    if (deleteMatch && params) {
      const tableName = deleteMatch[1];
      const whereClause = deleteMatch[2];
      const columnMatch = whereClause.match(/(\w+)\s*=/);

      if (columnMatch && mockDatabase[tableName]) {
        const column = columnMatch[1];
        const initialLength = mockDatabase[tableName].length;
        mockDatabase[tableName] = mockDatabase[tableName].filter(
          (r) => r[column] !== params[0]
        );
        return { changes: initialLength - mockDatabase[tableName].length };
      }
    }

    return { changes: 0, lastInsertRowId: 0 };
  }),

  getAllAsync: jest.fn(async <T>(sql: string, params?: unknown[]): Promise<T[]> => {
    // Handle SELECT *
    const selectMatch = sql.match(/SELECT \* FROM (\w+)/i);
    if (selectMatch) {
      const tableName = selectMatch[1];
      let results = mockDatabase[tableName] || [];

      // Handle WHERE clause
      const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
      if (whereMatch && params && params.length > 0) {
        const column = whereMatch[1];
        results = results.filter((r) => r[column] === params[0]);
      }

      // Handle ORDER BY
      const orderMatch = sql.match(/ORDER BY (\w+)/i);
      if (orderMatch) {
        const orderColumn = orderMatch[1];
        results = [...results].sort((a, b) => {
          const aVal = a[orderColumn];
          const bVal = b[orderColumn];
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return aVal - bVal;
          }
          return String(aVal).localeCompare(String(bVal));
        });
      }

      return results as T[];
    }

    // Handle PRAGMA table_info
    const pragmaMatch = sql.match(/PRAGMA table_info\((\w+)\)/i);
    if (pragmaMatch) {
      const tableName = pragmaMatch[1];
      const table = mockDatabase[tableName];
      if (table && table.length > 0) {
        return Object.keys(table[0]).map((name) => ({ name })) as T[];
      }
      return [];
    }

    return [];
  }),

  getFirstAsync: jest.fn(async <T>(sql: string, params?: unknown[]): Promise<T | null> => {
    // Handle SELECT with WHERE
    const selectMatch = sql.match(/SELECT .+ FROM (\w+)/i);
    if (selectMatch) {
      const tableName = selectMatch[1];
      const table = mockDatabase[tableName] || [];

      // Handle WHERE clause
      const whereMatch = sql.match(/WHERE\s+(\w+)\s*=\s*\?/i);
      if (whereMatch && params && params.length > 0) {
        const column = whereMatch[1];
        const found = table.find((r) => r[column] === params[0]);
        if (found) {
          // Handle SELECT value FROM
          if (sql.includes('SELECT value FROM')) {
            return { value: found.value } as T;
          }
          return found as T;
        }
      }
    }

    return null;
  }),

  withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => {
    // Save snapshot for rollback
    transactionSnapshot = JSON.parse(JSON.stringify(mockDatabase));
    inTransaction = true;

    try {
      await callback();
      inTransaction = false;
      transactionSnapshot = null;
    } catch (error) {
      // Rollback on error
      if (transactionSnapshot) {
        mockDatabase = transactionSnapshot;
      }
      inTransaction = false;
      transactionSnapshot = null;
      throw error;
    }
  }),
});

// Create singleton mock database instance
const mockDb = createMockDb();

// Export mock functions
export const openDatabaseSync = jest.fn(() => mockDb);

// Test utilities
export const __resetMockDatabase = () => {
  mockDatabase = {
    reciters: [],
    surahs: [],
    downloads: [],
    app_metadata: [],
  };
  inTransaction = false;
  transactionSnapshot = null;
  jest.clearAllMocks();
};

export const __getMockDatabase = () => mockDatabase;

export const __setMockDatabase = (data: Database) => {
  mockDatabase = data;
};

export const __getMockDb = () => mockDb;

export default {
  openDatabaseSync,
};
