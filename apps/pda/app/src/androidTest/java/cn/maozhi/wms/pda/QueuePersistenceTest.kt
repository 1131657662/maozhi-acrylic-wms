package cn.maozhi.wms.pda

import androidx.room.Room
import androidx.test.platform.app.InstrumentationRegistry
import cn.maozhi.wms.pda.data.AppStore
import cn.maozhi.wms.pda.data.CatalogItem
import cn.maozhi.wms.pda.scan.FactBuilder
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.UUID

class QueuePersistenceTest {
    @Test fun queuedPayloadSurvivesDatabaseReopen(): Unit = runBlocking {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val name = "test-${UUID.randomUUID()}.db"
        val fact = FactBuilder.create("DEMO-001", CatalogItem("DEMO-A", "ACR-032", 302500, 1), "test-device")
        val first = Room.databaseBuilder(context, AppStore::class.java, name).build()
        first.dao().insertFact(fact)
        first.close()
        val second = Room.databaseBuilder(context, AppStore::class.java, name).build()
        assertEquals(fact, second.dao().pending().single())
        second.close()
        context.deleteDatabase(name)
    }
}
