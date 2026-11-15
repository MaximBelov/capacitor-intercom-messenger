import { ExceptionCode } from '@capacitor/core';
import { afterAll, describe, expect, it } from 'vitest';

// A native platform whose app was not synced after the plugin was installed: the bridge is there, the plugin's header is not.
const g = globalThis as Record<string, unknown>;
g.androidBridge = {};
g.Capacitor = { PluginHeaders: [] };

afterAll(() => {
  delete g.androidBridge;
  delete g.Capacitor;
});

describe('on a native platform without the native plugin', () => {
  it('rejects with UNIMPLEMENTED instead of falling back to the web implementation', async () => {
    const { IntercomMessenger } = await import('../../src');
    await expect(IntercomMessenger.loadWithKeys({ appId: 'abc', apiKey: 'key' })).rejects.toMatchObject({
      code: ExceptionCode.Unimplemented,
    });
    await expect(IntercomMessenger.getUnreadConversationCount()).rejects.toMatchObject({
      code: ExceptionCode.Unimplemented,
    });
  });
});
