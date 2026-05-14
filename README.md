# Tempo Map

Visualise how the BPM of a song changes over time. Drop any audio file and get an instant tempo curve — all DSP runs in your browser via the Web Audio API, so nothing is uploaded anywhere.

## How it works

1. **Onset detection** — the audio is decoded to mono PCM and divided into overlapping frames. Spectral flux (energy increase across 8 sub-bands) produces an onset-strength envelope.
2. **Windowed autocorrelation** — a 4-second sliding window moves across the onset envelope in 0.5s hops. Autocorrelation within each window finds the dominant beat period → BPM.
3. **Smoothing** — a rolling average removes jitter so the curve is readable.

## Stack

- **Next.js 14** (App Router)
- **Web Audio API** for PCM decoding and DSP
- **CSS Modules** for scoped styles
- No external dependencies beyond Next itself

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

Push to GitHub, then import the repo at [vercel.com/new](https://vercel.com/new). No environment variables needed — it's a static frontend build.

```bash
# or deploy from the CLI
npx vercel
```

## Project structure

```
src/
  app/
    layout.js        # Root layout, font import, metadata
    page.js          # Entry point
    globals.css      # CSS variables and reset
  components/
    BPMAnalyser.js   # Main client component (orchestration)
    BPMChart.js      # SVG tempo visualisation
    DropZone.js      # Drag-and-drop file input
    StatBar.js       # Avg / peak / low / duration stats
    *.module.css     # Scoped styles per component
  lib/
    dsp.js           # All signal processing (pure functions)
    utils.js         # formatTime, curveStats
```

## Accuracy notes

- Works best on music with clear percussion
- The 4s analysis window means very short tempo changes (<2s) are smoothed over
- For higher accuracy, consider a Python backend with [librosa](https://librosa.org/) — its beat tracker uses a proper STFT + dynamic programming approach
