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

    -- Curriculum contributions from agents and humans
    CREATE TABLE IF NOT EXISTS contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contributor_id TEXT NOT NULL,
      contributor_type TEXT DEFAULT 'human' CHECK (contributor_type IN ('agent', 'human', 'institution')),
      contribution_type TEXT NOT NULL CHECK (contribution_type IN ('lesson_module', 'quiz_item', 'pedagogical_improvement', 'new_concept')),
      subject_id TEXT NOT NULL,
      concept_id TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'auto_validated', 'approved', 'rejected', 'deployed')),
      validation_results TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Reviews of contributions (human reviewers and automated systems)
    CREATE TABLE IF NOT EXISTS contribution_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contribution_id INTEGER REFERENCES contributions(id),
      reviewer_id TEXT NOT NULL,
      reviewer_type TEXT DEFAULT 'human' CHECK (reviewer_type IN ('agent', 'human', 'automated')),
      decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject', 'improve')),
      feedback TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Contributor reputation scores (higher = more trusted, content auto-approved sooner)
    CREATE TABLE IF NOT EXISTS contributor_reputation (
      contributor_id TEXT PRIMARY KEY,
      contributor_type TEXT DEFAULT 'human',
      total_contributions INTEGER DEFAULT 0,
      approved_contributions INTEGER DEFAULT 0,
      rejected_contributions INTEGER DEFAULT 0,
      reputation_score REAL DEFAULT 0.0,
      last_contribution_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- On-demand generated lessons (cached LLM output)
    CREATE TABLE IF NOT EXISTS generated_lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id TEXT NOT NULL,
      concept_id TEXT NOT NULL,
      content TEXT NOT NULL,
      generation_model TEXT,
      generation_prompt_version INTEGER DEFAULT 1,
      feedback_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(subject_id, concept_id)
    );

    -- Guest sessions for demo mode (no account required)
    CREATE TABLE IF NOT EXISTS guest_sessions (
      id TEXT PRIMARY KEY,
      subject TEXT,
      concept_id TEXT,
      grade_level INTEGER DEFAULT 9,
      messages TEXT DEFAULT '[]',
      message_count INTEGER DEFAULT 0,
      ip_hash TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrations: add new columns to existing installs (errors ignored if already present)
  const migrations = [
    'ALTER TABLE users ADD COLUMN atxp_account_id TEXT',
    'ALTER TABLE users ADD COLUMN atxp_connection_token TEXT',
    // Contribution system tables (added after initial launch)
    `CREATE TABLE IF NOT EXISTS contributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contributor_id TEXT NOT NULL,
      contributor_type TEXT DEFAULT 'human' CHECK (contributor_type IN ('agent', 'human', 'institution')),
      contribution_type TEXT NOT NULL CHECK (contribution_type IN ('lesson_module', 'quiz_item', 'pedagogical_improvement', 'new_concept')),
      subject_id TEXT NOT NULL,
      concept_id TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'auto_validated', 'approved', 'rejected', 'deployed')),
      validation_results TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS contribution_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contribution_id INTEGER REFERENCES contributions(id),
      reviewer_id TEXT NOT NULL,
      reviewer_type TEXT DEFAULT 'human' CHECK (reviewer_type IN ('agent', 'human', 'automated')),
      decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject', 'improve')),
      feedback TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS contributor_reputation (
      contributor_id TEXT PRIMARY KEY,
      contributor_type TEXT DEFAULT 'human',
      total_contributions INTEGER DEFAULT 0,
      approved_contributions INTEGER DEFAULT 0,
      rejected_contributions INTEGER DEFAULT 0,
      reputation_score REAL DEFAULT 0.0,
      last_contribution_at TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS guest_sessions (
      id TEXT PRIMARY KEY,
      subject TEXT,
      concept_id TEXT,
      grade_level INTEGER DEFAULT 9,
      messages TEXT DEFAULT '[]',
      message_count INTEGER DEFAULT 0,
      ip_hash TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS generated_lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id TEXT NOT NULL,
      concept_id TEXT NOT NULL,
      content TEXT NOT NULL,
      generation_model TEXT,
      generation_prompt_version INTEGER DEFAULT 1,
      feedback_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(subject_id, concept_id)
    )`,
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
