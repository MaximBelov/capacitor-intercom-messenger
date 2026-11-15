package io.github.maximbelov.intercommessenger

import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

// The JavaScript reaches the plugin by the name in @CapacitorPlugin and each method by its name; a rename on either side fails
// only at run time on a phone, so it is pinned here. The list itself is compared with src/definitions.ts by the parity test.
class IntercomMessengerPluginTest {
    @Test
    fun isRegisteredUnderTheNameTheJavaScriptUses() {
        val annotation = IntercomMessengerPlugin::class.java.getAnnotation(CapacitorPlugin::class.java)
        assertNotNull(annotation)
        assertEquals("IntercomMessenger", annotation!!.name)
    }

    @Test
    fun everyPluginMethodTakesACallAndReturnsNothing() {
        val methods = IntercomMessengerPlugin::class.java.declaredMethods.filter { it.isAnnotationPresent(PluginMethod::class.java) }
        assertEquals(21, methods.size)
        for (method in methods) {
            assertEquals(method.name, listOf(PluginCall::class.java), method.parameterTypes.toList())
            assertEquals(method.name, Void.TYPE, method.returnType)
        }
    }

    @Test
    fun theUnreadCountEventCarriesTheCount() {
        assertEquals("unreadConversationCountChange", IntercomMessengerPlugin.UNREAD_COUNT_EVENT)
        assertEquals(4, IntercomMessengerPlugin.unreadCountEvent(4).getInt("count"))
    }
}
