"use client";
import { useState, useEffect, useCallback } from "react";
import { loadHistory, deleteAnalysis, clearHistory } from "@/lib/db";
import { formatTime } from "@/lib/utils";
import styles from "./HistoryPanel.module.css";

function MiniSparkline({ curve }) {
  if (!curve?.length) return null;
  const W = 64,
    H = 20;
  const bpms = curve.map((d) => d.bpm);
  const minB = Math.min(...bpms);
  const maxB = Math.max(...bpms);
  const range = maxB - minB || 1;
  const xS = (i) => (i / (curve.length - 1)) * W;
  const yS = (b) => H - ((b - minB) / range) * H;
  const pts = curve.map((d, i) => `${xS(i)},${yS(d.bpm)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.sparkline}>
      <polyline
        points={pts}
        fill="none"
        stroke="#e8c96a"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function HistoryPanel({ onRestore }) {
  const [history, setHistory] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const h = await loadHistory();
      setHistory(h);
    } catch (e) {
      console.warn("History load failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    await deleteAnalysis(id);
    setHistory((h) => h.filter((r) => r.id !== id));
  };

  const handleClear = async () => {
    if (!confirm("Clear all history?")) return;
    await clearHistory();
    setHistory([]);
  };

  const handleRestore = (record) => {
    onRestore(
      {
        bpmCurve: record.bpmCurve,
        keyCurve: record.keyCurve,
        overallKey: record.overallKey,
        duration: record.duration,
        sampleRate: record.sampleRate,
        channels: record.channels,
      },
      record.filename,
    );
    setOpen(false);
  };

  return (
    <div className={styles.wrap}>
      <button
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.triggerIcon}>⟳</span>
        HISTORY
        {history.length > 0 && !open && (
          <span className={styles.badge}>{history.length}</span>
        )}
        <span className={styles.triggerChevron}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className={styles.panel}>
          {loading && <p className={styles.empty}>Loading...</p>}

          {!loading && history.length === 0 && (
            <p className={styles.empty}>
              No analyses yet — drop a file to get started.
            </p>
          )}

          {!loading && history.length > 0 && (
            <>
              <div className={styles.list}>
                {history.map((record) => (
                  <div
                    key={record.id}
                    className={styles.item}
                    onClick={() => handleRestore(record)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) =>
                      e.key === "Enter" && handleRestore(record)
                    }
                  >
                    <MiniSparkline curve={record.bpmCurve} />
                    <div className={styles.itemMeta}>
                      <p className={styles.itemName}>{record.filename}</p>
                      <p className={styles.itemStats}>
                        <span className={styles.bpm}>
                          {record.modalBpm} BPM
                        </span>
                        <span
                          className={
                            record.overallKey?.mode === "minor"
                              ? styles.keyMinor
                              : styles.keyMajor
                          }
                        >
                          {record.overallKey?.label ?? "—"}
                        </span>
                        <span className={styles.dim}>
                          {formatTime(record.duration)}
                        </span>
                      </p>
                      <p className={styles.itemDate}>
                        {new Date(record.analysedAt).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </p>
                    </div>
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => handleDelete(e, record.id)}
                      title="Remove from history"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className={styles.footer}>
                <button className={styles.clearBtn} onClick={handleClear}>
                  Clear all
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
