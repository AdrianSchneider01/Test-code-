This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npm test                    # unit tests (jest)
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and tests before declaring any task done.

## Navigation & Routing

- This app uses a small custom stack navigator in `src/state/Navigation.js` (not Expo Router). Screens are registered in the `ROUTES` map in `App.js`; navigate with `useNav()` (`navigate`, `replace`, `back`, `pop`, `reset`, `backTo`).
- Screens that show the Home/Events/Profile navigation are listed in `SHELL_ROUTES` (`src/components/NavBar.js`).

## Project layout

- `src/logic/` — pure, unit-tested logic (recommendation engine, memory, events). Keep UI out of it.
- `src/data/` — categories, the SAMPLE product catalogue and Explore ideas.
- `src/state/` — app state (persisted with AsyncStorage) and navigation.
- `src/components/`, `src/screens/` — UI.
- This is a JavaScript project (no TypeScript), so there is no typecheck step. Run `npm test` and `npm run lint`.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
