"use client";
import { useMemo } from "react";
import styles from "./KeyWheel.module.css";

// Circle of fifths order (clockwise from top)
const FIFTHS_ORDER = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]; // C G D A E B F# Db Ab Eb Bb F

const NOTE_NAMES_SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NOTE_NAMES_FLAT  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function rootToName(root, mode) {
  return mode === "major" ? NOTE_NAMES_FLAT[root] : NOTE_NAMES_SHARP[root];
}

const SIZE    = 260;
const CX      = SIZE / 2;
const CY      = SIZE / 2;
const R_MAJOR = 95;   // outer ring (major)
const R_MINOR = 62;   // inner ring (minor)
const R_LABEL_MAJOR = 112;
const R_LABEL_MINOR = 76;
const SECTOR_PAD = 0.04; // radians gap between sectors

function polarToXY(angle, r) {
  return {
    x: CX + r * Math.sin(angle),
    y: CY - r * Math.cos(angle),
  };
}

function sectorPath(index, total, rInner, rOuter, pad = SECTOR_PAD) {
  const slice     = (2 * Math.PI) / total;
  const startAngle = index * slice - Math.PI / total + pad / 2;
  const endAngle   = (index + 1) * slice - Math.PI / total - pad / 2;

  const p1 = polarToXY(startAngle, rInner);
  const p2 = polarToXY(startAngle, rOuter);
  const p3 = polarToXY(endAngle,   rOuter);
  const p4 = polarToXY(endAngle,   rInner);

  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    `M ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p3.x} ${p3.y}`,
    `L ${p4.x} ${p4.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p1.x} ${p1.y}`,
    "Z",
  ].join(" ");
}

export default function KeyWheel({ keyCurve, overallKey }) {
  // ── Score each key by time spent (weighted by confidence) ────────────────
  const scores = useMemo(() => {
    const s = {};
    for (const d of keyCurve) {
      s[d.label] = (s[d.label] ?? 0) + Math.max(0, d.confidence);
    }
    // Normalise to [0, 1]
    const max = Math.max(...Object.values(s), 0.001);
    const out = {};
    for (const k in s) out[k] = s[k] / max;
    return out;
  }, [keyCurve]);

  const sectors = useMemo(() => {
    return FIFTHS_ORDER.map((root, i) => {
      const majorLabel = `${rootToName(root, "major")} major`;
      const minorLabel = `${rootToName(root, "minor")} minor`;
      const majorScore = scores[majorLabel] ?? 0;
      const minorScore = scores[minorLabel] ?? 0;
      const angle      = (2 * Math.PI / 12) * i - Math.PI / 12;
      const midAngle   = (2 * Math.PI / 12) * i;
      return { root, i, majorLabel, minorLabel, majorScore, minorScore, midAngle };
    });
  }, [scores]);

  function majorFill(score) {
    const alpha = 0.06 + score * 0.94;
    return `rgba(232, 201, 106, ${alpha})`;
  }

  function minorFill(score) {
    const alpha = 0.06 + score * 0.94;
    return `rgba(100, 160, 210, ${alpha})`;
  }

  const isOverallMajor = overallKey?.mode === "major";

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>CIRCLE OF FIFTHS · brightness = time spent</p>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={styles.svg}
        aria-label="Circle of fifths heatmap"
      >
        {/* ── Centre label ── */}
        <circle cx={CX} cy={CY} r={42} fill="#0d0d0d" stroke="#1e1e1e" strokeWidth={1} />
        {overallKey && (
          <>
            <text x={CX} y={CY - 5} textAnchor="middle"
              fill={isOverallMajor ? "#e8c96a" : "#64a0d2"}
              fontSize={13} fontFamily="monospace" fontWeight="bold">
              {overallKey.label.replace(" major", "").replace(" minor", "")}
            </text>
            <text x={CX} y={CY + 11} textAnchor="middle"
              fill="#444" fontSize={9} fontFamily="monospace" letterSpacing="0.1em">
              {overallKey.mode.toUpperCase()}
            </text>
          </>
        )}

        {/* ── Sectors ── */}
        {sectors.map(({ root, i, majorLabel, minorLabel, majorScore, minorScore, midAngle }) => {
          const isOverallSector =
            overallKey?.root === root;
          const labelPos = polarToXY(midAngle, R_LABEL_MAJOR);
          const minorLabelPos = polarToXY(midAngle, R_LABEL_MINOR);
          const name = rootToName(root, "major");
          const minorName = rootToName(root, "minor");

          return (
            <g key={root}>
              {/* Major sector (outer) */}
              <path
                d={sectorPath(i, 12, R_MINOR + 2, R_MAJOR)}
                fill={majorFill(majorScore)}
                stroke={isOverallSector && isOverallMajor ? "#e8c96a" : "#1a1a1a"}
                strokeWidth={isOverallSector && isOverallMajor ? 1.5 : 0.5}
              />
              {/* Minor sector (inner) */}
              <path
                d={sectorPath(i, 12, 46, R_MINOR - 2)}
                fill={minorFill(minorScore)}
                stroke={isOverallSector && !isOverallMajor ? "#64a0d2" : "#1a1a1a"}
                strokeWidth={isOverallSector && !isOverallMajor ? 1.5 : 0.5}
              />
              {/* Major label */}
              <text
                x={labelPos.x} y={labelPos.y + 4}
                textAnchor="middle"
                fill={majorScore > 0.15 ? "#e8c96a" : "#444"}
                fontSize={majorScore > 0.5 ? 11 : 9}
                fontFamily="monospace"
                fontWeight={majorScore > 0.5 ? "bold" : "normal"}
              >
                {name}
              </text>
              {/* Minor label */}
              <text
                x={minorLabelPos.x} y={minorLabelPos.y + 3}
                textAnchor="middle"
                fill={minorScore > 0.15 ? "#64a0d2" : "#333"}
                fontSize={8}
                fontFamily="monospace"
              >
                {minorName}m
              </text>
            </g>
          );
        })}

        {/* ── Ring divider ── */}
        <circle cx={CX} cy={CY} r={R_MINOR} fill="none" stroke="#111" strokeWidth={1} />
        <circle cx={CX} cy={CY} r={R_MAJOR} fill="none" stroke="#111" strokeWidth={1} />
      </svg>
    </div>
  );
}
