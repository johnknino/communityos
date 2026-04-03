-- CommUnity OS — D1 Schema v1.0
-- Run: npx wrangler d1 execute communityos-db --file=schema.sql

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- discuss, need, offer, proposal, rating, connection, promise, plant
  community TEXT NOT NULL,       -- zip code or community ID
  author TEXT NOT NULL DEFAULT 'Anonymous',
  title TEXT,
  body TEXT,
  category TEXT,
  status TEXT DEFAULT 'active',  -- active, resolved, archived
  votes INTEGER DEFAULT 0,
  metadata TEXT,                 -- JSON blob for type-specific data
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS replies (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'Anonymous',
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_posts_community_type ON posts(community, type, status);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replies_post ON replies(post_id);

-- ═══ Civic Token System ═══

CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  parent_code TEXT,                    -- Which code generated this one
  uses_remaining INTEGER DEFAULT 1,    -- How many times this code can be used
  tokens_per_use INTEGER DEFAULT 20,   -- Tokens issued per redemption
  child_codes INTEGER DEFAULT 3,       -- How many invite codes each redeemer gets
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  last_used TEXT
);

CREATE TABLE IF NOT EXISTS valid_tokens (
  token_hash TEXT PRIMARY KEY,
  issued_at TEXT DEFAULT (datetime('now')),
  spent INTEGER DEFAULT 0,
  spent_at TEXT,
  action_type TEXT                     -- evaluate, vote, promise, add_official
);

CREATE INDEX IF NOT EXISTS idx_tokens_spent ON valid_tokens(spent);
CREATE INDEX IF NOT EXISTS idx_invites_active ON invite_codes(active, uses_remaining);
