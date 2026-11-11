package cn.maozhi.wms.pda.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction

@Dao
interface ScanDao {
    @Query("SELECT * FROM facts ORDER BY id") suspend fun allFacts(): List<ScanFact>
    @Query("SELECT * FROM fact_context_local WHERE factId=:id") suspend fun context(id: String): LocalFactContext?
    @Insert suspend fun insertContext(context: LocalFactContext)
    @Query("SELECT v.* FROM catalog_versions_local v JOIN catalog_head_local h ON h.version=v.version WHERE h.id=1")
    suspend fun currentCatalog(): LocalCatalogVersion?
    @Query("SELECT * FROM catalog_entries_local WHERE version=:version AND barcode=:barcode")
    suspend fun versionEntry(version: Int, barcode: String): LocalCatalogEntry?
    @Query("SELECT * FROM catalog_versions_local WHERE version=:version") suspend fun version(version: Int): LocalCatalogVersion?
    @Query("DELETE FROM catalog_entries_local WHERE version=:version") suspend fun removeUnverifiedEntries(version: Int)
    @Insert suspend fun insertEntries(entries: List<LocalCatalogEntry>)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun saveVersion(version: LocalCatalogVersion)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun saveHead(head: LocalCatalogHead)
    @Query("SELECT * FROM handoff_local WHERE id=1") suspend fun handoff(): LocalHandoff?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun saveHandoff(handoff: LocalHandoff)
    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insertHandoffOnce(handoff: LocalHandoff): Long
    @Transaction suspend fun firstHandoff(candidate: LocalHandoff): LocalHandoff {
        insertHandoffOnce(candidate)
        return handoff() ?: error("交接清单未持久化")
    }
    @Transaction suspend fun activate(version: LocalCatalogVersion, entries: List<LocalCatalogEntry>) {
        val old = version(version.version)
        if (old?.verified == true) require(old.sha == version.sha) { "历史目录摘要改变，拒绝切换" }
        else {
            removeUnverifiedEntries(version.version)
            insertEntries(entries)
            saveVersion(version)
        }
        saveHead(LocalCatalogHead(version = version.version))
    }
    @Transaction suspend fun persist(fact: ScanFact, context: LocalFactContext?) {
        insertFact(fact)
        if (context != null) insertContext(context)
    }
    @Transaction suspend fun sealContext(context: LocalFactContext) {
        val old = context(context.factId)
        if (old == null) insertContext(context) else require(old.json == context.json) { "已保存的扫码记录信息不能修改" }
    }
    @Query("SELECT * FROM facts WHERE planId = :planId ORDER BY rowid")
    suspend fun facts(planId: String): List<ScanFact>
    @Query("SELECT * FROM facts WHERE state IN ('pending','failed') ORDER BY rowid")
    suspend fun pending(): List<ScanFact>
    @Query("SELECT * FROM facts WHERE barcode = :barcode LIMIT 1")
    suspend fun findBarcode(barcode: String): ScanFact?
    @Insert suspend fun insertFact(fact: ScanFact)
    @Query("UPDATE facts SET state = :state, error = :error WHERE id = :id")
    suspend fun updateState(id: String, state: String, error: String)
    @Query("UPDATE facts SET error=:notice WHERE id=:id AND state='synced'") suspend fun notice(id: String, notice: String)
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
