package cn.maozhi.wms.pda
import android.os.Bundle
import androidx.test.platform.app.InstrumentationRegistry
object DeviceEvidence {
 fun record(message:String){
  println(message)
  InstrumentationRegistry.getInstrumentation().sendStatus(0,Bundle().apply{putString("stream",System.lineSeparator()+message+System.lineSeparator())})
 }
}
