"use client";
import { useRef } from "react";
import styles from "./DropZone.module.css";

export default function DropZone({ status, progress, fileName, onFile }) {
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  const handleChange = (e) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      className={`${styles.zone} ${status !== "idle" ? styles.active : ""}`}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      aria-label="Drop audio file or click to browse"
    >
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className={styles.input}
        onChange={handleChange}
      />

      {status === "idle" && (
        <div className={styles.idle}>
          <span className={styles.icon}>⌁</span>
          <p className={styles.label}>DROP AN AUDIO FILE OR CLICK TO BROWSE</p>
          <p className={styles.hint}>MP3 · WAV · FLAC · OGG · M4A · AAC</p>
        </div>
      )}

      {status === "loading" && (
        <div className={styles.loading}>
          <p className={styles.loadingLabel}>ANALYSING {fileName}</p>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${progress}%` }} />
          </div>
          <p className={styles.pct}>{progress}%</p>
        </div>
      )}

      {status === "done" && (
        <div className={styles.done}>
          <p>✓ {fileName}</p>
          <p className={styles.hint}>Click to load a different file</p>
        </div>
      )}

      {status === "error" && (
        <div className={styles.done}>
          <p className={styles.error}>✗ Analysis failed — try another file</p>
          <p className={styles.hint}>Click to try again</p>
        </div>
      )}
    </div>
  );
}
