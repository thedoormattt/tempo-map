export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function curveStats(curve) {
  if (!curve.length) return null;
  const bpms = curve.map((d) => d.bpm);

  // Mode BPM — most frequently occurring value when rounded to nearest integer
  const bins = {};
  for (const bpm of bpms) {
    const bin = Math.round(bpm);
    bins[bin] = (bins[bin] ?? 0) + 1;
  }
  const mode = parseInt(
    Object.entries(bins).reduce((a, b) => (b[1] > a[1] ? b : a))[0],
  );

  const max = curve.reduce((a, d) => (d.bpm > a.bpm ? d : a));
  const min = curve.reduce((a, d) => (d.bpm < a.bpm ? d : a));
  return { avg: mode, max, min };
}

export function dominantKey(keyCurve) {
  if (!keyCurve?.length) return null;
  const scores = {};
  for (const d of keyCurve) {
    scores[d.label] = (scores[d.label] ?? 0) + Math.max(0, d.confidence);
  }
  return Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}
