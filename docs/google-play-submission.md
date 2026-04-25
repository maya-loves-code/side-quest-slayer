# Google Play Submission Notes

Use these notes when completing Play Console app content, Data Safety, and store listing fields for Side Quest Slayer V1.

## Privacy Policy URL

After GitHub Pages is enabled for the `docs` folder, use this URL in Play Console:

https://maya-loves-code.github.io/side-quest-slayer/privacy-policy.html

## Data Safety

Side Quest Slayer V1 is local-only:

- No account creation or login.
- No backend server.
- No analytics SDK.
- No ads SDK.
- No crash-reporting SDK.
- No cloud sync or remote photo storage.
- Android app data backup is disabled for local app storage.

Camera and photo library access are used only when the user creates proof moments. Quest titles, captions/reflections, photo file locations, and copied proof photos stay in local app storage on the device.

Daily reminders are optional local notifications. Do not describe them as push notifications unless remote push notification functionality is added later.

## Permissions to Expect

Production Android builds should include:

- `android.permission.CAMERA`
- `android.permission.POST_NOTIFICATIONS`
- `android.permission.INTERNET`
- `android.permission.VIBRATE`

Production Android builds should not include:

- `android.permission.RECORD_AUDIO`
- `android.permission.READ_EXTERNAL_STORAGE`
- `android.permission.WRITE_EXTERNAL_STORAGE`
- `android.permission.SYSTEM_ALERT_WINDOW`

If any blocked permission appears in a release manifest or Play Console warning, inspect new dependencies or Expo plugins before submitting.

Production Android builds should also keep `android:allowBackup="false"` because quest photos, captions, and SQLite data are intentionally local/private.

## Store Listing Language

Suggested short description:

Track personal quests with local proof photos, reflections, and daily reminders.

Suggested feature copy:

Side Quest Slayer helps you build momentum on personal goals by saving local proof photos and short reflections for each quest. Use the camera or choose a photo from your camera roll to document each step. Your V1 quest data stays on your device.
