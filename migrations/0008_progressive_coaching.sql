ALTER TABLE workout_logs ADD COLUMN actual_load_kg REAL NOT NULL DEFAULT 0;
ALTER TABLE workout_logs ADD COLUMN effort_rpe INTEGER NOT NULL DEFAULT 0;
ALTER TABLE session_history ADD COLUMN readiness INTEGER NOT NULL DEFAULT 3;

CREATE INDEX IF NOT EXISTS idx_workout_logs_owner_exercise_timestamp
ON workout_logs(owner_id, exercise, timestamp DESC);
