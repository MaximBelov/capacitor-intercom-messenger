import Foundation
import Capacitor
import Intercom

/// Turns the notifications the Intercom SDK and Capacitor post into what the plugin reports: the unread count and the window
/// events go to JavaScript, the APNs token goes to Intercom. The closures stand in for the SDK and the bridge, so tests can post the
/// notifications on their own center and check what comes out.
public final class NotificationWiring {
    public static let unreadConversationCountChange = "unreadConversationCountChange"
    public static let windowDidShow = "windowDidShow"
    public static let windowDidHide = "windowDidHide"

    private let center: NotificationCenter
    private let unreadCount: () -> Int
    private let emit: (String, [String: Any]) -> Void
    private let deviceToken: (Data) -> Void
    private var observers: [NSObjectProtocol] = []

    public init(
        center: NotificationCenter,
        unreadCount: @escaping () -> Int,
        emit: @escaping (String, [String: Any]) -> Void,
        deviceToken: @escaping (Data) -> Void
    ) {
        self.center = center
        self.unreadCount = unreadCount
        self.emit = emit
        self.deviceToken = deviceToken
    }

    deinit {
        stop()
    }

    public func start() {
        guard observers.isEmpty else { return }
        // Swift imports these NSString constants as Notification.Name members already, because their names end in "Notification":
        // IntercomUnreadConversationCountDidChangeNotification is .IntercomUnreadConversationCountDidChange.
        observe(.IntercomUnreadConversationCountDidChange) { [unowned self] _ in
            self.emit(Self.unreadConversationCountChange, ["count": self.unreadCount()])
        }
        observe(.IntercomWindowDidShow) { [unowned self] _ in
            self.emit(Self.windowDidShow, [:])
        }
        observe(.IntercomWindowDidHide) { [unowned self] _ in
            self.emit(Self.windowDidHide, [:])
        }
        // Posted by the app's AppDelegate from application(_:didRegisterForRemoteNotificationsWithDeviceToken:), as Capacitor's
        // push plugins ask it to.
        observe(.capacitorDidRegisterForRemoteNotifications) { [unowned self] notification in
            if let token = notification.object as? Data {
                self.deviceToken(token)
            }
        }
    }

    public func stop() {
        for observer in observers {
            center.removeObserver(observer)
        }
        observers.removeAll()
    }

    private func observe(_ name: Notification.Name, using block: @escaping (Notification) -> Void) {
        // No queue: the block runs on the thread that posts, and notifyListeners may be called from any thread.
        observers.append(center.addObserver(forName: name, object: nil, queue: nil, using: block))
    }
}
