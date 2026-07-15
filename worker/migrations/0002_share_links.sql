-- Migration: Share links table
CREATE TABLE IF NOT EXISTS share_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  downloads INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  expires TEXT,
  FOREIGN KEY (account_id) REFERENCES storage_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_share_links_token ON share_links(token);
