import { ExceptionCode } from '@capacitor/core';
import { describe, expect, it, vi } from 'vitest';

// What an app that did not install the optional peer dependency gets: the dynamic import itself fails.
vi.mock('@intercom/messenger-js-sdk', () => {
  throw new Error("Cannot find package '@intercom/messenger-js-sdk'");
});

describe('without @intercom/messenger-js-sdk', () => {
  it('rejects the first login with UNAVAILABLE and says which package to install', async () => {
    const { IntercomMessenger } = await import('../../src');
    await IntercomMessenger.loadWithKeys({ appId: 'abc123' });
    await expect(IntercomMessenger.loginUser({ userId: 'u1' })).rejects.toMatchObject({
      code: ExceptionCode.Unavailable,
      message: expect.stringContaining('npm install @intercom/messenger-js-sdk'),
    });
  });

  it('still answers what does not need the Messenger', async () => {
    const { IntercomMessenger } = await import('../../src');
    await expect(IntercomMessenger.getUnreadConversationCount()).resolves.toEqual({ count: 0 });
  });
});
