import XCTest
import Intercom
@testable import IntercomMessengerPlugin

final class ArgumentsTests: XCTestCase {
    func testLoginTakesAUserIdAnEmailOrBoth() throws {
        let both = try Arguments.login(["userId": "u1", "email": "a@example.com"])
        XCTAssertEqual(both.userId, "u1")
        XCTAssertEqual(both.email, "a@example.com")
        XCTAssertEqual(try Arguments.login(["email": "a@example.com"]).email, "a@example.com")
        XCTAssertNil(try Arguments.login(["email": "a@example.com"]).userId)
        XCTAssertThrowsError(try Arguments.login([:]))
        XCTAssertThrowsError(try Arguments.login(["userId": ""]))
    }

    func testMapsTheUserAttributes() throws {
        let attributes = try Arguments.userAttributes([
            "userId": "u1",
            "email": "a@example.com",
            "name": "Ann",
            "phone": "+1 555 0100",
            "languageOverride": "fr",
            "signedUpAt": 1_700_000_000,
            "unsubscribedFromEmails": true,
            "customAttributes": ["region": "EU", "beta": true, "score": 1.5, "seats": 12, "cleared": NSNull()]
        ])
        XCTAssertEqual(attributes.userId, "u1")
        XCTAssertEqual(attributes.email, "a@example.com")
        XCTAssertEqual(attributes.name, "Ann")
        XCTAssertEqual(attributes.phone, "+1 555 0100")
        XCTAssertEqual(attributes.languageOverride, "fr")
        XCTAssertEqual(attributes.signedUpAt, Date(timeIntervalSince1970: 1_700_000_000))
        XCTAssertEqual(unsubscribedFromEmailsSent(attributes), NSNumber(value: true))
        let custom = try XCTUnwrap(attributes.customAttributes)
        XCTAssertEqual(custom["region"] as? String, "EU")
        XCTAssertEqual(custom["beta"] as? Bool, true)
        XCTAssertEqual(custom["score"] as? Double, 1.5)
        XCTAssertEqual(custom["seats"] as? Int, 12)
        XCTAssertTrue(custom["cleared"] is NSNull)
    }

    /// The value the SDK keeps for unsubscribedFromEmails. Its setter stores an NSNumber in an ivar of its own, apart from the BOOL
    /// the getter reads, so that a field nobody set is not sent; the getter therefore answers NO even after a set. The ivar is read
    /// through the runtime, which answers nil rather than crashing should a later SDK rename it.
    private func unsubscribedFromEmailsSent(_ attributes: ICMUserAttributes) -> NSNumber? {
        guard let ivar = class_getInstanceVariable(ICMUserAttributes.self, "_unsubscribedFromEmailObject") else {
            XCTFail("ICMUserAttributes has no _unsubscribedFromEmailObject in this SDK version")
            return nil
        }
        return object_getIvar(attributes, ivar) as? NSNumber
    }

    func testLeavesOutTheFieldsThatWereNotPassed() throws {
        let attributes = try Arguments.userAttributes(["name": "Ann"])
        XCTAssertEqual(attributes.name, "Ann")
        XCTAssertNil(attributes.email)
        XCTAssertNil(attributes.userId)
        XCTAssertNil(attributes.customAttributes)
        XCTAssertNil(attributes.companies)
        XCTAssertNil(unsubscribedFromEmailsSent(attributes))
    }

    func testMapsTheCompany() throws {
        let attributes = try Arguments.userAttributes([
            "company": ["companyId": "c1", "name": "Acme", "plan": "pro", "monthlySpend": 10, "createdAt": 1_600_000_000,
                        "customAttributes": ["seats": 3]]
        ])
        let company = try XCTUnwrap(attributes.companies?.first)
        XCTAssertEqual(company.companyId, "c1")
        XCTAssertEqual(company.name, "Acme")
        XCTAssertEqual(company.plan, "pro")
        XCTAssertEqual(company.monthlySpend, 10)
        XCTAssertEqual(company.createdAt, Date(timeIntervalSince1970: 1_600_000_000))
        XCTAssertEqual(company.customAttributes?["seats"] as? Int, 3)
        XCTAssertThrowsError(try Arguments.userAttributes(["company": ["name": "no id"]]))
    }

    func testRefusesACustomAttributeIntercomCannotStore() {
        XCTAssertThrowsError(try Arguments.userAttributes(["customAttributes": ["nested": ["a": 1]]])) { error in
            XCTAssertEqual(error as? InvalidArgument,
                           InvalidArgument("customAttributes.nested must be a string, a number, a boolean or null"))
        }
        XCTAssertThrowsError(try Arguments.userAttributes(["customAttributes": ["list": [1, 2]]]))
        XCTAssertThrowsError(try Arguments.userAttributes(["customAttributes": ["nan": Double.nan]]))
        XCTAssertThrowsError(try Arguments.userAttributes(["customAttributes": "not an object"]))
    }

    func testTellsBooleansFromNumbers() throws {
        XCTAssertTrue(try Arguments.requiredBool(["visible": true], "visible"))
        XCTAssertFalse(try Arguments.requiredBool(["visible": false], "visible"))
        XCTAssertThrowsError(try Arguments.requiredBool(["visible": 1], "visible"))
        XCTAssertThrowsError(try Arguments.requiredBool([:], "visible"))
    }

    func testMapsTheSpaces() throws {
        XCTAssertNil(try Arguments.space(nil))
        XCTAssertEqual(try Arguments.space("home"), .home)
        XCTAssertEqual(try Arguments.space("messages"), .messages)
        XCTAssertEqual(try Arguments.space("helpCenter"), .helpCenter)
        XCTAssertEqual(try Arguments.space("tickets"), .tickets)
        XCTAssertThrowsError(try Arguments.space("news"))
    }

    func testMapsTheContent() throws {
        func describe(_ options: [String: Any]) throws -> String {
            return String(describing: try Arguments.content(options))
        }
        XCTAssertEqual(try describe(["type": "article", "id": "1"]), String(describing: Intercom.Content.article(id: "1")))
        XCTAssertEqual(try describe(["type": "carousel", "id": "2"]), String(describing: Intercom.Content.carousel(id: "2")))
        XCTAssertEqual(try describe(["type": "survey", "id": "3"]), String(describing: Intercom.Content.survey(id: "3")))
        XCTAssertEqual(try describe(["type": "conversation", "id": "4"]),
                       String(describing: Intercom.Content.conversation(id: "4")))
        XCTAssertEqual(try describe(["type": "ticket", "id": "5"]), String(describing: Intercom.Content.ticket(id: "5")))
        XCTAssertEqual(try describe(["type": "helpCenterCollections", "ids": ["a", "b"]]),
                       String(describing: Intercom.Content.helpCenterCollections(ids: ["a", "b"])))
        XCTAssertThrowsError(try Arguments.content(["type": "article"]))
        XCTAssertThrowsError(try Arguments.content(["type": "helpCenterCollections", "ids": []]))
        XCTAssertThrowsError(try Arguments.content(["type": "news", "id": "1"]))
    }

    func testTakesTheBottomPaddingInPoints() throws {
        XCTAssertEqual(try Arguments.bottomPadding(["value": 48]), 48)
        XCTAssertEqual(try Arguments.bottomPadding(["value": 12.5]), 12.5)
        XCTAssertThrowsError(try Arguments.bottomPadding(["value": -1]))
        XCTAssertThrowsError(try Arguments.bottomPadding(["value": "48"]))
        XCTAssertThrowsError(try Arguments.bottomPadding([:]))
    }

    func testPassesThePushPayloadOn() throws {
        let data = try Arguments.pushData(["data": ["intercom_push_type": "notification", "conversation_id": "1"]])
        XCTAssertEqual(data["intercom_push_type"] as? String, "notification")
        XCTAssertThrowsError(try Arguments.pushData([:]))
    }
}
