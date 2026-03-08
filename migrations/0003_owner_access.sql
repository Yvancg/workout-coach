ALTER TABLE workout_logs ADD COLUMN owner_email TEXT NOT NULL DEFAULT '';
ALTER TABLE session_history ADD COLUMN owner_email TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_workout_logs_owner_date ON workout_logs(owner_email, date DESC);
CREATE INDEX IF NOT EXISTS idx_workout_logs_owner_session ON workout_logs(owner_email, session_id);
CREATE INDEX IF NOT EXISTS idx_session_history_owner_date ON session_history(owner_email, date DESC, session_id DESC);
