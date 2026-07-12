# Side Quest Slayer App Store Promo

Reusable Remotion graphic for Side Quest Slayer marketing. An iPhone slides up
from the bottom of the frame with the App Store listing screenshot on-screen.

## Compositions

- `SideQuestSlayerShortMusic` - 1080x1920, approximately 54 seconds, with music
- `SideQuestSlayerShortSfxOnly` - 1080x1920, approximately 54 seconds, without music
- `SideQuestSlayerPhonePromoVertical` - 1080x1920, 5 seconds
- `SideQuestSlayerPhonePromoSquare` - 1080x1080, 5 seconds

## Commands

**Install Dependencies**

```console
npm i
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
npx remotion render SideQuestSlayerShortMusic
npx remotion render SideQuestSlayerShortSfxOnly
npx remotion render SideQuestSlayerPhonePromoVertical
npx remotion render SideQuestSlayerPhonePromoSquare
```

**Render still checks**

```console
npx remotion still SideQuestSlayerPhonePromoVertical --frame=0 --scale=0.25
npx remotion still SideQuestSlayerPhonePromoVertical --frame=40 --scale=0.25
npx remotion still SideQuestSlayerPhonePromoVertical --frame=120 --scale=0.25
```

## Assets

- `public/app-store-listing.png` - App Store listing screenshot
- `public/app-icon.png` - Side Quest Slayer app icon
- `public/marathon-real/` - real-photo marathon journey assets
- `public/vision-board/` - vision-board photo assets
- `public/captions/` - timed short-form captions
- `public/audio/` - music bed and sound effects

## Local source media

The camera originals and local SDR transcodes are intentionally excluded from
Git because they are several gigabytes. Before rendering the short, place these
files in `public/media/`:

- `main-original-lighting-sdr.mp4`
- `broll-original-display-sdr.mp4`

The approved local exports are stored in the ignored `deliverables/` directory.
