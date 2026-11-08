package cn.maozhi.wms.pda.data

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

object CatalogMigration : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("CREATE TABLE IF NOT EXISTS catalog_versions_local (version INTEGER NOT NULL PRIMARY KEY, entryCount INTEGER NOT NULL, sha TEXT NOT NULL, verified INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS catalog_entries_local (version INTEGER NOT NULL, barcode TEXT NOT NULL, sourceSpec TEXT, weightGrams INTEGER NOT NULL, legacyProduct TEXT, PRIMARY KEY(version,barcode))")
        db.execSQL("CREATE TABLE IF NOT EXISTS catalog_head_local (id INTEGER NOT NULL PRIMARY KEY, version INTEGER NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS fact_context_local (factId TEXT NOT NULL PRIMARY KEY, json TEXT NOT NULL)")
        db.execSQL("CREATE TABLE IF NOT EXISTS handoff_local (id INTEGER NOT NULL PRIMARY KEY, header TEXT NOT NULL, records TEXT NOT NULL, registered INTEGER NOT NULL)")
        db.execSQL("INSERT INTO catalog_entries_local SELECT catalogVersion,barcode,NULL,weightGrams,productCode FROM catalog")
        db.execSQL("INSERT INTO catalog_versions_local SELECT catalogVersion,COUNT(*),'',0 FROM catalog GROUP BY catalogVersion")
        db.execSQL("INSERT INTO catalog_head_local SELECT 1,version FROM catalog_versions_local ORDER BY version LIMIT 1")
    }
}
