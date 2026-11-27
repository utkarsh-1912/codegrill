-- CodeGrill Neon PostgreSQL Initial Schema (0001_init.sql)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  firebase_uid TEXT UNIQUE NOT NULL,
  handle TEXT UNIQUE,
  display_name TEXT DEFAULT '',
  preferred_locale TEXT NOT NULL DEFAULT 'en',
  is_public_profile BOOLEAN NOT NULL DEFAULT FALSE,
  activity_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'solved',
  bookmarked BOOLEAN NOT NULL DEFAULT FALSE,
  confidence SMALLINT DEFAULT 0,
  next_review_at TIMESTAMPTZ,
  notes TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, problem_id)
);

CREATE TABLE IF NOT EXISTS linked_profiles (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  stats_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, platform)
);

CREATE TABLE IF NOT EXISTS custom_sheets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  problem_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plugin_cache (
  cache_key TEXT PRIMARY KEY,
  payload_json JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_progress_review ON user_progress (user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_custom_sheets_user ON custom_sheets (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_plugin_cache_expires ON plugin_cache (expires_at);
