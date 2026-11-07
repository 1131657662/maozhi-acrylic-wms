package cn.maozhi.wms.pda.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [ScanFact::class, CachedPlan::class, CatalogItem::class, PendingSubmission::class], version = 1)
abstract class AppStore : RoomDatabase() {
    abstract fun dao(): ScanDao
    companion object {
        @Volatile private var instance: AppStore? = null
        fun get(context: Context): AppStore = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(context.applicationContext, AppStore::class.java, "maozhi-scan.db")
                .build().also { instance = it }
        }
    }
}
