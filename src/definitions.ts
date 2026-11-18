/// <reference types="@capacitor/cli" />

import type { PluginListenerHandle } from '@capacitor/core';

declare module '@capacitor/cli' {
  export interface PluginsConfig {
    /**
     * Sets up the native Intercom SDKs when the app starts. The web reads no
     * configuration: call `loadWithKeys()` there.
     */
    IntercomMessenger?: {
      /**
       * The iOS API key of your Intercom workspace (Settings > Installation > iOS).
       *
       * @since 0.1.0
       * @example "ios_sdk-..."
       */
      iosApiKey?: string;

      /**
       * The id of your Intercom workspace, used on iOS.
       *
       * @since 0.1.0
       * @example "abc123"
       */
      iosAppId?: string;

      /**
       * The Android API key of your Intercom workspace (Settings > Installation >
       * Android).
       *
       * @since 0.1.0
       * @example "android_sdk-..."
       */
      androidApiKey?: string;

      /**
       * The id of your Intercom workspace, used on Android.
       *
       * @since 0.1.0
       * @example "abc123"
       */
      androidAppId?: string;
    };
  }
}

export interface IntercomMessengerPlugin {
  /**
   * Sets up Intercom with the keys given here, for an app that does not put
   * them in `capacitor.config` or decides at run time which workspace to use.
   *
   * - **iOS**: `Intercom.setApiKey(_:forAppId:)`. `apiKey` is required.
   * - **Android**: `Intercom.initialize(application, apiKey, appId)`. `apiKey`
   *   is required.
   * - **Web**: remembers `appId` and `region`. The Messenger script is loaded
   *   by the first `loginUser()` or `loginUnidentifiedUser()`, from the
   *   optional peer dependency `@intercom/messenger-js-sdk`. `apiKey` is not
   *   used.
   *
   * Intercom is set up once per app process. Calling this again with the
   * keys it is set up with (from here or from `capacitor.config`) resolves;
   * calling it with other keys rejects with `ALREADY_SET_UP`.
   *
   * @since 0.1.0
   */
  loadWithKeys(options: LoadWithKeysOptions): Promise<void>;

  /**
   * Logs in a user you know, by `userId`, `email` or both. At least one is
   * required.
   *
   * With identity verification on, call `setUserHash()` or `setUserJwt()`
   * first. The promise settles when Intercom answers: it rejects when the
   * login fails.
   *
   * On the web this boots the Messenger for that user.
   *
   * @since 0.1.0
   */
  loginUser(options: LoginUserOptions): Promise<void>;

  /**
   * Logs in an anonymous visitor, for example before your own sign-in. The
   * promise settles when Intercom answers.
   *
   * On the web this boots the Messenger without a user.
   *
   * @since 0.1.0
   */
  loginUnidentifiedUser(): Promise<void>;

  /**
   * Updates the logged-in user. Only the fields you pass are sent.
   *
   * A custom attribute may be a string, a number, a boolean or `null`; any
   * other value rejects the call with `INVALID_ARGUMENT`, on every platform,
   * before anything is sent.
   *
   * @since 0.1.0
   */
  updateUser(options: UserAttributes): Promise<void>;

  /**
   * Sets the HMAC of the user id or email for identity verification. Call it
   * before `loginUser()`.
   *
   * On the web the hash is sent as `user_hash` when the Messenger boots, so it
   * also has to come before `loginUser()`.
   *
   * @since 0.1.0
   */
  setUserHash(options: SetUserHashOptions): Promise<void>;

  /**
   * Sets a JWT for Messenger security with JWTs. Call it before
   * `loginUser()`.
   *
   * On the web it is sent as `intercom_user_jwt` when the Messenger boots.
   *
   * @since 0.1.0
   */
  setUserJwt(options: SetUserJwtOptions): Promise<void>;

  /**
   * Logs the user out and closes any Intercom UI. On the web this shuts the
   * Messenger down. A hash or JWT set before is forgotten, and the unread
   * count goes back to 0.
   *
   * @since 0.1.0
   */
  logout(): Promise<void>;

  /**
   * Opens the Messenger, on its home screen or on the space you name.
   *
   * @since 0.1.0
   */
  present(options?: PresentOptions): Promise<void>;

  /**
   * Opens the composer for a new conversation, with `message` typed in when
   * you pass one.
   *
   * @since 0.1.0
   */
  presentMessageComposer(options?: PresentMessageComposerOptions): Promise<void>;

  /**
   * Opens one Help Center article.
   *
   * @since 0.1.0
   */
  presentArticle(options: PresentArticleOptions): Promise<void>;

  /**
   * Opens the Help Center. The same as `present({ space: 'helpCenter' })`.
   *
   * @since 0.1.0
   */
  presentHelpCenter(): Promise<void>;

  /**
   * Opens one piece of Intercom content by its id: an article, a carousel, a
   * survey, a conversation, a ticket, or a list of Help Center collections.
   *
   * The web has no carousels and no collection list: those two reject there
   * with `UNAVAILABLE`.
   *
   * @since 0.1.0
   */
  presentContent(options: PresentContentOptions): Promise<void>;

  /**
   * Closes any Intercom UI that is open: the Messenger, the Help Center, an
   * article, a carousel or a survey.
   *
   * @since 0.1.0
   */
  hide(): Promise<void>;

  /**
   * Shows or hides Intercom's own launcher button. It is hidden until you
   * show it.
   *
   * On the web this sets `hide_default_launcher`.
   *
   * @since 0.1.0
   */
  setLauncherVisible(options: VisibilityOptions): Promise<void>;

  /**
   * Allows or holds back in-app messages (chats, posts, carousels and
   * banners that Intercom shows on its own). They are allowed until you hold
   * them back.
   *
   * On the web this is `hideNotifications`.
   *
   * @since 0.1.0
   */
  setInAppMessagesVisible(options: VisibilityOptions): Promise<void>;

  /**
   * Moves the launcher and in-app messages up from the bottom of the screen,
   * for example above a tab bar.
   *
   * @since 0.1.0
   */
  setBottomPadding(options: BottomPaddingOptions): Promise<void>;

  /**
   * Records an event for the logged-in user, with optional metadata.
   *
   * @since 0.1.0
   */
  logEvent(options: LogEventOptions): Promise<void>;

  /**
   * The number of conversations with replies the user has not read yet.
   *
   * It is 0 before Intercom is set up and after `logout()`. On the web it is
   * the count the Messenger last reported, so it is 0 until the Messenger
   * has booted and reported one.
   *
   * To follow it, listen to `unreadConversationCountChange` and read this once
   * at start and after each login, since the event only reports changes.
   *
   * @since 0.1.0
   */
  getUnreadConversationCount(): Promise<UnreadConversationCount>;

  /**
   * Whether a user is logged in, identified or unidentified: after
   * `loginUser()` or `loginUnidentifiedUser()` and until `logout()`.
   *
   * The native SDKs keep the user between launches, so on iOS and Android
   * this is `true` at start for a user who logged in during an earlier one.
   * Check it before `loginUser()` to avoid logging in a user who already is.
   * It is `false` before Intercom is set up. On the web it is whether the
   * Messenger has been booted since the page loaded.
   *
   * @since 0.2.0
   */
  isUserLoggedIn(): Promise<IsUserLoggedInResult>;

  /**
   * Android: sends the Firebase Cloud Messaging token to Intercom, so it can
   * deliver its pushes to this device. Call it after login and again whenever
   * the token changes.
   *
   * iOS and the web: resolves without doing anything. iOS takes the APNs
   * token on its own (see "Push notifications" in the README), and the
   * Messenger on the web does not use push.
   *
   * @since 0.1.0
   */
  sendPushTokenToIntercom(options: PushTokenOptions): Promise<void>;

  /**
   * Whether a push payload came from Intercom, for an app that receives
   * pushes itself and hands Intercom's on with `handlePush()`.
   *
   * On the web it rejects with `UNIMPLEMENTED`.
   *
   * @since 0.1.0
   */
  isIntercomPush(options: PushDataOptions): Promise<IsIntercomPushResult>;

  /**
   * Hands a push payload from Intercom to the SDK, which shows it (Android)
   * or opens the conversation it belongs to (iOS). Rejects with
   * `NOT_INTERCOM_PUSH` when the payload is not Intercom's.
   *
   * On the web it rejects with `UNIMPLEMENTED`.
   *
   * @since 0.1.0
   */
  handlePush(options: PushDataOptions): Promise<void>;

  /**
   * Fires whenever the number of unread conversations changes, with the new
   * number. iOS: `IntercomUnreadConversationCountDidChangeNotification`.
   * Android: `addUnreadConversationCountListener`. Web: `onUnreadCountChange`.
   *
   * @since 0.1.0
   */
  addListener(
    eventName: 'unreadConversationCountChange',
    listenerFunc: (event: UnreadConversationCount) => void,
  ): Promise<PluginListenerHandle>;

  /**
   * Fires when Intercom has put its UI on screen. iOS and the web only: the
   * Android SDK reports nothing of the kind, so it never fires there.
   *
   * @since 0.1.0
   */
  addListener(eventName: 'windowDidShow', listenerFunc: () => void): Promise<PluginListenerHandle>;

  /**
   * Fires when Intercom has taken its UI off the screen. iOS and the web only.
   *
   * @since 0.1.0
   */
  addListener(eventName: 'windowDidHide', listenerFunc: () => void): Promise<PluginListenerHandle>;

  /**
   * Removes every listener added to this plugin.
   *
   * @since 0.1.0
   */
  removeAllListeners(): Promise<void>;
}

/**
 * The data center your Intercom workspace is hosted in. Web only: the native
 * SDKs find it themselves.
 */
export type IntercomRegion = 'us' | 'eu' | 'ap';

export interface LoadWithKeysOptions {
  /**
   * The id of your Intercom workspace.
   *
   * @since 0.1.0
   */
  appId: string;

  /**
   * The API key for the platform the app runs on: the iOS key on iOS, the
   * Android key on Android. Required there; not used on the web.
   *
   * @since 0.1.0
   */
  apiKey?: string;

  /**
   * Web only: where the workspace is hosted.
   *
   * @default 'us'
   * @since 0.1.0
   */
  region?: IntercomRegion;
}

export interface LoginUserOptions {
  /**
   * Your own id for the user.
   *
   * @since 0.1.0
   */
  userId?: string;

  /**
   * The user's email address.
   *
   * @since 0.1.0
   */
  email?: string;
}

/**
 * The value of a custom attribute. `null` clears the attribute.
 */
export type CustomAttributeValue = string | number | boolean | null;

/**
 * Custom attributes by name. Each value is a string, a number, a boolean or
 * `null`.
 */
export interface CustomAttributes {
  [key: string]: CustomAttributeValue;
}

export interface UserAttributes {
  /**
   * @since 0.1.0
   */
  userId?: string;

  /**
   * @since 0.1.0
   */
  email?: string;

  /**
   * @since 0.1.0
   */
  name?: string;

  /**
   * @since 0.1.0
   */
  phone?: string;

  /**
   * A language code such as `fr` or `pt-BR`, used for the Messenger in place
   * of the device language.
   *
   * @since 0.1.0
   */
  languageOverride?: string;

  /**
   * When the user signed up, in seconds since 1970 (a Unix timestamp).
   *
   * @since 0.1.0
   */
  signedUpAt?: number;

  /**
   * @since 0.1.0
   */
  unsubscribedFromEmails?: boolean;

  /**
   * The company the user belongs to.
   *
   * @since 0.1.0
   */
  company?: Company;

  /**
   * Your own attributes, created beforehand in Intercom.
   *
   * @since 0.1.0
   */
  customAttributes?: CustomAttributes;
}

export interface Company {
  /**
   * Your own id for the company. Required.
   *
   * @since 0.1.0
   */
  companyId: string;

  /**
   * @since 0.1.0
   */
  name?: string;

  /**
   * @since 0.1.0
   */
  plan?: string;

  /**
   * @since 0.1.0
   */
  monthlySpend?: number;

  /**
   * When the company was created, in seconds since 1970 (a Unix timestamp).
   *
   * @since 0.1.0
   */
  createdAt?: number;

  /**
   * @since 0.1.0
   */
  customAttributes?: CustomAttributes;
}

export interface SetUserHashOptions {
  /**
   * The HMAC (SHA-256) of the user id, or of the email when there is no user
   * id, made on your server with the identity verification secret of the
   * platform the app runs on.
   *
   * @since 0.1.0
   */
  hmac: string;
}

export interface SetUserJwtOptions {
  /**
   * A JWT signed on your server with your Messenger security secret.
   *
   * @since 0.1.0
   */
  jwt: string;
}

/**
 * A space of the Messenger.
 */
export type IntercomSpace = 'home' | 'messages' | 'helpCenter' | 'tickets';

export interface PresentOptions {
  /**
   * The space to open.
   *
   * @default 'home'
   * @since 0.1.0
   */
  space?: IntercomSpace;
}

export interface PresentMessageComposerOptions {
  /**
   * Text typed into the composer, for the user to send or change.
   *
   * @since 0.1.0
   */
  message?: string;
}

export interface PresentArticleOptions {
  /**
   * @since 0.1.0
   */
  articleId: string;
}

/**
 * The kinds of content `presentContent()` opens.
 */
export type IntercomContentType =
  'article' | 'carousel' | 'survey' | 'conversation' | 'ticket' | 'helpCenterCollections';

export interface PresentContentOptions {
  /**
   * @since 0.1.0
   */
  type: IntercomContentType;

  /**
   * The content's id. Required for every type but `helpCenterCollections`.
   *
   * @since 0.1.0
   */
  id?: string;

  /**
   * The collection ids, for `helpCenterCollections` only.
   *
   * @since 0.1.0
   */
  ids?: string[];
}

export interface VisibilityOptions {
  /**
   * @since 0.1.0
   */
  visible: boolean;
}

export interface BottomPaddingOptions {
  /**
   * The padding in CSS pixels, which are points on iOS and density
   * independent pixels on Android. Not negative.
   *
   * On the web it is the Messenger's `vertical_padding`, which Intercom does
   * not let go below 20.
   *
   * @since 0.1.0
   */
  value: number;
}

/**
 * Event metadata by name, passed to Intercom as it is.
 */
export interface EventMetadata {
  [key: string]: unknown;
}

export interface LogEventOptions {
  /**
   * The event name, as it appears in Intercom.
   *
   * @since 0.1.0
   */
  name: string;

  /**
   * @since 0.1.0
   */
  data?: EventMetadata;
}

export interface UnreadConversationCount {
  /**
   * @since 0.1.0
   */
  count: number;
}

export interface PushTokenOptions {
  /**
   * The FCM registration token.
   *
   * @since 0.1.0
   */
  value: string;
}

/**
 * A push payload by key.
 */
export interface PushData {
  [key: string]: unknown;
}

export interface PushDataOptions {
  /**
   * The push payload: the `data` of an FCM message on Android, the
   * `userInfo` of the notification on iOS.
   *
   * @since 0.1.0
   */
  data: PushData;
}

export interface IsUserLoggedInResult {
  /**
   * @since 0.2.0
   */
  value: boolean;
}

export interface IsIntercomPushResult {
  /**
   * @since 0.1.0
   */
  value: boolean;
}
