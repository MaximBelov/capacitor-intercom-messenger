import { CapacitorException, ExceptionCode, WebPlugin } from '@capacitor/core';

import type {
  BottomPaddingOptions,
  Company,
  CustomAttributes,
  IntercomMessengerPlugin,
  IntercomRegion,
  IntercomSpace,
  IsIntercomPushResult,
  LoadWithKeysOptions,
  LogEventOptions,
  LoginUserOptions,
  PresentArticleOptions,
  PresentContentOptions,
  PresentMessageComposerOptions,
  PresentOptions,
  PushDataOptions,
  PushTokenOptions,
  SetUserHashOptions,
  SetUserJwtOptions,
  UnreadConversationCount,
  UserAttributes,
  VisibilityOptions,
} from './definitions';

/** The settings object the Messenger takes in `boot` and `update`, in its own snake_case names. */
export interface MessengerSettings {
  [key: string]: unknown;
}

/**
 * The part of `@intercom/messenger-js-sdk` this plugin calls. It is declared here rather than imported, so that the published
 * types do not depend on the optional peer dependency.
 */
export interface MessengerSdk {
  Intercom(settings: MessengerSettings & { region?: IntercomRegion }): void;
  boot(settings: MessengerSettings): void;
  update(settings: MessengerSettings): void;
  shutdown(): void;
  show(): void;
  hide(): void;
  showSpace(space: string): void;
  showNewMessage(message: string): void;
  showArticle(articleId: string): void;
  showConversation(conversationId: string): void;
  showTicket(ticketId: string): void;
  startSurvey(surveyId: string): void;
  trackEvent(name: string, metadata?: unknown): void;
  hideNotifications(hidden: boolean): void;
  onUnreadCountChange(callback: (count: number) => void): void;
  onShow(callback: () => void): void;
  onHide(callback: () => void): void;
}

export type MessengerSdkLoader = () => Promise<unknown>;

export const PEER_DEPENDENCY = '@intercom/messenger-js-sdk';

// The .catch() on the import itself is what lets esbuild (and so the Angular CLI) bundle an app that did not install the peer
// dependency: it turns the unresolved import into a failure at run time, which sdkInstance() reports. Vite does the same on its own.
const defaultLoader: MessengerSdkLoader = () =>
  import('@intercom/messenger-js-sdk').catch((error: unknown) => {
    throw error;
  });

// The Messenger's API hosts, by region: the same ones @intercom/messenger-js-sdk sets on its first load. A later boot (a login
// after a logout) has to name it again.
const API_BASE: { [region in IntercomRegion]: string } = {
  us: 'https://api-iam.intercom.io',
  eu: 'https://api-iam.eu.intercom.io',
  ap: 'https://api-iam.au.intercom.io',
};

const WEB_SPACE: { [space in IntercomSpace]: string } = {
  home: 'home',
  messages: 'messages',
  helpCenter: 'help',
  tickets: 'tickets',
};

const SPACES = Object.keys(WEB_SPACE);

export class IntercomMessengerWeb extends WebPlugin implements IntercomMessengerPlugin {
  private appId?: string;
  private region: IntercomRegion = 'us';
  private sdk?: MessengerSdk;
  private loaded = false;
  private booted = false;
  private userHash?: string;
  private userJwt?: string;
  // The native SDKs keep their launcher hidden until the app shows it; the Messenger on the web shows its own unless told not to.
  // Starting hidden here makes the three platforms agree.
  private launcherVisible = false;
  private inAppMessagesVisible = true;
  private bottomPadding?: number;
  private unreadCount = 0;
  // Each boot registers the Messenger's callbacks again, in case a shutdown dropped the earlier ones. A callback from an earlier
  // boot sees a newer generation and stays quiet, so an event is never reported twice.
  private generation = 0;

  constructor(private readonly loadSdk: MessengerSdkLoader = defaultLoader) {
    super();
  }

  async loadWithKeys(options: LoadWithKeysOptions): Promise<void> {
    const appId = requireString(options?.appId, 'appId');
    const region = options.region ?? 'us';
    if (!(region in API_BASE)) {
      throw invalid(`region must be one of ${Object.keys(API_BASE).join(', ')}`);
    }
    if (this.appId !== undefined) {
      if (this.appId === appId && this.region === region) {
        return;
      }
      throw new CapacitorException(
        'Intercom is already set up with another workspace. It is set up once per page load.',
        'ALREADY_SET_UP' as ExceptionCode,
      );
    }
    this.appId = appId;
    this.region = region;
  }

  async loginUser(options: LoginUserOptions): Promise<void> {
    const settings: MessengerSettings = {};
    if (options?.userId) settings.user_id = options.userId;
    if (options?.email) settings.email = options.email;
    if (!settings.user_id && !settings.email) {
      throw invalid('loginUser needs a userId, an email or both');
    }
    await this.boot(settings);
  }

  async loginUnidentifiedUser(): Promise<void> {
    await this.boot({});
  }

  async updateUser(options: UserAttributes): Promise<void> {
    const sdk = this.requireBooted();
    sdk.update(userSettings(options ?? {}));
  }

  async setUserHash(options: SetUserHashOptions): Promise<void> {
    const hmac = requireString(options?.hmac, 'hmac');
    this.requireSetUp();
    this.userHash = hmac;
  }

  async setUserJwt(options: SetUserJwtOptions): Promise<void> {
    const jwt = requireString(options?.jwt, 'jwt');
    this.requireSetUp();
    this.userJwt = jwt;
  }

  async logout(): Promise<void> {
    this.requireSetUp();
    this.userHash = undefined;
    this.userJwt = undefined;
    this.unreadCount = 0;
    if (this.booted && this.sdk) {
      this.sdk.shutdown();
    }
    this.booted = false;
  }

  async present(options?: PresentOptions): Promise<void> {
    const space = options?.space;
    if (space !== undefined && !SPACES.includes(space)) {
      throw invalid(`space must be one of ${SPACES.join(', ')}`);
    }
    const sdk = this.requireBooted();
    if (space === undefined) {
      sdk.show();
    } else {
      sdk.showSpace(WEB_SPACE[space]);
    }
  }

  async presentMessageComposer(options?: PresentMessageComposerOptions): Promise<void> {
    this.requireBooted().showNewMessage(options?.message ?? '');
  }

  async presentArticle(options: PresentArticleOptions): Promise<void> {
    const articleId = requireString(options?.articleId, 'articleId');
    this.requireBooted().showArticle(articleId);
  }

  async presentHelpCenter(): Promise<void> {
    this.requireBooted().showSpace(WEB_SPACE.helpCenter);
  }

  async presentContent(options: PresentContentOptions): Promise<void> {
    const type = options?.type;
    switch (type) {
      case 'carousel':
      case 'helpCenterCollections':
        throw this.unavailable(`The Messenger on the web cannot present a ${type}.`);
      case 'article':
      case 'survey':
      case 'conversation':
      case 'ticket': {
        const id = requireString(options.id, 'id');
        const sdk = this.requireBooted();
        if (type === 'article') sdk.showArticle(id);
        else if (type === 'survey') sdk.startSurvey(id);
        else if (type === 'conversation') sdk.showConversation(id);
        else sdk.showTicket(id);
        return;
      }
      default:
        throw invalid('type must be one of article, carousel, survey, conversation, ticket, helpCenterCollections');
    }
  }

  async hide(): Promise<void> {
    this.requireSetUp();
    if (this.booted && this.sdk) {
      this.sdk.hide();
    }
  }

  async setLauncherVisible(options: VisibilityOptions): Promise<void> {
    const visible = requireBoolean(options?.visible, 'visible');
    this.requireSetUp();
    this.launcherVisible = visible;
    if (this.booted && this.sdk) {
      this.sdk.update({ hide_default_launcher: !visible });
    }
  }

  async setInAppMessagesVisible(options: VisibilityOptions): Promise<void> {
    const visible = requireBoolean(options?.visible, 'visible');
    this.requireSetUp();
    this.inAppMessagesVisible = visible;
    if (this.booted && this.sdk) {
      this.sdk.hideNotifications(!visible);
    }
  }

  async setBottomPadding(options: BottomPaddingOptions): Promise<void> {
    const value = options?.value;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw invalid('value must be a number that is not negative');
    }
    this.requireSetUp();
    this.bottomPadding = value;
    if (this.booted && this.sdk) {
      this.sdk.update({ vertical_padding: value });
    }
  }

  async logEvent(options: LogEventOptions): Promise<void> {
    const name = requireString(options?.name, 'name');
    const sdk = this.requireBooted();
    if (options.data === undefined) {
      sdk.trackEvent(name);
    } else {
      sdk.trackEvent(name, options.data);
    }
  }

  async getUnreadConversationCount(): Promise<UnreadConversationCount> {
    return { count: this.unreadCount };
  }

  // The Messenger on the web has no push, so there is no token to hand over: resolving lets the same code run on every platform.
  async sendPushTokenToIntercom(options: PushTokenOptions): Promise<void> {
    requireString(options?.value, 'value');
  }

  async isIntercomPush(_options: PushDataOptions): Promise<IsIntercomPushResult> {
    throw this.unimplemented('isIntercomPush is not available on the web: the Messenger there does not use push.');
  }

  async handlePush(_options: PushDataOptions): Promise<void> {
    throw this.unimplemented('handlePush is not available on the web: the Messenger there does not use push.');
  }

  private requireSetUp(): string {
    if (this.appId === undefined) {
      throw new CapacitorException(
        'Intercom is not set up: call loadWithKeys({ appId }) first.',
        'NOT_SET_UP' as ExceptionCode,
      );
    }
    return this.appId;
  }

  private requireBooted(): MessengerSdk {
    this.requireSetUp();
    if (!this.booted || !this.sdk) {
      throw new CapacitorException(
        'The Messenger has not started: call loginUser() or loginUnidentifiedUser() first.',
        'NOT_LOGGED_IN' as ExceptionCode,
      );
    }
    return this.sdk;
  }

  private async sdkInstance(): Promise<MessengerSdk> {
    if (this.sdk) {
      return this.sdk;
    }
    let module: unknown;
    try {
      module = await this.loadSdk();
    } catch (error) {
      throw new CapacitorException(
        `The web implementation needs the optional peer dependency ${PEER_DEPENDENCY}, which could not be loaded. ` +
          `Install it with: npm install ${PEER_DEPENDENCY} (${describe(error)})`,
        ExceptionCode.Unavailable,
      );
    }
    const sdk = interop(module);
    if (!sdk) {
      throw new CapacitorException(
        `${PEER_DEPENDENCY} was loaded but is not the Messenger SDK this plugin expects (an alias to an empty module, or an incompatible version).`,
        ExceptionCode.Unavailable,
      );
    }
    this.sdk = sdk;
    return sdk;
  }

  private async boot(user: MessengerSettings): Promise<void> {
    const appId = this.requireSetUp();
    const sdk = await this.sdkInstance();
    const settings: MessengerSettings = {
      app_id: appId,
      ...user,
      hide_default_launcher: !this.launcherVisible,
      hide_notifications: !this.inAppMessagesVisible,
    };
    if (this.userHash !== undefined) settings.user_hash = this.userHash;
    if (this.userJwt !== undefined) settings.intercom_user_jwt = this.userJwt;
    if (this.bottomPadding !== undefined) settings.vertical_padding = this.bottomPadding;

    if (this.booted) {
      sdk.shutdown();
    }
    if (this.loaded) {
      sdk.boot({ ...settings, api_base: API_BASE[this.region] });
    } else {
      // The first call loads the Messenger script, which boots itself with these settings.
      sdk.Intercom({ ...settings, region: this.region });
      this.loaded = true;
    }
    this.booted = true;
    this.listen(sdk);
  }

  private listen(sdk: MessengerSdk): void {
    const generation = ++this.generation;
    const current = () => generation === this.generation;
    sdk.onUnreadCountChange((count: number) => {
      if (!current()) return;
      this.unreadCount = Number(count) || 0;
      this.notifyListeners('unreadConversationCountChange', { count: this.unreadCount });
    });
    sdk.onShow(() => {
      if (current()) this.notifyListeners('windowDidShow', {});
    });
    sdk.onHide(() => {
      if (current()) this.notifyListeners('windowDidHide', {});
    });
  }
}

/** Maps the plugin's user attributes to the Messenger's settings. Throws INVALID_ARGUMENT on a value Intercom cannot store. */
export function userSettings(attributes: UserAttributes): MessengerSettings {
  const settings: MessengerSettings = {};
  if (attributes.userId !== undefined) settings.user_id = attributes.userId;
  if (attributes.email !== undefined) settings.email = attributes.email;
  if (attributes.name !== undefined) settings.name = attributes.name;
  if (attributes.phone !== undefined) settings.phone = attributes.phone;
  if (attributes.languageOverride !== undefined) settings.language_override = attributes.languageOverride;
  if (attributes.signedUpAt !== undefined) settings.created_at = attributes.signedUpAt;
  if (attributes.unsubscribedFromEmails !== undefined) {
    settings.unsubscribed_from_emails = attributes.unsubscribedFromEmails;
  }
  if (attributes.company !== undefined) settings.company = companySettings(attributes.company);
  // The Messenger takes custom attributes next to the standard ones, not in an object of their own.
  Object.assign(settings, customAttributes(attributes.customAttributes, 'customAttributes'));
  return settings;
}

function companySettings(company: Company): MessengerSettings {
  const settings: MessengerSettings = { id: requireString(company?.companyId, 'company.companyId') };
  if (company.name !== undefined) settings.name = company.name;
  if (company.plan !== undefined) settings.plan = company.plan;
  if (company.monthlySpend !== undefined) settings.monthly_spend = company.monthlySpend;
  if (company.createdAt !== undefined) settings.created_at = company.createdAt;
  Object.assign(settings, customAttributes(company.customAttributes, 'company.customAttributes'));
  return settings;
}

/** Checks every value is one Intercom stores as a custom attribute: a string, a finite number, a boolean or null. */
export function customAttributes(attributes: CustomAttributes | undefined, path: string): CustomAttributes {
  if (attributes === undefined) return {};
  if (attributes === null || typeof attributes !== 'object' || Array.isArray(attributes)) {
    throw invalid(`${path} must be an object`);
  }
  const checked: CustomAttributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    const valid =
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value));
    if (!valid) {
      throw invalid(`${path}.${key} must be a string, a number, a boolean or null`);
    }
    checked[key] = value;
  }
  return checked;
}

// The package is CommonJS: a bundler hands its exports over either as the namespace itself or as its `default`.
function interop(module: unknown): MessengerSdk | undefined {
  if (isSdk(module)) return module;
  const wrapped = module as { default?: unknown } | null | undefined;
  return wrapped && isSdk(wrapped.default) ? wrapped.default : undefined;
}

function isSdk(candidate: unknown): candidate is MessengerSdk {
  const sdk = candidate as Partial<MessengerSdk> | null | undefined;
  return Boolean(sdk) && typeof sdk?.Intercom === 'function' && typeof sdk?.boot === 'function';
}

function invalid(message: string): CapacitorException {
  return new CapacitorException(message, 'INVALID_ARGUMENT' as ExceptionCode);
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw invalid(`${name} must be a non-empty string`);
  }
  return value;
}

function requireBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') {
    throw invalid(`${name} must be true or false`);
  }
  return value;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
