CREATE TABLE IF NOT EXISTS results (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  room        TEXT NOT NULL,
  source      TEXT NOT NULL,   -- 'mtr' or 'observer'
  status      TEXT NOT NULL,   -- PASS / WARN / FAIL / LIVE / NO_FEED ...
  message     TEXT,
  details     TEXT,            -- JSON
  received_at TEXT NOT NULL    -- ISO 8601 UTC
);
CREATE INDEX IF NOT EXISTS idx_results_received ON results (received_at);
