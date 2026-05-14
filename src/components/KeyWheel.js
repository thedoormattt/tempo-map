"use client";
import { useMemo, useState, useCallback } from "react";
import styles from "./KeyWheel.module.css";

const FIFTHS_ORDER = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

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

const SIZE = 260;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_MAJOR = 95;
const R_MINOR = 62;
const R_LABEL_MAJOR = 112;
const R_LABEL_MINOR = 76;
const SECTOR_PAD = 0.04;

function polarToXY(angle, r) {
  return {
    x: CX + r * Math.sin(angle),
    y: CY - r * Math.cos(angle),
  };
}

function sectorPath(index, total, rInner, rOuter, pad = SECTOR_PAD) {
  const slice = (2 * Math.PI) / total;
  const startAngle = index * slice - Math.PI / total + pad / 2;
  const endAngle = (index + 1) * slice - Math.PI / total - pad / 2;
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
  const [hovered, setHovered] = useState(null); // { label, pct, mode }

  // Raw counts (windows) and normalised scores
  const { scores, pcts } = useMemo(() => {
    const counts = {};
    const total = keyCurve.length || 1;
    for (const d of keyCurve) {
      counts[d.label] = (counts[d.label] ?? 0) + 1;
    }
    const pcts = {};
    const scores = {};
    const max = Math.max(...Object.values(counts), 0.001);
    for (const k in counts) {
      pcts[k] = Math.round((counts[k] / total) * 100);
      scores[k] = counts[k] / max;
    }
    return { scores, pcts };
  }, [keyCurve]);

  const sectors = useMemo(() => {
    return FIFTHS_ORDER.map((root, i) => {
      const majorLabel = `${rootToName(root, "major")} major`;
      const minorLabel = `${rootToName(root, "minor")} minor`;
      return {
        root,
        i,
        majorLabel,
        minorLabel,
        majorScore: scores[majorLabel] ?? 0,
        minorScore: scores[minorLabel] ?? 0,
        majorPct: pcts[majorLabel] ?? 0,
        minorPct: pcts[minorLabel] ?? 0,
        midAngle: ((2 * Math.PI) / 12) * i,
      };
    });
  }, [scores, pcts]);

  function majorFill(score) {
    return `rgba(232, 201, 106, ${0.06 + score * 0.94})`;
  }
  function minorFill(score) {
    return `rgba(100, 160, 210, ${0.06 + score * 0.94})`;
  }

  const isOverallMajor = overallKey?.mode === "major";

  // Tooltip position — place near centre to avoid clipping
  const tooltipW = 108;
  const tooltipH = 36;

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>CIRCLE OF FIFTHS · brightness = time spent</p>
      <div className={styles.svgWrap}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className={styles.svg}
          aria-label="Circle of fifths heatmap"
        >
          {/* Centre */}
          <circle
            cx={CX}
            cy={CY}
            r={42}
            fill="#0d0d0d"
            stroke="#1e1e1e"
            strokeWidth={1}
          />
          {overallKey && !hovered && (
            <>
              <text
                x={CX}
                y={CY - 5}
                textAnchor="middle"
                fill={isOverallMajor ? "#e8c96a" : "#64a0d2"}
                fontSize={13}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {overallKey.label.replace(" major", "").replace(" minor", "")}
              </text>
              <text
                x={CX}
                y={CY + 11}
                textAnchor="middle"
                fill="#444"
                fontSize={9}
                fontFamily="monospace"
                letterSpacing="0.1em"
              >
                {overallKey.mode.toUpperCase()}
              </text>
            </>
          )}

          {/* Hovered label in centre */}
          {hovered && (
            <>
              <text
                x={CX}
                y={CY - 8}
                textAnchor="middle"
                fill={hovered.mode === "major" ? "#e8c96a" : "#64a0d2"}
                fontSize={11}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {hovered.label}
              </text>
              <text
                x={CX}
                y={CY + 10}
                textAnchor="middle"
                fill="#888"
                fontSize={12}
                fontFamily="monospace"
                fontWeight="bold"
              >
                {hovered.pct}%
              </text>
            </>
          )}

          {/* Sectors */}
          {sectors.map(
            ({
              root,
              i,
              majorLabel,
              minorLabel,
              majorScore,
              minorScore,
              majorPct,
              minorPct,
              midAngle,
            }) => {
              const isOverallSector = overallKey?.root === root;
              const labelPos = polarToXY(midAngle, R_LABEL_MAJOR);
              const minorLabelPos = polarToXY(midAngle, R_LABEL_MINOR);
              const name = rootToName(root, "major");
              const minorName = rootToName(root, "minor");

              return (
                <g key={root}>
                  {/* Major sector */}
                  <path
                    d={sectorPath(i, 12, R_MINOR + 2, R_MAJOR)}
                    fill={majorFill(majorScore)}
                    stroke={
                      isOverallSector && isOverallMajor ? "#e8c96a" : "#1a1a1a"
                    }
                    strokeWidth={isOverallSector && isOverallMajor ? 1.5 : 0.5}
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
                  {/* Minor sector */}
                  <path
                    d={sectorPath(i, 12, 46, R_MINOR - 2)}
                    fill={minorFill(minorScore)}
                    stroke={
                      isOverallSector && !isOverallMajor ? "#64a0d2" : "#1a1a1a"
                    }
                    strokeWidth={isOverallSector && !isOverallMajor ? 1.5 : 0.5}
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
                  {/* Major label */}
                  <text
                    x={labelPos.x}
                    y={labelPos.y + 4}
                    textAnchor="middle"
                    fill={majorScore > 0.15 ? "#e8c96a" : "#444"}
                    fontSize={majorScore > 0.5 ? 11 : 9}
                    fontFamily="monospace"
                    fontWeight={majorScore > 0.5 ? "bold" : "normal"}
                    style={{ pointerEvents: "none" }}
                  >
                    {name}
                  </text>
                  {/* Minor label */}
                  <text
                    x={minorLabelPos.x}
                    y={minorLabelPos.y + 3}
                    textAnchor="middle"
                    fill={minorScore > 0.15 ? "#64a0d2" : "#333"}
                    fontSize={8}
                    fontFamily="monospace"
                    style={{ pointerEvents: "none" }}
                  >
                    {minorName}m
                  </text>
                </g>
              );
            },
          )}

          {/* Ring dividers */}
          <circle
            cx={CX}
            cy={CY}
            r={R_MINOR}
            fill="none"
            stroke="#111"
            strokeWidth={1}
          />
          <circle
            cx={CX}
            cy={CY}
            r={R_MAJOR}
            fill="none"
            stroke="#111"
            strokeWidth={1}
          />
        </svg>
      </div>
    </div>
  );
}
