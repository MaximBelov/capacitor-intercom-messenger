package io.github.maximbelov.intercommessenger

import io.intercom.android.sdk.Company
import io.intercom.android.sdk.IntercomContent
import io.intercom.android.sdk.IntercomSpace
import io.intercom.android.sdk.UserAttributes
import io.intercom.android.sdk.identity.Registration
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

// The options are built from JSON text, as the bridge builds them from what JavaScript sent.
private fun options(json: String) = JSONObject(json)

class ArgumentsTest {
    @Test
    fun logsInByUserIdEmailOrBoth() {
        assertEquals(
            Registration.create().withUserId("u1").withEmail("a@example.com"),
            Arguments.login(options("""{"userId":"u1","email":"a@example.com"}""")),
        )
        assertEquals(Registration.create().withEmail("a@example.com"), Arguments.login(options("""{"email":"a@example.com"}""")))
        assertThrows(InvalidArgument::class.java) { Arguments.login(options("{}")) }
        assertThrows(InvalidArgument::class.java) { Arguments.login(options("""{"userId":""}""")) }
    }

    @Test
    fun mapsTheUserAttributes() {
        val mapped = Arguments.userAttributes(
            options(
                """{"userId":"u1","email":"a@example.com","name":"Ann","phone":"+1 555 0100","languageOverride":"fr",
                "signedUpAt":1700000000,"unsubscribedFromEmails":true,
                "customAttributes":{"region":"EU","beta":true,"score":1.5,"seats":12,"cleared":null}}""",
            ),
        )
        val expected = UserAttributes.Builder()
            .withUserId("u1")
            .withEmail("a@example.com")
            .withName("Ann")
            .withPhone("+1 555 0100")
            .withLanguageOverride("fr")
            .withSignedUpAt(1700000000L)
            .withUnsubscribedFromEmails(true)
            .withCustomAttributes(mapOf("region" to "EU", "beta" to true, "score" to 1.5, "seats" to 12, "cleared" to null))
            .build()
        assertEquals(expected, mapped)
        @Suppress("UNCHECKED_CAST")
        val custom = mapped.toMap()["custom_attributes"] as Map<String, Any?>
        assertTrue(custom.containsKey("cleared"))
        assertNull(custom["cleared"])
    }

    @Test
    fun leavesOutTheFieldsThatWereNotPassed() {
        val mapped = Arguments.userAttributes(options("""{"name":"Ann"}"""))
        assertEquals(UserAttributes.Builder().withName("Ann").build(), mapped)
        assertFalse(mapped.toMap().containsKey("email"))
    }

    @Test
    fun mapsTheCompany() {
        val mapped = Arguments.userAttributes(
            options(
                """{"company":{"companyId":"c1","name":"Acme","plan":"pro","monthlySpend":10,"createdAt":1600000000,
                "customAttributes":{"seats":3}}}""",
            ),
        )
        val company = Company.Builder()
            .withCompanyId("c1")
            .withName("Acme")
            .withPlan("pro")
            .withMonthlySpend(10)
            .withCreatedAt(1600000000L)
            .withCustomAttributes(mapOf("seats" to 3))
            .build()
        assertEquals(UserAttributes.Builder().withCompany(company).build(), mapped)
        assertThrows(InvalidArgument::class.java) { Arguments.userAttributes(options("""{"company":{"name":"no id"}}""")) }
    }

    @Test
    fun refusesACustomAttributeIntercomCannotStore() {
        val error = assertThrows(InvalidArgument::class.java) {
            Arguments.userAttributes(options("""{"customAttributes":{"nested":{"a":1}}}"""))
        }
        assertEquals("customAttributes.nested must be a string, a number, a boolean or null", error.message)
        assertThrows(InvalidArgument::class.java) { Arguments.userAttributes(options("""{"customAttributes":{"list":[1,2]}}""")) }
        assertThrows(InvalidArgument::class.java) { Arguments.userAttributes(options("""{"customAttributes":"text"}""")) }
    }

    @Test
    fun convertsTheEventMetadataInFull() {
        val data = Arguments.eventMetadata(JSONObject("""{"price":3,"link":{"url":"https://example.com","value":"Docs"},"tags":["a",null]}"""))
        assertEquals(mapOf("price" to 3, "link" to mapOf("url" to "https://example.com", "value" to "Docs"), "tags" to listOf("a", null)), data)
        assertNull(Arguments.eventMetadata(null))
        assertNull(Arguments.eventMetadata(JSONObject.NULL))
    }

    @Test
    fun readsBooleansOnly() {
        assertTrue(Arguments.requiredBoolean(options("""{"visible":true}"""), "visible"))
        assertFalse(Arguments.requiredBoolean(options("""{"visible":false}"""), "visible"))
        assertThrows(InvalidArgument::class.java) { Arguments.requiredBoolean(options("""{"visible":1}"""), "visible") }
        assertThrows(InvalidArgument::class.java) { Arguments.requiredBoolean(options("{}"), "visible") }
    }

    @Test
    fun mapsTheSpaces() {
        assertNull(Arguments.space(null))
        assertEquals(IntercomSpace.Home, Arguments.space("home"))
        assertEquals(IntercomSpace.Messages, Arguments.space("messages"))
        assertEquals(IntercomSpace.HelpCenter, Arguments.space("helpCenter"))
        assertEquals(IntercomSpace.Tickets, Arguments.space("tickets"))
        assertThrows(InvalidArgument::class.java) { Arguments.space("news") }
    }

    @Test
    fun mapsTheContent() {
        assertEquals(IntercomContent.Article("1"), Arguments.content(options("""{"type":"article","id":"1"}""")))
        assertEquals(IntercomContent.Carousel("2"), Arguments.content(options("""{"type":"carousel","id":"2"}""")))
        assertEquals(IntercomContent.Survey("3"), Arguments.content(options("""{"type":"survey","id":"3"}""")))
        assertEquals(IntercomContent.Conversation("4"), Arguments.content(options("""{"type":"conversation","id":"4"}""")))
        assertEquals(IntercomContent.Ticket("5"), Arguments.content(options("""{"type":"ticket","id":"5"}""")))
        assertEquals(
            IntercomContent.HelpCenterCollections(listOf("a", "b")),
            Arguments.content(options("""{"type":"helpCenterCollections","ids":["a","b"]}""")),
        )
        assertThrows(InvalidArgument::class.java) { Arguments.content(options("""{"type":"article"}""")) }
        assertThrows(InvalidArgument::class.java) { Arguments.content(options("""{"type":"helpCenterCollections","ids":[]}""")) }
        assertThrows(InvalidArgument::class.java) { Arguments.content(options("""{"type":"news","id":"1"}""")) }
    }

    @Test
    fun turnsTheBottomPaddingIntoPixels() {
        assertEquals(144, Arguments.bottomPaddingPixels(options("""{"value":48}"""), 3f))
        assertEquals(19, Arguments.bottomPaddingPixels(options("""{"value":12.5}"""), 1.5f))
        assertEquals(0, Arguments.bottomPaddingPixels(options("""{"value":0}"""), 2f))
        assertThrows(InvalidArgument::class.java) { Arguments.bottomPaddingPixels(options("""{"value":-1}"""), 2f) }
        assertThrows(InvalidArgument::class.java) { Arguments.bottomPaddingPixels(options("""{"value":"48"}"""), 2f) }
    }

    @Test
    fun turnsThePushPayloadIntoStrings() {
        val data = Arguments.pushData(options("""{"data":{"receiver":"intercom_sdk","conversation_id":123,"priority":1,"gone":null}}"""))
        assertEquals(mapOf("receiver" to "intercom_sdk", "conversation_id" to "123", "priority" to "1"), data)
        assertThrows(InvalidArgument::class.java) { Arguments.pushData(options("{}")) }
    }

    @Test
    fun requiresNonEmptyStrings() {
        assertEquals("x", Arguments.requiredString(options("""{"name":"x"}"""), "name"))
        assertThrows(InvalidArgument::class.java) { Arguments.requiredString(options("""{"name":""}"""), "name") }
        assertThrows(InvalidArgument::class.java) { Arguments.requiredString(options("""{"name":1}"""), "name") }
        assertThrows(InvalidArgument::class.java) { Arguments.requiredString(JSONObject().put("ids", JSONArray()), "name") }
    }
}
