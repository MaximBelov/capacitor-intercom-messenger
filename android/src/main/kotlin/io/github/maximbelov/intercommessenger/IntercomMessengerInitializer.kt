package io.github.maximbelov.intercommessenger

import android.app.Application
import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import android.util.Log
import io.intercom.android.sdk.Intercom

/**
 * Sets the Intercom SDK up when the app process starts, before any activity, from the keys in `capacitor.config.json`.
 *
 * Intercom asks to be initialised from `Application.onCreate`. Its own `IntercomInitializeContentProvider` only prepares a later
 * initialisation (it tracks the activities from process start); the keys still have to come from somewhere. A process the system
 * starts for a push (no activity, so no Capacitor bridge and no plugin) would otherwise have no initialised SDK to show Intercom's
 * notification or open its conversation. A content provider is created before `Application.onCreate` returns, which is the
 * earliest a library can run without the app adding code. Without the keys in the config it does nothing, and `loadWithKeys`
 * sets Intercom up later.
 */
class IntercomMessengerInitializer : ContentProvider() {
    override fun onCreate(): Boolean {
        val context = context ?: return true
        try {
            val json = context.assets.open(CONFIG_ASSET).bufferedReader().use { it.readText() }
            val keys = Keys.fromConfigJson(json) ?: return true
            if (Setup.shared.apply(keys) == Setup.Outcome.CONFIGURE) {
                Intercom.initialize(context.applicationContext as Application, keys.apiKey, keys.appId)
            }
        } catch (error: Exception) {
            // A missing or unreadable config only means the plugin sets Intercom up later; the app must start regardless.
            Log.w(TAG, "Intercom was not set up at process start: ${error.message}")
        }
        return true
    }

    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, args: Array<out String>?, sort: String?): Cursor? =
        null

    override fun getType(uri: Uri): String? = null

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null

    override fun delete(uri: Uri, selection: String?, args: Array<out String>?): Int = 0

    override fun update(uri: Uri, values: ContentValues?, selection: String?, args: Array<out String>?): Int = 0

    private companion object {
        const val TAG = "IntercomMessenger"
        const val CONFIG_ASSET = "capacitor.config.json"
    }
}
