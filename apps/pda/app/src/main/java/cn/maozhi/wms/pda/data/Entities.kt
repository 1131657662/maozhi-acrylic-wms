package cn.maozhi.wms.pda.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "facts", indices = [Index(value = ["barcode"], unique = true), Index("planId")])
data class ScanFact(
    @PrimaryKey val id: String,
    val planId: String,
    val barcode: String,
    val payload: String,
    val state: String = "pending",
    val error: String = "",
)

@Entity(tableName = "plans")
data class CachedPlan(@PrimaryKey val id: String, val json: String)

@Entity(tableName = "catalog")
data class CatalogItem(
    @PrimaryKey val barcode: String,
    val productCode: String,
    val weightGrams: Long,
    val catalogVersion: Int,
)

@Entity(tableName = "submissions")
data class PendingSubmission(@PrimaryKey val planId: String, val key: String, val payload: String)
