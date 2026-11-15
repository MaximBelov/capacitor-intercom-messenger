import XCTest
import Capacitor
@testable import IntercomMessengerPlugin

// The JavaScript reaches the plugin by jsName and each method by its name; a rename on either side fails only at run time on a
// phone, so it is pinned here. The list itself is compared with src/definitions.ts by test/unit/platform-parity.test.mjs.
final class IntercomMessengerPluginTests: XCTestCase {
    func testIsRegisteredUnderTheNameTheJavaScriptUses() {
        XCTAssertEqual(IntercomMessengerPlugin().jsName, "IntercomMessenger")
    }

    func testEveryMethodIsAPromiseMethod() {
        let methods = IntercomMessengerPlugin().pluginMethods
        XCTAssertEqual(methods.count, 21)
        XCTAssertTrue(methods.allSatisfy { $0.returnType == CAPPluginReturnPromise })
    }

    func testEveryMethodNameHasAnObjectiveCSelector() {
        // Capacitor calls a method through the selector "<name>:"; a missing @objc compiles fine and fails on the phone.
        for method in IntercomMessengerPlugin().pluginMethods {
            XCTAssertTrue(IntercomMessengerPlugin().responds(to: NSSelectorFromString("\(method.name!):")), method.name!)
        }
    }
}
