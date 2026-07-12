import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const sampleRate = 48_000;
const durationSeconds = 58;
const channels = 2;
const frameCount = Math.floor(sampleRate * durationSeconds);
const bpm = 96;
const beatSeconds = 60 / bpm;
const barSeconds = beatSeconds * 4;

const chords = [
  { root: 130.81, notes: [261.63, 329.63, 392, 493.88] },
  { root: 110, notes: [220, 261.63, 329.63, 392] },
  { root: 87.31, notes: [174.61, 220, 261.63, 329.63] },
  { root: 98, notes: [196, 246.94, 293.66, 392] },
];

const melody = [659.25, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25];

let randomState = 0x5eed1234;
const noise = () => {
  randomState = (1664525 * randomState + 1013904223) >>> 0;
  return (randomState / 0xffffffff) * 2 - 1;
};

const softClip = (value) => Math.tanh(value * 1.15) * 0.82;
const attackRelease = (position, length, attack, release) => {
  const attackGain = Math.min(1, position / attack);
  const releaseGain = Math.min(1, Math.max(0, length - position) / release);
  return Math.max(0, Math.min(attackGain, releaseGain));
};

const left = new Float32Array(frameCount);
const right = new Float32Array(frameCount);

let previousNoise = 0;

for (let index = 0; index < frameCount; index += 1) {
  const time = index / sampleRate;
  const beatIndex = Math.floor(time / beatSeconds);
  const beatPosition = time % beatSeconds;
  const barIndex = Math.floor(time / barSeconds);
  const barPosition = time % barSeconds;
  const chord = chords[barIndex % chords.length];
  const chordEnvelope = attackRelease(barPosition, barSeconds, 0.72, 0.72);
  const sidechain = 0.64 + 0.36 * Math.min(1, beatPosition / 0.16);

  let padLeft = 0;
  let padRight = 0;
  chord.notes.forEach((frequency, noteIndex) => {
    const detune = 1 + (noteIndex - 1.5) * 0.0008;
    const phase = 2 * Math.PI * frequency * detune * time;
    const harmonic = Math.sin(phase) + 0.22 * Math.sin(phase * 2 + 0.3);
    padLeft += harmonic * (noteIndex % 2 === 0 ? 1 : 0.72);
    padRight += harmonic * (noteIndex % 2 === 1 ? 1 : 0.72);
  });
  padLeft *= 0.022 * chordEnvelope * sidechain;
  padRight *= 0.022 * chordEnvelope * sidechain;

  const bassPosition = time % (beatSeconds * 2);
  const bassEnvelope = Math.exp(-bassPosition * 2.5) * Math.min(1, bassPosition / 0.018);
  const bass = Math.sin(2 * Math.PI * chord.root * time) * 0.08 * bassEnvelope;

  const kickEnvelope = Math.exp(-beatPosition * 18) * Math.min(1, beatPosition / 0.004);
  const kickFrequency = 76 - Math.min(38, beatPosition * 240);
  const kick = Math.sin(2 * Math.PI * kickFrequency * beatPosition) * 0.16 * kickEnvelope;

  const eighthPosition = time % (beatSeconds / 2);
  const rawNoise = noise();
  const highNoise = rawNoise - previousNoise * 0.86;
  previousNoise = rawNoise;
  const hat = highNoise * Math.exp(-eighthPosition * 58) * 0.026;

  const beatInBar = beatIndex % 4;
  const snapActive = beatInBar === 1 || beatInBar === 3;
  const snap = snapActive ? highNoise * Math.exp(-beatPosition * 32) * 0.038 : 0;

  const melodyStepSeconds = beatSeconds / 2;
  const melodyStep = Math.floor(time / melodyStepSeconds);
  const melodyPosition = time % melodyStepSeconds;
  const melodyFrequency = melody[(melodyStep + barIndex) % melody.length];
  const melodyEnvelope = Math.exp(-melodyPosition * 5.6) * Math.min(1, melodyPosition / 0.012);
  const melodyPhase = 2 * Math.PI * melodyFrequency * time;
  const bell =
    (Math.sin(melodyPhase) + 0.34 * Math.sin(melodyPhase * 2.01) + 0.11 * Math.sin(melodyPhase * 3.98)) *
    melodyEnvelope *
    0.035;
  const melodyPan = melodyStep % 2 === 0 ? 0.75 : 1.15;

  const fadeIn = Math.min(1, time / 1.5);
  const fadeOut = Math.min(1, Math.max(0, durationSeconds - time) / 3);
  const master = fadeIn * fadeOut;

  left[index] = softClip((padLeft + bass + kick + hat + snap + bell * melodyPan) * master);
  right[index] = softClip((padRight + bass + kick + hat * 0.82 + snap + bell * (1.9 - melodyPan)) * master);
}

const bytesPerSample = 2;
const dataSize = frameCount * channels * bytesPerSample;
const buffer = Buffer.alloc(44 + dataSize);

buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write("WAVE", 8);
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(channels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
buffer.writeUInt16LE(channels * bytesPerSample, 32);
buffer.writeUInt16LE(bytesPerSample * 8, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(dataSize, 40);

for (let index = 0; index < frameCount; index += 1) {
  buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[index])) * 32767), 44 + index * 4);
  buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[index])) * 32767), 46 + index * 4);
}

const output = resolve("public/audio/music-bed.wav");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, buffer);
console.log(`Wrote ${output} (${durationSeconds}s, ${sampleRate}Hz stereo PCM16)`);
