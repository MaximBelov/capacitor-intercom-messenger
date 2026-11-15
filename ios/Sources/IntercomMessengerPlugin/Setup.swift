import Foundation

/// The keys Intercom is set up with on iOS.
public struct Keys: Equatable {
    public let apiKey: String
    public let appId: String

    /// The keys from `capacitor.config`, or nil when either is missing or empty, in which case the app sets Intercom up later
    /// with `loadWithKeys`.
    public static func fromConfig(apiKey: String?, appId: String?) -> Keys? {
        guard let apiKey = apiKey, !apiKey.isEmpty, let appId = appId, !appId.isEmpty else {
            return nil
        }
        return Keys(apiKey: apiKey, appId: appId)
    }
}

/// Intercom is set up once per process. This remembers with which keys, so that a second call with the same keys can resolve and
/// one with other keys can be refused, instead of silently switching workspaces under a logged-in user.
public final class Setup {
    public enum Outcome: Equatable {
        /// First keys: set the SDK up with them.
        case configure
        /// The keys it is already set up with: nothing to do.
        case unchanged
        /// Other keys than the ones it is set up with.
        case conflict
    }

    public static let notSetUpMessage =
        "Intercom is not set up: add iosApiKey and iosAppId to plugins.IntercomMessenger in capacitor.config, or call loadWithKeys first."

    private let lock = NSLock()
    private var keys: Keys?

    public init() {}

    public var isSetUp: Bool {
        lock.lock()
        defer { lock.unlock() }
        return keys != nil
    }

    public func apply(_ newKeys: Keys) -> Outcome {
        lock.lock()
        defer { lock.unlock() }
        guard let current = keys else {
            keys = newKeys
            return .configure
        }
        return current == newKeys ? .unchanged : .conflict
    }
}

/// The APNs token Capacitor posts can arrive before Intercom is set up (a token cached from an earlier launch comes early). It is
/// kept until then and handed over once, and every later token goes straight through.
public final class DeviceTokenRelay {
    private let lock = NSLock()
    private let send: (Data) -> Void
    private var isSetUp = false
    private var pending: Data?

    public init(send: @escaping (Data) -> Void) {
        self.send = send
    }

    public func receive(_ token: Data) {
        lock.lock()
        guard isSetUp else {
            pending = token
            lock.unlock()
            return
        }
        lock.unlock()
        send(token)
    }

    public func setUp() {
        lock.lock()
        isSetUp = true
        let token = pending
        pending = nil
        lock.unlock()
        if let token = token {
            send(token)
        }
    }
}
