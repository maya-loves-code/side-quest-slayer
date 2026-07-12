import { Audio, Video } from "@remotion/media";
import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { CaptionLayer } from "./CaptionLayer";

export const SHORT_FPS = 30;
export const SHORT_DURATION_IN_FRAMES = 1624;

export type SideQuestSlayerShortProps = {
  musicEnabled: boolean;
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
  shadow: "rgba(56, 35, 92, 0.2)",
  shadowStrong: "rgba(56, 35, 92, 0.32)",
};

const sourceStartSeconds = 9.44;
const sourceEndSeconds = 65.8;

const sec = (seconds: number) => Math.round(seconds * SHORT_FPS);

const photoMoments = [
  {
    src: "marathon-real/july-long-run.jpg",
    month: "JANUARY",
    label: "First long run outside",
    rotate: -4,
    objectPosition: "center 58%",
  },
  {
    src: "marathon-real/march-sunrise-runners.jpg",
    month: "MARCH",
    label: "Sunrise miles with friends",
    rotate: -2,
    objectPosition: "center 52%",
  },
  {
    src: "marathon-real/may-workout.jpeg",
    month: "MAY",
    label: "4.48 miles — getting stronger",
    rotate: 3,
    objectPosition: "center 42%",
  },
  {
    src: "marathon-real/july-gym.jpg",
    month: "JULY",
    label: "Kept showing up at the gym",
    rotate: 4,
    objectPosition: "44% center",
  },
  {
    src: "marathon-real/race-day.jpg",
    month: "RACE DAY",
    label: "The joy at the finish",
    rotate: -3,
    objectPosition: "center 44%",
  },
] as const;

const PaperStage = ({ children }: { children?: ReactNode }) => (
  <AbsoluteFill
    style={{
      background: palette.paper,
      color: palette.ink,
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "radial-gradient(rgba(69, 50, 35, 0.09) 1.2px, transparent 1.2px)",
        backgroundSize: "36px 36px",
        opacity: 0.55,
      }}
    />
    <div
      style={{
        position: "absolute",
        width: 820,
        height: 820,
        right: -360,
        top: -300,
        borderRadius: 999,
        background: palette.accentSoft,
        opacity: 0.72,
      }}
    />
    <div
      style={{
        position: "absolute",
        width: 760,
        height: 760,
        left: -330,
        bottom: -300,
        borderRadius: 999,
        background: palette.blush,
        opacity: 0.48,
      }}
    />
    {children}
  </AbsoluteFill>
);

const Sparkle = ({ left, top, size = 42, color = palette.accent }: { left: number; top: number; size?: number; color?: string }) => (
  <div style={{ position: "absolute", left, top, width: size, height: size }}>
    <div
      style={{
        position: "absolute",
        left: "43%",
        top: 0,
        width: "14%",
        height: "100%",
        borderRadius: 999,
        background: color,
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 0,
        top: "43%",
        width: "100%",
        height: "14%",
        borderRadius: 999,
        background: color,
      }}
    />
  </div>
);

const Tape = ({ left, top, width = 190, rotate = 0, dark = false }: { left: number; top: number; width?: number; rotate?: number; dark?: boolean }) => (
  <div
    style={{
      position: "absolute",
      left,
      top,
      width,
      height: 52,
      borderRadius: 8,
      background: dark ? palette.lavenderTape : palette.maskingTape,
      boxShadow: `0 14px 34px ${palette.shadow}`,
      opacity: 0.9,
      rotate: `${rotate}deg`,
      zIndex: 5,
    }}
  />
);

const Polaroid = ({
  src,
  label,
  width,
  height,
  left,
  top,
  rotate,
  delay = 0,
}: {
  src: string;
  label: string;
  width: number;
  height: number;
  left: number;
  top: number;
  rotate: number;
  delay?: number;
}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [delay, delay + 15], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        padding: "22px 22px 76px",
        borderRadius: 7,
        background: palette.photoPaper,
        boxShadow: `0 24px 58px ${palette.shadowStrong}`,
        opacity: enter,
        rotate: `${interpolate(enter, [0, 1], [rotate - 5, rotate])}deg`,
        scale: interpolate(enter, [0, 1], [0.84, 1]),
        translate: `0 ${interpolate(enter, [0, 1], [80, 0])}px`,
      }}
    >
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: 3,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 20,
          right: 20,
          bottom: 22,
          color: palette.ink,
          fontFamily: '"Arial Rounded MT Bold", Arial, sans-serif',
          fontSize: 28,
          lineHeight: 1,
          textAlign: "center",
        }}
      >
        {label}
      </div>
    </div>
  );
};

const TalkingHead = () => {
  const frame = useCurrentFrame();

  const talkingHeadStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    scale: interpolate(frame, [0, SHORT_DURATION_IN_FRAMES], [1, 1.035], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  };

  const segments = [
    { from: 0, sourceStart: 0, duration: sec(21.3) },
    { from: sec(21.3), sourceStart: sec(22.55), duration: sec(26.62) - sec(22.55) },
    {
      from: sec(21.3) + sec(26.62) - sec(22.55),
      sourceStart: sec(27.6),
      duration: SHORT_DURATION_IN_FRAMES - (sec(21.3) + sec(26.62) - sec(22.55)),
    },
  ];

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#dedbd5" }}>
      {segments.map((segment) => (
        <Sequence
          key={`${segment.from}-${segment.sourceStart}`}
          from={segment.from}
          durationInFrames={segment.duration}
          premountFor={SHORT_FPS}
        >
          <Video
            src={staticFile("media/main-original-lighting-sdr.mp4")}
            trimBefore={sec(sourceStartSeconds) + segment.sourceStart}
            trimAfter={sec(sourceEndSeconds)}
            objectFit="cover"
            style={talkingHeadStyle}
          />
        </Sequence>
      ))}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(255,250,240,0.1) 0%, transparent 36%, rgba(24,15,36,0.08) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const CreatorLowerThird = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [4, 13, 91, 108], [0, 1, 1, 0], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: 128,
        top: 1240,
        width: 500,
        padding: "22px 30px",
        borderRadius: 18,
        border: `3px solid ${palette.lavenderTape}`,
        background: "rgba(255, 250, 240, 0.94)",
        boxShadow: `0 22px 50px ${palette.shadow}`,
        opacity,
        translate: `${interpolate(opacity, [0, 1], [-36, 0])}px 0`,
        zIndex: 20,
      }}
    >
      <div
        style={{
          color: palette.ink,
          fontFamily: '"Arial Rounded MT Bold", Arial, sans-serif',
          fontSize: 44,
          lineHeight: 1,
        }}
      >
        Maya Bello
      </div>
      <div style={{ marginTop: 10, color: palette.accentDark, fontSize: 28, fontWeight: 800 }}>
        Co-creator · Side Quest Slayer
      </div>
    </div>
  );
};

const VisionBoardScene = () => {
  const frame = useCurrentFrame();

  return (
    <PaperStage>
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 620,
          padding: "18px 28px",
          borderRadius: 14,
          background: palette.accent,
          color: "white",
          fontFamily: '"Arial Rounded MT Bold", Arial, sans-serif',
          fontSize: 32,
          letterSpacing: 2,
          rotate: "-3deg",
          opacity: interpolate(frame, [0, 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        MY 2026 VISION BOARD
      </div>
      <Polaroid
        src="vision-board/financial-freedom.jpg"
        label="financial freedom"
        width={430}
        height={560}
        left={92}
        top={760}
        rotate={-5}
        delay={0}
      />
      <Polaroid
        src="vision-board/healthy-living.jpg"
        label="nourish my body"
        width={365}
        height={455}
        left={600}
        top={720}
        rotate={5}
        delay={8}
      />
      <Polaroid
        src="vision-board/travel.jpg"
        label="see the world"
        width={400}
        height={500}
        left={510}
        top={1250}
        rotate={-3}
        delay={16}
      />
      <Tape left={224} top={738} rotate={-4} />
      <Tape left={682} top={698} width={165} rotate={7} dark />
      <Sparkle left={850} top={1150} size={62} />
      <Sparkle left={128} top={1400} size={46} color={palette.lavenderTapeDark} />
    </PaperStage>
  );
};

const CalendarOverlay = () => {
  const frame = useCurrentFrame();
  const cards = [
    { month: "JAN", note: "new year energy", rotate: -6, left: 124, delay: 0 },
    { month: "APR", note: "life got busy", rotate: 3, left: 386, delay: 9 },
    { month: "JUL", note: "still dreaming", rotate: -2, left: 648, delay: 18 },
  ];

  return (
    <AbsoluteFill style={{ zIndex: 16 }}>
      {cards.map((card) => {
        const enter = interpolate(frame, [card.delay, card.delay + 14], [0, 1], {
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={card.month}
            style={{
              position: "absolute",
              left: card.left,
              top: 1260,
              width: 235,
              height: 210,
              borderRadius: 18,
              border: `4px solid ${palette.lavenderTape}`,
              background: "rgba(255, 250, 240, 0.96)",
              boxShadow: `0 22px 50px ${palette.shadow}`,
              padding: "24px 20px",
              textAlign: "center",
              opacity: enter,
              rotate: `${interpolate(enter, [0, 1], [card.rotate - 5, card.rotate])}deg`,
              translate: `0 ${interpolate(enter, [0, 1], [80, 0])}px`,
            }}
          >
            <div
              style={{
                color: palette.accentDark,
                fontFamily: '"Arial Rounded MT Bold", Arial, sans-serif',
                fontSize: 56,
                lineHeight: 1,
              }}
            >
              {card.month}
            </div>
            <div style={{ marginTop: 22, color: palette.pencil, fontSize: 25, fontWeight: 750, lineHeight: 1.1 }}>
              {card.note}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const OnboardingScene = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, sec(7.7)], [0, 1], {
    easing: Easing.bezier(0.45, 0, 0.55, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <PaperStage>
      <div
        style={{
          position: "absolute",
          left: 275,
          top: 610,
          width: 530,
          height: 1160,
          padding: 16,
          borderRadius: 68,
          background: "#120e18",
          boxShadow: `0 34px 75px ${palette.shadowStrong}`,
          scale: interpolate(frame, [0, 18], [0.9, 1], {
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: 54, overflow: "hidden", background: palette.paper }}>
          <Img
            src={staticFile("onboarding-page.png")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: `center ${interpolate(progress, [0, 1], [0, 18])}%`,
              scale: interpolate(progress, [0, 1], [1, 1.1]),
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 27,
            width: 148,
            height: 36,
            marginLeft: -74,
            borderRadius: 999,
            background: "#08070a",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 100,
          top: 720,
          width: 220,
          padding: "18px 20px",
          borderRadius: 16,
          background: palette.photoPaper,
          border: `3px solid ${palette.lavenderTape}`,
          boxShadow: `0 18px 42px ${palette.shadow}`,
          color: palette.accentDark,
          fontSize: 28,
          fontWeight: 900,
          rotate: "-5deg",
          textAlign: "center",
        }}
      >
        choose a quest ✦
      </div>
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 1310,
          width: 240,
          padding: "20px 22px",
          borderRadius: 16,
          background: palette.accent,
          boxShadow: `0 18px 42px ${palette.shadow}`,
          color: "white",
          fontSize: 28,
          fontWeight: 900,
          rotate: "5deg",
          textAlign: "center",
        }}
      >
        make it yours
      </div>
      <Sparkle left={850} top={760} size={48} />
      <Sparkle left={150} top={1510} size={42} color={palette.lavenderTapeDark} />
    </PaperStage>
  );
};

const BrollVideo = ({ start, end, playbackRate = 1 }: { start: number; end: number; playbackRate?: number }) => (
  <Video
      src={staticFile("media/broll-original-display-sdr.mp4")}
    trimBefore={sec(start)}
    trimAfter={sec(end)}
    playbackRate={playbackRate}
    muted
    objectFit="cover"
    style={{
      width: "100%",
      height: "100%",
      scale: 1.05,
    }}
  />
);

const QuestStickerOverlay = () => {
  const frame = useCurrentFrame();
  const quests = [
    { text: "build a business", emoji: "🚀", left: 88, top: 1120, rotate: -5, delay: sec(0.95) },
    { text: "learn a skill", emoji: "🎸", left: 620, top: 1050, rotate: 5, delay: sec(2.56) },
    { text: "create content", emoji: "📸", left: 148, top: 1450, rotate: 3, delay: sec(3.68) },
  ];

  return (
    <AbsoluteFill style={{ zIndex: 18 }}>
      {quests.map((quest) => {
        const enter = interpolate(frame, [quest.delay, quest.delay + 15], [0, 1], {
          easing: Easing.bezier(0.34, 1.4, 0.64, 1),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={quest.text}
            style={{
              position: "absolute",
              left: quest.left,
              top: quest.top,
              minWidth: 330,
              padding: "22px 28px",
              borderRadius: 999,
              border: `3px solid ${palette.lavenderTape}`,
              background: "rgba(255, 250, 240, 0.96)",
              boxShadow: `0 18px 45px ${palette.shadow}`,
              color: palette.accentDark,
              fontFamily: '"Arial Rounded MT Bold", Arial, sans-serif',
              fontSize: 31,
              opacity: enter,
              rotate: `${quest.rotate}deg`,
              scale: interpolate(enter, [0, 1], [0.76, 1]),
              textAlign: "center",
            }}
          >
            <span style={{ marginRight: 12 }}>{quest.emoji}</span>
            {quest.text}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const DemoBrollScene = () => {
  return (
    <AbsoluteFill style={{ background: "#ddd7cf", overflow: "hidden" }}>
      <BrollVideo start={5.45} end={8.5} />
      <div
        style={{
          position: "absolute",
          left: 180,
          top: 1420,
          width: 720,
          padding: "20px 24px",
          borderRadius: 16,
          background: "rgba(255,250,240,0.94)",
          border: `3px solid ${palette.lavenderTape}`,
          color: palette.accentDark,
          fontFamily: '"Arial Rounded MT Bold", Arial, sans-serif',
          fontSize: 35,
          textAlign: "center",
          boxShadow: `0 18px 45px ${palette.shadow}`,
        }}
      >
        choose it → log it → remember it
      </div>
    </AbsoluteFill>
  );
};

const MarathonMontageScene = () => {
  const frame = useCurrentFrame();
  const segmentStarts = [0, sec(2.8), sec(5.8), sec(8.1)];
  const photoIndex = frame >= segmentStarts[3] ? 3 : frame >= segmentStarts[2] ? 2 : frame >= segmentStarts[1] ? 1 : 0;
  const photo = photoMoments[photoIndex];
  const enter = 1;

  return (
    <PaperStage>
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 650,
          padding: "16px 26px",
          borderRadius: 14,
          background: palette.accent,
          color: "white",
          fontFamily: '"Arial Rounded MT Bold", Arial, sans-serif',
          fontSize: 30,
          letterSpacing: 2,
          rotate: "-3deg",
        }}
      >
        {photo.month}
      </div>
      <div
        style={{
          position: "absolute",
          left: 185,
          top: 760,
          width: 710,
          height: 810,
          padding: "28px 28px 100px",
          borderRadius: 8,
          background: palette.photoPaper,
          boxShadow: `0 34px 80px ${palette.shadowStrong}`,
          opacity: enter,
          rotate: `${interpolate(enter, [0, 1], [photo.rotate - 5, photo.rotate])}deg`,
          scale: interpolate(enter, [0.42, 1], [0.94, 1]),
          translate: `0 ${interpolate(enter, [0.42, 1], [34, 0])}px`,
        }}
      >
        <Img
          src={staticFile(photo.src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: photo.objectPosition,
            borderRadius: 4,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 32,
            right: 32,
            bottom: 30,
            color: palette.ink,
            fontFamily: '"Arial Rounded MT Bold", Arial, sans-serif',
            fontSize: 38,
            textAlign: "center",
          }}
        >
          {photo.label}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 170,
          top: 1690,
          width: 740,
          height: 14,
          borderRadius: 999,
          background: palette.accentSoft,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${interpolate(frame, [0, sec(8.8)], [8, 100], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}%`,
            height: "100%",
            borderRadius: 999,
            background: `linear-gradient(90deg, ${palette.accentDark}, ${palette.lavenderTapeDark})`,
          }}
        />
      </div>
      <Sparkle left={846} top={700} size={54} />
      <Sparkle left={120} top={1510} size={46} color={palette.lavenderTapeDark} />
    </PaperStage>
  );
};

const CaptureMomentScene = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: "#ded9d2", overflow: "hidden" }}>
      <BrollVideo start={11.55} end={14.35} playbackRate={0.9} />
      <div
        style={{
          position: "absolute",
          left: 238,
          top: 1400,
          width: 604,
          padding: "22px 28px",
          borderRadius: 18,
          background: palette.accent,
          color: "white",
          fontFamily: '"Arial Rounded MT Bold", Arial, sans-serif',
          fontSize: 40,
          textAlign: "center",
          boxShadow: `0 22px 50px ${palette.shadowStrong}`,
          opacity: interpolate(frame, [12, 25], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        proof you showed up ✦
      </div>
    </AbsoluteFill>
  );
};

const JourneyRecapScene = () => {
  const frame = useCurrentFrame();
  const medalOpacity = interpolate(frame, [0, 94, 102], [1, 1, 0], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <PaperStage>
      <Img
        src={staticFile("quest-journey.png")}
        style={{
          position: "absolute",
          left: 180,
          top: 640,
          width: 720,
          height: 1020,
          objectFit: "cover",
          borderRadius: 18,
          boxShadow: `0 28px 70px ${palette.shadowStrong}`,
          opacity: 0.34,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 300,
          top: 860,
          width: 480,
          height: 560,
          padding: "20px 20px 72px",
          borderRadius: 8,
          background: palette.photoPaper,
          boxShadow: `0 30px 70px ${palette.shadowStrong}`,
          opacity: medalOpacity,
          rotate: "-2deg",
          scale: interpolate(medalOpacity, [0, 1], [0.86, 1]),
          zIndex: 4,
        }}
      >
        <Img
          src={staticFile(photoMoments[4].src)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: photoMoments[4].objectPosition,
            borderRadius: 4,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 18,
            right: 18,
            bottom: 20,
            color: palette.ink,
            fontFamily: '"Arial Rounded MT Bold", Arial, sans-serif',
            fontSize: 28,
            textAlign: "center",
          }}
        >
          RACE DAY · I DID IT
        </div>
      </div>
      {photoMoments.slice(0, 4).map((photo, index) => {
        const positions = [
          { left: 90, top: 770, rotate: -6 },
          { left: 620, top: 740, rotate: 5 },
          { left: 115, top: 1260, rotate: 4 },
          { left: 605, top: 1210, rotate: -5 },
        ];
        const position = positions[index];
        const enter = interpolate(frame, [index * 10, index * 10 + 18], [0, 1], {
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={photo.src}
            style={{
              position: "absolute",
              left: position.left,
              top: position.top,
              width: 330,
              height: 370,
              padding: "16px 16px 56px",
              borderRadius: 6,
              background: palette.photoPaper,
              boxShadow: `0 22px 50px ${palette.shadow}`,
              opacity: enter,
              rotate: `${position.rotate}deg`,
              scale: interpolate(enter, [0, 1], [0.75, 1]),
            }}
          >
            <Img
              src={staticFile(photo.src)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: photo.objectPosition,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 10,
                right: 10,
                bottom: 15,
                color: palette.ink,
                fontSize: 23,
                fontWeight: 850,
                textAlign: "center",
              }}
            >
              {photo.month}
            </div>
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 294,
          top: 1050,
          width: 492,
          padding: "30px 34px",
          borderRadius: 22,
          border: `4px solid ${palette.lavenderTape}`,
          background: palette.photoPaper,
          boxShadow: `0 30px 70px ${palette.shadowStrong}`,
          color: palette.accentDark,
          fontFamily: '"Arial Rounded MT Bold", Arial, sans-serif',
          fontSize: 48,
          lineHeight: 1.02,
          textAlign: "center",
          opacity: interpolate(frame, [94, 106], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [94, 106], [0.82, 1], {
            easing: Easing.bezier(0.34, 1.4, 0.64, 1),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          zIndex: 6,
        }}
      >
        THE JOURNEY COUNTS
      </div>
      <Sparkle left={830} top={1120} size={62} />
      <Sparkle left={180} top={1110} size={50} color={palette.lavenderTapeDark} />
    </PaperStage>
  );
};

const EndCard = () => {
  const enter = 1;

  return (
    <PaperStage>
      <div
        style={{
          position: "absolute",
          left: 135,
          top: 660,
          width: 810,
          height: 890,
          borderRadius: 34,
          border: `4px solid ${palette.lavenderTape}`,
          background: "rgba(255,254,249,0.96)",
          boxShadow: `0 34px 85px ${palette.shadowStrong}`,
          display: "flex",
          alignItems: "center",
          flexDirection: "column",
          padding: "58px 60px",
          opacity: enter,
          scale: interpolate(enter, [0, 1], [0.88, 1]),
          translate: `0 ${interpolate(enter, [0, 1], [100, 0])}px`,
        }}
      >
        <div
          style={{
            width: 220,
            height: 220,
            padding: 14,
            borderRadius: 50,
            background: palette.photoPaper,
            boxShadow: `0 24px 60px ${palette.shadowStrong}`,
            rotate: "-4deg",
          }}
        >
          <Img src={staticFile("app-icon.png")} style={{ width: "100%", height: "100%", borderRadius: 38 }} />
        </div>
        <div
          style={{
            marginTop: 42,
            color: palette.ink,
            fontFamily: '"Arial Rounded MT Bold", Arial, sans-serif',
            fontSize: 68,
            lineHeight: 0.96,
            textAlign: "center",
          }}
        >
          Side Quest Slayer
        </div>
        <div
          style={{
            marginTop: 26,
            color: palette.pencil,
            fontSize: 34,
            fontWeight: 760,
            lineHeight: 1.18,
            textAlign: "center",
          }}
        >
          Document the journey.
          <br />
          Celebrate every step.
        </div>
        <div
          style={{
            marginTop: 44,
            minWidth: 480,
            padding: "24px 38px",
            borderRadius: 999,
            background: palette.accent,
            color: "white",
            fontFamily: '"Arial Rounded MT Bold", Arial, sans-serif',
            fontSize: 38,
            textAlign: "center",
            boxShadow: `0 20px 50px ${palette.shadow}`,
          }}
        >
          Now on the App Store
        </div>
      </div>
      <Tape left={720} top={640} width={190} rotate={8} dark />
      <Sparkle left={130} top={660} size={60} />
      <Sparkle left={865} top={1450} size={52} color={palette.lavenderTapeDark} />
    </PaperStage>
  );
};

const SoundDesign = ({ musicEnabled }: { musicEnabled: boolean }) => {
  const { fps } = useVideoConfig();
  const soundEffects = [
    { file: "audio/whoosh.wav", at: 4.6, volume: 0.22 },
    { file: "audio/page-turn.wav", at: 13.0, volume: 0.2 },
    { file: "audio/mouse-click.wav", at: 25.25, volume: 0.24 },
    { file: "audio/mouse-click.wav", at: 27.21, volume: 0.2 },
    { file: "audio/shutter.wav", at: 38.36, volume: 0.26 },
    { file: "audio/ding.wav", at: 40.85, volume: 0.18 },
    { file: "audio/ding.wav", at: 50.05, volume: 0.18 },
  ] as const;

  return (
    <AbsoluteFill>
      {musicEnabled ? (
        <Audio
          src={staticFile("audio/music-bed.wav")}
          loop
          volume={(audioFrame) =>
            interpolate(
              audioFrame,
              [0, fps, SHORT_DURATION_IN_FRAMES - sec(2), SHORT_DURATION_IN_FRAMES],
              [0, 0.38, 0.38, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )
          }
        />
      ) : null}
      {soundEffects.map((effect, index) => (
        <Sequence
          key={`${effect.file}-${effect.at}-${index}`}
          from={sec(effect.at)}
          durationInFrames={sec(2)}
          premountFor={fps}
        >
          <Audio src={staticFile(effect.file)} volume={() => effect.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const SideQuestSlayerShort = ({ musicEnabled }: SideQuestSlayerShortProps) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: palette.paper, fontFamily: "Arial, sans-serif" }}>
      <TalkingHead />
      <Sequence durationInFrames={sec(4.6)} premountFor={fps}>
        <CreatorLowerThird />
      </Sequence>
      <Sequence from={sec(4.6)} durationInFrames={sec(3.8)} premountFor={fps}>
        <VisionBoardScene />
      </Sequence>
      <Sequence from={sec(8.4)} durationInFrames={sec(4.6)} premountFor={fps}>
        <CalendarOverlay />
      </Sequence>
      <Sequence from={sec(13)} durationInFrames={sec(3)} premountFor={fps}>
        <OnboardingScene />
      </Sequence>
      <Sequence from={sec(16)} durationInFrames={sec(5.3)} premountFor={fps}>
        <QuestStickerOverlay />
      </Sequence>
      <Sequence from={sec(25.25)} durationInFrames={sec(2.99)} premountFor={fps}>
        <DemoBrollScene />
      </Sequence>
      <Sequence from={sec(28.24)} durationInFrames={sec(9.51)} premountFor={fps}>
        <MarathonMontageScene />
      </Sequence>
      <Sequence from={sec(37.75)} durationInFrames={sec(3.1)} premountFor={fps}>
        <CaptureMomentScene />
      </Sequence>
      <Sequence from={sec(40.85)} durationInFrames={sec(4.9)} premountFor={fps}>
        <JourneyRecapScene />
      </Sequence>
      <Sequence from={sec(50.05)} durationInFrames={SHORT_DURATION_IN_FRAMES - sec(50.05)} premountFor={fps}>
        <EndCard />
      </Sequence>
      <SoundDesign musicEnabled={musicEnabled} />
      <CaptionLayer />
    </AbsoluteFill>
  );
};

export const shortStyles: Record<string, CSSProperties> = {
  visuallyHidden: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    opacity: 0,
  },
};
