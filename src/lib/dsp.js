import { dominantKey } from "./utils.js";
// ─── dsp.js ──────────────────────────────────────────────────────────────────
// All signal-processing helpers for BPM and key analysis.
// Pure functions — no DOM, no side-effects, fully testable.

// ─── Key detection constants ──────────────────────────────────────────────────

export const NOTE_NAMES_SHARP = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
export const NOTE_NAMES_FLAT = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

export function rootToName(root, mode) {
  // Major keys: use flats for black notes (Eb, Ab, Bb, Db, Gb)
  // Minor keys: use sharps (C#m, F#m, G#m, D#m, A#m)
  return mode === "major" ? NOTE_NAMES_FLAT[root] : NOTE_NAMES_SHARP[root];
}

const MAJOR_PROFILE = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
];
const MINOR_PROFILE = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
];

function buildProfiles() {
  const profiles = [];
  for (let root = 0; root < 12; root++) {
    const major = new Float32Array(12);
    const minor = new Float32Array(12);
    for (let i = 0; i < 12; i++) {
      major[i] = MAJOR_PROFILE[(i - root + 12) % 12];
      minor[i] = MINOR_PROFILE[(i - root + 12) % 12];
    }
    profiles.push(
      {
        root,
        mode: "major",
        label: `${NOTE_NAMES_FLAT[root]} major`,
        profile: major,
      },
      {
        root,
        mode: "minor",
        label: `${NOTE_NAMES_SHARP[root]} minor`,
        profile: minor,
      },
    );
  }
  return profiles;
}
const KEY_PROFILES = buildProfiles();

function pearson(a, b) {
  const n = a.length;
  let sumA = 0,
    sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const mA = sumA / n,
    mB = sumB / n;
  let num = 0,
    dA = 0,
    dB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - mA,
      db = b[i] - mB;
    num += da * db;
    dA += da * da;
    dB += db * db;
  }
  const denom = Math.sqrt(dA * dB);
  return denom === 0 ? 0 : num / denom;
}

export function chromaToKey(chroma) {
  let best = null;
  let bestScore = -Infinity;
  for (const kp of KEY_PROFILES) {
    const score = pearson(chroma, kp.profile);
    if (score > bestScore) {
      bestScore = score;
      best = kp;
    }
  }
  const name = rootToName(best.root, best.mode);
  return {
    root: best.root,
    mode: best.mode,
    label: `${name} ${best.mode}`,
    confidence: bestScore,
  };
}

function rfftMagnitudes(signal) {
  const N = signal.length;
  const re = new Float32Array(signal);
  const im = new Float32Array(N);
  let j = 0;
  for (let i = 1; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
    }
  }
  for (let len = 2; len <= N; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang),
      wIm = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let tRe = 1,
        tIm = 0;
      for (let k = 0; k < half; k++) {
        const uRe = re[i + k],
          uIm = im[i + k];
        const vRe = re[i + k + half] * tRe - im[i + k + half] * tIm;
        const vIm = re[i + k + half] * tIm + im[i + k + half] * tRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + half] = uRe - vRe;
        im[i + k + half] = uIm - vIm;
        const newTRe = tRe * wRe - tIm * wIm;
        tIm = tRe * wIm + tIm * wRe;
        tRe = newTRe;
      }
    }
  }
  const out = new Float32Array(N / 2 + 1);
  for (let k = 0; k <= N / 2; k++) out[k] = Math.sqrt(re[k] ** 2 + im[k] ** 2);
  return out;
}

export function computeChroma(pcm, sampleRate, frameSize = 8192) {
  const win = hannWindow(frameSize);
  const chroma = new Float32Array(12);
  const hopSize = Math.floor(frameSize / 2);

  for (let start = 0; start + frameSize <= pcm.length; start += hopSize) {
    const frame = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) frame[i] = pcm[start + i] * win[i];
    const mags = rfftMagnitudes(frame);
    const freqPerBin = sampleRate / frameSize;
    for (let k = 1; k < mags.length; k++) {
      const freq = k * freqPerBin;
      if (freq < 27.5 || freq > 4186) continue;
      const midi = 12 * Math.log2(freq / 440) + 69;
      const pc = Math.round(midi) % 12;
      const pcIdx = ((pc % 12) + 12) % 12;
      chroma[pcIdx] += mags[k];
    }
  }

  let maxC = 0;
  for (let i = 0; i < 12; i++) if (chroma[i] > maxC) maxC = chroma[i];
  if (maxC > 0) for (let i = 0; i < 12; i++) chroma[i] /= maxC;
  return chroma;
}

export function computeKeyCurve(
  pcm,
  sampleRate,
  duration,
  windowSec = 8,
  hopSec = 2,
) {
  const winSamples = Math.round(windowSec * sampleRate);
  const hopSamples = Math.round(hopSec * sampleRate);
  const results = [];

  for (let start = 0; start + winSamples <= pcm.length; start += hopSamples) {
    const slice = pcm.slice(start, start + winSamples);
    const chroma = computeChroma(slice, sampleRate);
    const key = chromaToKey(chroma);
    results.push({ t: start / sampleRate + windowSec / 2, ...key });
  }
  return results;
}

export function computeOverallKey(pcm, sampleRate) {
  const maxSamples = sampleRate * 60;
  const stride = Math.max(1, Math.floor(pcm.length / maxSamples));
  const sampled = new Float32Array(Math.floor(pcm.length / stride));
  for (let i = 0; i < sampled.length; i++) sampled[i] = pcm[i * stride];
  const chroma = computeChroma(sampled, sampleRate / stride);
  return chromaToKey(chroma);
}

// ─── Hann window ─────────────────────────────────────────────────────────────

export function hannWindow(N) {
  const w = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
  }
  return w;
}

// ─── Mono mix ────────────────────────────────────────────────────────────────

export function toMono(decoded) {
  const { length, numberOfChannels } = decoded;
  const out = new Float32Array(length);
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = decoded.getChannelData(ch);
    for (let i = 0; i < length; i++) out[i] += data[i];
  }
  const inv = 1 / numberOfChannels;
  for (let i = 0; i < length; i++) out[i] *= inv;
  return out;
}

// ─── Onset envelope ──────────────────────────────────────────────────────────

export function computeOnsetEnvelope(pcm, sampleRate) {
  const FRAME = 2048;
  const HOP = Math.round(sampleRate / 100);
  const BANDS = 8;
  const bandSize = Math.floor(FRAME / 2 / BANDS);
  const frames = Math.floor((pcm.length - FRAME) / HOP);

  const win = hannWindow(FRAME);
  const times = new Float32Array(frames);
  const onsets = new Float32Array(frames);
  const prevMag = new Float32Array(BANDS);

  for (let f = 0; f < frames; f++) {
    const start = f * HOP;
    let flux = 0;
    for (let b = 0; b < BANDS; b++) {
      let energy = 0;
      const bStart = b * bandSize;
      for (let i = 0; i < bandSize; i++) {
        const s = pcm[start + bStart + i] * win[bStart + i];
        energy += s * s;
      }
      const mag = Math.sqrt(energy / bandSize);
      const diff = mag - prevMag[b];
      if (diff > 0) flux += diff;
      prevMag[b] = mag;
    }
    times[f] = start / sampleRate;
    onsets[f] = flux;
  }

  let maxO = 0;
  for (let i = 0; i < frames; i++) if (onsets[i] > maxO) maxO = onsets[i];
  if (maxO > 0) for (let i = 0; i < frames; i++) onsets[i] /= maxO;
  return { times, onsets };
}

// ─── BPM estimation ──────────────────────────────────────────────────────────

export function estimateBPM(onsets, fps, minBPM = 55, maxBPM = 210) {
  const N = onsets.length;
  if (N < 8) return null;

  let mean = 0;
  for (let i = 0; i < N; i++) mean += onsets[i];
  mean /= N;
  const sig = new Float32Array(N);
  for (let i = 0; i < N; i++) sig[i] = onsets[i] - mean;

  const minLag = Math.max(1, Math.round((60 / maxBPM) * fps));
  const maxLag = Math.min(N - 1, Math.round((60 / minBPM) * fps));

  let bestLag = minLag,
    bestAC = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let ac = 0;
    for (let i = 0; i < N - lag; i++) ac += sig[i] * sig[i + lag];
    if (ac > bestAC) {
      bestAC = ac;
      bestLag = lag;
    }
  }
  return 60 / (bestLag / fps);
}

export function computeBPMCurve(times, onsets, windowSec = 4, hopSec = 0.5) {
  if (times.length < 2) return [];
  const fps = 1 / (times[1] - times[0]);
  const winN = Math.round(windowSec * fps);
  const hopN = Math.round(hopSec * fps);
  const results = [];

  for (let i = 0; i + winN < onsets.length; i += hopN) {
    const slice = onsets.slice(i, i + winN);
    const bpm = estimateBPM(slice, fps);
    if (bpm !== null) results.push({ t: times[i] + windowSec / 2, bpm });
  }
  return results;
}

export function smoothCurve(data, k = 4) {
  return data.map((d, i) => {
    const lo = Math.max(0, i - k);
    const hi = Math.min(data.length - 1, i + k);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += data[j].bpm;
    return { t: d.t, bpm: sum / (hi - lo + 1) };
  });
}

// ─── Main pipeline ───────────────────────────────────────────────────────────

export function analyseSong(decoded, onProgress) {
  const report = (p) => onProgress?.(p);

  report(5);
  const pcm = toMono(decoded);

  report(15);
  const { times, onsets } = computeOnsetEnvelope(pcm, decoded.sampleRate);

  report(40);
  const raw = computeBPMCurve(times, onsets);
  const bpmCurve = smoothCurve(raw);

  report(60);
  const keyCurve = computeKeyCurve(pcm, decoded.sampleRate, decoded.duration);

  report(90);
  // Derive overall key from the curve — consistent with what the chart shows
  const overallKey =
    dominantKey(keyCurve) ?? computeOverallKey(pcm, decoded.sampleRate);

  report(100);
  return {
    bpmCurve,
    keyCurve,
    overallKey,
    duration: decoded.duration,
    sampleRate: decoded.sampleRate,
    channels: decoded.numberOfChannels,
  };
}
