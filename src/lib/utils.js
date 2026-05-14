/**
 * Format seconds as m:ss
 */
export function formatTime(seconds) {
  const m   = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Derive summary stats from a BPM curve.
 */
export function curveStats(curve) {
  if (!curve.length) return null;
  const bpms = curve.map((d) => d.bpm);
  const avg  = bpms.reduce((a, b) => a + b, 0) / bpms.length;
  const max  = curve.reduce((a, d) => (d.bpm > a.bpm ? d : a));
  const min  = curve.reduce((a, d) => (d.bpm < a.bpm ? d : a));
  return { avg: Math.round(avg), max, min };
}
