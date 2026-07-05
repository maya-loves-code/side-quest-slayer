# Side Quest Slayer App Store Promo

Reusable Remotion graphic for Side Quest Slayer marketing. An iPhone slides up
from the bottom of the frame with the App Store listing screenshot on-screen.

## Compositions

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
