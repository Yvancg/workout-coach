CREATE TABLE IF NOT EXISTS workout_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  date TEXT NOT NULL,
  program TEXT NOT NULL,
  day_type TEXT NOT NULL,
  exercise TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  target INTEGER NOT NULL,
  completed INTEGER NOT NULL,
  is_time INTEGER NOT NULL DEFAULT 0,
  weight_guide TEXT NOT NULL,
  tempo TEXT NOT NULL,
  rest_seconds INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workout_logs_session_id ON workout_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_timestamp ON workout_logs(timestamp DESC);

CREATE TABLE IF NOT EXISTS session_history (
  session_id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  program TEXT NOT NULL,
  day_type TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  sets_completed INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session_history_date ON session_history(date DESC, session_id DESC);
