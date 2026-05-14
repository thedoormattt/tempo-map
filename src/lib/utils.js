export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function curveStats(curve) {
  if (!curve.length) return null;
  const bpms = curve.map((d) => d.bpm);
  const avg = bpms.reduce((a, b) => a + b, 0) / bpms.length;
  const max = curve.reduce((a, d) => (d.bpm > a.bpm ? d : a));
  const min = curve.reduce((a, d) => (d.bpm < a.bpm ? d : a));
  return { avg: Math.round(avg), max, min };
}

export function dominantKey(keyCurve) {
  if (!keyCurve?.length) return null;
  const scores = {};
  for (const d of keyCurve) {
    scores[d.label] = (scores[d.label] ?? 0) + Math.max(0, d.confidence);
  }
  return Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}
