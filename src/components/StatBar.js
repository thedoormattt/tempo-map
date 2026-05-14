import { formatTime } from "@/lib/utils";
import styles from "./StatBar.module.css";

export default function StatBar({ stats, duration }) {
  const items = [
    { label: "MODAL BPM", value: stats.avg },
    {
      label: "PEAK BPM",
      value: `${Math.round(stats.max.bpm)} @ ${formatTime(stats.max.t)}`,
    },
    {
      label: "LOW BPM",
      value: `${Math.round(stats.min.bpm)} @ ${formatTime(stats.min.t)}`,
    },
    { label: "DURATION", value: formatTime(duration) },
  ];

  return (
    <div className={styles.bar}>
      {items.map((s) => (
        <div key={s.label} className={styles.cell}>
          <span className={styles.label}>{s.label}</span>
          <span className={styles.value}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}
