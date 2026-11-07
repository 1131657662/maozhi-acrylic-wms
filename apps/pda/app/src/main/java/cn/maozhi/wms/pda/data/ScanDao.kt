package cn.maozhi.wms.pda.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction

@Dao
interface ScanDao {
    @Query("SELECT * FROM facts WHERE planId = :planId ORDER BY rowid")
    suspend fun facts(planId: String): List<ScanFact>
    @Query("SELECT * FROM facts WHERE state IN ('pending','failed') ORDER BY rowid")
    suspend fun pending(): List<ScanFact>
    @Query("SELECT * FROM facts WHERE barcode = :barcode LIMIT 1")
    suspend fun findBarcode(barcode: String): ScanFact?
    @Insert suspend fun insertFact(fact: ScanFact)
    @Query("UPDATE facts SET state = :state, error = :error WHERE id = :id")
    suspend fun updateState(id: String, state: String, error: String)
    @Query("SELECT * FROM plans ORDER BY id") suspend fun plans(): List<CachedPlan>
    @Query("SELECT * FROM plans WHERE id = :id") suspend fun plan(id: String): CachedPlan?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun savePlan(plan: CachedPlan)
    @Query("SELECT * FROM catalog WHERE barcode = :barcode") suspend fun catalogItem(barcode: String): CatalogItem?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun saveCatalog(items: List<CatalogItem>)
    @Query("SELECT * FROM submissions WHERE planId = :id") suspend fun submission(id: String): PendingSubmission?
    @Insert suspend fun saveSubmission(submission: PendingSubmission)
    @Query("DELETE FROM submissions WHERE planId = :id") suspend fun removeSubmission(id: String)
    @Transaction
    suspend fun acknowledge(id: String, plan: CachedPlan) {
        updateState(id, "synced", "")
        savePlan(plan)
    }
}
