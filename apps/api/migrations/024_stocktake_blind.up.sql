ALTER TABLE stocktakes
 ADD COLUMN mode VARCHAR(8) NOT NULL DEFAULT 'open',
 ADD COLUMN revealed_at DATETIME(3) NULL,
 ADD CONSTRAINT stocktake_mode CHECK(mode IN ('open','blind')),
 ADD CONSTRAINT stocktake_reveal_mode CHECK(revealed_at IS NULL OR mode='blind');
