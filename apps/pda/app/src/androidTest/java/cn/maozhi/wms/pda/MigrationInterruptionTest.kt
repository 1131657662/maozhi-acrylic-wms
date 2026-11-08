package cn.maozhi.wms.pda

import android.util.Log
import androidx.room.Room
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.test.platform.app.InstrumentationRegistry
import cn.maozhi.wms.pda.data.AppStore
import cn.maozhi.wms.pda.data.CatalogMigration
import kotlinx.coroutines.runBlocking
import org.junit.Test

class MigrationInterruptionTest {
    @Test fun pauseBeforeCommit(): Unit = runBlocking {
        val ctx = InstrumentationRegistry.getInstrumentation().targetContext
        check(ctx.packageName in listOf("cn.maozhi.wms.pda.b1c2test.debug", "cn.maozhi.wms.pda.b1c2recovery.debug")) { "Only isolated validation package" }
        val migration = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                CatalogMigration.migrate(db)
                Log.i("B1C2", "MIGRATION_WRITES_DONE_BEFORE_COMMIT")
                // Host forcibly kills this isolated process while Room's upgrade transaction is open.
                Thread.sleep(60000)
                error("Host did not interrupt migration within the evidence window")
            }
        }
        val db = Room.databaseBuilder(ctx, AppStore::class.java, "maozhi-scan.db").addMigrations(migration).build()
        try { db.dao().allFacts() } finally { db.close() }
    }
}
