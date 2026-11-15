// Every method of the TypeScript API has its implementation on the web, its native method on both platforms, its section in the
// README and its row in the README's platform table, and no platform has a method the API does not declare. A miss on either side
// compiles fine and fails only on a phone. Plain Node, no install.
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const SWIFT = 'ios/Sources/IntercomMessengerPlugin/IntercomMessengerPlugin.swift';
const SWIFT_WIRING = 'ios/Sources/IntercomMessengerPlugin/NotificationWiring.swift';
const KOTLIN = 'android/src/main/kotlin/io/github/maximbelov/intercommessenger/IntercomMessengerPlugin.kt';

// addListener and removeAllListeners come with every Capacitor plugin; they are not methods of this one.
const LISTENER_METHODS = new Set(['addListener', 'removeAllListeners']);

const api = [...read('src/definitions.ts').matchAll(/^\s+(\w+)\([^)]*\):\s*Promise</gm)]
  .map((m) => m[1])
  .filter((name) => !LISTENER_METHODS.has(name))
  .sort();
const web = [...read('src/web.ts').matchAll(/^ {2}async (\w+)\(/gm)].map((m) => m[1]).sort();
const ios = [...read(SWIFT).matchAll(/CAPPluginMethod\(name:\s*"(\w+)"/g)].map((m) => m[1]).sort();
const iosFunctions = [...read(SWIFT).matchAll(/@objc func (\w+)\(_ call: CAPPluginCall\)/g)].map((m) => m[1]).sort();
const android = [...read(KOTLIN).matchAll(/@PluginMethod\s+fun (\w+)\(/g)].map((m) => m[1]).sort();
const events = [...read('src/definitions.ts').matchAll(/eventName: '(\w+)'/g)].map((m) => m[1]).sort();

test('the API declares its methods and events', () => {
  assert.equal(api.length, 21, `found ${api.join(', ')}`);
  assert.deepEqual(events, ['unreadConversationCountChange', 'windowDidHide', 'windowDidShow']);
});

test('the web implements exactly the methods of the API', () => {
  assert.deepEqual(web, api);
});

test('iOS registers exactly the methods of the API', () => {
  assert.deepEqual(ios, api);
});

test('iOS has an @objc function for every registered method', () => {
  assert.deepEqual(iosFunctions, api);
});

test('Android annotates exactly the methods of the API', () => {
  assert.deepEqual(android, api);
});

test('the plugin has the same name in JavaScript, Swift and Kotlin', () => {
  assert.match(read('src/index.ts'), /registerPlugin<IntercomMessengerPlugin>\('IntercomMessenger'/);
  assert.match(read(SWIFT), /jsName = "IntercomMessenger"/);
  assert.match(read(KOTLIN), /@CapacitorPlugin\(name = "IntercomMessenger"\)/);
});

test('every platform reports the events under the names the API declares', () => {
  const webSource = read('src/web.ts');
  const swift = read(SWIFT_WIRING);
  for (const event of events) {
    assert.match(webSource, new RegExp(`notifyListeners\\('${event}'`), `the web never reports ${event}`);
    assert.match(swift, new RegExp(`"${event}"`), `iOS never reports ${event}`);
  }
  // The Android SDK has no window callbacks: only the unread count is reported there, and the README says so.
  assert.match(read(KOTLIN), /UNREAD_COUNT_EVENT = "unreadConversationCountChange"/);
});

test('the native config keys are the ones the API documents', () => {
  const config = read('src/definitions.ts').match(/IntercomMessenger\?: \{([\s\S]*?)\n {4}\};/)[1];
  const keys = [...config.matchAll(/^\s+(\w+)\?:/gm)].map((m) => m[1]).sort();
  assert.deepEqual(keys, ['androidApiKey', 'androidAppId', 'iosApiKey', 'iosAppId']);
  assert.match(read(SWIFT), /getString\("iosApiKey"\)/);
  assert.match(read(SWIFT), /getString\("iosAppId"\)/);
  const setup = read('android/src/main/kotlin/io/github/maximbelov/intercommessenger/Setup.kt');
  assert.match(setup, /read\("androidApiKey"\)/);
  assert.match(setup, /read\("androidAppId"\)/);
});

test('the README documents every method and lists it in the platform table', () => {
  const readme = read('README.md');
  for (const method of api) {
    assert.match(readme, new RegExp(`### ${method}\\(`), `README.md has no section for ${method}()`);
    assert.match(
      readme,
      new RegExp(`^\\| \`${method}\` +\\|`, 'm'),
      `README.md's platform table has no row for ${method}`,
    );
  }
});

test('the Intercom SDK versions agree between the Swift package, the podspec, Gradle and the README', () => {
  const spm = read('Package.swift').match(/intercom-ios-sp\.git", from: "(\d+\.\d+\.\d+)"/)[1];
  const pod = read('CapacitorIntercomMessenger.podspec').match(/'Intercom', '~> (\d+\.\d+)'/)[1];
  const gradle = read('android/build.gradle').match(/rootProject\.ext\.intercomSdkVersion : '(\d+\.\d+\.\d+)'/)[1];
  assert.ok(spm.startsWith(`${pod}.`), `Package.swift asks for ${spm}, the podspec for ~> ${pod}`);
  const readme = read('README.md');
  assert.ok(readme.includes(spm), `README.md does not name the iOS SDK version ${spm}`);
  assert.ok(readme.includes(gradle), `README.md does not name the Android SDK version ${gradle}`);
});

test('every ProGuard file the Android library hands to its consumers is in the npm package', () => {
  // Gradle fails an app's build when a consumerProguardFiles entry is missing from node_modules, and
  // package.json's "files" decides what reaches node_modules.
  const gradle = read('android/build.gradle');
  const files = JSON.parse(read('package.json')).files;
  const consumer = [...gradle.matchAll(/consumerProguardFiles\s+((?:'[^']+'\s*,?\s*)+)/g)].flatMap((match) =>
    [...match[1].matchAll(/'([^']+)'/g)].map((name) => `android/${name[1]}`),
  );
  assert.ok(consumer.length > 0, 'the library declares a consumer ProGuard file');
  for (const path of consumer) {
    assert.ok(
      files.some((entry) => path === entry || path.startsWith(entry.endsWith('/') ? entry : `${entry}/`)),
      `${path} is not in package.json "files"`,
    );
    assert.ok(read(path).length > 0, `${path} exists`);
  }
});
