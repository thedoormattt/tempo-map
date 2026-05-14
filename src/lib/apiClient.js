// src/lib/apiClient.js
// Calls the Python/librosa backend for high-accuracy analysis.
// The NEXT_PUBLIC_API_URL env var should point at your Render service,
// e.g. https://tempo-map-api.onrender.com

const API_URL = process.env.NEXT_PUBLIC_API_URL;

/**
 * Upload an audio file to the Python backend and return structured analysis data.
 * Throws if the request fails or the backend returns an error.
 *
 * @param {File} file
 * @param {(pct: number) => void} [onProgress]  — called with 0..100 during upload
 * @returns {Promise<import('./dsp').AnalysisResult>}
 */
export async function analyseWithBackend(file, onProgress) {
  if (!API_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set. Add it to .env.local or your Vercel environment variables.",
    );
  }

  // Use XMLHttpRequest so we get upload progress events
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);

    xhr.open("POST", `${API_URL}/analyse`);

    // Upload progress (0 → 90%) — the remaining 10% is server processing time
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress?.(Math.round((e.loaded / e.total) * 90));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const raw = JSON.parse(xhr.responseText);
          onProgress?.(100);
          resolve(normalise(raw));
        } catch (e) {
          reject(new Error("Invalid JSON response from backend"));
        }
      } else {
        let detail = xhr.statusText;
        try {
          detail = JSON.parse(xhr.responseText)?.detail ?? detail;
        } catch {}
        reject(new Error(`Backend error ${xhr.status}: ${detail}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error contacting backend"));
    xhr.ontimeout = () => reject(new Error("Backend request timed out"));
    xhr.timeout = 120_000; // 2 min — large files can take a while on a free Render instance

    xhr.send(form);
  });
}

/**
 * Normalise the snake_case backend response to the same shape
 * that analyseSong() returns from dsp.js, so the rest of the UI
 * doesn't need to care which backend produced the result.
 */
function normalise(raw) {
  return {
    bpmCurve: raw.bpm_curve.map((p) => ({ t: p.t, bpm: p.bpm })),
    keyCurve: raw.key_curve.map((p) => ({
      t: p.t,
      label: p.key,
      root: p.root,
      mode: p.mode,
      confidence: p.confidence,
    })),
    overallKey: {
      label: raw.overall_key.label,
      root: raw.overall_key.root,
      mode: raw.overall_key.mode,
      confidence: raw.overall_key.confidence,
    },
    duration: raw.duration,
    sampleRate: raw.sample_rate,
    channels: raw.channels,
  };
}

/**
 * Quick health check — resolves true if the backend is reachable.
 */
export async function pingBackend() {
  if (!API_URL) return false;
  try {
    const res = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
