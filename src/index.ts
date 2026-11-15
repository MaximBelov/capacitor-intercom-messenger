import { registerPlugin } from '@capacitor/core';

import type { IntercomMessengerPlugin } from './definitions';

const IntercomMessenger = registerPlugin<IntercomMessengerPlugin>('IntercomMessenger', {
  web: () => import('./web').then((m) => new m.IntercomMessengerWeb()),
});

export * from './definitions';
export { IntercomMessenger };
