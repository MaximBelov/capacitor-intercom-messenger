package io.github.maximbelov.intercommessenger

import android.app.Application
import android.os.Handler
import android.os.Looper
import com.getcapacitor.JSObject
import com.getcapacitor.Logger
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import io.intercom.android.sdk.Intercom
import io.intercom.android.sdk.IntercomContent
import io.intercom.android.sdk.IntercomError
import io.intercom.android.sdk.IntercomSpace
import io.intercom.android.sdk.IntercomStatusCallback
import io.intercom.android.sdk.UnreadConversationCountListener

@CapacitorPlugin(name = "IntercomMessenger")
class IntercomMessengerPlugin : Plugin() {

    // Shared with IntercomMessengerInitializer, which may have set the SDK up already when the process started.
    private val setup = Setup.shared
    private val mainHandler by lazy { Handler(Looper.getMainLooper()) }
    private var unreadCountListener: UnreadConversationCountListener? = null

    private val application: Application
        get() = context.applicationContext as Application

    override fun load() {
        val keys = Keys.fromConfig { key -> config.getString(key) } ?: return
        when (setup.apply(keys)) {
            Setup.Outcome.CONFIGURE -> configure(keys)
            // Set up at process start from the same config: only the plugin's own listener is missing.
            Setup.Outcome.UNCHANGED -> listenForUnreadCount()
            Setup.Outcome.CONFLICT -> Logger.warn(TAG, "Intercom is already set up with other keys than the ones in capacitor.config")
        }
    }

    @PluginMethod
    fun loadWithKeys(call: PluginCall) = handle(call, needsSetUp = false) { options ->
        val keys = Keys(apiKey = Arguments.requiredString(options, "apiKey"), appId = Arguments.requiredString(options, "appId"))
        when (setup.apply(keys)) {
            Setup.Outcome.CONFIGURE -> onMain {
                configure(keys)
                call.resolve()
            }
            Setup.Outcome.UNCHANGED -> onMain {
                listenForUnreadCount()
                call.resolve()
            }
            Setup.Outcome.CONFLICT ->
                call.reject("Intercom is already set up with other keys. It is set up once per app process.", "ALREADY_SET_UP")
        }
    }

    @PluginMethod
    fun loginUser(call: PluginCall) = handle(call) { options ->
        val registration = Arguments.login(options)
        onMain { Intercom.client().loginIdentifiedUser(registration, settle(call)) }
    }

    @PluginMethod
    fun loginUnidentifiedUser(call: PluginCall) = handle(call) {
        onMain { Intercom.client().loginUnidentifiedUser(settle(call)) }
    }

    @PluginMethod
    fun updateUser(call: PluginCall) = handle(call) { options ->
        val attributes = Arguments.userAttributes(options)
        onMain { Intercom.client().updateUser(attributes, settle(call)) }
    }

    @PluginMethod
    fun setUserHash(call: PluginCall) = handle(call) { options ->
        val hmac = Arguments.requiredString(options, "hmac")
        Intercom.client().setUserHash(hmac)
        call.resolve()
    }

    @PluginMethod
    fun setUserJwt(call: PluginCall) = handle(call) { options ->
        val jwt = Arguments.requiredString(options, "jwt")
        Intercom.client().setUserJwt(jwt)
        call.resolve()
    }

    @PluginMethod
    fun logout(call: PluginCall) = handle(call) {
        onMain {
            Intercom.client().logout()
            call.resolve()
        }
    }

    @PluginMethod
    fun present(call: PluginCall) = handle(call) { options ->
        val space = Arguments.space(options.opt("space"))
        onMain {
            if (space == null) Intercom.client().present() else Intercom.client().present(space)
            call.resolve()
        }
    }

    @PluginMethod
    fun presentMessageComposer(call: PluginCall) = handle(call) { options ->
        val message = options.opt("message") as? String
        onMain {
            if (message == null) Intercom.client().displayMessageComposer() else Intercom.client().displayMessageComposer(message)
            call.resolve()
        }
    }

    @PluginMethod
    fun presentArticle(call: PluginCall) = handle(call) { options ->
        val articleId = Arguments.requiredString(options, "articleId")
        onMain {
            Intercom.client().presentContent(IntercomContent.Article(articleId))
            call.resolve()
        }
    }

    @PluginMethod
    fun presentHelpCenter(call: PluginCall) = handle(call) {
        onMain {
            Intercom.client().present(IntercomSpace.HelpCenter)
            call.resolve()
        }
    }

    @PluginMethod
    fun presentContent(call: PluginCall) = handle(call) { options ->
        val content = Arguments.content(options)
        onMain {
            Intercom.client().presentContent(content)
            call.resolve()
        }
    }

    @PluginMethod
    fun hide(call: PluginCall) = handle(call) {
        onMain {
            Intercom.client().hideIntercom()
            call.resolve()
        }
    }

    @PluginMethod
    fun setLauncherVisible(call: PluginCall) = handle(call) { options ->
        val visible = Arguments.requiredBoolean(options, "visible")
        onMain {
            Intercom.client().setLauncherVisibility(if (visible) Intercom.VISIBLE else Intercom.GONE)
            call.resolve()
        }
    }

    @PluginMethod
    fun setInAppMessagesVisible(call: PluginCall) = handle(call) { options ->
        val visible = Arguments.requiredBoolean(options, "visible")
        onMain {
            Intercom.client().setInAppMessageVisibility(if (visible) Intercom.VISIBLE else Intercom.GONE)
            call.resolve()
        }
    }

    @PluginMethod
    fun setBottomPadding(call: PluginCall) = handle(call) { options ->
        val pixels = Arguments.bottomPaddingPixels(options, context.resources.displayMetrics.density)
        onMain {
            Intercom.client().setBottomPadding(pixels)
            call.resolve()
        }
    }

    @PluginMethod
    fun logEvent(call: PluginCall) = handle(call) { options ->
        val name = Arguments.requiredString(options, "name")
        val data = Arguments.eventMetadata(options.opt("data"))
        if (data == null) Intercom.client().logEvent(name) else Intercom.client().logEvent(name, data)
        call.resolve()
    }

    @PluginMethod
    fun getUnreadConversationCount(call: PluginCall) {
        // 0 until Intercom is set up, as on the other platforms.
        val count = if (setup.isSetUp) Intercom.client().unreadConversationCount else 0
        call.resolve(JSObject().put("count", count))
    }

    @PluginMethod
    fun sendPushTokenToIntercom(call: PluginCall) = handle(call) { options ->
        IntercomMessengerPush.sendTokenToIntercom(application, Arguments.requiredString(options, "value"))
        call.resolve()
    }

    @PluginMethod
    fun isIntercomPush(call: PluginCall) = handle(call, needsSetUp = false) { options ->
        val data = Arguments.pushData(options)
        call.resolve(JSObject().put("value", IntercomMessengerPush.isIntercomPush(data)))
    }

    @PluginMethod
    fun handlePush(call: PluginCall) = handle(call) { options ->
        val data = Arguments.pushData(options)
        if (IntercomMessengerPush.handlePush(application, data)) {
            call.resolve()
        } else {
            call.reject("The payload is not an Intercom push.", "NOT_INTERCOM_PUSH")
        }
    }

    private fun configure(keys: Keys) {
        Intercom.initialize(application, keys.apiKey, keys.appId)
        listenForUnreadCount()
    }

    // The SDK calls this whenever the unread count changes. Registered once, after the SDK is set up.
    private fun listenForUnreadCount() {
        if (unreadCountListener != null) return
        val listener = UnreadConversationCountListener { count -> notifyListeners(UNREAD_COUNT_EVENT, unreadCountEvent(count)) }
        unreadCountListener = listener
        Intercom.client().addUnreadConversationCountListener(listener)
    }

    /** Reads the options, refuses the call before setup when it needs Intercom, and turns an InvalidArgument into a rejection. */
    private inline fun handle(call: PluginCall, needsSetUp: Boolean = true, body: (JSObject) -> Unit) {
        if (needsSetUp && !setup.isSetUp) {
            call.reject(Setup.NOT_SET_UP_MESSAGE, "NOT_SET_UP")
            return
        }
        try {
            body(call.data)
        } catch (error: InvalidArgument) {
            call.reject(error.message, "INVALID_ARGUMENT")
        } catch (error: Exception) {
            Logger.error(TAG, "IntercomMessenger.${call.methodName} failed", error)
            call.reject(error.message ?: error.toString(), "INTERCOM_ERROR", error)
        }
    }

    /** Capacitor calls plugin methods on a thread of its own; the SDK draws UI, so those calls go to the main thread. */
    private fun onMain(work: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) work() else mainHandler.post(work)
    }

    private fun settle(call: PluginCall) = object : IntercomStatusCallback {
        override fun onSuccess() = call.resolve()

        override fun onFailure(intercomError: IntercomError) =
            call.reject(intercomError.errorMessage, "INTERCOM_ERROR", null, JSObject().put("intercomCode", intercomError.errorCode))
    }

    companion object {
        private const val TAG = "IntercomMessenger"
        const val UNREAD_COUNT_EVENT = "unreadConversationCountChange"

        fun unreadCountEvent(count: Int): JSObject = JSObject().put("count", count)
    }
}
