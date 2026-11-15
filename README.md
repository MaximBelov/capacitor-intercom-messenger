# capacitor-intercom-messenger

The [Intercom](https://www.intercom.com) Messenger in a Capacitor app, on iOS, Android and the web.

- **One API on all three platforms.** The same calls log a user in, open the Messenger and count unread conversations on a phone
  and in a browser. Where a platform cannot do something, the table below says what the call does there instead.
- **Current Intercom SDKs.** iOS SDK 19.11.0 (from the `intercom-ios-sp` Swift package, or the `Intercom` pod),
  Android SDK 18.13.0 (`io.intercom.android:intercom-sdk`), and the official
  [`@intercom/messenger-js-sdk`](https://www.npmjs.com/package/@intercom/messenger-js-sdk) on the web.
- **The unread conversation count as a value and an event.** `getUnreadConversationCount()` reads it, and
  `unreadConversationCountChange` reports every change, from each SDK's own notification. Nothing polls.

## Install

```bash
npm install capacitor-intercom-messenger
npx cap sync
```

Requires Capacitor 8, iOS 15 or newer and Android 7.0 (API 24) or newer. On iOS the plugin is a Swift package; CocoaPods works too.

### The web part

The web implementation drives the Messenger through `@intercom/messenger-js-sdk`, an optional peer dependency that npm does not
install on its own:

```bash
npm install @intercom/messenger-js-sdk
```

It is loaded with a dynamic `import()` the first time a user logs in on the web, so a native app never runs it. Whether an app
that did not install it still builds depends on the bundler, because it follows every `import()` in the code it bundles. Measured
with this package:

| Bundler                                         | Without the package                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Vite 8.3                                        | builds; the import fails at run time                                                       |
| esbuild 0.28 (which the Angular CLI builds with) | builds with a warning; the import fails at run time                                        |
| webpack 5.112                                   | fails the build: install the package, or alias it to `false` in `resolve.alias`           |

When the import fails at run time, a login on the web rejects with `UNAVAILABLE` and a message naming the package. Every other
call that does not need the Messenger keeps working.

## Set up

Intercom is set up with the API key of the platform and the id of your workspace (Intercom: Settings > Installation). On iOS and
Android the keys can go into `capacitor.config`, under `plugins.IntercomMessenger`, and the plugin sets the SDK up when the app
starts:

<docgen-config>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

Sets up the native Intercom SDKs when the app starts. The web reads no
configuration: call `loadWithKeys()` there.

| Prop                | Type                | Description                                                                               | Since |
| ------------------- | ------------------- | ----------------------------------------------------------------------------------------- | ----- |
| **`iosApiKey`**     | <code>string</code> | The iOS API key of your Intercom workspace (Settings &gt; Installation &gt; iOS).         | 0.1.0 |
| **`iosAppId`**      | <code>string</code> | The id of your Intercom workspace, used on iOS.                                           | 0.1.0 |
| **`androidApiKey`** | <code>string</code> | The Android API key of your Intercom workspace (Settings &gt; Installation &gt; Android). | 0.1.0 |
| **`androidAppId`**  | <code>string</code> | The id of your Intercom workspace, used on Android.                                       | 0.1.0 |

### Examples

In `capacitor.config.json`:

```json
{
  "plugins": {
    "IntercomMessenger": {
      "iosApiKey": "ios_sdk-...",
      "iosAppId": "abc123",
      "androidApiKey": "android_sdk-...",
      "androidAppId": "abc123"
    }
  }
}
```

In `capacitor.config.ts`:

```ts
/// <reference types="capacitor-intercom-messenger" />

import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  plugins: {
    IntercomMessenger: {
      iosApiKey: "ios_sdk-...",
      iosAppId: "abc123",
      androidApiKey: "android_sdk-...",
      androidAppId: "abc123",
    },
  },
};

export default config;
```

</docgen-config>

The web reads no configuration at run time, so a web build calls `loadWithKeys()` first. An app that does not want the keys in its
configuration, or picks the workspace at run time, can do the same on every platform:

```ts
import { Capacitor } from '@capacitor/core';
import { IntercomMessenger } from 'capacitor-intercom-messenger';

const apiKey = { ios: IOS_API_KEY, android: ANDROID_API_KEY }[Capacitor.getPlatform()];
await IntercomMessenger.loadWithKeys({ appId: 'abc123', apiKey, region: 'eu' }); // region is for the web only
```

Intercom is set up once per app process (once per page load on the web): calling `loadWithKeys()` again with the same keys resolves,
and with other keys it rejects with `ALREADY_SET_UP`. Every call that needs Intercom rejects with `NOT_SET_UP` until it is set up.

### iOS: attachments

The Messenger lets users attach photos and videos. Intercom asks for these keys in the app's `Info.plist`, with your own wording:
`NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription` and `NSMicrophoneUsageDescription`. The example app has all three.

## Use

```ts
import { IntercomMessenger } from 'capacitor-intercom-messenger';

// With identity verification on, the hash comes from your server and goes first.
await IntercomMessenger.setUserHash({ hmac });
await IntercomMessenger.loginUser({ userId: '42' });
await IntercomMessenger.updateUser({ name: 'Ann', customAttributes: { plan: 'pro', seats: 3 } });

// The count, now and whenever it changes.
const { count } = await IntercomMessenger.getUnreadConversationCount();
await IntercomMessenger.addListener('unreadConversationCountChange', ({ count }) => showBadge(count));

await IntercomMessenger.present({ space: 'messages' });

// On sign-out
await IntercomMessenger.logout();
```

The event only reports changes, so read the count once at start and again after each login. It is 0 before Intercom is set up and
after `logout()`.

Intercom's own launcher button is hidden until `setLauncherVisible({ visible: true })`, on the web as well (where the Messenger
otherwise shows it by default), so the three platforms start the same way.

## Platforms

Every method exists on every platform. This is what each one does where the platforms differ.

| Method                       | iOS                                                     | Android                                           | Web                                                           |
| ---------------------------- | ------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| `loadWithKeys`               | `Intercom.setApiKey(_:forAppId:)`                       | `Intercom.initialize(application, apiKey, appId)` | remembers `appId` and `region`; `apiKey` is not used          |
| `loginUser`                  | `Intercom.loginUser(with:)`                             | `loginIdentifiedUser`                             | loads the Messenger (first time) and boots it for the user    |
| `loginUnidentifiedUser`      | `Intercom.loginUnidentifiedUser`                        | `loginUnidentifiedUser`                           | boots the Messenger without a user                            |
| `updateUser`                 | `Intercom.updateUser(with:)`                            | `updateUser`                                      | `update`, custom attributes at the top level                  |
| `setUserHash`                | `Intercom.setUserHash`                                  | `setUserHash`                                     | sent as `user_hash` at the next boot                          |
| `setUserJwt`                 | `Intercom.setUserJwt`                                   | `setUserJwt`                                      | sent as `intercom_user_jwt` at the next boot                  |
| `logout`                     | `Intercom.logout`                                       | `logout`                                          | `shutdown`                                                    |
| `present`                    | `Intercom.present(_:)`                                  | `present(IntercomSpace)`                          | `show` / `showSpace`                                          |
| `presentMessageComposer`     | `Intercom.presentMessageComposer`                       | `displayMessageComposer`                          | `showNewMessage`                                              |
| `presentArticle`             | `presentContent(.article)`                              | `presentContent(IntercomContent.Article)`         | `showArticle`                                                 |
| `presentHelpCenter`          | `Intercom.present(.helpCenter)`                         | `present(IntercomSpace.HelpCenter)`               | `showSpace('help')`                                           |
| `presentContent`             | `Intercom.presentContent`, every type                   | `presentContent`, every type                      | article, survey, conversation, ticket; the rest `UNAVAILABLE` |
| `hide`                       | `Intercom.hide`                                         | `hideIntercom`                                    | `hide`                                                        |
| `setLauncherVisible`         | `Intercom.setLauncherVisible`                           | `setLauncherVisibility`                           | `hide_default_launcher`                                       |
| `setInAppMessagesVisible`    | `Intercom.setInAppMessagesVisible`                      | `setInAppMessageVisibility`                       | `hideNotifications`                                           |
| `setBottomPadding`           | `Intercom.setBottomPadding`, in points                  | `setBottomPadding`, converted from dp to pixels   | `vertical_padding` (Intercom's minimum is 20)                 |
| `logEvent`                   | `Intercom.logEvent(withName:metaData:)`                 | `logEvent`                                        | `trackEvent`                                                  |
| `getUnreadConversationCount` | `Intercom.unreadConversationCount()`                    | `getUnreadConversationCount`                      | the count `onUnreadCountChange` last reported                 |
| `sendPushTokenToIntercom`    | resolves, does nothing: iOS takes the APNs token itself | `IntercomPushClient.sendTokenToIntercom`          | resolves, does nothing: no push on the web                    |
| `isIntercomPush`             | `Intercom.isIntercomPushNotification`                   | `IntercomPushClient.isIntercomPush`               | rejects `UNIMPLEMENTED`                                       |
| `handlePush`                 | `Intercom.handlePushNotification`                       | `IntercomPushClient.handlePush`                   | rejects `UNIMPLEMENTED`                                       |

| Event                           | iOS                                                    | Android                                   | Web                   |
| ------------------------------- | ------------------------------------------------------ | ----------------------------------------- | --------------------- |
| `unreadConversationCountChange` | `IntercomUnreadConversationCountDidChangeNotification` | `addUnreadConversationCountListener`      | `onUnreadCountChange` |
| `windowDidShow`                 | `IntercomWindowDidShowNotification`                    | never fires: the SDK has no such callback | `onShow`              |
| `windowDidHide`                 | `IntercomWindowDidHideNotification`                    | never fires: the SDK has no such callback | `onHide`              |

On the web, the calls that need a running Messenger (`updateUser`, `present*`, `logEvent`) reject with `NOT_LOGGED_IN` until
`loginUser()` or `loginUnidentifiedUser()` has booted it. On iOS and Android they are passed to the SDK, which keeps its own rules.

### Errors

| Code                | When                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------- |
| `NOT_SET_UP`        | a call that needs Intercom, before the keys came from the config or `loadWithKeys()`    |
| `ALREADY_SET_UP`    | `loadWithKeys()` with other keys than the ones Intercom is set up with                  |
| `INVALID_ARGUMENT`  | a missing or malformed option, checked before anything reaches the SDK                  |
| `INTERCOM_ERROR`    | the SDK refused a login or an update (iOS, Android); the message is the SDK's           |
| `NOT_INTERCOM_PUSH` | `handlePush()` with a payload that is not from Intercom                                 |
| `NOT_LOGGED_IN`     | web only: a call that needs the Messenger before it has booted                          |
| `UNAVAILABLE`       | web only: `@intercom/messenger-js-sdk` is not installed, or content the web cannot show |
| `UNIMPLEMENTED`     | web only: `isIntercomPush()` and `handlePush()`                                         |

## Push notifications

**iOS.** Intercom needs the APNs device token. The plugin takes it from Capacitor's `capacitorDidRegisterForRemoteNotifications`
notification and passes it to `Intercom.setDeviceToken(_:completion:)`, so there is nothing to call from JavaScript. The app's
`AppDelegate` has to post that notification, which is the same line `@capacitor/push-notifications` and
`@capacitor-firebase/messaging` already ask for:

```swift
func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
}
```

A token that arrives before Intercom is set up is kept and handed over once it is. The Intercom SDK handles a tapped push on its
own; `isIntercomPush()` and `handlePush()` are for an app that has turned that off with `IntercomAutoIntegratePushNotifications`
set to `NO` in its `Info.plist`.

**Android.** Intercom delivers its pushes through Firebase Cloud Messaging. Send it the FCM token after login, and again whenever
the token changes:

```ts
import { FirebaseMessaging } from '@capacitor-firebase/messaging';

const { token } = await FirebaseMessaging.getToken();
await IntercomMessenger.sendPushTokenToIntercom({ value: token });
```

The Intercom SDK brings its own `FirebaseMessagingService`, at a low priority. When the app has a messaging service of its own (a
push plugin usually adds one), only that one receives the messages, so Intercom's pushes have to be handed on from its data
messages:

```ts
if ((await IntercomMessenger.isIntercomPush({ data })).value) {
  await IntercomMessenger.handlePush({ data });
}
```

JavaScript only sees a message while the app is running. An app with its own native `FirebaseMessagingService` hands Intercom's
messages on from there instead, which also covers the ones that arrive in the background, with `IntercomMessengerPush`:

```kotlin
import io.github.maximbelov.intercommessenger.IntercomMessengerPush

override fun onMessageReceived(message: RemoteMessage) {
    if (!IntercomMessengerPush.handlePush(this, message.data)) {
        // not Intercom's: the app's own pushes
    }
}

override fun onNewToken(token: String) {
    IntercomMessengerPush.sendTokenToIntercom(this, token)
}
```

With the Android keys in `capacitor.config`, the plugin sets Intercom up as soon as the process starts, before any activity and
before the Capacitor bridge, from a content provider it adds to the app's manifest. The SDK's own provider already tracks the
activities from that point; this one gives it the keys, so a process the system starts only to deliver a push has an initialised
SDK to show it. Without the keys in the config, Intercom is set up by `loadWithKeys()` instead.

**Web.** The Messenger on the web does not use push. `sendPushTokenToIntercom()` resolves without doing anything, so the same code
runs everywhere, and `isIntercomPush()` and `handlePush()` reject with `UNIMPLEMENTED`.

## Intercom SDK versions

| Platform | SDK                                                        | Version                | Change it                                                        |
| -------- | ---------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| iOS      | `intercom-ios-sp` (Swift package) / `Intercom` (CocoaPods) | from 19.11.0, below 20 | the app's package resolution picks the newest 19.x               |
| Android  | `io.intercom.android:intercom-sdk`                         | 18.13.0                | set `intercomSdkVersion` in the app's `android/variables.gradle` |
| Web      | `@intercom/messenger-js-sdk`                               | 0.0.20 or newer        | the version the app installs                                     |

## API

<docgen-index>

* [`loadWithKeys(...)`](#loadwithkeys)
* [`loginUser(...)`](#loginuser)
* [`loginUnidentifiedUser()`](#loginunidentifieduser)
* [`updateUser(...)`](#updateuser)
* [`setUserHash(...)`](#setuserhash)
* [`setUserJwt(...)`](#setuserjwt)
* [`logout()`](#logout)
* [`present(...)`](#present)
* [`presentMessageComposer(...)`](#presentmessagecomposer)
* [`presentArticle(...)`](#presentarticle)
* [`presentHelpCenter()`](#presenthelpcenter)
* [`presentContent(...)`](#presentcontent)
* [`hide()`](#hide)
* [`setLauncherVisible(...)`](#setlaunchervisible)
* [`setInAppMessagesVisible(...)`](#setinappmessagesvisible)
* [`setBottomPadding(...)`](#setbottompadding)
* [`logEvent(...)`](#logevent)
* [`getUnreadConversationCount()`](#getunreadconversationcount)
* [`sendPushTokenToIntercom(...)`](#sendpushtokentointercom)
* [`isIntercomPush(...)`](#isintercompush)
* [`handlePush(...)`](#handlepush)
* [`addListener('unreadConversationCountChange', ...)`](#addlistenerunreadconversationcountchange-)
* [`addListener('windowDidShow', ...)`](#addlistenerwindowdidshow-)
* [`addListener('windowDidHide', ...)`](#addlistenerwindowdidhide-)
* [`removeAllListeners()`](#removealllisteners)
* [Interfaces](#interfaces)
* [Type Aliases](#type-aliases)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### loadWithKeys(...)

```typescript
loadWithKeys(options: LoadWithKeysOptions) => Promise<void>
```

Sets up Intercom with the keys given here, for an app that does not put
them in `capacitor.config` or decides at run time which workspace to use.

- **iOS**: `Intercom.setApiKey(_:forAppId:)`. `apiKey` is required.
- **Android**: `Intercom.initialize(application, apiKey, appId)`. `apiKey`
  is required.
- **Web**: remembers `appId` and `region`. The Messenger script is loaded
  by the first `loginUser()` or `loginUnidentifiedUser()`, from the
  optional peer dependency `@intercom/messenger-js-sdk`. `apiKey` is not
  used.

Intercom is set up once per app process. Calling this again with the
keys it is set up with (from here or from `capacitor.config`) resolves;
calling it with other keys rejects with `ALREADY_SET_UP`.

| Param         | Type                                                                |
| ------------- | ------------------------------------------------------------------- |
| **`options`** | <code><a href="#loadwithkeysoptions">LoadWithKeysOptions</a></code> |

**Since:** 0.1.0

--------------------


### loginUser(...)

```typescript
loginUser(options: LoginUserOptions) => Promise<void>
```

Logs in a user you know, by `userId`, `email` or both. At least one is
required.

With identity verification on, call `setUserHash()` or `setUserJwt()`
first. The promise settles when Intercom answers: it rejects when the
login fails.

On the web this boots the Messenger for that user.

| Param         | Type                                                          |
| ------------- | ------------------------------------------------------------- |
| **`options`** | <code><a href="#loginuseroptions">LoginUserOptions</a></code> |

**Since:** 0.1.0

--------------------


### loginUnidentifiedUser()

```typescript
loginUnidentifiedUser() => Promise<void>
```

Logs in an anonymous visitor, for example before your own sign-in. The
promise settles when Intercom answers.

On the web this boots the Messenger without a user.

**Since:** 0.1.0

--------------------


### updateUser(...)

```typescript
updateUser(options: UserAttributes) => Promise<void>
```

Updates the logged-in user. Only the fields you pass are sent.

A custom attribute may be a string, a number, a boolean or `null`; any
other value rejects the call with `INVALID_ARGUMENT`, on every platform,
before anything is sent.

| Param         | Type                                                      |
| ------------- | --------------------------------------------------------- |
| **`options`** | <code><a href="#userattributes">UserAttributes</a></code> |

**Since:** 0.1.0

--------------------


### setUserHash(...)

```typescript
setUserHash(options: SetUserHashOptions) => Promise<void>
```

Sets the HMAC of the user id or email for identity verification. Call it
before `loginUser()`.

On the web the hash is sent as `user_hash` when the Messenger boots, so it
also has to come before `loginUser()`.

| Param         | Type                                                              |
| ------------- | ----------------------------------------------------------------- |
| **`options`** | <code><a href="#setuserhashoptions">SetUserHashOptions</a></code> |

**Since:** 0.1.0

--------------------


### setUserJwt(...)

```typescript
setUserJwt(options: SetUserJwtOptions) => Promise<void>
```

Sets a JWT for Messenger security with JWTs. Call it before
`loginUser()`.

On the web it is sent as `intercom_user_jwt` when the Messenger boots.

| Param         | Type                                                            |
| ------------- | --------------------------------------------------------------- |
| **`options`** | <code><a href="#setuserjwtoptions">SetUserJwtOptions</a></code> |

**Since:** 0.1.0

--------------------


### logout()

```typescript
logout() => Promise<void>
```

Logs the user out and closes any Intercom UI. On the web this shuts the
Messenger down. A hash or JWT set before is forgotten, and the unread
count goes back to 0.

**Since:** 0.1.0

--------------------


### present(...)

```typescript
present(options?: PresentOptions | undefined) => Promise<void>
```

Opens the Messenger, on its home screen or on the space you name.

| Param         | Type                                                      |
| ------------- | --------------------------------------------------------- |
| **`options`** | <code><a href="#presentoptions">PresentOptions</a></code> |

**Since:** 0.1.0

--------------------


### presentMessageComposer(...)

```typescript
presentMessageComposer(options?: PresentMessageComposerOptions | undefined) => Promise<void>
```

Opens the composer for a new conversation, with `message` typed in when
you pass one.

| Param         | Type                                                                                    |
| ------------- | --------------------------------------------------------------------------------------- |
| **`options`** | <code><a href="#presentmessagecomposeroptions">PresentMessageComposerOptions</a></code> |

**Since:** 0.1.0

--------------------


### presentArticle(...)

```typescript
presentArticle(options: PresentArticleOptions) => Promise<void>
```

Opens one Help Center article.

| Param         | Type                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| **`options`** | <code><a href="#presentarticleoptions">PresentArticleOptions</a></code> |

**Since:** 0.1.0

--------------------


### presentHelpCenter()

```typescript
presentHelpCenter() => Promise<void>
```

Opens the Help Center. The same as `present({ space: 'helpCenter' })`.

**Since:** 0.1.0

--------------------


### presentContent(...)

```typescript
presentContent(options: PresentContentOptions) => Promise<void>
```

Opens one piece of Intercom content by its id: an article, a carousel, a
survey, a conversation, a ticket, or a list of Help Center collections.

The web has no carousels and no collection list: those two reject there
with `UNAVAILABLE`.

| Param         | Type                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| **`options`** | <code><a href="#presentcontentoptions">PresentContentOptions</a></code> |

**Since:** 0.1.0

--------------------


### hide()

```typescript
hide() => Promise<void>
```

Closes any Intercom UI that is open: the Messenger, the Help Center, an
article, a carousel or a survey.

**Since:** 0.1.0

--------------------


### setLauncherVisible(...)

```typescript
setLauncherVisible(options: VisibilityOptions) => Promise<void>
```

Shows or hides Intercom's own launcher button. It is hidden until you
show it.

On the web this sets `hide_default_launcher`.

| Param         | Type                                                            |
| ------------- | --------------------------------------------------------------- |
| **`options`** | <code><a href="#visibilityoptions">VisibilityOptions</a></code> |

**Since:** 0.1.0

--------------------


### setInAppMessagesVisible(...)

```typescript
setInAppMessagesVisible(options: VisibilityOptions) => Promise<void>
```

Allows or holds back in-app messages (chats, posts, carousels and
banners that Intercom shows on its own). They are allowed until you hold
them back.

On the web this is `hideNotifications`.

| Param         | Type                                                            |
| ------------- | --------------------------------------------------------------- |
| **`options`** | <code><a href="#visibilityoptions">VisibilityOptions</a></code> |

**Since:** 0.1.0

--------------------


### setBottomPadding(...)

```typescript
setBottomPadding(options: BottomPaddingOptions) => Promise<void>
```

Moves the launcher and in-app messages up from the bottom of the screen,
for example above a tab bar.

| Param         | Type                                                                  |
| ------------- | --------------------------------------------------------------------- |
| **`options`** | <code><a href="#bottompaddingoptions">BottomPaddingOptions</a></code> |

**Since:** 0.1.0

--------------------


### logEvent(...)

```typescript
logEvent(options: LogEventOptions) => Promise<void>
```

Records an event for the logged-in user, with optional metadata.

| Param         | Type                                                        |
| ------------- | ----------------------------------------------------------- |
| **`options`** | <code><a href="#logeventoptions">LogEventOptions</a></code> |

**Since:** 0.1.0

--------------------


### getUnreadConversationCount()

```typescript
getUnreadConversationCount() => Promise<UnreadConversationCount>
```

The number of conversations with replies the user has not read yet.

It is 0 before Intercom is set up and after `logout()`. On the web it is
the count the Messenger last reported, so it is 0 until the Messenger
has booted and reported one.

To follow it, listen to `unreadConversationCountChange` and read this once
at start and after each login, since the event only reports changes.

**Returns:** <code>Promise&lt;<a href="#unreadconversationcount">UnreadConversationCount</a>&gt;</code>

**Since:** 0.1.0

--------------------


### sendPushTokenToIntercom(...)

```typescript
sendPushTokenToIntercom(options: PushTokenOptions) => Promise<void>
```

Android: sends the Firebase Cloud Messaging token to Intercom, so it can
deliver its pushes to this device. Call it after login and again whenever
the token changes.

iOS and the web: resolves without doing anything. iOS takes the APNs
token on its own (see "Push notifications" in the README), and the
Messenger on the web does not use push.

| Param         | Type                                                          |
| ------------- | ------------------------------------------------------------- |
| **`options`** | <code><a href="#pushtokenoptions">PushTokenOptions</a></code> |

**Since:** 0.1.0

--------------------


### isIntercomPush(...)

```typescript
isIntercomPush(options: PushDataOptions) => Promise<IsIntercomPushResult>
```

Whether a push payload came from Intercom, for an app that receives
pushes itself and hands Intercom's on with `handlePush()`.

On the web it rejects with `UNIMPLEMENTED`.

| Param         | Type                                                        |
| ------------- | ----------------------------------------------------------- |
| **`options`** | <code><a href="#pushdataoptions">PushDataOptions</a></code> |

**Returns:** <code>Promise&lt;<a href="#isintercompushresult">IsIntercomPushResult</a>&gt;</code>

**Since:** 0.1.0

--------------------


### handlePush(...)

```typescript
handlePush(options: PushDataOptions) => Promise<void>
```

Hands a push payload from Intercom to the SDK, which shows it (Android)
or opens the conversation it belongs to (iOS). Rejects with
`NOT_INTERCOM_PUSH` when the payload is not Intercom's.

On the web it rejects with `UNIMPLEMENTED`.

| Param         | Type                                                        |
| ------------- | ----------------------------------------------------------- |
| **`options`** | <code><a href="#pushdataoptions">PushDataOptions</a></code> |

**Since:** 0.1.0

--------------------


### addListener('unreadConversationCountChange', ...)

```typescript
addListener(eventName: 'unreadConversationCountChange', listenerFunc: (event: UnreadConversationCount) => void) => Promise<PluginListenerHandle>
```

Fires whenever the number of unread conversations changes, with the new
number. iOS: `IntercomUnreadConversationCountDidChangeNotification`.
Android: `addUnreadConversationCountListener`. Web: `onUnreadCountChange`.

| Param              | Type                                                                                            |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| **`eventName`**    | <code>'unreadConversationCountChange'</code>                                                    |
| **`listenerFunc`** | <code>(event: <a href="#unreadconversationcount">UnreadConversationCount</a>) =&gt; void</code> |

**Returns:** <code>Promise&lt;<a href="#pluginlistenerhandle">PluginListenerHandle</a>&gt;</code>

**Since:** 0.1.0

--------------------


### addListener('windowDidShow', ...)

```typescript
addListener(eventName: 'windowDidShow', listenerFunc: () => void) => Promise<PluginListenerHandle>
```

Fires when Intercom has put its UI on screen. iOS and the web only: the
Android SDK reports nothing of the kind, so it never fires there.

| Param              | Type                         |
| ------------------ | ---------------------------- |
| **`eventName`**    | <code>'windowDidShow'</code> |
| **`listenerFunc`** | <code>() =&gt; void</code>   |

**Returns:** <code>Promise&lt;<a href="#pluginlistenerhandle">PluginListenerHandle</a>&gt;</code>

**Since:** 0.1.0

--------------------


### addListener('windowDidHide', ...)

```typescript
addListener(eventName: 'windowDidHide', listenerFunc: () => void) => Promise<PluginListenerHandle>
```

Fires when Intercom has taken its UI off the screen. iOS and the web only.

| Param              | Type                         |
| ------------------ | ---------------------------- |
| **`eventName`**    | <code>'windowDidHide'</code> |
| **`listenerFunc`** | <code>() =&gt; void</code>   |

**Returns:** <code>Promise&lt;<a href="#pluginlistenerhandle">PluginListenerHandle</a>&gt;</code>

**Since:** 0.1.0

--------------------


### removeAllListeners()

```typescript
removeAllListeners() => Promise<void>
```

Removes every listener added to this plugin.

**Since:** 0.1.0

--------------------


### Interfaces


#### LoadWithKeysOptions

| Prop         | Type                                                      | Description                                                                                                                        | Default           | Since |
| ------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----- |
| **`appId`**  | <code>string</code>                                       | The id of your Intercom workspace.                                                                                                 |                   | 0.1.0 |
| **`apiKey`** | <code>string</code>                                       | The API key for the platform the app runs on: the iOS key on iOS, the Android key on Android. Required there; not used on the web. |                   | 0.1.0 |
| **`region`** | <code><a href="#intercomregion">IntercomRegion</a></code> | Web only: where the workspace is hosted.                                                                                           | <code>'us'</code> | 0.1.0 |


#### LoginUserOptions

| Prop         | Type                | Description               | Since |
| ------------ | ------------------- | ------------------------- | ----- |
| **`userId`** | <code>string</code> | Your own id for the user. | 0.1.0 |
| **`email`**  | <code>string</code> | The user's email address. | 0.1.0 |


#### UserAttributes

| Prop                         | Type                                                          | Description                                                                                      | Since |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----- |
| **`userId`**                 | <code>string</code>                                           |                                                                                                  | 0.1.0 |
| **`email`**                  | <code>string</code>                                           |                                                                                                  | 0.1.0 |
| **`name`**                   | <code>string</code>                                           |                                                                                                  | 0.1.0 |
| **`phone`**                  | <code>string</code>                                           |                                                                                                  | 0.1.0 |
| **`languageOverride`**       | <code>string</code>                                           | A language code such as `fr` or `pt-BR`, used for the Messenger in place of the device language. | 0.1.0 |
| **`signedUpAt`**             | <code>number</code>                                           | When the user signed up, in seconds since 1970 (a Unix timestamp).                               | 0.1.0 |
| **`unsubscribedFromEmails`** | <code>boolean</code>                                          |                                                                                                  | 0.1.0 |
| **`company`**                | <code><a href="#company">Company</a></code>                   | The company the user belongs to.                                                                 | 0.1.0 |
| **`customAttributes`**       | <code><a href="#customattributes">CustomAttributes</a></code> | Your own attributes, created beforehand in Intercom.                                             | 0.1.0 |


#### Company

| Prop                   | Type                                                          | Description                                                             | Since |
| ---------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- | ----- |
| **`companyId`**        | <code>string</code>                                           | Your own id for the company. Required.                                  | 0.1.0 |
| **`name`**             | <code>string</code>                                           |                                                                         | 0.1.0 |
| **`plan`**             | <code>string</code>                                           |                                                                         | 0.1.0 |
| **`monthlySpend`**     | <code>number</code>                                           |                                                                         | 0.1.0 |
| **`createdAt`**        | <code>number</code>                                           | When the company was created, in seconds since 1970 (a Unix timestamp). | 0.1.0 |
| **`customAttributes`** | <code><a href="#customattributes">CustomAttributes</a></code> |                                                                         | 0.1.0 |


#### CustomAttributes

Custom attributes by name. Each value is a string, a number, a boolean or
`null`.


#### SetUserHashOptions

| Prop       | Type                | Description                                                                                                                                                             | Since |
| ---------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| **`hmac`** | <code>string</code> | The HMAC (SHA-256) of the user id, or of the email when there is no user id, made on your server with the identity verification secret of the platform the app runs on. | 0.1.0 |


#### SetUserJwtOptions

| Prop      | Type                | Description                                                      | Since |
| --------- | ------------------- | ---------------------------------------------------------------- | ----- |
| **`jwt`** | <code>string</code> | A JWT signed on your server with your Messenger security secret. | 0.1.0 |


#### PresentOptions

| Prop        | Type                                                    | Description        | Default             | Since |
| ----------- | ------------------------------------------------------- | ------------------ | ------------------- | ----- |
| **`space`** | <code><a href="#intercomspace">IntercomSpace</a></code> | The space to open. | <code>'home'</code> | 0.1.0 |


#### PresentMessageComposerOptions

| Prop          | Type                | Description                                                   | Since |
| ------------- | ------------------- | ------------------------------------------------------------- | ----- |
| **`message`** | <code>string</code> | Text typed into the composer, for the user to send or change. | 0.1.0 |


#### PresentArticleOptions

| Prop            | Type                | Since |
| --------------- | ------------------- | ----- |
| **`articleId`** | <code>string</code> | 0.1.0 |


#### PresentContentOptions

| Prop       | Type                                                                | Description                                                            | Since |
| ---------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----- |
| **`type`** | <code><a href="#intercomcontenttype">IntercomContentType</a></code> |                                                                        | 0.1.0 |
| **`id`**   | <code>string</code>                                                 | The content's id. Required for every type but `helpCenterCollections`. | 0.1.0 |
| **`ids`**  | <code>string[]</code>                                               | The collection ids, for `helpCenterCollections` only.                  | 0.1.0 |


#### VisibilityOptions

| Prop          | Type                 | Since |
| ------------- | -------------------- | ----- |
| **`visible`** | <code>boolean</code> | 0.1.0 |


#### BottomPaddingOptions

| Prop        | Type                | Description                                                                                                                                                                                               | Since |
| ----------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| **`value`** | <code>number</code> | The padding in CSS pixels, which are points on iOS and density independent pixels on Android. Not negative. On the web it is the Messenger's `vertical_padding`, which Intercom does not let go below 20. | 0.1.0 |


#### LogEventOptions

| Prop       | Type                                                    | Description                                | Since |
| ---------- | ------------------------------------------------------- | ------------------------------------------ | ----- |
| **`name`** | <code>string</code>                                     | The event name, as it appears in Intercom. | 0.1.0 |
| **`data`** | <code><a href="#eventmetadata">EventMetadata</a></code> |                                            | 0.1.0 |


#### EventMetadata

Event metadata by name, passed to Intercom as it is.


#### UnreadConversationCount

| Prop        | Type                | Since |
| ----------- | ------------------- | ----- |
| **`count`** | <code>number</code> | 0.1.0 |


#### PushTokenOptions

| Prop        | Type                | Description                 | Since |
| ----------- | ------------------- | --------------------------- | ----- |
| **`value`** | <code>string</code> | The FCM registration token. | 0.1.0 |


#### IsIntercomPushResult

| Prop        | Type                 | Since |
| ----------- | -------------------- | ----- |
| **`value`** | <code>boolean</code> | 0.1.0 |


#### PushDataOptions

| Prop       | Type                                          | Description                                                                                           | Since |
| ---------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----- |
| **`data`** | <code><a href="#pushdata">PushData</a></code> | The push payload: the `data` of an FCM message on Android, the `userInfo` of the notification on iOS. | 0.1.0 |


#### PushData

A push payload by key.


#### PluginListenerHandle

| Prop         | Type                                      |
| ------------ | ----------------------------------------- |
| **`remove`** | <code>() =&gt; Promise&lt;void&gt;</code> |


### Type Aliases


#### IntercomRegion

The data center your Intercom workspace is hosted in. Web only: the native
SDKs find it themselves.

<code>'us' | 'eu' | 'ap'</code>


#### IntercomSpace

A space of the Messenger.

<code>'home' | 'messages' | 'helpCenter' | 'tickets'</code>


#### IntercomContentType

The kinds of content `presentContent()` opens.

<code>'article' | 'carousel' | 'survey' | 'conversation' | 'ticket' | 'helpCenterCollections'</code>

</docgen-api>

## Testing

```bash
npm run test:unit      # TypeScript: the web implementation against a stand-in for the Messenger JS SDK, and the native bridge calls
npm run test:parity    # the API, the web, the Swift, the Kotlin and this README name the same methods, events and SDK versions
npm run test:android   # JUnit on the JVM: config keys, the set-up rule, argument mapping (attributes, content, spaces, padding, push data)
npm run test:ios       # XCTest on a simulator: the same mapping, and the notification wiring (unread count, window events, APNs token)
```

None of them talks to Intercom. The example app in `example-app/` has a field for the keys and a button per method, for a run
against a real workspace on a phone or in a browser.

## License

MIT
