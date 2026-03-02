import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function executeSql<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  // Replace $1, $2, etc. with ? for libsql
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

  const result = await client.execute({
    sql: processedSql,
    args: processedParams as any[],
  });

  return {
    rows: result.rows as T[],
    rowCount: result.rowsAffected,
  };
}

export async function initializeSchema(): Promise<void> {
  await client.executeMultiple(`
    -- Users (students and parents)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      atxp_account_id TEXT UNIQUE,
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

  // Migrations: add new columns to existing installs (errors ignored if already present)
  const migrations = [
    'ALTER TABLE users ADD COLUMN atxp_account_id TEXT',
  ];
  for (const sql of migrations) {
    try {
      await client.execute(sql);
    } catch {
      // Column already exists — safe to ignore
    }
  }
}

export default { executeSql, initializeSchema };
