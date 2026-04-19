# Side Quest Slayer

Bare-bones V1 of a private, local-first progress journal for multiple active quests.

## What is included

- Multiple active quests with last-opened quest restore
- Full-screen daily proof camera
- Camera roll photo uploads from the capture flow
- Local photo persistence to the device file system
- Local SQLite storage for quests and entries
- Scrapbook-style 2-3 column moment grid
- Inline "Your journey so far" comparison for first vs latest photo
- Trophy Room for archived quests
- Daily local reminder notification

## Stack

- Expo
- React Native
- `expo-camera`
- `expo-image-picker`
- `expo-sqlite`
- `expo-file-system`
- `expo-notifications`

## Run locally

```bash
npm install
npm run start
```

Open in the Expo Go app or run on an iOS/Android simulator.

## Notes

- All data is local-only for V1.
- Photos are copied into the app's internal document directory.
- The first journal image is marked as the milestone anchor in SQLite to support future montage or milestone features.
- The app's brand palette is purple and is defined in `src/theme/colors.ts`.

## Public Repo Safety

- This app does not require API keys or backend credentials for V1.
- Keep `package.json` marked `"private": true` to avoid accidental npm publishing.
- Do not commit local artifacts such as `node_modules/`, `.expo/`, `.DS_Store`, or `.env` files.
- If any secret was ever pasted into this project in the past, rotate it before making the GitHub repo public.

Last verified GitHub push flow from local machine: April 5, 2026.
