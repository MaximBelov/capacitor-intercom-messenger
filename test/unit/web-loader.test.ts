import { describe, expect, it, vi } from 'vitest';

describe('the web implementation', () => {
  it('is one instance for calls made together before it has loaded', async () => {
    const web = await import('../../src/web');
    const method = vi.spyOn(web.IntercomMessengerWeb.prototype, 'getUnreadConversationCount');
    const { IntercomMessenger } = await import('../../src');

    await Promise.all([
      IntercomMessenger.getUnreadConversationCount({}),
      IntercomMessenger.getUnreadConversationCount({}),
      IntercomMessenger.getUnreadConversationCount({}),
    ]);

    expect(method).toHaveBeenCalledTimes(3);
    expect(new Set(method.mock.contexts).size).toBe(1);
    method.mockRestore();
  });
});
