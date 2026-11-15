package io.github.maximbelov.intercommessenger

import android.app.Application
import android.content.Context
import io.intercom.android.sdk.push.IntercomPushClient

/**
 * For an app that has its own `FirebaseMessagingService`. Android delivers FCM to one service only, and Intercom's own runs at a
 * low priority, so such an app hands Intercom's messages and every new token on from native code. That also covers a message
 * that arrives while the app is in the background, which a JavaScript `handlePush()` cannot see:
 *
 * ```kotlin
 * override fun onMessageReceived(message: RemoteMessage) {
 *     if (IntercomMessengerPush.isIntercomPush(message.data)) {
 *         IntercomMessengerPush.handlePush(this, message.data)
 *     } else {
 *         // the app's own pushes
 *     }
 * }
 *
 * override fun onNewToken(token: String) {
 *     IntercomMessengerPush.sendTokenToIntercom(this, token)
 * }
 * ```
 *
 * It takes the message's `data` map rather than the `RemoteMessage`, so the plugin needs no dependency on Firebase itself.
 */
object IntercomMessengerPush {
    private val client by lazy { IntercomPushClient() }

    @JvmStatic
    fun isIntercomPush(data: Map<String, String>): Boolean = client.isIntercomPush(data)

    /** Shows the push, when it is Intercom's and Intercom is set up. Returns whether it did. */
    @JvmStatic
    fun handlePush(context: Context, data: Map<String, String>): Boolean {
        if (!Setup.shared.isSetUp || !client.isIntercomPush(data)) return false
        client.handlePush(context.applicationContext as Application, data)
        return true
    }

    /** Sends the token, when Intercom is set up. Returns whether it did. */
    @JvmStatic
    fun sendTokenToIntercom(context: Context, token: String): Boolean {
        if (!Setup.shared.isSetUp || token.isEmpty()) return false
        client.sendTokenToIntercom(context.applicationContext as Application, token)
        return true
    }
}
