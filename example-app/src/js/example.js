import { Capacitor } from '@capacitor/core';
import { IntercomMessenger } from 'capacitor-intercom-messenger';

const $ = (id) => document.getElementById(id);
const value = (id) => $(id).value.trim();
const optional = (id) => value(id) || undefined;

// The keys stay on this device only, so they never end up in the repository.
const STORED = ['appId', 'apiKey', 'region', 'userId', 'email'];
for (const id of STORED) {
  try {
    const stored = localStorage.getItem(`intercom-example.${id}`);
    if (stored) $(id).value = stored;
  } catch {
    // no storage: start empty
  }
}

function remember() {
  for (const id of STORED) {
    try {
      localStorage.setItem(`intercom-example.${id}`, $(id).value);
    } catch {
      // no storage: nothing to keep
    }
  }
}

function log(line) {
  const time = new Date().toLocaleTimeString();
  $('log').textContent = `${time} ${line}\n${$('log').textContent}`;
}

$('platform').textContent = Capacitor.getPlatform();

IntercomMessenger.addListener('unreadConversationCountChange', ({ count }) => {
  $('unread').textContent = String(count);
  log(`event unreadConversationCountChange ${count}`);
});
IntercomMessenger.addListener('windowDidShow', () => log('event windowDidShow'));
IntercomMessenger.addListener('windowDidHide', () => log('event windowDidHide'));

const calls = {
  loadWithKeys: () => {
    remember();
    return IntercomMessenger.loadWithKeys({ appId: value('appId'), apiKey: optional('apiKey'), region: value('region') });
  },
  setUserHash: () => IntercomMessenger.setUserHash({ hmac: value('hmac') }),
  setUserJwt: () => IntercomMessenger.setUserJwt({ jwt: value('jwt') }),
  loginUser: () => {
    remember();
    return IntercomMessenger.loginUser({ userId: optional('userId'), email: optional('email') });
  },
  loginUnidentifiedUser: () => IntercomMessenger.loginUnidentifiedUser(),
  updateUser: () =>
    IntercomMessenger.updateUser({
      name: optional('name'),
      customAttributes: { example_app: true, example_opened_at: Math.floor(Date.now() / 1000) },
    }),
  logout: () => IntercomMessenger.logout(),
  present: () => IntercomMessenger.present(value('space') ? { space: value('space') } : undefined),
  presentMessageComposer: () => IntercomMessenger.presentMessageComposer({ message: optional('message') }),
  presentArticle: () => IntercomMessenger.presentArticle({ articleId: value('contentId') }),
  presentHelpCenter: () => IntercomMessenger.presentHelpCenter(),
  presentContent: () => {
    const type = value('contentType');
    return type === 'helpCenterCollections'
      ? IntercomMessenger.presentContent({ type, ids: value('contentId').split(',').map((id) => id.trim()) })
      : IntercomMessenger.presentContent({ type, id: value('contentId') });
  },
  hide: () => IntercomMessenger.hide(),
  setLauncherVisible: (button) => IntercomMessenger.setLauncherVisible({ visible: button.dataset.visible === 'true' }),
  setInAppMessagesVisible: (button) =>
    IntercomMessenger.setInAppMessagesVisible({ visible: button.dataset.visible === 'true' }),
  setBottomPadding: () => IntercomMessenger.setBottomPadding({ value: Number(value('padding')) }),
  logEvent: () => IntercomMessenger.logEvent({ name: value('eventName'), data: { source: 'example-app' } }),
  getUnreadConversationCount: async () => {
    const result = await IntercomMessenger.getUnreadConversationCount();
    $('unread').textContent = String(result.count);
    return result;
  },
  sendPushTokenToIntercom: () => IntercomMessenger.sendPushTokenToIntercom({ value: value('pushToken') }),
  isIntercomPush: () => IntercomMessenger.isIntercomPush({ data: JSON.parse(value('pushData') || '{}') }),
  handlePush: () => IntercomMessenger.handlePush({ data: JSON.parse(value('pushData') || '{}') }),
};

for (const button of document.querySelectorAll('button[data-call]')) {
  button.addEventListener('click', async () => {
    const name = button.dataset.call;
    try {
      const result = await calls[name](button);
      log(`${button.textContent} resolved${result === undefined ? '' : ` ${JSON.stringify(result)}`}`);
    } catch (error) {
      log(`${button.textContent} rejected: ${error.code ?? ''} ${error.message}`);
    }
  });
}
