type ScorePanelProps = {
  label: string;
  value: number;
  accent: "gold" | "ink";
};

export function ScorePanel({ label, value, accent }: ScorePanelProps) {
  return (
    <div className={`score-panel score-panel--${accent}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}
