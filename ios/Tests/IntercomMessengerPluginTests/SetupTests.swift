import XCTest
@testable import IntercomMessengerPlugin

final class SetupTests: XCTestCase {
    func testKeysFromConfigNeedBothValues() {
        XCTAssertEqual(Keys.fromConfig(apiKey: "ios_sdk-1", appId: "abc"), Keys(apiKey: "ios_sdk-1", appId: "abc"))
        XCTAssertNil(Keys.fromConfig(apiKey: nil, appId: "abc"))
        XCTAssertNil(Keys.fromConfig(apiKey: "ios_sdk-1", appId: nil))
        XCTAssertNil(Keys.fromConfig(apiKey: "", appId: "abc"))
        XCTAssertNil(Keys.fromConfig(apiKey: "ios_sdk-1", appId: ""))
    }

    func testSetsUpOnceAcceptsTheSameKeysAndRefusesOthers() {
        let setup = Setup()
        let keys = Keys(apiKey: "ios_sdk-1", appId: "abc")
        XCTAssertFalse(setup.isSetUp)
        XCTAssertEqual(setup.apply(keys), .configure)
        XCTAssertTrue(setup.isSetUp)
        XCTAssertEqual(setup.apply(keys), .unchanged)
        XCTAssertEqual(setup.apply(Keys(apiKey: "ios_sdk-2", appId: "abc")), .conflict)
        XCTAssertEqual(setup.apply(Keys(apiKey: "ios_sdk-1", appId: "other")), .conflict)
    }

    func testKeepsATokenThatArrivesBeforeSetupAndSendsItOnce() {
        var sent: [Data] = []
        let relay = DeviceTokenRelay { sent.append($0) }
        let early = Data([1, 2])
        relay.receive(early)
        XCTAssertEqual(sent, [])
        relay.setUp()
        XCTAssertEqual(sent, [early])
        relay.setUp()
        XCTAssertEqual(sent, [early])
    }

    func testSendsATokenStraightAwayAfterSetup() {
        var sent: [Data] = []
        let relay = DeviceTokenRelay { sent.append($0) }
        relay.setUp()
        XCTAssertEqual(sent, [])
        let token = Data([3, 4])
        relay.receive(token)
        XCTAssertEqual(sent, [token])
    }

    func testOnlyTheLatestEarlyTokenIsSent() {
        var sent: [Data] = []
        let relay = DeviceTokenRelay { sent.append($0) }
        relay.receive(Data([1]))
        relay.receive(Data([2]))
        relay.setUp()
        XCTAssertEqual(sent, [Data([2])])
    }
}
