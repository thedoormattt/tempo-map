// ─── dsp.js ──────────────────────────────────────────────────────────────────
// All signal-processing helpers for BPM analysis.
// Pure functions — no DOM, no side-effects, fully testable.

/**
 * Generate a Hann window of length N.
 */
export function hannWindow(N) {
  const w = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
  }
  return w;
}

/**
 * Mix a decoded AudioBuffer to a mono Float32Array.
 */
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

/**
 * Compute a normalised onset-strength envelope from mono PCM.
 *
 * Strategy: spectral flux across 8 sub-bands (half-wave rectified).
 * Returns { times: Float32Array, onsets: Float32Array } at ~100 fps.
 */
export function computeOnsetEnvelope(pcm, sampleRate) {
  const FRAME = 2048;
  const HOP   = Math.round(sampleRate / 100); // ≈10 ms → 100 fps
  const BANDS = 8;
  const bandSize = Math.floor(FRAME / 2 / BANDS);
  const frames = Math.floor((pcm.length - FRAME) / HOP);

  const win  = hannWindow(FRAME);
  const times  = new Float32Array(frames);
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

    times[f]  = start / sampleRate;
    onsets[f] = flux;
  }

  // Normalise to [0, 1]
  let maxO = 0;
  for (let i = 0; i < frames; i++) if (onsets[i] > maxO) maxO = onsets[i];
  if (maxO > 0) for (let i = 0; i < frames; i++) onsets[i] /= maxO;

  return { times, onsets };
}

/**
 * Autocorrelation-based BPM from a window of onset samples.
 *
 * @param {Float32Array|number[]} onsets  — onset envelope slice
 * @param {number} fps                   — frames per second of the envelope
 * @param {number} minBPM
 * @param {number} maxBPM
 * @returns {number|null}
 */
export function estimateBPM(onsets, fps, minBPM = 55, maxBPM = 210) {
  const N = onsets.length;
  if (N < 8) return null;

  // Detrend
  let mean = 0;
  for (let i = 0; i < N; i++) mean += onsets[i];
  mean /= N;
  const sig = new Float32Array(N);
  for (let i = 0; i < N; i++) sig[i] = onsets[i] - mean;

  const minLag = Math.max(1, Math.round((60 / maxBPM) * fps));
  const maxLag = Math.min(N - 1, Math.round((60 / minBPM) * fps));

  let bestLag = minLag;
  let bestAC  = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let ac = 0;
    for (let i = 0; i < N - lag; i++) ac += sig[i] * sig[i + lag];
    if (ac > bestAC) { bestAC = ac; bestLag = lag; }
  }

  return 60 / (bestLag / fps);
}

/**
 * Slide a window across the onset envelope and estimate BPM for each position.
 *
 * @param {Float32Array} times
 * @param {Float32Array} onsets
 * @param {number} windowSec  — analysis window length in seconds (default 4)
 * @param {number} hopSec     — hop between windows in seconds (default 0.5)
 * @returns {{ t: number, bpm: number }[]}
 */
export function computeBPMCurve(times, onsets, windowSec = 4, hopSec = 0.5) {
  if (times.length < 2) return [];
  const fps = 1 / (times[1] - times[0]);
  const winN = Math.round(windowSec * fps);
  const hopN = Math.round(hopSec * fps);
  const results = [];

  for (let i = 0; i + winN < onsets.length; i += hopN) {
    const slice = onsets.slice(i, i + winN);
    const bpm   = estimateBPM(slice, fps);
    if (bpm !== null) {
      results.push({ t: times[i] + windowSec / 2, bpm });
    }
  }
  return results;
}

/**
 * Simple causal moving-average smoother.
 *
 * @param {{ t: number, bpm: number }[]} data
 * @param {number} k  — half-window (default 4 → 9-point window)
 */
export function smoothCurve(data, k = 4) {
  return data.map((d, i) => {
    const lo  = Math.max(0, i - k);
    const hi  = Math.min(data.length - 1, i + k);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += data[j].bpm;
    return { t: d.t, bpm: sum / (hi - lo + 1) };
  });
}

/**
 * Run the full analysis pipeline on an AudioBuffer.
 * Accepts an optional progress callback: (pct: number) => void
 *
 * @param {AudioBuffer} decoded
 * @param {(pct: number) => void} [onProgress]
 * @returns {{ curve: { t: number, bpm: number }[], duration: number, sampleRate: number, channels: number }}
 */
export function analyseSong(decoded, onProgress) {
  const report = (p) => onProgress?.(p);

  report(10);
  const pcm = toMono(decoded);

  report(30);
  const { times, onsets } = computeOnsetEnvelope(pcm, decoded.sampleRate);

  report(60);
  const raw = computeBPMCurve(times, onsets);

  report(85);
  const curve = smoothCurve(raw);

  report(100);
  return {
    curve,
    duration:   decoded.duration,
    sampleRate: decoded.sampleRate,
    channels:   decoded.numberOfChannels,
  };
}
