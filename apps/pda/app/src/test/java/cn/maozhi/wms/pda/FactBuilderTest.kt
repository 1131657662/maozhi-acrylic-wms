package cn.maozhi.wms.pda

import cn.maozhi.wms.pda.data.CatalogItem
import cn.maozhi.wms.pda.scan.FactBuilder
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class FactBuilderTest {
    @Test fun differentWeightsRemainIndependent() {
        val first = FactBuilder.create("DEMO-001", CatalogItem("DEMO-A", "ACR-032", 302500, 1), "device")
        val second = FactBuilder.create("DEMO-001", CatalogItem("DEMO-B", "ACR-032", 297500, 1), "device")
        assertEquals(302500, JSONObject(first.payload).getLong("weightGrams"))
        assertEquals(297500, JSONObject(second.payload).getLong("weightGrams"))
        assertNotEquals(first.id, second.id)
    }
    @Test(expected = IllegalArgumentException::class) fun missingWeightIsRejected() {
        FactBuilder.create("DEMO-001", CatalogItem("DEMO-A", "ACR-032", 0, 1), "device")
    }
    @Test(expected = IllegalArgumentException::class) fun unsupportedPrecisionIsRejected() {
        FactBuilder.create("DEMO-001", CatalogItem("DEMO-A", "ACR-032", 302501, 1), "device")
    }
}
