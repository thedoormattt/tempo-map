"use client";
import { useMemo, useState } from "react";
import styles from "./KeyWheel.module.css";

const FIFTHS_ORDER = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
const RELATIVE_MINOR = FIFTHS_ORDER.map((root) => (root - 3 + 12) % 12);

const NOTE_NAMES_SHARP = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const NOTE_NAMES_FLAT = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

function rootToName(root, mode) {
  return mode === "major" ? NOTE_NAMES_FLAT[root] : NOTE_NAMES_SHARP[root];
}

const SIZE = 380;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 175; // outer edge of major ring
const R_MID = 115; // boundary between major and minor rings
const R_INNER = 62; // inner edge of minor ring (centre hole)
const SECTOR_PAD = 0.03;

// Label radii — midpoint of each ring
const R_LABEL_MAJOR = (R_OUTER + R_MID) / 2; // ~145
const R_LABEL_MINOR = (R_MID + R_INNER) / 2; // ~88

function polarToXY(angle, r) {
  return {
    x: CX + r * Math.sin(angle),
    y: CY - r * Math.cos(angle),
  };
}

function sectorPath(index, rInner, rOuter, pad = SECTOR_PAD) {
  const slice = (2 * Math.PI) / 12;
  const startAngle = index * slice - slice / 2 + pad / 2;
  const endAngle = index * slice + slice / 2 - pad / 2;
  const p1 = polarToXY(startAngle, rInner);
  const p2 = polarToXY(startAngle, rOuter);
  const p3 = polarToXY(endAngle, rOuter);
  const p4 = polarToXY(endAngle, rInner);
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
  const [hovered, setHovered] = useState(null);

  const { scores, pcts } = useMemo(() => {
    const counts = {};
    const total = keyCurve.length || 1;
    for (const d of keyCurve) counts[d.label] = (counts[d.label] ?? 0) + 1;
    const max = Math.max(...Object.values(counts), 0.001);
    const pcts = {},
      scores = {};
    for (const k in counts) {
      pcts[k] = Math.round((counts[k] / total) * 100);
      scores[k] = counts[k] / max;
    }
    return { scores, pcts };
  }, [keyCurve]);

  const sectors = useMemo(
    () =>
      FIFTHS_ORDER.map((majorRoot, i) => {
        const minorRoot = RELATIVE_MINOR[i];
        const majorLabel = `${rootToName(majorRoot, "major")} major`;
        const minorLabel = `${rootToName(minorRoot, "minor")} minor`;
        return {
          majorRoot,
          minorRoot,
          i,
          majorLabel,
          minorLabel,
          majorScore: scores[majorLabel] ?? 0,
          minorScore: scores[minorLabel] ?? 0,
          majorPct: pcts[majorLabel] ?? 0,
          minorPct: pcts[minorLabel] ?? 0,
          midAngle: ((2 * Math.PI) / 12) * i,
        };
      }),
    [scores, pcts],
  );

  const majorFill = (s) => `rgba(232, 201, 106, ${0.06 + s * 0.94})`;
  const minorFill = (s) => `rgba(100, 160, 210, ${0.06 + s * 0.94})`;
  const isOverallMajor = overallKey?.mode === "major";

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>CIRCLE OF FIFTHS · brightness = time spent</p>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className={styles.svg}
        aria-label="Circle of fifths heatmap"
      >
        {/* ── Centre hole ── */}
        <circle
          cx={CX}
          cy={CY}
          r={R_INNER - 1}
          fill="#0d0d0d"
          stroke="#1e1e1e"
          strokeWidth={1}
        />

        {/* ── Centre label ── */}
        {overallKey && !hovered && (
          <>
            <text
              x={CX}
              y={CY - 6}
              textAnchor="middle"
              fill={isOverallMajor ? "#e8c96a" : "#64a0d2"}
              fontSize={15}
              fontFamily="monospace"
              fontWeight="bold"
            >
              {overallKey.label.replace(" major", "").replace(" minor", "")}
            </text>
            <text
              x={CX}
              y={CY + 12}
              textAnchor="middle"
              fill="#444"
              fontSize={10}
              fontFamily="monospace"
              letterSpacing="0.12em"
            >
              {overallKey.mode.toUpperCase()}
            </text>
          </>
        )}
        {hovered && (
          <>
            <text
              x={CX}
              y={CY - 8}
              textAnchor="middle"
              fill={hovered.mode === "major" ? "#e8c96a" : "#64a0d2"}
              fontSize={12}
              fontFamily="monospace"
              fontWeight="bold"
            >
              {hovered.label}
            </text>
            <text
              x={CX}
              y={CY + 11}
              textAnchor="middle"
              fill="#888"
              fontSize={14}
              fontFamily="monospace"
              fontWeight="bold"
            >
              {hovered.pct}%
            </text>
          </>
        )}

        {/* ── Sectors ── */}
        {sectors.map(
          ({
            majorRoot,
            minorRoot,
            i,
            majorLabel,
            minorLabel,
            majorScore,
            minorScore,
            majorPct,
            minorPct,
            midAngle,
          }) => {
            const isOverallMajorSector =
              overallKey?.root === majorRoot && overallKey?.mode === "major";
            const isOverallMinorSector =
              overallKey?.root === minorRoot && overallKey?.mode === "minor";
            const majorLabelPos = polarToXY(midAngle, R_LABEL_MAJOR);
            const minorLabelPos = polarToXY(midAngle, R_LABEL_MINOR);
            const majorName = rootToName(majorRoot, "major");
            const minorName = rootToName(minorRoot, "minor");

            return (
              <g key={majorRoot}>
                {/* Major ring */}
                <path
                  d={sectorPath(i, R_MID + 2, R_OUTER)}
                  fill={majorFill(majorScore)}
                  stroke={isOverallMajorSector ? "#e8c96a" : "#1a1a1a"}
                  strokeWidth={isOverallMajorSector ? 2 : 0.5}
                  style={{ cursor: majorScore > 0 ? "pointer" : "default" }}
                  onMouseEnter={() =>
                    majorScore > 0 &&
                    setHovered({
                      label: majorLabel,
                      pct: majorPct,
                      mode: "major",
                    })
                  }
                  onMouseLeave={() => setHovered(null)}
                />
                {/* Minor ring */}
                <path
                  d={sectorPath(i, R_INNER + 1, R_MID - 2)}
                  fill={minorFill(minorScore)}
                  stroke={isOverallMinorSector ? "#64a0d2" : "#1a1a1a"}
                  strokeWidth={isOverallMinorSector ? 2 : 0.5}
                  style={{ cursor: minorScore > 0 ? "pointer" : "default" }}
                  onMouseEnter={() =>
                    minorScore > 0 &&
                    setHovered({
                      label: minorLabel,
                      pct: minorPct,
                      mode: "minor",
                    })
                  }
                  onMouseLeave={() => setHovered(null)}
                />
                {/* Major label — inside major ring */}
                <text
                  x={majorLabelPos.x}
                  y={majorLabelPos.y + 4}
                  textAnchor="middle"
                  fill={
                    majorScore > 0.15
                      ? majorScore > 0.6
                        ? "#1a1400"
                        : "#e8c96a"
                      : "#555"
                  }
                  fontSize={majorScore > 0.4 ? 13 : 11}
                  fontFamily="monospace"
                  fontWeight={majorScore > 0.4 ? "bold" : "normal"}
                  style={{ pointerEvents: "none" }}
                >
                  {majorName}
                </text>
                {/* Minor label — inside minor ring */}
                <text
                  x={minorLabelPos.x}
                  y={minorLabelPos.y + 3}
                  textAnchor="middle"
                  fill={
                    minorScore > 0.15
                      ? minorScore > 0.6
                        ? "#0a1520"
                        : "#64a0d2"
                      : "#444"
                  }
                  fontSize={minorScore > 0.4 ? 11 : 9}
                  fontFamily="monospace"
                  fontWeight={minorScore > 0.4 ? "bold" : "normal"}
                  style={{ pointerEvents: "none" }}
                >
                  {minorName}m
                </text>
              </g>
            );
          },
        )}

        {/* ── Ring dividers ── */}
        <circle
          cx={CX}
          cy={CY}
          r={R_MID}
          fill="none"
          stroke="#111"
          strokeWidth={1}
        />
        <circle
          cx={CX}
          cy={CY}
          r={R_OUTER}
          fill="none"
          stroke="#111"
          strokeWidth={1}
        />
        <circle
          cx={CX}
          cy={CY}
          r={R_INNER}
          fill="none"
          stroke="#111"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}
