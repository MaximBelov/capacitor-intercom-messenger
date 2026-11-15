package io.github.maximbelov.intercommessenger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SetupTest {
    @Test
    fun readsTheAndroidKeysFromTheConfig() {
        val config = mapOf("androidApiKey" to "android_sdk-1", "androidAppId" to "abc", "iosApiKey" to "ios_sdk-1")
        assertEquals(Keys("android_sdk-1", "abc"), Keys.fromConfig { config[it] })
    }

    @Test
    fun needsBothKeysInTheConfig() {
        assertNull(Keys.fromConfig { if (it == "androidAppId") "abc" else null })
        assertNull(Keys.fromConfig { if (it == "androidApiKey") "android_sdk-1" else null })
        assertNull(Keys.fromConfig { "" })
        assertNull(Keys.fromConfig { null })
    }

    @Test
    fun setsUpOnceAcceptsTheSameKeysAndRefusesOthers() {
        val setup = Setup()
        val keys = Keys("android_sdk-1", "abc")
        assertFalse(setup.isSetUp)
        assertEquals(Setup.Outcome.CONFIGURE, setup.apply(keys))
        assertTrue(setup.isSetUp)
        assertEquals(Setup.Outcome.UNCHANGED, setup.apply(keys.copy()))
        assertEquals(Setup.Outcome.CONFLICT, setup.apply(Keys("android_sdk-2", "abc")))
        assertEquals(Setup.Outcome.CONFLICT, setup.apply(Keys("android_sdk-1", "other")))
    }

    @Test
    fun readsTheKeysFromTheSyncedConfigFileForTheEarlySetUp() {
        val json = """{"appId":"com.example","plugins":{"IntercomMessenger":{"androidApiKey":"android_sdk-1","androidAppId":"abc",
            "iosApiKey":"ios_sdk-1"},"SplashScreen":{}}}"""
        assertEquals(Keys("android_sdk-1", "abc"), Keys.fromConfigJson(json))
    }

    @Test
    fun skipsTheEarlySetUpWithoutBothKeys() {
        assertNull(Keys.fromConfigJson("""{"plugins":{"IntercomMessenger":{"androidApiKey":"android_sdk-1"}}}"""))
        assertNull(Keys.fromConfigJson("""{"plugins":{"IntercomMessenger":{"androidApiKey":"","androidAppId":"abc"}}}"""))
        assertNull(Keys.fromConfigJson("""{"plugins":{}}"""))
        assertNull(Keys.fromConfigJson("""{"appId":"com.example"}"""))
        assertNull(Keys.fromConfigJson("not json"))
    }
}
