"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import DropZone from "./DropZone";
import StatBar  from "./StatBar";
import BPMChart from "./BPMChart";
import { analyseSong } from "@/lib/dsp";
import { curveStats }  from "@/lib/utils";
import styles from "./BPMAnalyser.module.css";

export default function BPMAnalyser() {
  const [status,   setStatus]   = useState("idle");   // idle | loading | done | error
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [result,   setResult]   = useState(null);     // { curve, duration, sampleRate, channels }
  const [playhead, setPlayhead] = useState(null);
  const [audioURL, setAudioURL] = useState(null);

  const audioRef = useRef(null);
  const rafRef   = useRef(null);

  // ─── Analysis ────────────────────────────────────────────────────────────
  const analyse = useCallback(async (file) => {
    setStatus("loading");
    setProgress(0);
    setFileName(file.name);
    setResult(null);
    setPlayhead(null);

    // Revoke previous object URL
    setAudioURL((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const decoded = await ctx.decodeAudioData(arrayBuffer);

      const data = analyseSong(decoded, setProgress);

      setAudioURL(URL.createObjectURL(file));
      setResult(data);
      setStatus("done");
      ctx.close();
    } catch (err) {
      console.error("Analysis error:", err);
      setStatus("error");
    }
  }, []);

  // ─── Playhead tracking ───────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || status !== "done") return;

    const tick = () => {
      setPlayhead(audio.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [status, audioURL]);

  // ─── Derived data ────────────────────────────────────────────────────────
  const stats = result?.curve?.length ? curveStats(result.curve) : null;

  return (
    <main className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowAccent}>Tempo Map</span>
          <span className={styles.slash}>///</span>
          <span className={styles.eyebrowDim}>BPM ANALYSER</span>
        </div>
        <h1 className={styles.heading}>
          How does the tempo<br />
          <span className={styles.headingAccent}>change over time?</span>
        </h1>
        <p className={styles.sub}>
          Drop any audio file. The BPM is analysed in sliding windows so you
          can see tempo drift, breakdowns, and double-time sections — not just a
          single average value.
        </p>
      </header>

      {/* ── Drop zone ── */}
      <section className={styles.section}>
        <DropZone
          status={status}
          progress={progress}
          fileName={fileName}
          onFile={analyse}
        />
      </section>

      {/* ── Results ── */}
      {status === "done" && result && stats && (
        <section className={styles.section}>
          <StatBar stats={stats} duration={result.duration} />
          <BPMChart
            curve={result.curve}
            duration={result.duration}
            playhead={playhead}
            avgBPM={stats.avg}
          />

          {/* Audio player */}
          <div className={styles.player}>
            {audioURL && (
              <audio
                ref={audioRef}
                src={audioURL}
                controls
                className={styles.audio}
              />
            )}
          </div>

          <p className={styles.meta}>
            {result.sampleRate / 1000} kHz · {result.channels === 1 ? "Mono" : "Stereo"}
          </p>
        </section>
      )}

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        ALL PROCESSING HAPPENS IN YOUR BROWSER · NO UPLOAD · NO TRACKING
      </footer>
    </main>
  );
}
