import { createTikTokStyleCaptions } from "@remotion/captions";
import type { Caption, TikTokPage } from "@remotion/captions";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
} from "remotion";
import { editCaptions } from "./editTimeline";

const SWITCH_CAPTIONS_EVERY_MS = 1050;

const colors = {
  purple: "#7c3aed",
  purpleDark: "#5b21b6",
  cream: "#fffaf0",
  ink: "#180f24",
};

const CaptionPage = ({ page }: { page: TikTokPage }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const absoluteTimeMs = page.startMs + (frame / fps) * 1000;
  const textLength = page.tokens.reduce((sum, token) => sum + token.text.length, 0);
  const fontSize = textLength > 34 ? 78 : textLength > 25 ? 88 : 102;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "flex-start",
        paddingTop: 270,
        pointerEvents: "none",
        zIndex: 80,
      }}
    >
      <div
        style={{
          width: 720,
          minHeight: 220,
          alignItems: "center",
          display: "flex",
          justifyContent: "center",
          textAlign: "center",
          opacity: interpolate(frame, [0, 4, 8], [0, 1, 1], {
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [0, 5], [0.94, 1], {
            easing: Easing.bezier(0.34, 1.35, 0.64, 1),
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            color: colors.purple,
            fontFamily: '"Arial Rounded MT Bold", "Arial Black", Arial, sans-serif',
            fontSize,
            fontWeight: 900,
            letterSpacing: -3,
            lineHeight: 0.94,
            maxWidth: "100%",
            overflowWrap: "break-word",
            textShadow: [
              `-4px -4px 0 ${colors.cream}`,
              `4px -4px 0 ${colors.cream}`,
              `-4px 4px 0 ${colors.cream}`,
              `4px 4px 0 ${colors.cream}`,
              `0 8px 18px rgba(24, 15, 36, 0.24)`,
            ].join(", "),
            whiteSpace: "pre-wrap",
          }}
        >
          {page.tokens.map((token) => {
            const isActive = token.fromMs <= absoluteTimeMs && token.toMs > absoluteTimeMs;

            return (
              <span
                key={`${token.fromMs}-${token.toMs}-${token.text}`}
                style={{
                  color: isActive ? colors.purpleDark : colors.purple,
                  textDecoration: isActive ? "underline" : "none",
                  textDecorationColor: colors.ink,
                  textDecorationThickness: 7,
                  textUnderlineOffset: 9,
                }}
              >
                {token.text}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const CaptionLayer = () => {
  const [captions, setCaptions] = useState<Caption[] | null>(null);
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Loading Side Quest Slayer captions"));
  const { fps } = useVideoConfig();

  const loadCaptions = useCallback(async () => {
    try {
      const response = await fetch(staticFile("captions/side-quest-short.json"));
      if (!response.ok) {
        throw new Error(`Caption request failed with ${response.status}`);
      }

      const nextCaptions = (await response.json()) as Caption[];
      setCaptions(editCaptions(nextCaptions));
      continueRender(handle);
    } catch (error) {
      cancelRender(error instanceof Error ? error : new Error(String(error)));
    }
  }, [cancelRender, continueRender, handle]);

  useEffect(() => {
    void loadCaptions();
  }, [loadCaptions]);

  const pages = useMemo(() => {
    if (!captions) {
      return [];
    }

    return createTikTokStyleCaptions({
      captions,
      combineTokensWithinMilliseconds: SWITCH_CAPTIONS_EVERY_MS,
    }).pages;
  }, [captions]);

  if (!captions) {
    return null;
  }

  return (
    <AbsoluteFill>
      {pages.map((page, index) => {
        const nextPage = pages[index + 1] ?? null;
        const startFrame = Math.round((page.startMs / 1000) * fps);
        const endFrame = nextPage
          ? Math.round((nextPage.startMs / 1000) * fps)
          : startFrame + Math.round((SWITCH_CAPTIONS_EVERY_MS / 1000) * fps);
        const durationInFrames = endFrame - startFrame;

        if (durationInFrames <= 0) {
          return null;
        }

        return (
          <Sequence
            key={`${page.startMs}-${index}`}
            from={startFrame}
            durationInFrames={durationInFrames}
            premountFor={fps}
          >
            <CaptionPage page={page} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
