package cn.maozhi.wms.pda.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "catalog_versions_local")
data class LocalCatalogVersion(@PrimaryKey val version: Int, val entryCount: Int, val sha: String, val verified: Boolean)
@Entity(tableName = "catalog_entries_local", primaryKeys = ["version", "barcode"])
data class LocalCatalogEntry(val version: Int, val barcode: String, val sourceSpec: String?, val weightGrams: Long, val legacyProduct: String?)
@Entity(tableName = "catalog_head_local")
data class LocalCatalogHead(@PrimaryKey val id: Int = 1, val version: Int)
@Entity(tableName = "fact_context_local")
data class LocalFactContext(@PrimaryKey val factId: String, val json: String)
@Entity(tableName = "handoff_local")
data class LocalHandoff(@PrimaryKey val id: Int = 1, val header: String, val records: String, val registered: Boolean)
