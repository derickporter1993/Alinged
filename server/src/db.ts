import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'alinged.db');
const db: DatabaseType = new Database(dbPath);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Read and execute schema
const schemaPath = join(__dirname, '..', 'src', 'schema.sql');
let schemaSql: string;
try {
  schemaSql = readFileSync(schemaPath, 'utf-8');
} catch {
  // When running from dist, schema.sql is relative to project root
  schemaSql = readFileSync(join(__dirname, '..', 'schema.sql'), 'utf-8');
}
db.exec(schemaSql);

console.log('[DB] SQLite database initialized at', dbPath);

export default db;
