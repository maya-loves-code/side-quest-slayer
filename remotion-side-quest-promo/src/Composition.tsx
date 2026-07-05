import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type SideQuestSlayerPhonePromoProps = {
  listingImage?: string;
  variant: "vertical" | "square";
};

const palette = {
  paper: "#fffaf0",
  paperWarm: "#f8efdf",
  ink: "#180f24",
  pencil: "#5f5668",
  accent: "#7c3aed",
  accentDark: "#5b21b6",
  accentSoft: "#ede3ff",
  lavenderTape: "#d9bcff",
  lavenderTapeDark: "#8d55dc",
  maskingTape: "#e9d9b7",
  photoPaper: "#fffef9",
  blush: "#ffd9cb",
  sky: "#b8f2e6",
  shadow: "rgba(56, 35, 92, 0.18)",
  shadowStrong: "rgba(56, 35, 92, 0.28)",
};

const flecks = [
  { left: 80, top: 150, width: 7, height: 4, rotate: -12 },
  { left: 230, top: 280, width: 5, height: 5, rotate: 18 },
  { left: 930, top: 210, width: 9, height: 4, rotate: 22 },
  { left: 130, top: 760, width: 6, height: 6, rotate: 8 },
  { left: 900, top: 860, width: 8, height: 5, rotate: -20 },
  { left: 210, top: 1320, width: 8, height: 4, rotate: 16 },
  { left: 820, top: 1460, width: 6, height: 6, rotate: -8 },
  { left: 980, top: 1700, width: 9, height: 4, rotate: 12 },
];

const sparkles = [
  { left: 134, top: 490, size: 48, rotate: -10 },
  { left: 870, top: 375, size: 36, rotate: 20 },
  { left: 835, top: 1240, size: 54, rotate: 8 },
  { left: 218, top: 1570, size: 30, rotate: -18 },
];

const variantLayout = {
  vertical: {
    phoneWidth: 610,
    phoneHeight: 1328,
    finalTop: 380,
    titleTop: 142,
    titleSize: 78,
    subtitleSize: 30,
    stickerTop: 1530,
    iconSize: 146,
    iconLeft: 112,
    iconTop: 1230,
  },
  square: {
    phoneWidth: 390,
    phoneHeight: 850,
    finalTop: 170,
    titleTop: 36,
    titleSize: 44,
    subtitleSize: 20,
    stickerTop: 800,
    iconSize: 104,
    iconLeft: 96,
    iconTop: 720,
  },
} satisfies Record<
  SideQuestSlayerPhonePromoProps["variant"],
  {
    phoneWidth: number;
    phoneHeight: number;
    finalTop: number;
    titleTop: number;
    titleSize: number;
    subtitleSize: number;
    stickerTop: number;
    iconSize: number;
    iconLeft: number;
    iconTop: number;
  }
>;

export const SideQuestSlayerPhonePromo = ({
  listingImage = "app-store-listing.png",
  variant,
}: SideQuestSlayerPhonePromoProps) => {
  const frame = useCurrentFrame();
  const { height, fps } = useVideoConfig();
  const layout = variantLayout[variant];

  const entryProgress = interpolate(frame, [0, 1.25 * fps], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const settleProgress = interpolate(frame, [1.25 * fps, 1.75 * fps], [0, 1], {
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const phoneTop = interpolate(entryProgress, [0, 1], [height + 80, layout.finalTop]);
  const phoneScale = interpolate(settleProgress, [0, 1], [0.985, 1]);
  const decorOpacity = interpolate(frame, [0.45 * fps, 1.3 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={styles.stage}>
      <div style={styles.paperTexture} />
      <div style={styles.topWash} />
      <div style={styles.bottomWash} />
      {flecks.map((fleck) => (
        <div
          key={`${fleck.left}-${fleck.top}`}
          style={{
            ...styles.fleck,
            left: fleck.left,
            top: variant === "square" ? fleck.top * 0.56 : fleck.top,
            width: fleck.width,
            height: fleck.height,
            transform: `rotate(${fleck.rotate}deg)`,
          }}
        />
      ))}

      <div
        style={{
          ...styles.lockup,
          top: layout.titleTop,
          opacity: decorOpacity,
          transform: `translateY(${interpolate(decorOpacity, [0, 1], [24, 0])}px)`,
        }}
      >
        <div style={{ ...styles.title, fontSize: layout.titleSize }}>Side Quest Slayer</div>
        <div style={{ ...styles.subtitle, fontSize: layout.subtitleSize }}>
          Document your progress, one quest at a time.
        </div>
      </div>

      <Tape
        style={{
          left: variant === "square" ? 690 : 735,
          top: variant === "square" ? 130 : 300,
          width: variant === "square" ? 180 : 250,
          angle: 13,
          opacity: decorOpacity,
        }}
      />
      <Tape
        dark
        style={{
          left: variant === "square" ? 110 : 145,
          top: variant === "square" ? 560 : 1110,
          width: variant === "square" ? 170 : 250,
          angle: -11,
          opacity: decorOpacity,
        }}
      />

      {sparkles.map((sparkle) => (
        <Sparkle
          key={`${sparkle.left}-${sparkle.top}`}
          left={sparkle.left}
          top={variant === "square" ? sparkle.top * 0.55 : sparkle.top}
          size={sparkle.size}
          rotate={sparkle.rotate}
          opacity={decorOpacity}
        />
      ))}

      <div
        style={{
          ...styles.iconSticker,
          left: layout.iconLeft,
          top: layout.iconTop,
          width: layout.iconSize,
          height: layout.iconSize,
          opacity: decorOpacity,
          transform: `rotate(-5deg) scale(${interpolate(decorOpacity, [0, 1], [0.92, 1])})`,
        }}
      >
        <Img src={staticFile("app-icon.png")} style={styles.iconImage} />
      </div>

      <div
        style={{
          ...styles.captionSticker,
          top: layout.stickerTop,
          opacity: decorOpacity,
          transform: `rotate(3deg) translateY(${interpolate(decorOpacity, [0, 1], [18, 0])}px)`,
        }}
      >
        <span style={styles.captionKicker}>Now live</span>
        <span>Start a quest. Slay the follow-through.</span>
      </div>

      <PhoneMockup
        listingImage={listingImage}
        width={layout.phoneWidth}
        height={layout.phoneHeight}
        top={phoneTop}
        scale={phoneScale}
      />
    </AbsoluteFill>
  );
};

const PhoneMockup = ({
  listingImage,
  width,
  height,
  top,
  scale,
}: {
  listingImage: string;
  width: number;
  height: number;
  top: number;
  scale: number;
}) => {
  const bezel = Math.max(14, width * 0.035);
  const screenRadius = width * 0.08;

  return (
    <div
      style={{
        ...styles.phoneWrap,
        width,
        height,
        top,
        transform: `translateX(-50%) scale(${scale})`,
        borderRadius: width * 0.12,
        padding: bezel,
      }}
    >
      <div style={{ ...styles.phoneHighlight, borderRadius: width * 0.11 }} />
      <div style={{ ...styles.phoneScreen, borderRadius: screenRadius }}>
        <Img
          src={staticFile(listingImage)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "top center",
          }}
        />
      </div>
      <div
        style={{
          ...styles.dynamicIsland,
          width: width * 0.27,
          height: height * 0.028,
          borderRadius: height * 0.018,
          top: bezel + height * 0.015,
        }}
      />
    </div>
  );
};

const Tape = ({
  style,
  dark = false,
}: {
  style: CSSProperties & { angle: number };
  dark?: boolean;
}) => {
  const { angle, ...rest } = style;

  return (
    <div
      style={{
        ...styles.tape,
        ...rest,
        background: dark ? palette.lavenderTapeDark : palette.maskingTape,
        transform: `rotate(${angle}deg)`,
      }}
    />
  );
};

const Sparkle = ({
  left,
  top,
  size,
  rotate,
  opacity,
}: {
  left: number;
  top: number;
  size: number;
  rotate: number;
  opacity: number;
}) => (
  <div
    style={{
      ...styles.sparkle,
      left,
      top,
      width: size,
      height: size,
      opacity,
      transform: `rotate(${rotate}deg)`,
    }}
  >
    <div style={styles.sparkleVertical} />
    <div style={styles.sparkleHorizontal} />
  </div>
);

const styles: Record<string, CSSProperties> = {
  stage: {
    overflow: "hidden",
    backgroundColor: palette.paper,
    color: palette.ink,
  },
  paperTexture: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "radial-gradient(rgba(69, 50, 35, 0.08) 1.2px, transparent 1.2px)",
    backgroundSize: "38px 38px",
    opacity: 0.55,
  },
  topWash: {
    position: "absolute",
    width: 900,
    height: 900,
    right: -320,
    top: -340,
    borderRadius: 999,
    background: palette.accentSoft,
    opacity: 0.78,
  },
  bottomWash: {
    position: "absolute",
    width: 820,
    height: 820,
    left: -340,
    bottom: -340,
    borderRadius: 999,
    background: palette.blush,
    opacity: 0.5,
  },
  fleck: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(69, 50, 35, 0.17)",
  },
  lockup: {
    position: "absolute",
    left: 0,
    width: "100%",
    textAlign: "center",
    padding: "0 96px",
    zIndex: 4,
  },
  eyebrow: {
    color: palette.accentDark,
    fontWeight: 800,
    letterSpacing: 3.4,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  title: {
    color: palette.ink,
    fontWeight: 950,
    lineHeight: 0.96,
  },
  subtitle: {
    color: palette.pencil,
    fontWeight: 650,
    lineHeight: 1.2,
    marginTop: 20,
  },
  tape: {
    position: "absolute",
    height: 56,
    borderRadius: 8,
    boxShadow: `0 18px 42px ${palette.shadow}`,
    mixBlendMode: "multiply",
    zIndex: 6,
  },
  sparkle: {
    position: "absolute",
    zIndex: 5,
  },
  sparkleVertical: {
    position: "absolute",
    left: "43%",
    top: 0,
    width: "14%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  sparkleHorizontal: {
    position: "absolute",
    left: 0,
    top: "43%",
    width: "100%",
    height: "14%",
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  iconSticker: {
    position: "absolute",
    padding: 12,
    borderRadius: 34,
    background: palette.photoPaper,
    boxShadow: `0 22px 55px ${palette.shadowStrong}`,
    zIndex: 7,
  },
  iconImage: {
    width: "100%",
    height: "100%",
    borderRadius: 24,
    objectFit: "cover",
  },
  captionSticker: {
    position: "absolute",
    left: "50%",
    width: 560,
    marginLeft: -280,
    minHeight: 122,
    borderRadius: 18,
    background: palette.photoPaper,
    border: `4px solid ${palette.lavenderTape}`,
    boxShadow: `0 20px 46px ${palette.shadow}`,
    color: palette.ink,
    fontSize: 31,
    fontWeight: 850,
    lineHeight: 1.1,
    padding: "24px 30px 24px",
    textAlign: "center",
    zIndex: 7,
  },
  captionKicker: {
    display: "block",
    color: palette.accentDark,
    fontSize: 21,
    fontWeight: 950,
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  phoneWrap: {
    position: "absolute",
    left: "50%",
    background: "#08080b",
    boxShadow:
      "0 55px 120px rgba(36, 23, 57, 0.34), inset 0 0 0 2px rgba(255, 255, 255, 0.12)",
    zIndex: 10,
    transformOrigin: "center bottom",
  },
  phoneHighlight: {
    position: "absolute",
    inset: 5,
    border: "2px solid rgba(255, 255, 255, 0.12)",
    pointerEvents: "none",
  },
  phoneScreen: {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
    background: "#000",
  },
  dynamicIsland: {
    position: "absolute",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#000",
    boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.08)",
    zIndex: 11,
  },
};
