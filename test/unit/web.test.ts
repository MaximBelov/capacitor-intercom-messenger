import { CapacitorException, ExceptionCode } from '@capacitor/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MessengerSdk } from '../../src/web';
import { IntercomMessengerWeb, PEER_DEPENDENCY } from '../../src/web';

// A stand-in for @intercom/messenger-js-sdk that records every call and lets a test fire the Messenger's own callbacks.
function fakeSdk() {
  const callbacks = {
    unread: [] as ((count: number) => void)[],
    show: [] as (() => void)[],
    hide: [] as (() => void)[],
  };
  const sdk = {
    Intercom: vi.fn(),
    boot: vi.fn(),
    update: vi.fn(),
    shutdown: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    showSpace: vi.fn(),
    showNewMessage: vi.fn(),
    showArticle: vi.fn(),
    showConversation: vi.fn(),
    showTicket: vi.fn(),
    startSurvey: vi.fn(),
    trackEvent: vi.fn(),
    hideNotifications: vi.fn(),
    onUnreadCountChange: vi.fn((cb: (count: number) => void) => callbacks.unread.push(cb)),
    onShow: vi.fn((cb: () => void) => callbacks.show.push(cb)),
    onHide: vi.fn((cb: () => void) => callbacks.hide.push(cb)),
  } satisfies MessengerSdk;
  return { sdk, callbacks };
}

let sdk: ReturnType<typeof fakeSdk>['sdk'];
let callbacks: ReturnType<typeof fakeSdk>['callbacks'];
let loader: ReturnType<typeof vi.fn>;
let plugin: IntercomMessengerWeb;

beforeEach(() => {
  ({ sdk, callbacks } = fakeSdk());
  loader = vi.fn(async () => sdk);
  plugin = new IntercomMessengerWeb(loader);
});

async function errorOf(promise: Promise<unknown>): Promise<CapacitorException> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(CapacitorException);
  return error as CapacitorException;
}

describe('the Messenger JS SDK', () => {
  it('is not loaded until the first login', async () => {
    await plugin.loadWithKeys({ appId: 'abc123' });
    expect(loader).not.toHaveBeenCalled();
    await plugin.loginUnidentifiedUser();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('rejects with UNAVAILABLE naming the peer dependency when it cannot be loaded', async () => {
    const missing = new IntercomMessengerWeb(async () => {
      throw new Error(`Cannot find package '${PEER_DEPENDENCY}'`);
    });
    await missing.loadWithKeys({ appId: 'abc123' });
    const error = await errorOf(missing.loginUser({ userId: 'u1' }));
    expect(error.code).toBe(ExceptionCode.Unavailable);
    expect(error.message).toContain('@intercom/messenger-js-sdk');
    expect(error.message).toContain('npm install @intercom/messenger-js-sdk');
  });

  it('rejects with UNAVAILABLE when the module does not look like the Messenger SDK', async () => {
    const wrong = new IntercomMessengerWeb(async () => ({ something: 'else' }));
    await wrong.loadWithKeys({ appId: 'abc123' });
    const error = await errorOf(wrong.loginUnidentifiedUser());
    expect(error.code).toBe(ExceptionCode.Unavailable);
  });

  it('accepts the module as a CommonJS default export too', async () => {
    const wrapped = new IntercomMessengerWeb(async () => ({ default: sdk }));
    await wrapped.loadWithKeys({ appId: 'abc123' });
    await wrapped.loginUnidentifiedUser();
    expect(sdk.Intercom).toHaveBeenCalledTimes(1);
  });
});

describe('setup', () => {
  it('rejects a call that needs Intercom before loadWithKeys with NOT_SET_UP', async () => {
    expect((await errorOf(plugin.loginUser({ userId: 'u1' }))).code).toBe('NOT_SET_UP');
    expect((await errorOf(plugin.setLauncherVisible({ visible: true }))).code).toBe('NOT_SET_UP');
    expect((await errorOf(plugin.setUserHash({ hmac: 'hash' }))).code).toBe('NOT_SET_UP');
  });

  it('requires an appId', async () => {
    expect((await errorOf(plugin.loadWithKeys({} as never))).code).toBe('INVALID_ARGUMENT');
  });

  it('accepts the same keys again and refuses other ones', async () => {
    await plugin.loadWithKeys({ appId: 'abc123', region: 'eu' });
    await expect(plugin.loadWithKeys({ appId: 'abc123', region: 'eu' })).resolves.toBeUndefined();
    expect((await errorOf(plugin.loadWithKeys({ appId: 'other' }))).code).toBe('ALREADY_SET_UP');
  });

  it('refuses an unknown region', async () => {
    expect((await errorOf(plugin.loadWithKeys({ appId: 'a', region: 'mars' as never }))).code).toBe('INVALID_ARGUMENT');
  });
});

describe('logging in', () => {
  beforeEach(async () => {
    await plugin.loadWithKeys({ appId: 'abc123', region: 'eu' });
  });

  it('boots the Messenger for the user, with the hash, the JWT and the launcher hidden', async () => {
    await plugin.setUserHash({ hmac: 'hash' });
    await plugin.setUserJwt({ jwt: 'jwt' });
    await plugin.loginUser({ userId: 'u1', email: 'a@example.com' });
    expect(sdk.Intercom).toHaveBeenCalledWith({
      app_id: 'abc123',
      region: 'eu',
      user_id: 'u1',
      email: 'a@example.com',
      user_hash: 'hash',
      intercom_user_jwt: 'jwt',
      hide_default_launcher: true,
      hide_notifications: false,
    });
    expect(sdk.boot).not.toHaveBeenCalled();
  });

  it('needs a userId or an email', async () => {
    expect((await errorOf(plugin.loginUser({}))).code).toBe('INVALID_ARGUMENT');
    expect(sdk.Intercom).not.toHaveBeenCalled();
  });

  it('boots an anonymous visitor', async () => {
    await plugin.loginUnidentifiedUser();
    expect(sdk.Intercom).toHaveBeenCalledWith({
      app_id: 'abc123',
      region: 'eu',
      hide_default_launcher: true,
      hide_notifications: false,
    });
  });

  it('carries the launcher, in-app messages and padding set before the boot into it', async () => {
    await plugin.setLauncherVisible({ visible: true });
    await plugin.setInAppMessagesVisible({ visible: false });
    await plugin.setBottomPadding({ value: 80 });
    expect(sdk.update).not.toHaveBeenCalled();
    await plugin.loginUnidentifiedUser();
    expect(sdk.Intercom).toHaveBeenCalledWith(
      expect.objectContaining({ hide_default_launcher: false, hide_notifications: true, vertical_padding: 80 }),
    );
  });

  it('shuts down on logout and boots again, with the region, on the next login', async () => {
    await plugin.setUserHash({ hmac: 'hash' });
    await plugin.loginUser({ userId: 'u1' });
    await plugin.logout();
    expect(sdk.shutdown).toHaveBeenCalledTimes(1);
    await plugin.loginUser({ userId: 'u2' });
    expect(sdk.Intercom).toHaveBeenCalledTimes(1);
    expect(sdk.boot).toHaveBeenCalledWith({
      app_id: 'abc123',
      user_id: 'u2',
      hide_default_launcher: true,
      hide_notifications: false,
      api_base: 'https://api-iam.eu.intercom.io',
    });
    // the hash belonged to the user who logged out
    expect(sdk.boot.mock.calls[0][0]).not.toHaveProperty('user_hash');
  });
});

describe('after the Messenger has booted', () => {
  beforeEach(async () => {
    await plugin.loadWithKeys({ appId: 'abc123' });
    await plugin.loginUser({ userId: 'u1' });
  });

  it('maps the user attributes to the Messenger names, with custom attributes at the top level', async () => {
    await plugin.updateUser({
      name: 'Ann',
      phone: '+1 555 0100',
      languageOverride: 'fr',
      signedUpAt: 1700000000,
      unsubscribedFromEmails: true,
      company: {
        companyId: 'c1',
        name: 'Acme',
        plan: 'pro',
        monthlySpend: 10,
        createdAt: 1600000000,
        customAttributes: { seats: 3 },
      },
      customAttributes: { region: 'EU', beta: true, score: 1.5, cleared: null },
    });
    expect(sdk.update).toHaveBeenCalledWith({
      name: 'Ann',
      phone: '+1 555 0100',
      language_override: 'fr',
      created_at: 1700000000,
      unsubscribed_from_emails: true,
      company: { id: 'c1', name: 'Acme', plan: 'pro', monthly_spend: 10, created_at: 1600000000, seats: 3 },
      region: 'EU',
      beta: true,
      score: 1.5,
      cleared: null,
    });
  });

  it('refuses a custom attribute that is not a string, number, boolean or null, before sending anything', async () => {
    const error = await errorOf(plugin.updateUser({ customAttributes: { nested: { a: 1 } as never } }));
    expect(error.code).toBe('INVALID_ARGUMENT');
    expect(error.message).toContain('customAttributes.nested');
    expect((await errorOf(plugin.updateUser({ customAttributes: { n: Number.NaN } }))).code).toBe('INVALID_ARGUMENT');
    expect(sdk.update).not.toHaveBeenCalled();
  });

  it('opens the Messenger, a space, the composer, an article and the Help Center', async () => {
    await plugin.present();
    await plugin.present({ space: 'messages' });
    await plugin.present({ space: 'helpCenter' });
    await plugin.presentMessageComposer({ message: 'Hello' });
    await plugin.presentMessageComposer();
    await plugin.presentArticle({ articleId: '42' });
    await plugin.presentHelpCenter();
    expect(sdk.show).toHaveBeenCalledTimes(1);
    expect(sdk.showSpace.mock.calls).toEqual([['messages'], ['help'], ['help']]);
    expect(sdk.showNewMessage.mock.calls).toEqual([['Hello'], ['']]);
    expect(sdk.showArticle).toHaveBeenCalledWith('42');
  });

  it('refuses an unknown space', async () => {
    expect((await errorOf(plugin.present({ space: 'news' as never }))).code).toBe('INVALID_ARGUMENT');
  });

  it('presents the content the web has, and rejects the rest with UNAVAILABLE', async () => {
    await plugin.presentContent({ type: 'article', id: 'a' });
    await plugin.presentContent({ type: 'survey', id: 's' });
    await plugin.presentContent({ type: 'conversation', id: 'c' });
    await plugin.presentContent({ type: 'ticket', id: 't' });
    expect(sdk.showArticle).toHaveBeenCalledWith('a');
    expect(sdk.startSurvey).toHaveBeenCalledWith('s');
    expect(sdk.showConversation).toHaveBeenCalledWith('c');
    expect(sdk.showTicket).toHaveBeenCalledWith('t');
    expect((await errorOf(plugin.presentContent({ type: 'carousel', id: 'x' }))).code).toBe(ExceptionCode.Unavailable);
    expect((await errorOf(plugin.presentContent({ type: 'helpCenterCollections', ids: ['1'] }))).code).toBe(
      ExceptionCode.Unavailable,
    );
    expect((await errorOf(plugin.presentContent({ type: 'article' }))).code).toBe('INVALID_ARGUMENT');
  });

  it('hides, and sets the launcher, in-app messages and padding on the running Messenger', async () => {
    await plugin.hide();
    await plugin.setLauncherVisible({ visible: true });
    await plugin.setInAppMessagesVisible({ visible: false });
    await plugin.setBottomPadding({ value: 40 });
    expect(sdk.hide).toHaveBeenCalledTimes(1);
    expect(sdk.update.mock.calls).toEqual([[{ hide_default_launcher: false }], [{ vertical_padding: 40 }]]);
    expect(sdk.hideNotifications).toHaveBeenCalledWith(true);
    expect((await errorOf(plugin.setBottomPadding({ value: -1 }))).code).toBe('INVALID_ARGUMENT');
  });

  it('tracks an event with and without metadata', async () => {
    await plugin.logEvent({ name: 'opened' });
    await plugin.logEvent({ name: 'bought', data: { price: 3 } });
    expect(sdk.trackEvent.mock.calls).toEqual([['opened'], ['bought', { price: 3 }]]);
  });
});

describe('before a login', () => {
  beforeEach(async () => {
    await plugin.loadWithKeys({ appId: 'abc123' });
  });

  it('rejects what needs a running Messenger with NOT_LOGGED_IN', async () => {
    expect((await errorOf(plugin.present())).code).toBe('NOT_LOGGED_IN');
    expect((await errorOf(plugin.updateUser({ name: 'x' }))).code).toBe('NOT_LOGGED_IN');
    expect((await errorOf(plugin.logEvent({ name: 'x' }))).code).toBe('NOT_LOGGED_IN');
  });

  it('resolves hide and logout without touching the Messenger', async () => {
    await plugin.hide();
    await plugin.logout();
    expect(loader).not.toHaveBeenCalled();
  });
});

describe('the unread conversation count', () => {
  beforeEach(async () => {
    await plugin.loadWithKeys({ appId: 'abc123' });
  });

  it('is 0 before the Messenger reports one', async () => {
    await expect(plugin.getUnreadConversationCount()).resolves.toEqual({ count: 0 });
  });

  it('follows onUnreadCountChange and is reported as unreadConversationCountChange', async () => {
    const listener = vi.fn();
    await plugin.addListener('unreadConversationCountChange', listener);
    await plugin.loginUser({ userId: 'u1' });
    callbacks.unread[0](3);
    expect(listener).toHaveBeenCalledWith({ count: 3 });
    await expect(plugin.getUnreadConversationCount()).resolves.toEqual({ count: 3 });
  });

  it('goes back to 0 on logout, and a callback from before the next boot stays quiet', async () => {
    const listener = vi.fn();
    await plugin.addListener('unreadConversationCountChange', listener);
    await plugin.loginUser({ userId: 'u1' });
    await plugin.logout();
    await expect(plugin.getUnreadConversationCount()).resolves.toEqual({ count: 0 });
    await plugin.loginUser({ userId: 'u2' });
    expect(callbacks.unread).toHaveLength(2);
    callbacks.unread[0](7);
    expect(listener).not.toHaveBeenCalled();
    callbacks.unread[1](2);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ count: 2 });
  });

  it('reports the Messenger showing and hiding', async () => {
    const shown = vi.fn();
    const hidden = vi.fn();
    await plugin.addListener('windowDidShow', shown);
    await plugin.addListener('windowDidHide', hidden);
    await plugin.loginUnidentifiedUser();
    callbacks.show[0]();
    callbacks.hide[0]();
    expect(shown).toHaveBeenCalledTimes(1);
    expect(hidden).toHaveBeenCalledTimes(1);
  });
});

describe('push on the web', () => {
  it('resolves sendPushTokenToIntercom without doing anything', async () => {
    await expect(plugin.sendPushTokenToIntercom({ value: 'token' })).resolves.toBeUndefined();
    expect(loader).not.toHaveBeenCalled();
  });

  it('rejects isIntercomPush and handlePush with UNIMPLEMENTED', async () => {
    expect((await errorOf(plugin.isIntercomPush({ data: {} }))).code).toBe(ExceptionCode.Unimplemented);
    expect((await errorOf(plugin.handlePush({ data: {} }))).code).toBe(ExceptionCode.Unimplemented);
  });
});

describe('isUserLoggedIn', () => {
  beforeEach(async () => {
    await plugin.loadWithKeys({ appId: 'abc123' });
  });

  it('is false until a login has booted the Messenger', async () => {
    await expect(plugin.isUserLoggedIn()).resolves.toEqual({ value: false });
  });

  it('is true after logging in a known user or an anonymous visitor', async () => {
    await plugin.loginUser({ userId: 'u1' });
    await expect(plugin.isUserLoggedIn()).resolves.toEqual({ value: true });
    await plugin.logout();
    await plugin.loginUnidentifiedUser();
    await expect(plugin.isUserLoggedIn()).resolves.toEqual({ value: true });
  });

  it('is false again after logout', async () => {
    await plugin.loginUser({ userId: 'u1' });
    await plugin.logout();
    await expect(plugin.isUserLoggedIn()).resolves.toEqual({ value: false });
  });

  it('stays false when the login fails', async () => {
    const failing = new IntercomMessengerWeb(async () => {
      throw new Error(`Cannot find package '${PEER_DEPENDENCY}'`);
    });
    await failing.loadWithKeys({ appId: 'abc123' });
    await failing.loginUser({ userId: 'u1' }).catch(() => undefined);
    await expect(failing.isUserLoggedIn()).resolves.toEqual({ value: false });
  });
});
