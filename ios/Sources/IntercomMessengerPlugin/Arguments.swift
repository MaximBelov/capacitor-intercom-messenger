import Foundation
import Intercom

/// A call option that is missing or of the wrong kind. The plugin rejects the call with INVALID_ARGUMENT and this message, before
/// anything reaches the SDK.
public struct InvalidArgument: Error, Equatable {
    public let message: String

    public init(_ message: String) {
        self.message = message
    }
}

/// Turns the options of a call, as the bridge hands them over, into what the Intercom SDK takes. No SDK call happens here.
public enum Arguments {
    public static func requiredString(_ options: [String: Any], _ key: String) throws -> String {
        guard let value = options[key] as? String, !value.isEmpty else {
            throw InvalidArgument("\(key) must be a non-empty string")
        }
        return value
    }

    public static func requiredBool(_ options: [String: Any], _ key: String) throws -> Bool {
        guard let number = options[key] as? NSNumber, isBoolean(number) else {
            throw InvalidArgument("\(key) must be true or false")
        }
        return number.boolValue
    }

    /// The attributes for `loginUser`: a user id, an email or both.
    public static func login(_ options: [String: Any]) throws -> ICMUserAttributes {
        let attributes = ICMUserAttributes()
        if let userId = options["userId"] as? String, !userId.isEmpty {
            attributes.userId = userId
        }
        if let email = options["email"] as? String, !email.isEmpty {
            attributes.email = email
        }
        guard attributes.userId != nil || attributes.email != nil else {
            throw InvalidArgument("loginUser needs a userId, an email or both")
        }
        return attributes
    }

    /// The attributes for `updateUser`. Only the fields present in the options are set.
    public static func userAttributes(_ options: [String: Any]) throws -> ICMUserAttributes {
        let attributes = ICMUserAttributes()
        if let value = options["userId"] as? String { attributes.userId = value }
        if let value = options["email"] as? String { attributes.email = value }
        if let value = options["name"] as? String { attributes.name = value }
        if let value = options["phone"] as? String { attributes.phone = value }
        if let value = options["languageOverride"] as? String { attributes.languageOverride = value }
        if let value = options["signedUpAt"] as? NSNumber {
            attributes.signedUpAt = Date(timeIntervalSince1970: value.doubleValue)
        }
        if let value = options["unsubscribedFromEmails"] as? NSNumber {
            attributes.unsubscribedFromEmails = value.boolValue
        }
        if let company = options["company"] {
            attributes.companies = [try self.company(company)]
        }
        if let custom = try customAttributes(options["customAttributes"], path: "customAttributes") {
            attributes.customAttributes = custom
        }
        return attributes
    }

    public static func company(_ value: Any) throws -> ICMCompany {
        guard let options = value as? [String: Any] else {
            throw InvalidArgument("company must be an object")
        }
        let company = ICMCompany()
        guard let companyId = options["companyId"] as? String, !companyId.isEmpty else {
            throw InvalidArgument("company.companyId must be a non-empty string")
        }
        company.companyId = companyId
        if let value = options["name"] as? String { company.name = value }
        if let value = options["plan"] as? String { company.plan = value }
        if let value = options["monthlySpend"] as? NSNumber { company.monthlySpend = value }
        if let value = options["createdAt"] as? NSNumber {
            company.createdAt = Date(timeIntervalSince1970: value.doubleValue)
        }
        if let custom = try customAttributes(options["customAttributes"], path: "company.customAttributes") {
            company.customAttributes = custom
        }
        return company
    }

    /// Checks every value is one the SDK stores as a custom attribute: a string, a finite number, a boolean (an NSNumber too) or
    /// null (NSNull). Nil when the option is absent.
    public static func customAttributes(_ value: Any?, path: String) throws -> [String: Any]? {
        guard let value = value else { return nil }
        guard let dictionary = value as? [String: Any] else {
            throw InvalidArgument("\(path) must be an object")
        }
        for (key, item) in dictionary {
            switch item {
            case is String, is NSNull:
                continue
            case let number as NSNumber where isBoolean(number) || number.doubleValue.isFinite:
                continue
            default:
                throw InvalidArgument("\(path).\(key) must be a string, a number, a boolean or null")
            }
        }
        return dictionary
    }

    /// The Messenger space for `present`, or nil for its home screen.
    public static func space(_ value: Any?) throws -> Space? {
        guard let value = value else { return nil }
        switch value as? String {
        case "home": return .home
        case "messages": return .messages
        case "helpCenter": return .helpCenter
        case "tickets": return .tickets
        default: throw InvalidArgument("space must be one of home, messages, helpCenter, tickets")
        }
    }

    public static func content(_ options: [String: Any]) throws -> Intercom.Content {
        let type = options["type"] as? String
        if type == "helpCenterCollections" {
            guard let ids = options["ids"] as? [String], !ids.isEmpty, !ids.contains(where: { $0.isEmpty }) else {
                throw InvalidArgument("ids must be a non-empty list of collection ids")
            }
            return .helpCenterCollections(ids: ids)
        }
        let known = ["article", "carousel", "survey", "conversation", "ticket"]
        guard let kind = type, known.contains(kind) else {
            throw InvalidArgument("type must be one of article, carousel, survey, conversation, ticket, helpCenterCollections")
        }
        let id = try requiredString(options, "id")
        switch kind {
        case "article": return .article(id: id)
        case "carousel": return .carousel(id: id)
        case "survey": return .survey(id: id)
        case "conversation": return .conversation(id: id)
        default: return .ticket(id: id)
        }
    }

    /// The bottom padding in points, which is what the iOS SDK takes and what a CSS pixel is on iOS.
    public static func bottomPadding(_ options: [String: Any]) throws -> CGFloat {
        guard let number = options["value"] as? NSNumber, !isBoolean(number),
              number.doubleValue.isFinite, number.doubleValue >= 0 else {
            throw InvalidArgument("value must be a number that is not negative")
        }
        return CGFloat(number.doubleValue)
    }

    /// The push payload as the SDK wants it, from the `data` option.
    public static func pushData(_ options: [String: Any]) throws -> [AnyHashable: Any] {
        guard let data = options["data"] as? [String: Any] else {
            throw InvalidArgument("data must be an object")
        }
        return data
    }

    /// JavaScript booleans arrive as NSNumber, and `as? Bool` also accepts 0 and 1, so the type is checked on the CFBoolean.
    static func isBoolean(_ number: NSNumber) -> Bool {
        return CFGetTypeID(number) == CFBooleanGetTypeID()
    }
}
