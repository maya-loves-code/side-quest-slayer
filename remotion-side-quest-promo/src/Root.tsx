import "./index.css";
import { Composition } from "remotion";
import {
  SideQuestSlayerPhonePromo,
  type SideQuestSlayerPhonePromoProps,
} from "./Composition";

const fps = 30;
const durationInFrames = fps * 5;

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
