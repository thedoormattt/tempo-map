"use client";
import { useState, useCallback } from "react";
import { NOTE_NAMES } from "@/lib/dsp";
import { formatTime } from "@/lib/utils";
import styles from "./KeyChart.module.css";

const W = 800;
const H = 200;
const PAD = { t: 20, r: 20, b: 44, l: 54 };
const IW = W - PAD.l - PAD.r;
const IH = H - PAD.t - PAD.b;

const MAJOR_KEYS = NOTE_NAMES.map((n) => `${n} major`);
const MINOR_KEYS = NOTE_NAMES.map((n) => `${n} minor`);
const ALL_KEYS = [...MAJOR_KEYS, ...MINOR_KEYS];

function keyColour(mode, confidence) {
  const alpha = 0.35 + Math.max(0, Math.min(confidence, 1)) * 0.65;
  return mode === "major"
    ? `rgba(232, 201, 106, ${alpha})`
    : `rgba(100, 160, 210, ${alpha})`;
}

export default function KeyChart({ keyCurve, duration, playhead, overallKey }) {
  const [hovered, setHovered] = useState(null);

  const xS = (t) => (t / duration) * IW;
  const yS = (label) => {
    const idx = ALL_KEYS.indexOf(label);
    return idx === -1 ? 0 : (idx / (ALL_KEYS.length - 1)) * IH;
  };

  const xTicks = [];
  for (let t = 0; t <= duration; t += 30) xTicks.push(t);

  const segments = keyCurve.slice(0, -1).map((d, i) => {
    const next = keyCurve[i + 1];
    return {
      x: xS(d.t),
      width: xS(next.t) - xS(d.t),
      y: yS(d.label),
      label: d.label,
      mode: d.mode,
      confidence: d.confidence,
      t: d.t,
    };
  });

  const dots = keyCurve.map((d) => ({ cx: xS(d.t), cy: yS(d.label), ...d }));

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
      setHovered(best && bestDist * (IW / duration) < 30 ? best : null);
    },
    [keyCurve, duration],
  );

  const tooltipX = (d) => {
    const x = xS(d.t);
    return x > IW - 110 ? x - 100 : x + 8;
  };

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
        aria-label="Key over time chart"
        role="img"
      >
        <defs>
          <clipPath id="keyClip">
            <rect x="0" y="0" width={IW} height={IH} />
          </clipPath>
        </defs>

        <g transform={`translate(${PAD.l},${PAD.t})`}>
          <line
            x1={0}
            y1={IH / 2}
            x2={IW}
            y2={IH / 2}
            stroke="#1e1e1e"
            strokeWidth={1}
            strokeDasharray="3 3"
          />

          {segments.map((s, i) => (
            <rect
              key={i}
              clipPath="url(#keyClip)"
              x={s.x}
              y={s.y - 4}
              width={Math.max(s.width - 1, 1)}
              height={8}
              rx={2}
              fill={keyColour(s.mode, s.confidence)}
            />
          ))}

          {dots.length > 1 && (
            <polyline
              clipPath="url(#keyClip)"
              points={dots.map((d) => `${d.cx},${d.cy}`).join(" ")}
              fill="none"
              stroke="#333"
              strokeWidth={1}
              strokeLinejoin="round"
            />
          )}

          {dots.map((d, i) => (
            <circle
              key={i}
              clipPath="url(#keyClip)"
              cx={d.cx}
              cy={d.cy}
              r={3}
              fill={keyColour(d.mode, d.confidence)}
              stroke="#0d0d0d"
              strokeWidth={1}
            />
          ))}

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

          {hovered && (
            <>
              <circle
                cx={xS(hovered.t)}
                cy={yS(hovered.label)}
                r={5}
                fill={keyColour(hovered.mode, hovered.confidence)}
                stroke="#fff"
                strokeWidth={1}
              />
              <g
                transform={`translate(${tooltipX(hovered)},${Math.max(4, yS(hovered.label) - 42)})`}
              >
                <rect
                  x={0}
                  y={0}
                  width={98}
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
                  fontSize={13}
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
                  {Math.round(hovered.confidence * 100)}% confidence
                </text>
              </g>
            </>
          )}

          {[0, 6, 12, 18].map((idx) => (
            <text
              key={idx}
              x={-6}
              y={yS(ALL_KEYS[idx]) + 4}
              textAnchor="end"
              fill="#444"
              fontSize={9}
              fontFamily="monospace"
            >
              {ALL_KEYS[idx].replace(" major", "M").replace(" minor", "m")}
            </text>
          ))}

          <text
            x={-6}
            y={IH / 4}
            textAnchor="end"
            fill="#555"
            fontSize={8}
            fontFamily="monospace"
          >
            MAJOR
          </text>
          <text
            x={-6}
            y={(IH * 3) / 4}
            textAnchor="end"
            fill="#555"
            fontSize={8}
            fontFamily="monospace"
          >
            MINOR
          </text>

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
