"use client";
import { useState, useCallback, useMemo } from "react";
import { formatTime } from "@/lib/utils";
import styles from "./KeyChart.module.css";

const W = 800;
const PAD = { t: 12, r: 20, b: 44, l: 72 };
const IW = W - PAD.l - PAD.r;
const LANE_H = 18;
const LANE_GAP = 3;

function keyColour(mode, confidence) {
  const alpha = 0.3 + Math.max(0, Math.min(confidence, 1)) * 0.7;
  return mode === "major"
    ? `rgba(232, 201, 106, ${alpha})`
    : `rgba(100, 160, 210, ${alpha})`;
}

function keyStroke(mode) {
  return mode === "major" ? "rgba(232,201,106,0.4)" : "rgba(100,160,210,0.4)";
}

export default function KeyChart({
  keyCurve,
  duration,
  playhead,
  overallKey,
  onSeek,
}) {
  const [hovered, setHovered] = useState(null);

  const xS = (t) => (t / duration) * IW;

  const { lanes, laneIndex } = useMemo(() => {
    const counts = {};
    for (const d of keyCurve) {
      counts[d.label] = (counts[d.label] ?? 0) + 1;
    }
    const sorted = Object.keys(counts).sort((a, b) => {
      if (overallKey && a === overallKey.label) return -1;
      if (overallKey && b === overallKey.label) return 1;
      return counts[b] - counts[a];
    });
    const index = {};
    sorted.forEach((k, i) => {
      index[k] = i;
    });
    return { lanes: sorted, laneIndex: index };
  }, [keyCurve, overallKey]);

  const IH = lanes.length * (LANE_H + LANE_GAP) + 8;
  const H = IH + PAD.t + PAD.b;

  const laneY = (label) => {
    const i = laneIndex[label] ?? 0;
    return i * (LANE_H + LANE_GAP);
  };

  const hopSec = keyCurve.length > 1 ? keyCurve[1].t - keyCurve[0].t : 2;

  const segments = keyCurve.map((d) => ({
    x: xS(Math.max(0, d.t - hopSec / 2)),
    width: xS(hopSec) - 1,
    y: laneY(d.label),
    label: d.label,
    mode: d.mode,
    confidence: d.confidence,
    t: d.t,
  }));

  const xTicks = [];
  for (let t = 0; t <= duration; t += 30) xTicks.push(t);

  const playheadX = playhead != null ? xS(playhead) : null;

  const onMouseMove = useCallback(
    (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = (e.clientX - rect.left - PAD.l) * (W / rect.width);
      const mt = (mx / IW) * duration;
      let best = null,
        bestDist = Infinity;
      for (const d of keyCurve) {
        const dist = Math.abs(d.t - mt);
        if (dist < bestDist) {
          bestDist = dist;
          best = d;
        }
      }
      setHovered(best && bestDist * (IW / duration) < 20 ? best : null);
    },
    [keyCurve, duration],
  );

  const tooltipT = hovered ? xS(hovered.t) : 0;
  const tooltipX = hovered
    ? tooltipT > IW - 110
      ? tooltipT - 108
      : tooltipT + 8
    : 0;
  const tooltipY = hovered ? Math.max(0, laneY(hovered.label) - 2) : 0;

  const onMouseClick = useCallback(
    (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = (e.clientX - rect.left - PAD.l) * (W / rect.width);
      const t = (mx / IW) * duration;
      if (t >= 0 && t <= duration) onSeek?.(t);
    },
    [duration],
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <p className={styles.hint}>KEY OVER TIME · hover to inspect</p>
        {overallKey && (
          <p className={styles.overall}>
            <span className={styles.overallLabel}>OVERALL KEY</span>
            <span
              className={
                overallKey.mode === "major" ? styles.major : styles.minor
              }
            >
              {overallKey.label}
            </span>
          </p>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.svg}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHovered(null)}
        onClick={onMouseClick}
        aria-label="Key over time swimlane chart"
        role="img"
      >
        <defs>
          <clipPath id="keySwimClip">
            <rect x="0" y="0" width={IW} height={IH} />
          </clipPath>
        </defs>

        <g transform={`translate(${PAD.l},${PAD.t})`}>
          {lanes.map((label) => {
            const isOverall = overallKey?.label === label;
            return (
              <rect
                key={label}
                x={0}
                y={laneY(label)}
                width={IW}
                height={LANE_H}
                fill={
                  isOverall
                    ? "rgba(255,255,255,0.03)"
                    : "rgba(255,255,255,0.01)"
                }
                rx={2}
              />
            );
          })}

          {segments.map((s, i) => (
            <rect
              key={i}
              clipPath="url(#keySwimClip)"
              x={s.x}
              y={s.y + 1}
              width={Math.max(s.width, 2)}
              height={LANE_H - 2}
              rx={2}
              fill={keyColour(s.mode, s.confidence)}
              stroke={
                hovered?.label === s.label && Math.abs(hovered.t - s.t) < 1
                  ? keyStroke(s.mode)
                  : "none"
              }
            />
          ))}

          {hovered && (
            <line
              x1={xS(hovered.t)}
              y1={0}
              x2={xS(hovered.t)}
              y2={IH}
              stroke="#fff"
              strokeWidth={1}
              opacity={0.15}
            />
          )}

          {playheadX != null && playheadX >= 0 && playheadX <= IW && (
            <line
              x1={playheadX}
              y1={0}
              x2={playheadX}
              y2={IH}
              stroke="var(--danger)"
              strokeWidth={1.5}
              opacity={0.75}
            />
          )}

          {lanes.map((label) => {
            const isOverall = overallKey?.label === label;
            const mode =
              keyCurve.find((d) => d.label === label)?.mode ?? "major";
            const shortLabel = label
              .replace(" major", "M")
              .replace(" minor", "m");
            return (
              <text
                key={label}
                x={-6}
                y={laneY(label) + LANE_H / 2 + 4}
                textAnchor="end"
                fill={
                  isOverall
                    ? mode === "major"
                      ? "#e8c96a"
                      : "#64a0d2"
                    : "#555"
                }
                fontSize={isOverall ? 11 : 10}
                fontFamily="monospace"
                fontWeight={isOverall ? "bold" : "normal"}
              >
                {shortLabel}
              </text>
            );
          })}

          {hovered && (
            <g transform={`translate(${tooltipX},${tooltipY})`}>
              <rect
                x={0}
                y={0}
                width={100}
                height={44}
                rx={3}
                fill="#111"
                stroke={hovered.mode === "major" ? "#e8c96a" : "#64a0d2"}
                strokeWidth={1}
              />
              <text
                x={8}
                y={14}
                fill="#666"
                fontSize={10}
                fontFamily="monospace"
              >
                {formatTime(hovered.t)}
              </text>
              <text
                x={8}
                y={28}
                fill="#f0f0f0"
                fontSize={12}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {hovered.label}
              </text>
              <text
                x={8}
                y={40}
                fill="#555"
                fontSize={9}
                fontFamily="monospace"
              >
                {Math.round(hovered.confidence * 100)}% conf
              </text>
            </g>
          )}

          {xTicks.map((t) => (
            <g key={t} transform={`translate(${xS(t)},${IH})`}>
              <line x1={0} y1={0} x2={0} y2={5} stroke="#333" />
              <text
                x={0}
                y={18}
                textAnchor="middle"
                fill="#555"
                fontSize={10}
                fontFamily="monospace"
              >
                {formatTime(t)}
              </text>
            </g>
          ))}

          <line x1={0} y1={0} x2={0} y2={IH} stroke="#2a2a2a" />
          <line x1={0} y1={IH} x2={IW} y2={IH} stroke="#2a2a2a" />
        </g>
      </svg>
    </div>
  );
}
