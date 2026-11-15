import { describe, expect, it, vi } from 'vitest';

// The default loader is a dynamic import of the package name. vi.mock replaces that module for this file only, so this checks the
// plugin reaches for the right package without loading the real Messenger script.
const boot = vi.hoisted(() => ({ Intercom: vi.fn() }));
vi.mock('@intercom/messenger-js-sdk', () => ({
  Intercom: boot.Intercom,
  boot: vi.fn(),
  update: vi.fn(),
  shutdown: vi.fn(),
  onUnreadCountChange: vi.fn(),
  onShow: vi.fn(),
  onHide: vi.fn(),
}));

describe('the default loader', () => {
  it('imports @intercom/messenger-js-sdk and boots through it', async () => {
    const { IntercomMessengerWeb } = await import('../../src/web');
    const plugin = new IntercomMessengerWeb();
    await plugin.loadWithKeys({ appId: 'abc123' });
    await plugin.loginUnidentifiedUser();
    expect(boot.Intercom).toHaveBeenCalledWith(expect.objectContaining({ app_id: 'abc123', region: 'us' }));
  });
});
