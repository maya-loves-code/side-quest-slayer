import "./index.css";
import type { FC } from "react";
import { Composition } from "remotion";
import {
  SideQuestSlayerPhonePromo,
  type SideQuestSlayerPhonePromoProps,
} from "./Composition";
import {
  SHORT_DURATION_IN_FRAMES,
  SHORT_FPS,
  SideQuestSlayerShort,
  type SideQuestSlayerShortProps,
} from "./short/SideQuestSlayerShort";

const fps = 30;
const durationInFrames = fps * 5;

export const RemotionRoot: FC = () => {
  return (
    <>
      <Composition
        id="SideQuestSlayerShortMusic"
        component={SideQuestSlayerShort}
        durationInFrames={SHORT_DURATION_IN_FRAMES}
        fps={SHORT_FPS}
        width={1080}
        height={1920}
        defaultProps={
          {
            musicEnabled: true,
          } satisfies SideQuestSlayerShortProps
        }
      />
      <Composition
        id="SideQuestSlayerShortSfxOnly"
        component={SideQuestSlayerShort}
        durationInFrames={SHORT_DURATION_IN_FRAMES}
        fps={SHORT_FPS}
        width={1080}
        height={1920}
        defaultProps={
          {
            musicEnabled: false,
          } satisfies SideQuestSlayerShortProps
        }
      />
      <Composition
        id="SideQuestSlayerPhonePromoVertical"
        component={SideQuestSlayerPhonePromo}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1080}
        height={1920}
        defaultProps={
          {
            listingImage: "app-store-listing.png",
            variant: "vertical",
          } satisfies SideQuestSlayerPhonePromoProps
        }
      />
      <Composition
        id="SideQuestSlayerPhonePromoSquare"
        component={SideQuestSlayerPhonePromo}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1080}
        height={1080}
        defaultProps={
          {
            listingImage: "app-store-listing.png",
            variant: "square",
          } satisfies SideQuestSlayerPhonePromoProps
        }
      />
    </>
  );
};
