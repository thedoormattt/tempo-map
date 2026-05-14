"use client";
import KeyChart from "./KeyChart";
import KeyWheel from "./KeyWheel";
import styles from "./KeySection.module.css";

export default function KeySection({
  keyCurve,
  duration,
  playhead,
  overallKey,
  onSeek,
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.chart}>
        <KeyChart
          keyCurve={keyCurve}
          duration={duration}
          playhead={playhead}
          overallKey={overallKey}
          onSeek={onSeek}
        />
      </div>
      <div className={styles.wheel}>
        <KeyWheel keyCurve={keyCurve} overallKey={overallKey} />
      </div>
    </div>
  );
}
