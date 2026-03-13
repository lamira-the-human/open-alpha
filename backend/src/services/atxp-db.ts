import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/open-alpha.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

// For compatibility with async interface used elsewhere
export async function createDatabase(): Promise<string> {
  getDb();
  return DB_PATH;
}

export async function getDatabaseUrl(): Promise<string> {
  return DB_PATH;
}

export async function executeSql<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  const database = getDb();

  // Replace $1, $2, etc. with ? for SQLite
  let processedSql = sql;
  const processedParams: unknown[] = [];

  if (params) {
    let paramIndex = 0;
    processedSql = sql.replace(/\$(\d+)/g, () => {
      processedParams.push(params[paramIndex]);
      paramIndex++;
      return '?';
    });
  }

  try {
    // Check if it's a SELECT query
    const isSelect = processedSql.trim().toUpperCase().startsWith('SELECT');
    const isReturning = processedSql.toUpperCase().includes('RETURNING');

    if (isSelect || isReturning) {
      const stmt = database.prepare(processedSql);
      const rows = stmt.all(...processedParams) as T[];
      return { rows, rowCount: rows.length };
    } else {
      const stmt = database.prepare(processedSql);
      const result = stmt.run(...processedParams);
      return { rows: [], rowCount: result.changes };
    }
  } catch (error) {
    // Handle multi-statement SQL (like schema creation)
    if (processedSql.includes(';')) {
      database.exec(processedSql);
      return { rows: [], rowCount: 0 };
    }
    throw error;
  }
}

export async function initializeSchema(): Promise<void> {
  const database = getDb();

  // SQLite schema (adapted from PostgreSQL)
  database.exec(`
    -- Users (students and parents)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      atxp_account_id TEXT UNIQUE,
      atxp_connection_token TEXT,
      display_name TEXT,
      role TEXT NOT NULL CHECK (role IN ('student', 'parent')),
      grade_level INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Parent-child links
    CREATE TABLE IF NOT EXISTS parent_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER REFERENCES users(id),
      student_id INTEGER REFERENCES users(id),
      invite_code TEXT UNIQUE,
      linked_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Progress tracking
    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER REFERENCES users(id),
      subject TEXT NOT NULL,
      concept_id TEXT NOT NULL,
      mastery_score INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0,
      last_attempt_at TEXT,
      completed_at TEXT,
      UNIQUE(student_id, subject, concept_id)
    );

    -- Chat sessions (tutor and coach)
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      session_type TEXT CHECK (session_type IN ('tutor', 'coach')),
      subject TEXT,
      concept_id TEXT,
      messages TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- PKCE state for OAuth flows
    CREATE TABLE IF NOT EXISTS oauth_pkce (
      state TEXT PRIMARY KEY,
      code_verifier TEXT NOT NULL,
      role TEXT,
      grade_level INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrations: add new columns to existing installs
  const migrations = [
    'ALTER TABLE users ADD COLUMN atxp_account_id TEXT UNIQUE',
    'ALTER TABLE users ADD COLUMN atxp_connection_token TEXT',
  ];
  for (const sql of migrations) {
    try {
      database.exec(sql);
    } catch {
      // Column already exists — safe to ignore
    }
  }
}

export default {
  createDatabase,
  getDatabaseUrl,
  executeSql,
  initializeSchema,
};
