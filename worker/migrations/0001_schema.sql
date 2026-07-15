-- Migration: Initial schema
-- Applied via: wrangler d1 migrations apply

CREATE TABLE IF NOT EXISTS storage_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  account_id TEXT NOT NULL,
  bucket TEXT NOT NULL,
  api_token_encrypted TEXT NOT NULL,
  folders TEXT NOT NULL DEFAULT '["foto","video","dokumen","backup"]',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  folder TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  size INTEGER DEFAULT 0,
  mime TEXT DEFAULT '',
  share_token TEXT UNIQUE,
  share_created TEXT,
  share_expires TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (account_id) REFERENCES storage_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_files_account ON files(account_id);
CREATE INDEX IF NOT EXISTS idx_files_folder ON files(account_id, folder);
CREATE INDEX IF NOT EXISTS idx_files_share ON files(share_token);
