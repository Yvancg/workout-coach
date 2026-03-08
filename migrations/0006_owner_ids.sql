ALTER TABLE workout_logs ADD COLUMN owner_id TEXT NOT NULL DEFAULT '';
ALTER TABLE session_history ADD COLUMN owner_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_workout_logs_owner_id_date ON workout_logs(owner_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_workout_logs_owner_id_session ON workout_logs(owner_id, session_id);
CREATE INDEX IF NOT EXISTS idx_session_history_owner_id_date ON session_history(owner_id, date DESC, session_id DESC);
