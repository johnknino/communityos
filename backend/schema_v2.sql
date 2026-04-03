-- CommUnity OS — Schema Migration v2.0
-- Adaptive Civic Diagnostic System
-- Run: npx wrangler d1 execute communityos-db --remote --file=schema_v2.sql

-- ═══ Diagnostic Reports ═══
-- Stores deidentified civic health snapshots produced by the scheduled diagnostic engine.
-- No individual data. Aggregates only. k≥11 suppression on all counts.

CREATE TABLE IF NOT EXISTS diagnostic_reports (
  id TEXT PRIMARY KEY,
  community TEXT NOT NULL,
  period TEXT NOT NULL,              -- '2026-W14', '2026-Q2', '2026-04'
  period_type TEXT NOT NULL,         -- 'weekly', 'monthly', 'quarterly'
  health_score REAL,                 -- 0-100 composite
  health_grade TEXT,                 -- A-F
  participation_score REAL,
  responsiveness_score REAL,
  accountability_score REAL,
  solidarity_score REAL,
  trend TEXT,                        -- 'strengthening', 'stable', 'weakening'
  failpoints TEXT,                   -- JSON array of detected failpoints
  strengths TEXT,                    -- JSON array of detected strengths
  recommended_actions TEXT,          -- JSON array of platform/community/upgrade actions
  census_crossref TEXT,              -- JSON: Census data signals at time of report
  cdc_crossref TEXT,                 -- JSON: CDC PLACES signals at time of report
  raw_signals TEXT,                  -- JSON: all computed signals (deidentified aggregates)
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_diag_community_period ON diagnostic_reports(community, period_type, created_at DESC);

-- ═══ Failpoint Definitions ═══
-- Reference table: what the system watches for and how it responds.
-- These are the N→B→F patterns encoded as detection rules.

CREATE TABLE IF NOT EXISTS failpoint_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  nbf_stage TEXT NOT NULL DEFAULT 'broken',  -- 'normal', 'broken', 'fix'
  category TEXT,                              -- 'safety_net', 'accountability', 'engagement', 'crisis'
  detection_query TEXT NOT NULL,              -- SQL template for detection
  severity_formula TEXT,                      -- how to compute severity from query results
  threshold_warn REAL DEFAULT 0.3,            -- below this = warning
  threshold_critical REAL DEFAULT 0.6,        -- above this = critical
  recommended_action TEXT,                    -- default action when triggered
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══ Seed failpoint definitions — the diagnostic intelligence ═══

INSERT OR IGNORE INTO failpoint_definitions (id, name, description, category, detection_query, threshold_warn, threshold_critical, recommended_action) VALUES
('fp_unmet_needs', 
 'Unmet Need Accumulation',
 'Needs posted with zero responses after 72 hours. Safety net failure signal.',
 'safety_net',
 'SELECT category, COUNT(*) as cnt FROM posts WHERE type=''need'' AND status=''active'' AND created_at < datetime(''now'', ''-3 days'') AND id NOT IN (SELECT DISTINCT post_id FROM replies) GROUP BY category HAVING cnt >= 3',
 0.3, 0.6,
 'Surface relevant resource guides. Connect to local_resources in community.json.'),

('fp_accountability_gap',
 'Accountability Gap',
 'Proposals that pass community vote threshold but show no official response after 30 days.',
 'accountability',
 'SELECT category, COUNT(*) as cnt FROM posts WHERE type=''proposal'' AND votes >= 5 AND status=''active'' AND created_at < datetime(''now'', ''-30 days'') GROUP BY category HAVING cnt >= 1',
 0.2, 0.5,
 'Flag in governance dashboard. Generate accountability follow-up prompt.'),

('fp_promise_failure',
 'Promise Delivery Failure',
 'Promise tracker items rated Stalled or Broken clustering in a policy domain.',
 'accountability',
 'SELECT category, COUNT(*) as cnt FROM posts WHERE type=''promise'' AND status IN (''stalled'',''broken'') GROUP BY category HAVING cnt >= 2',
 0.3, 0.6,
 'Surface in Leadership Check. Cross-reference with election cycle data.'),

('fp_engagement_decline',
 'Civic Engagement Decline',
 'Discussion activity dropping month-over-month. Community withdrawal signal.',
 'engagement',
 'SELECT ''current'' as period, COUNT(*) as cnt FROM posts WHERE type=''discuss'' AND created_at > datetime(''now'', ''-30 days'') UNION ALL SELECT ''previous'', COUNT(*) FROM posts WHERE type=''discuss'' AND created_at BETWEEN datetime(''now'', ''-60 days'') AND datetime(''now'', ''-30 days'')',
 0.2, 0.4,
 'Review discussion categories for emerging concerns. Check for seasonal patterns.'),

('fp_crisis_signal',
 'Emerging Crisis',
 'Sudden spike in needs within a single category. Potential community crisis.',
 'crisis',
 'SELECT category, COUNT(*) as cnt, COUNT(*) * 1.0 / (SELECT MAX(1, COUNT(*)) FROM posts WHERE type=''need'' AND created_at > datetime(''now'', ''-90 days'')) as ratio FROM posts WHERE type=''need'' AND created_at > datetime(''now'', ''-7 days'') GROUP BY category HAVING cnt >= 5',
 0.4, 0.7,
 'Activate crisis resources. Surface relevant survival guides. Alert community leaders.'),

('fp_evaluation_decline',
 'Official Performance Decline',
 'Evaluation scores declining for officials across multiple dimensions.',
 'accountability',
 'SELECT category as official, AVG(votes) as avg_score, COUNT(*) as eval_count FROM posts WHERE type=''rating'' AND created_at > datetime(''now'', ''-90 days'') GROUP BY category HAVING eval_count >= 5 AND avg_score < 2.0',
 0.3, 0.5,
 'Surface in Leadership Check with historical comparison.'),

('fp_resource_gap',
 'Resource-Need Mismatch', 
 'Offers exist but don''t match the categories where needs concentrate.',
 'safety_net',
 'SELECT n.category, n.cnt as needs, COALESCE(o.cnt, 0) as offers, n.cnt - COALESCE(o.cnt, 0) as gap FROM (SELECT category, COUNT(*) as cnt FROM posts WHERE type=''need'' AND status=''active'' GROUP BY category) n LEFT JOIN (SELECT category, COUNT(*) as cnt FROM posts WHERE type=''offer'' AND status=''active'' GROUP BY category) o ON n.category = o.category WHERE n.cnt > COALESCE(o.cnt, 0) + 3',
 0.3, 0.6,
 'Highlight gap categories in needs page. Prompt community for targeted offers.');

-- ═══ Federation — Cross-community diagnostic sharing ═══
CREATE TABLE IF NOT EXISTS federation_members (
  community TEXT PRIMARY KEY,
  joined_at TEXT DEFAULT (datetime('now')),
  sharing_level TEXT DEFAULT 'aggregate',  -- aggregate (scores only), detailed (failpoints), full (actions)
  last_shared TEXT,
  active INTEGER DEFAULT 1
);
