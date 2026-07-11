
export async function getD1(): Promise<D1Database> {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) throw new Error("DepositOS database is unavailable.");
  return env.DB as D1Database;
}

let initialization: Promise<void> | null = null;

export function ensureDatabase(): Promise<void> {
  if (!initialization) initialization = getD1().then(initialize);
  return initialization;
}

async function initialize(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS deposit_definitions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', pillar TEXT NOT NULL,
      measurement_type TEXT NOT NULL DEFAULT 'check', unit TEXT NOT NULL DEFAULT '',
      target REAL, schedule_days TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
      position INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
      active_from TEXT NOT NULL DEFAULT '2000-01-01', archived_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS daily_entries (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, entry_date TEXT NOT NULL,
      deposit_id TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0,
      value REAL, note TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS cope_reflections (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL,
      pressure TEXT NOT NULL, old_loop TEXT NOT NULL, reward TEXT NOT NULL DEFAULT '',
      cost TEXT NOT NULL DEFAULT '', replacement TEXT NOT NULL,
      friction TEXT NOT NULL DEFAULT '', commitment TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS weekly_reviews (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, week_start TEXT NOT NULL,
      win TEXT NOT NULL, lesson TEXT NOT NULL DEFAULT '',
      next_deposit TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS deposits_user_idx ON deposit_definitions (user_id, active, position)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS entries_user_date_deposit_idx ON daily_entries (user_id, entry_date, deposit_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS entries_history_idx ON daily_entries (user_id, entry_date)"),
    db.prepare("CREATE INDEX IF NOT EXISTS reflections_user_idx ON cope_reflections (user_id, created_at)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_week_idx ON weekly_reviews (user_id, week_start)"),
  ]);
}

