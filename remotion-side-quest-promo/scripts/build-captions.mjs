import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const sourcePath = resolve(process.argv[2] ?? "/private/tmp/IMG_7388-transcript.json");
const outputJsonPath = resolve("public/captions/side-quest-short.json");
const outputSrtPath = resolve("public/captions/side-quest-short.srt");
const trimStartMs = 9_440;
const trimEndMs = 65_800;
const durationMs = trimEndMs - trimStartMs;

const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const segments = source.transcription.filter(
  (segment) =>
    segment.offsets.to > trimStartMs &&
    segment.offsets.from < trimEndMs &&
    !segment.text.includes("[BLANK_AUDIO]"),
);

const correctText = (text) =>
  text
    .replaceAll("SideQuest Layer", "Side Quest Slayer")
    .replaceAll("Side Quest Layer", "Side Quest Slayer")
    .replaceAll("SideQuest Slayer", "Side Quest Slayer");

const rawTokens = segments.flatMap((segment) => segment.tokens).filter((token) => !token.text.startsWith("["));
const mergedTokens = [];

for (let index = 0; index < rawTokens.length; index += 1) {
  const token = rawTokens[index];
  const next = rawTokens[index + 1];
  const afterNext = rawTokens[index + 2];

  if (token.text === " Side" && next?.text === "Quest" && afterNext?.text === " Layer") {
    mergedTokens.push({
      text: " Side Quest Slayer",
      offsets: { from: token.offsets.from, to: afterNext.offsets.to },
      p: Math.min(token.p, next.p, afterNext.p),
    });
    index += 2;
    continue;
  }

  if (token.text === " girl" && next?.text === "ies") {
    mergedTokens.push({
      text: " girlies",
      offsets: { from: token.offsets.from, to: next.offsets.to },
      p: Math.min(token.p, next.p),
    });
    index += 1;
    continue;
  }

  mergedTokens.push(token);
}

const captions = [];

for (let index = 0; index < mergedTokens.length; index += 1) {
  const token = mergedTokens[index];
  if (token.offsets.to < trimStartMs || token.offsets.from >= trimEndMs) {
    continue;
  }

  const nextToken = mergedTokens[index + 1];
  const startMs = Math.max(0, Math.min(durationMs, token.offsets.from - trimStartMs));
  const naturalEndMs = Math.max(startMs, Math.min(durationMs, token.offsets.to - trimStartMs));
  const nextStartMs = nextToken
    ? Math.max(startMs, Math.min(durationMs, nextToken.offsets.from - trimStartMs))
    : durationMs;
  const endMs = Math.max(startMs + 1, Math.min(durationMs, Math.max(naturalEndMs, nextStartMs)));

  captions.push({
    text: correctText(token.text),
    startMs,
    endMs,
    timestampMs: null,
    confidence: typeof token.p === "number" ? token.p : null,
  });
}

for (let index = 1; index < captions.length; index += 1) {
  const previous = captions[index - 1];
  const current = captions[index];
  current.startMs = Math.max(current.startMs, previous.endMs);
  current.endMs = Math.max(current.startMs + 1, current.endMs);
}

const formatSrtTime = (milliseconds) => {
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  const millis = Math.floor(milliseconds % 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
};

const srt = segments
  .map((segment, index) => {
    const startMs = Math.max(0, segment.offsets.from - trimStartMs);
    const endMs = Math.min(durationMs, segment.offsets.to - trimStartMs);
    return `${index + 1}\n${formatSrtTime(startMs)} --> ${formatSrtTime(endMs)}\n${correctText(segment.text.trim())}`;
  })
  .join("\n\n");

mkdirSync(dirname(outputJsonPath), { recursive: true });
writeFileSync(outputJsonPath, `${JSON.stringify(captions, null, 2)}\n`);
writeFileSync(outputSrtPath, `${srt}\n`);

console.log(
  `Wrote ${captions.length} captions from ${captions[0]?.startMs ?? 0}ms to ${captions.at(-1)?.endMs ?? 0}ms`,
);
