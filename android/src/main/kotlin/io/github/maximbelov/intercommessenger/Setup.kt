package io.github.maximbelov.intercommessenger

import org.json.JSONException
import org.json.JSONObject

/** The keys Intercom is set up with on Android. */
data class Keys(val apiKey: String, val appId: String) {
    companion object {
        /**
         * The keys from `capacitor.config`, read through [read] (the plugin's config getter), or null when either is missing or
         * empty, in which case the app sets Intercom up later with `loadWithKeys`.
         */
        fun fromConfig(read: (String) -> String?): Keys? {
            val apiKey = read("androidApiKey")
            val appId = read("androidAppId")
            if (apiKey.isNullOrEmpty() || appId.isNullOrEmpty()) return null
            return Keys(apiKey, appId)
        }

        /**
         * The keys from the text of `capacitor.config.json` as `cap sync` copies it into the app's assets, for the early set-up
         * that runs before Capacitor has read it. Null when the file has no `plugins.IntercomMessenger` with both keys.
         */
        fun fromConfigJson(json: String): Keys? {
            val plugin = try {
                JSONObject(json).optJSONObject("plugins")?.optJSONObject(CONFIG_NAME)
            } catch (error: JSONException) {
                null
            } ?: return null
            return fromConfig { key -> plugin.optString(key, "").takeIf { it.isNotEmpty() } }
        }

        const val CONFIG_NAME = "IntercomMessenger"
    }
}

/**
 * Intercom is set up once per process: `Intercom.initialize` ignores a second call. This remembers with which keys, so a second
 * call with the same keys can resolve and one with other keys can be refused instead of being ignored in silence.
 */
class Setup {
    enum class Outcome {
        /** First keys: set the SDK up with them. */
        CONFIGURE,

        /** The keys it is already set up with: nothing to do. */
        UNCHANGED,

        /** Other keys than the ones it is set up with. */
        CONFLICT,
    }

    @Volatile
    private var keys: Keys? = null

    val isSetUp: Boolean
        get() = keys != null

    @Synchronized
    fun apply(newKeys: Keys): Outcome {
        val current = keys
        if (current == null) {
            keys = newKeys
            return Outcome.CONFIGURE
        }
        return if (current == newKeys) Outcome.UNCHANGED else Outcome.CONFLICT
    }

    companion object {
        /**
         * The one set-up of the process: the early set-up in [IntercomMessengerInitializer] and the plugin share it, so the SDK is
         * initialised once whichever runs first.
         */
        val shared = Setup()

        const val NOT_SET_UP_MESSAGE =
            "Intercom is not set up: add androidApiKey and androidAppId to plugins.IntercomMessenger in capacitor.config, " +
                "or call loadWithKeys first."
    }
}
