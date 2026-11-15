import XCTest
import Capacitor
import Intercom
@testable import IntercomMessengerPlugin

// The notifications are posted on a private center, as the SDK and Capacitor post them on the default one, and the closures stand
// in for the SDK's count, the bridge and Intercom.setDeviceToken.
final class NotificationWiringTests: XCTestCase {
    private var center: NotificationCenter!
    private var emitted: [(String, [String: Any])]!
    private var tokens: [Data]!
    private var count = 0
    private var wiring: NotificationWiring!

    override func setUp() {
        super.setUp()
        center = NotificationCenter()
        emitted = []
        tokens = []
        count = 0
        wiring = NotificationWiring(
            center: center,
            unreadCount: { [unowned self] in self.count },
            emit: { [unowned self] event, data in self.emitted.append((event, data)) },
            deviceToken: { [unowned self] token in self.tokens.append(token) }
        )
        wiring.start()
    }

    override func tearDown() {
        wiring.stop()
        wiring = nil
        super.tearDown()
    }

    func testReportsTheUnreadCountWhenIntercomSaysItChanged() {
        count = 3
        center.post(name: .IntercomUnreadConversationCountDidChange, object: nil)
        XCTAssertEqual(emitted.count, 1)
        XCTAssertEqual(emitted[0].0, "unreadConversationCountChange")
        XCTAssertEqual(emitted[0].1["count"] as? Int, 3)

        count = 0
        center.post(name: .IntercomUnreadConversationCountDidChange, object: nil)
        XCTAssertEqual(emitted.last?.1["count"] as? Int, 0)
    }

    func testReportsTheMessengerWindowShowingAndHiding() {
        center.post(name: .IntercomWindowDidShow, object: nil)
        center.post(name: .IntercomWindowDidHide, object: nil)
        XCTAssertEqual(emitted.map { $0.0 }, ["windowDidShow", "windowDidHide"])
    }

    func testHandsTheAPNsTokenCapacitorPostsOn() {
        let token = Data([0xAB, 0xCD])
        center.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
        center.post(name: .capacitorDidRegisterForRemoteNotifications, object: "not a token")
        XCTAssertEqual(tokens, [token])
        XCTAssertTrue(emitted.isEmpty)
    }

    func testStartingTwiceObservesOnce() {
        wiring.start()
        center.post(name: .IntercomUnreadConversationCountDidChange, object: nil)
        XCTAssertEqual(emitted.count, 1)
    }

    func testStopsListening() {
        wiring.stop()
        center.post(name: .IntercomUnreadConversationCountDidChange, object: nil)
        center.post(name: .capacitorDidRegisterForRemoteNotifications, object: Data([1]))
        XCTAssertTrue(emitted.isEmpty)
        XCTAssertTrue(tokens.isEmpty)
    }
}
