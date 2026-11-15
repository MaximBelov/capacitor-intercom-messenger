# Contributing

This guide provides instructions for contributing to this Capacitor plugin.

## Developing

### Local Setup

1. Fork and clone the repo.
1. Install the dependencies.

    ```shell
    npm install
    ```

1. Install SwiftLint if you're on macOS.

    ```shell
    brew install swiftlint
    ```

Building the native parts needs Xcode (iOS 15 SDK or newer) and JDK 21 with the Android SDK, as Capacitor 8 does.

### Scripts

#### `npm run build`

Build the plugin web assets and generate plugin API documentation using [`@capacitor/docgen`](https://github.com/ionic-team/capacitor-docgen).

It will compile the TypeScript code from `src/` into ESM JavaScript in `dist/esm/`. These files are used in apps with bundlers when your plugin is imported.

Then, Rollup will bundle the code into a single file at `dist/plugin.js`. This file is used in apps without bundlers by including it as a script in `index.html`.

The API section of `README.md` is written by docgen from the JSDoc in `src/definitions.ts`. Commit the README it writes: CI fails a
change whose README is not what docgen writes.

#### `npm run verify`

Build and validate the web and native projects.

This is useful to run in CI to verify that the plugin builds for all platforms.

#### `npm run lint` / `npm run fmt`

Check formatting and code quality, autoformat/autofix if possible.

ESLint (`eslint.config.mjs`, with `@ionic/eslint-config`), Prettier (`@ionic/prettier-config`) and SwiftLint.

#### Tests

```shell
npm run test:unit      # Vitest: the web implementation, with the Messenger JS SDK replaced by a stand-in
npm run test:parity    # the API, the web, iOS, Android and the README name the same methods, events and SDK versions
npm run test:android   # JUnit on the JVM
npm run test:ios       # XCTest on an iOS simulator
```

A new method goes into `src/definitions.ts`, `src/web.ts`, the Swift plugin's `pluginMethods` and an `@objc func`, the Kotlin
plugin's `@PluginMethod`, and a row of the platform table in the README. The parity test names whichever is missing.

#### The example app

`example-app/` installs the plugin from this repository and has a button per method. `npm run example:android:build` and
`npm run example:ios:build` build it the way CI does.

`.github/workflows/pins.yaml` keeps the native SDK pins current every Monday: when a newer Intercom iOS or Android SDK is out, it
opens a pull request that moves the pin (`Package.swift` and the podspec, or `android/build.gradle`) and the README lines that
name it, and starts CI on its branch. It needs Settings > Actions > General > "Allow GitHub Actions to create and approve pull
requests". `node scripts/check-pins.mjs` says where each pin stands.

## Publishing

A version is published by CI, not by hand: `.github/workflows/ci.yaml` publishes the version in `package.json` to npm when a push
to `main` carries a version that is not on npm yet, through npm's trusted publishing (no npm token). So a release is a pull request
that bumps `version` in `package.json`, merged to `main`.

> **Note**: The [`files`](https://docs.npmjs.com/cli/v7/configuring-npm/package-json#files) array in `package.json` specifies which files get published. If you rename files/directories or add files elsewhere, you may need to update it.
