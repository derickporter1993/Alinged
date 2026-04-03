import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { vi, beforeEach } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const schemaPath = join(__dirname, '..', '..', 'src', 'schema.sql');
const schemaSql = readFileSync(schemaPath, 'utf-8');

// Create a fresh in-memory database for each test
let testDb: InstanceType<typeof Database>;

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(schemaSql);
  return db;
}

// Mock the db module
vi.mock('../db.js', () => {
  return {
    default: {
      prepare: (...args: unknown[]) => testDb.prepare(...(args as [string])),
      exec: (...args: unknown[]) => testDb.exec(...(args as [string])),
      pragma: (...args: unknown[]) => testDb.pragma(...(args as [string])),
    },
  };
});

// Mock the socket module
vi.mock('../socket.js', () => ({
  getIO: () => ({
    emit: vi.fn(),
  }),
  initSocket: vi.fn(),
}));

beforeEach(() => {
  testDb = createTestDb();
});

// createTestDb is used internally via beforeEach
