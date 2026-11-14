ALTER TABLE stocktakes
 DROP CHECK stocktake_reveal_mode,
 DROP CHECK stocktake_mode,
 DROP COLUMN revealed_at,
 DROP COLUMN mode;
