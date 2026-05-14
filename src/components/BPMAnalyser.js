"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import DropZone from "./DropZone";
import StatBar from "./StatBar";
import BPMChart from "./BPMChart";
import KeySection from "./KeySection";
import HistoryPanel from "./HistoryPanel";
import { analyseSong } from "@/lib/dsp";
import { analyseWithBackend } from "@/lib/apiClient";
import { saveAnalysis } from "@/lib/db";
import { curveStats } from "@/lib/utils";
import styles from "./BPMAnalyser.module.css";

const BACKEND_CONFIGURED = !!process.env.NEXT_PUBLIC_API_URL;

export default function BPMAnalyser() {
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState(null);
  const [playhead, setPlayhead] = useState(null);
  const [audioURL, setAudioURL] = useState(null);
  const [mode, setMode] = useState("js");
  const [usedMode, setUsedMode] = useState(null);

  const audioRef = useRef(null);
  const rafRef = useRef(null);
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const analyse = useCallback(async (file) => {
    const currentMode = modeRef.current;
    setStatus("loading");
    setProgress(0);
    setFileName(file.name);
    setResult(null);
    setPlayhead(null);
    setUsedMode(null);
    setAudioURL((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    try {
      let data;
      if (currentMode === "python") {
        data = await analyseWithBackend(file, setProgress);
      } else {
        const arrayBuffer = await file.arrayBuffer();
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        data = analyseSong(decoded, setProgress);
        ctx.close();
      }
      setAudioURL(URL.createObjectURL(file));
      setResult(data);
      setUsedMode(currentMode);
      setStatus("done");
      saveAnalysis(data, file.name).catch(console.warn);
    } catch (err) {
      console.error("Analysis error:", err);
      setStatus("error");
    }
  }, []);

  const handleRestore = useCallback((data, filename) => {
    setAudioURL((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setResult(data);
    setFileName(filename);
    setPlayhead(null);
    setUsedMode("history");
    setStatus("done");
  }, []);

  const handleSeek = useCallback((t) => {
    if (audioRef.current) {
      audioRef.current.currentTime = t;
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
      <div className={styles.hero}>
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
            Drop any audio file. BPM and key are analysed in sliding windows so
            you can see tempo drift, modulations, and breakdowns.
          </p>
          {BACKEND_CONFIGURED && (
            <div className={styles.toggleWrap}>
              <button
                className={`${styles.toggleBtn} ${mode === "js" ? styles.toggleActive : ""}`}
                onClick={() => setMode("js")}
              >
                <span className={styles.toggleDot} />
                In-browser
                <span className={styles.toggleTag}>instant</span>
              </button>
              <button
                className={`${styles.toggleBtn} ${styles.toggleDisabled}`}
                disabled
                title="High accuracy analysis coming soon"
              >
                <span className={styles.toggleDot} />
                High accuracy
                <span className={styles.toggleTag}>librosa</span>
              </button>
            </div>
          )}
        </header>

        <div className={styles.dropCol}>
          <DropZone
            status={status}
            progress={progress}
            fileName={fileName}
            onFile={analyse}
          />
          <HistoryPanel onRestore={handleRestore} />
        </div>
      </div>

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
            onSeek={handleSeek}
          />
          <KeySection
            keyCurve={result.keyCurve}
            duration={result.duration}
            playhead={playhead}
            overallKey={result.overallKey}
            onSeek={handleSeek}
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
            {!audioURL && usedMode === "history" && (
              <p className={styles.reloadHint}>
                Drop the file again to listen along
              </p>
            )}
          </div>
          <p className={styles.meta}>
            {result.sampleRate / 1000} kHz
            {" · "}
            {result.channels === 1 ? "Mono" : "Stereo"}
            {usedMode === "python" && " · analysed with librosa"}
            {usedMode === "history" && " · restored from history"}
          </p>
        </section>
      )}

      <footer className={styles.footer}>
        {mode === "js"
          ? "ALL PROCESSING HAPPENS IN YOUR BROWSER · NO UPLOAD · NO TRACKING"
          : "AUDIO IS SENT TO THE ANALYSIS SERVER · NOT STORED · DELETED AFTER PROCESSING"}
      </footer>
    </main>
  );
}
