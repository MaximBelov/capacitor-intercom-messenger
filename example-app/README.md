## Example app

A page with a field for the Intercom keys and a button per method of `capacitor-intercom-messenger`, for trying the plugin against
a real workspace on a phone, a simulator or in a browser. It installs the plugin from this repository (`file:..`), so build the
plugin first (`npm run build` in the repository root).

No keys are committed. Type the workspace id and the API key of the platform into the page and press "Set up"; the page keeps them
in the device's `localStorage` for the next launch. To have the native SDK set up at start instead, put them into
`capacitor.config.json` under `plugins.IntercomMessenger` (`iosApiKey`, `iosAppId`, `androidApiKey`, `androidAppId`) on your own
machine, and do not commit them.

```bash
npm install
npm start                          # the web, with @intercom/messenger-js-sdk
npm run build && npx cap sync      # then open ios/App in Xcode or android/ in Android Studio
```
