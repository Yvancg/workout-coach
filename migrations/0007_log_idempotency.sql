ALTER TABLE workout_logs ADD COLUMN client_log_id TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_logs_owner_client_log
ON workout_logs(owner_id, client_log_id)
WHERE client_log_id <> '';
