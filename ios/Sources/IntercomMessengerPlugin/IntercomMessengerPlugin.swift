import Foundation
import Capacitor
import Intercom

@objc(IntercomMessengerPlugin)
public class IntercomMessengerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "IntercomMessengerPlugin"
    public let jsName = "IntercomMessenger"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "loadWithKeys", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "loginUser", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "loginUnidentifiedUser", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateUser", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setUserHash", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setUserJwt", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logout", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "present", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentMessageComposer", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentArticle", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentHelpCenter", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "presentContent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setLauncherVisible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setInAppMessagesVisible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setBottomPadding", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "logEvent", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getUnreadConversationCount", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isUserLoggedIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "sendPushTokenToIntercom", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isIntercomPush", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "handlePush", returnType: CAPPluginReturnPromise)
    ]

    private let setup = Setup()
    private let deviceTokens = DeviceTokenRelay { token in
        // On the main thread whoever posted the token: the SDK expects its calls there.
        DispatchQueue.main.async {
            Intercom.setDeviceToken(token) { result in
                if case .failure(let error) = result {
                    CAPLog.print("IntercomMessenger: Intercom did not take the APNs token: \(error.localizedDescription)")
                }
            }
        }
    }
    private var wiring: NotificationWiring?

    override public func load() {
        let wiring = NotificationWiring(
            center: .default,
            unreadCount: { Int(Intercom.unreadConversationCount()) },
            emit: { [weak self] event, data in self?.notifyListeners(event, data: data) },
            deviceToken: { [weak self] token in self?.deviceTokens.receive(token) }
        )
        wiring.start()
        self.wiring = wiring

        let config = getConfig()
        if let keys = Keys.fromConfig(apiKey: config.getString("iosApiKey"), appId: config.getString("iosAppId")),
           setup.apply(keys) == .configure {
            configure(keys)
        }
    }

    deinit {
        wiring?.stop()
    }

    @objc func loadWithKeys(_ call: CAPPluginCall) {
        run(call, needsSetUp: false) { options in
            let keys = Keys(apiKey: try Arguments.requiredString(options, "apiKey"),
                            appId: try Arguments.requiredString(options, "appId"))
            switch self.setup.apply(keys) {
            case .configure:
                self.onMain {
                    self.configure(keys)
                    call.resolve()
                }
            case .unchanged:
                call.resolve()
            case .conflict:
                call.reject("Intercom is already set up with other keys. It is set up once per app process.", "ALREADY_SET_UP")
            }
        }
    }

    @objc func loginUser(_ call: CAPPluginCall) {
        run(call) { options in
            let attributes = try Arguments.login(options)
            self.onMain {
                Intercom.loginUser(with: attributes) { result in self.settle(call, result) }
            }
        }
    }

    @objc func loginUnidentifiedUser(_ call: CAPPluginCall) {
        run(call) { _ in
            self.onMain {
                Intercom.loginUnidentifiedUser { result in self.settle(call, result) }
            }
        }
    }

    @objc func updateUser(_ call: CAPPluginCall) {
        run(call) { options in
            let attributes = try Arguments.userAttributes(options)
            self.onMain {
                Intercom.updateUser(with: attributes) { result in self.settle(call, result) }
            }
        }
    }

    @objc func setUserHash(_ call: CAPPluginCall) {
        run(call) { options in
            let hmac = try Arguments.requiredString(options, "hmac")
            self.onMain {
                Intercom.setUserHash(hmac)
                call.resolve()
            }
        }
    }

    @objc func setUserJwt(_ call: CAPPluginCall) {
        run(call) { options in
            let jwt = try Arguments.requiredString(options, "jwt")
            self.onMain {
                Intercom.setUserJwt(jwt)
                call.resolve()
            }
        }
    }

    @objc func logout(_ call: CAPPluginCall) {
        run(call) { _ in
            self.onMain {
                Intercom.logout()
                call.resolve()
            }
        }
    }

    @objc func present(_ call: CAPPluginCall) {
        run(call) { options in
            let space = try Arguments.space(options["space"])
            self.onMain {
                if let space = space {
                    Intercom.present(space)
                } else {
                    Intercom.present()
                }
                call.resolve()
            }
        }
    }

    @objc func presentMessageComposer(_ call: CAPPluginCall) {
        run(call) { options in
            let message = options["message"] as? String
            self.onMain {
                Intercom.presentMessageComposer(message)
                call.resolve()
            }
        }
    }

    @objc func presentArticle(_ call: CAPPluginCall) {
        run(call) { options in
            let articleId = try Arguments.requiredString(options, "articleId")
            self.onMain {
                Intercom.presentContent(.article(id: articleId))
                call.resolve()
            }
        }
    }

    @objc func presentHelpCenter(_ call: CAPPluginCall) {
        run(call) { _ in
            self.onMain {
                Intercom.present(.helpCenter)
                call.resolve()
            }
        }
    }

    @objc func presentContent(_ call: CAPPluginCall) {
        run(call) { options in
            let content = try Arguments.content(options)
            self.onMain {
                Intercom.presentContent(content)
                call.resolve()
            }
        }
    }

    @objc func hide(_ call: CAPPluginCall) {
        run(call) { _ in
            self.onMain {
                Intercom.hide()
                call.resolve()
            }
        }
    }

    @objc func setLauncherVisible(_ call: CAPPluginCall) {
        run(call) { options in
            let visible = try Arguments.requiredBool(options, "visible")
            self.onMain {
                Intercom.setLauncherVisible(visible)
                call.resolve()
            }
        }
    }

    @objc func setInAppMessagesVisible(_ call: CAPPluginCall) {
        run(call) { options in
            let visible = try Arguments.requiredBool(options, "visible")
            self.onMain {
                Intercom.setInAppMessagesVisible(visible)
                call.resolve()
            }
        }
    }

    @objc func setBottomPadding(_ call: CAPPluginCall) {
        run(call) { options in
            let padding = try Arguments.bottomPadding(options)
            self.onMain {
                Intercom.setBottomPadding(padding)
                call.resolve()
            }
        }
    }

    @objc func logEvent(_ call: CAPPluginCall) {
        run(call) { options in
            let name = try Arguments.requiredString(options, "name")
            let data = options["data"] as? [String: Any]
            self.onMain {
                if let data = data {
                    Intercom.logEvent(withName: name, metaData: data)
                } else {
                    Intercom.logEvent(withName: name)
                }
                call.resolve()
            }
        }
    }

    @objc func getUnreadConversationCount(_ call: CAPPluginCall) {
        // 0 until Intercom is set up, as on the other platforms.
        let count = setup.isSetUp ? Int(Intercom.unreadConversationCount()) : 0
        call.resolve(["count": count])
    }

    @objc func isUserLoggedIn(_ call: CAPPluginCall) {
        // false until Intercom is set up, as on the other platforms.
        call.resolve(["value": setup.isSetUp && Intercom.isUserLoggedIn()])
    }

    @objc func sendPushTokenToIntercom(_ call: CAPPluginCall) {
        // iOS takes the APNs token from Capacitor's capacitorDidRegisterForRemoteNotifications notification on its own (see
        // NotificationWiring), and an FCM token is no use to Intercom here. Resolving lets the same code run on every platform.
        run(call, needsSetUp: false) { options in
            _ = try Arguments.requiredString(options, "value")
            call.resolve()
        }
    }

    @objc func isIntercomPush(_ call: CAPPluginCall) {
        run(call, needsSetUp: false) { options in
            let data = try Arguments.pushData(options)
            call.resolve(["value": Intercom.isIntercomPushNotification(data)])
        }
    }

    @objc func handlePush(_ call: CAPPluginCall) {
        run(call) { options in
            let data = try Arguments.pushData(options)
            guard Intercom.isIntercomPushNotification(data) else {
                call.reject("The payload is not an Intercom push.", "NOT_INTERCOM_PUSH")
                return
            }
            self.onMain {
                Intercom.handlePushNotification(data)
                call.resolve()
            }
        }
    }

    // MARK: - Helpers

    private func configure(_ keys: Keys) {
        Intercom.setApiKey(keys.apiKey, forAppId: keys.appId)
        deviceTokens.setUp()
    }

    /// Reads the options, refuses the call before setup when it needs Intercom, and turns an InvalidArgument into a rejection.
    private func run(_ call: CAPPluginCall, needsSetUp: Bool = true, _ body: ([String: Any]) throws -> Void) {
        if needsSetUp && !setup.isSetUp {
            call.reject(Setup.notSetUpMessage, "NOT_SET_UP")
            return
        }
        let options = call.options as? [String: Any] ?? [:]
        do {
            try body(options)
        } catch let error as InvalidArgument {
            call.reject(error.message, "INVALID_ARGUMENT")
        } catch {
            call.reject(error.localizedDescription, "INVALID_ARGUMENT", error)
        }
    }

    /// The SDK draws UI and expects its calls on the main thread; Capacitor calls plugin methods on a queue of its own.
    private func onMain(_ work: @escaping () -> Void) {
        if Thread.isMainThread {
            work()
        } else {
            DispatchQueue.main.async(execute: work)
        }
    }

    private func settle(_ call: CAPPluginCall, _ result: Result<Void, Error>) {
        switch result {
        case .success:
            call.resolve()
        case .failure(let error):
            call.reject(error.localizedDescription, "INTERCOM_ERROR", error)
        }
    }
}
