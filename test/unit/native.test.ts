import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { IntercomMessengerPlugin } from '../../src';

// What the native side of Capacitor injects into the web view: a bridge object that makes the platform 'android', the headers of
// the installed plugins, and nativePromise, which every promise method of a plugin goes through.
const nativePromise = vi.fn(async (): Promise<unknown> => undefined);
const g = globalThis as Record<string, unknown>;

let IntercomMessenger: IntercomMessengerPlugin;

beforeAll(async () => {
  g.androidBridge = {};
  g.Capacitor = {
    PluginHeaders: [
      {
        name: 'IntercomMessenger',
        methods: [
          { name: 'loginUser', rtype: 'promise' },
          { name: 'getUnreadConversationCount', rtype: 'promise' },
          { name: 'present', rtype: 'promise' },
        ],
      },
    ],
    nativePromise,
  };
  ({ IntercomMessenger } = await import('../../src'));
});

afterAll(() => {
  delete g.androidBridge;
  delete g.Capacitor;
});

describe('on a native platform', () => {
  it('sends a call to the native plugin named IntercomMessenger, with its options', async () => {
    await IntercomMessenger.loginUser({ userId: 'u1' });
    expect(nativePromise).toHaveBeenCalledWith('IntercomMessenger', 'loginUser', { userId: 'u1' });
  });

  it('resolves with what the native side answers', async () => {
    nativePromise.mockResolvedValueOnce({ count: 4 });
    await expect(IntercomMessenger.getUnreadConversationCount()).resolves.toEqual({ count: 4 });
  });

  it('passes on a rejection from the native side', async () => {
    nativePromise.mockRejectedValueOnce(new Error('from native'));
    await expect(IntercomMessenger.present()).rejects.toThrow('from native');
  });

  it('does not load the web implementation or the Messenger JS SDK', async () => {
    await IntercomMessenger.present({ space: 'messages' });
    expect(nativePromise).toHaveBeenLastCalledWith('IntercomMessenger', 'present', { space: 'messages' });
  });
});
