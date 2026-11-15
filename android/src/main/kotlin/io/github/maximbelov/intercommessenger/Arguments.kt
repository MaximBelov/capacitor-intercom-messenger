package io.github.maximbelov.intercommessenger

import io.intercom.android.sdk.Company
import io.intercom.android.sdk.IntercomContent
import io.intercom.android.sdk.IntercomSpace
import io.intercom.android.sdk.UserAttributes
import io.intercom.android.sdk.identity.Registration
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.roundToInt

/**
 * A call option that is missing or of the wrong kind. The plugin rejects the call with INVALID_ARGUMENT and this message, before
 * anything reaches the SDK.
 */
class InvalidArgument(message: String) : IllegalArgumentException(message)

/** Turns the options of a call, as the bridge hands them over, into what the Intercom SDK takes. No SDK call happens here. */
object Arguments {
    fun requiredString(options: JSONObject, key: String): String {
        val value = options.opt(key)
        if (value !is String || value.isEmpty()) throw InvalidArgument("$key must be a non-empty string")
        return value
    }

    fun requiredBoolean(options: JSONObject, key: String): Boolean =
        options.opt(key) as? Boolean ?: throw InvalidArgument("$key must be true or false")

    private fun optionalString(options: JSONObject, key: String): String? = options.opt(key) as? String

    /** The registration for `loginUser`: a user id, an email or both. */
    fun login(options: JSONObject): Registration {
        val userId = optionalString(options, "userId")?.takeIf { it.isNotEmpty() }
        val email = optionalString(options, "email")?.takeIf { it.isNotEmpty() }
        if (userId == null && email == null) throw InvalidArgument("loginUser needs a userId, an email or both")
        var registration = Registration.create()
        if (userId != null) registration = registration.withUserId(userId)
        if (email != null) registration = registration.withEmail(email)
        return registration
    }

    /** The attributes for `updateUser`. Only the fields present in the options are set. */
    fun userAttributes(options: JSONObject): UserAttributes {
        val builder = UserAttributes.Builder()
        optionalString(options, "userId")?.let { builder.withUserId(it) }
        optionalString(options, "email")?.let { builder.withEmail(it) }
        optionalString(options, "name")?.let { builder.withName(it) }
        optionalString(options, "phone")?.let { builder.withPhone(it) }
        optionalString(options, "languageOverride")?.let { builder.withLanguageOverride(it) }
        (options.opt("signedUpAt") as? Number)?.let { builder.withSignedUpAt(it.toLong()) }
        (options.opt("unsubscribedFromEmails") as? Boolean)?.let { builder.withUnsubscribedFromEmails(it) }
        options.opt("company")?.let { builder.withCompany(company(it)) }
        customAttributes(options.opt("customAttributes"), "customAttributes")?.let { builder.withCustomAttributes(it) }
        return builder.build()
    }

    fun company(value: Any): Company {
        val options = value as? JSONObject ?: throw InvalidArgument("company must be an object")
        val companyId = optionalString(options, "companyId")
        if (companyId.isNullOrEmpty()) throw InvalidArgument("company.companyId must be a non-empty string")
        val builder = Company.Builder().withCompanyId(companyId)
        optionalString(options, "name")?.let { builder.withName(it) }
        optionalString(options, "plan")?.let { builder.withPlan(it) }
        (options.opt("monthlySpend") as? Number)?.let { builder.withMonthlySpend(it.toInt()) }
        (options.opt("createdAt") as? Number)?.let { builder.withCreatedAt(it.toLong()) }
        customAttributes(options.opt("customAttributes"), "company.customAttributes")?.let { builder.withCustomAttributes(it) }
        return builder.build()
    }

    /**
     * Checks every value is one the SDK stores as a custom attribute, a string, a finite number, a boolean or null, and returns
     * them as a map with JSON null turned into Kotlin null. Null when the option is absent.
     */
    fun customAttributes(value: Any?, path: String): Map<String, Any?>? {
        if (value == null) return null
        val attributes = value as? JSONObject ?: throw InvalidArgument("$path must be an object")
        val map = LinkedHashMap<String, Any?>()
        for (key in attributes.keys()) {
            map[key] = when (val item = attributes.opt(key)) {
                JSONObject.NULL, null -> null
                is String, is Boolean, is Int, is Long -> item
                is Number -> item.toDouble().takeIf { it.isFinite() }
                    ?: throw InvalidArgument("$path.$key must be a string, a number, a boolean or null")
                else -> throw InvalidArgument("$path.$key must be a string, a number, a boolean or null")
            }
        }
        return map
    }

    /** The event metadata, converted in full (nested objects and lists included), or null when it is absent. */
    fun eventMetadata(value: Any?): Map<String, Any?>? {
        if (value == null || value == JSONObject.NULL) return null
        val data = value as? JSONObject ?: throw InvalidArgument("data must be an object")
        return toMap(data)
    }

    /** The Messenger space for `present`, or null for its home screen. */
    fun space(value: Any?): IntercomSpace? = when (value) {
        null, JSONObject.NULL -> null
        "home" -> IntercomSpace.Home
        "messages" -> IntercomSpace.Messages
        "helpCenter" -> IntercomSpace.HelpCenter
        "tickets" -> IntercomSpace.Tickets
        else -> throw InvalidArgument("space must be one of home, messages, helpCenter, tickets")
    }

    fun content(options: JSONObject): IntercomContent {
        return when (options.opt("type")) {
            "helpCenterCollections" -> {
                val ids = (options.opt("ids") as? JSONArray)?.let { list -> (0 until list.length()).map { list.opt(it) } }
                if (ids.isNullOrEmpty() || ids.any { it !is String || it.isEmpty() }) {
                    throw InvalidArgument("ids must be a non-empty list of collection ids")
                }
                IntercomContent.HelpCenterCollections(ids.map { it as String })
            }
            "article" -> IntercomContent.Article(requiredString(options, "id"))
            "carousel" -> IntercomContent.Carousel(requiredString(options, "id"))
            "survey" -> IntercomContent.Survey(requiredString(options, "id"))
            "conversation" -> IntercomContent.Conversation(requiredString(options, "id"))
            "ticket" -> IntercomContent.Ticket(requiredString(options, "id"))
            else -> throw InvalidArgument(
                "type must be one of article, carousel, survey, conversation, ticket, helpCenterCollections",
            )
        }
    }

    /**
     * The bottom padding in pixels, which is what the Android SDK takes. The option is in CSS pixels, which are density
     * independent pixels on Android, so it is multiplied by the screen density.
     */
    fun bottomPaddingPixels(options: JSONObject, density: Float): Int {
        val value = (options.opt("value") as? Number)?.toDouble()
        if (value == null || !value.isFinite() || value < 0) throw InvalidArgument("value must be a number that is not negative")
        return (value * density).roundToInt()
    }

    /** The push payload as the SDK wants it: FCM data is string to string, so every value is turned into its string. */
    fun pushData(options: JSONObject): Map<String, String> {
        val data = options.opt("data") as? JSONObject ?: throw InvalidArgument("data must be an object")
        val map = LinkedHashMap<String, String>()
        for (key in data.keys()) {
            val value = data.opt(key)
            if (value != null && value != JSONObject.NULL) map[key] = value.toString()
        }
        return map
    }

    private fun toMap(json: JSONObject): Map<String, Any?> {
        val map = LinkedHashMap<String, Any?>()
        for (key in json.keys()) map[key] = toValue(json.opt(key))
        return map
    }

    private fun toValue(value: Any?): Any? = when (value) {
        null, JSONObject.NULL -> null
        is JSONObject -> toMap(value)
        is JSONArray -> (0 until value.length()).map { toValue(value.opt(it)) }
        else -> value
    }
}
