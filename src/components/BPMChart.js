"use client";
import { useState, useCallback } from "react";
import { formatTime } from "@/lib/utils";
import styles from "./BPMChart.module.css";

const W = 800;
const H = 280;
const PAD = { t: 20, r: 20, b: 44, l: 54 };
const IW = W - PAD.l - PAD.r;
const IH = H - PAD.t - PAD.b;

export default function BPMChart({
  curve,
  duration,
  playhead,
  avgBPM,
  onSeek,
}) {
  const [hovered, setHovered] = useState(null);

  const bpms = curve.map((d) => d.bpm);
  const minBPM = Math.floor(Math.min(...bpms) / 10) * 10 - 10;
  const maxBPM = Math.ceil(Math.max(...bpms) / 10) * 10 + 10;
  const bpmRange = maxBPM - minBPM;

  const xS = (t) => (t / duration) * IW;
  const yS = (b) => IH - ((b - minBPM) / bpmRange) * IH;

  // Y-axis ticks — every 10 BPM, but show only even ones for labels
  const yTicks = [];
  for (let b = Math.ceil(minBPM / 10) * 10; b <= maxBPM; b += 10)
    yTicks.push(b);

  // X-axis ticks — every 30 s
  const xTicks = [];
  for (let t = 0; t <= duration; t += 30) xTicks.push(t);

  const pts = curve.map((d) => `${xS(d.t)},${yS(d.bpm)}`).join(" ");
  const fillPts = [
    `0,${IH}`,
    ...curve.map((d) => `${xS(d.t)},${yS(d.bpm)}`),
    `${xS(curve[curve.length - 1].t)},${IH}`,
  ].join(" ");

  const playheadX = playhead != null ? xS(playhead) : null;

  const onMouseMove = useCallback(
    (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = (e.clientX - rect.left - PAD.l) * (W / rect.width);
      const mt = (mx / IW) * duration;
      let best = null,
        bestDist = Infinity;
      for (const d of curve) {
        const dist = Math.abs(d.t - mt);
        if (dist < bestDist) {
          bestDist = dist;
          best = d;
        }
      }
      setHovered(best && bestDist * (IW / duration) < 20 ? best : null);
    },
    [curve, duration],
  );

  // Tooltip placement: flip to left if near right edge
  const tooltipX = (d) => {
    const x = xS(d.t);
    return x > IW - 100 ? x - 90 : x + 8;
  };

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
      <p className={styles.hint}>
        BPM OVER TIME · hover to inspect · dashed = average
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.svg}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setHovered(null)}
        onClick={onMouseClick}
        aria-label="BPM over time chart"
        role="img"
      >
        <defs>
          <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8c96a" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#e8c96a" stopOpacity="0.01" />
          </linearGradient>
          <clipPath id="chartClip">
            <rect x="0" y="0" width={IW} height={IH} />
          </clipPath>
        </defs>

        <g transform={`translate(${PAD.l},${PAD.t})`}>
          {/* Grid */}
          {yTicks.map((b) => (
            <line
              key={b}
              x1={0}
              y1={yS(b)}
              x2={IW}
              y2={yS(b)}
              stroke="#1e1e1e"
              strokeWidth={1}
            />
          ))}

          {/* Fill */}
          <polygon
            clipPath="url(#chartClip)"
            fill="url(#fillGrad)"
            points={fillPts}
          />

          {/* Curve */}
          <polyline
            clipPath="url(#chartClip)"
            points={pts}
            fill="none"
            stroke="#e8c96a"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Average line */}
          <line
            x1={0}
            y1={yS(avgBPM)}
            x2={IW}
            y2={yS(avgBPM)}
            stroke="#e8c96a"
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.45}
          />

          {/* Playhead */}
          {playheadX != null && playheadX >= 0 && playheadX <= IW && (
            <line
              x1={playheadX}
              y1={0}
              x2={playheadX}
              y2={IH}
              stroke={`var(--danger)`}
              strokeWidth={1.5}
              opacity={0.75}
            />
          )}

          {/* Hover dot + tooltip */}
          {hovered && (
            <>
              <circle
                cx={xS(hovered.t)}
                cy={yS(hovered.bpm)}
                r={4}
                fill="#e8c96a"
              />
              <g
                transform={`translate(${tooltipX(hovered)},${Math.max(4, yS(hovered.bpm) - 36)})`}
              >
                <rect
                  x={0}
                  y={0}
                  width={82}
                  height={38}
                  rx={3}
                  fill="#111"
                  stroke="#e8c96a"
                  strokeWidth={1}
                />
                <text
                  x={8}
                  y={14}
                  fill="#888"
                  fontSize={10}
                  fontFamily="monospace"
                >
                  {formatTime(hovered.t)}
                </text>
                <text
                  x={8}
                  y={30}
                  fill="#f0f0f0"
                  fontSize={13}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {Math.round(hovered.bpm)} BPM
                </text>
              </g>
            </>
          )}

          {/* Y-axis labels */}
          {yTicks
            .filter((b) => b % 20 === 0)
            .map((b) => (
              <text
                key={b}
                x={-8}
                y={yS(b) + 4}
                textAnchor="end"
                fill="#555"
                fontSize={10}
                fontFamily="monospace"
              >
                {b}
              </text>
            ))}

          {/* X-axis ticks + labels */}
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

          {/* Axes */}
          <line x1={0} y1={0} x2={0} y2={IH} stroke="#2a2a2a" />
          <line x1={0} y1={IH} x2={IW} y2={IH} stroke="#2a2a2a" />
        </g>
      </svg>
    </div>
  );
}
