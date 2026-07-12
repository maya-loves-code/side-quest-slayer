import type { Caption } from "@remotion/captions";

export const EDIT_CUTS_MS = [
  { startMs: 21300, endMs: 22550 },
  { startMs: 26620, endMs: 27600 },
] as const;

export const removedBeforeMs = (timeMs: number) =>
  EDIT_CUTS_MS.reduce((total, cut) => {
    if (timeMs <= cut.startMs) return total;
    return total + Math.min(timeMs, cut.endMs) - cut.startMs;
  }, 0);

export const editedTimeMs = (timeMs: number) => timeMs - removedBeforeMs(timeMs);

export const editCaptions = (captions: Caption[]): Caption[] =>
  captions
    .filter(
      (caption) =>
        !EDIT_CUTS_MS.some(
          (cut) => caption.startMs >= cut.startMs && caption.endMs <= cut.endMs,
        ),
    )
    .map((caption) => ({
      ...caption,
      startMs: editedTimeMs(caption.startMs),
      endMs: editedTimeMs(caption.endMs),
    }));
