"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import DropZone from "./DropZone";
import StatBar from "./StatBar";
import BPMChart from "./BPMChart";
import KeyChart from "./KeyChart";
import { analyseSong } from "@/lib/dsp";
import { curveStats } from "@/lib/utils";
import styles from "./BPMAnalyser.module.css";

export default function BPMAnalyser() {
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState(null);
  const [playhead, setPlayhead] = useState(null);
  const [audioURL, setAudioURL] = useState(null);

  const audioRef = useRef(null);
  const rafRef = useRef(null);

  const analyse = useCallback(async (file) => {
    setStatus("loading");
    setProgress(0);
    setFileName(file.name);
    setResult(null);
    setPlayhead(null);
    setAudioURL((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

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

  const stats = result?.bpmCurve?.length ? curveStats(result.bpmCurve) : null;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>
          <span className={styles.eyebrowAccent}>Tempo Map</span>
          <span className={styles.slash}>///</span>
          <span className={styles.eyebrowDim}>BPM + KEY ANALYSER</span>
        </div>
        <h1 className={styles.heading}>
          How does the tempo and key
          <br />
          <span className={styles.headingAccent}>change over time?</span>
        </h1>
        <p className={styles.sub}>
          Drop any audio file. BPM and key are both analysed in sliding windows
          so you can see tempo drift, modulations, and breakdowns — not just
          single average values.
        </p>
      </header>

      <section className={styles.section}>
        <DropZone
          status={status}
          progress={progress}
          fileName={fileName}
          onFile={analyse}
        />
      </section>

      {status === "done" && result && stats && (
        <section className={styles.section}>
          <StatBar
            stats={stats}
            duration={result.duration}
            overallKey={result.overallKey}
          />

          <BPMChart
            curve={result.bpmCurve}
            duration={result.duration}
            playhead={playhead}
            avgBPM={stats.avg}
          />

          <KeyChart
            keyCurve={result.keyCurve}
            duration={result.duration}
            playhead={playhead}
            overallKey={result.overallKey}
          />

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
            {result.sampleRate / 1000} kHz ·{" "}
            {result.channels === 1 ? "Mono" : "Stereo"}
          </p>
        </section>
      )}

      <footer className={styles.footer}>
        ALL PROCESSING HAPPENS IN YOUR BROWSER · NO UPLOAD · NO TRACKING
      </footer>
    </main>
  );
}
