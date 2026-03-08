ALTER TABLE session_history ADD COLUMN note TEXT NOT NULL DEFAULT '';
ALTER TABLE session_history ADD COLUMN available_weights TEXT NOT NULL DEFAULT '';
ALTER TABLE session_history ADD COLUMN warmup_completed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE session_history ADD COLUMN stretch_completed INTEGER NOT NULL DEFAULT 0;
