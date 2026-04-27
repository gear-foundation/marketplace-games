import type { CSSProperties } from "react";

    type TileProps = {
  value: number;
  animation: "idle" | "pulse" | "spawn";
};

const TILE_COLORS: Record<number, { background: string; foreground: string }> = {
  2: { background: "#f9efe2", foreground: "#5d4d3f" },
  4: { background: "#f4dfc5", foreground: "#5a4735" },
  8: { background: "#f79a4b", foreground: "#fffaf0" },
  16: { background: "#f07b3f", foreground: "#fffaf0" },
  32: { background: "#e86247", foreground: "#fffaf0" },
  64: { background: "#d74b3f", foreground: "#fffaf0" },
  128: { background: "#f2c65d", foreground: "#30210e" },
  256: { background: "#f0bc46", foreground: "#30210e" },
  512: { background: "#e7a93d", foreground: "#261709" },
  1024: { background: "#d99529", foreground: "#fffaf0" },
  2048: { background: "#c9821f", foreground: "#fffaf0" },
};

function getTileStyles(value: number): CSSProperties {
  const palette = TILE_COLORS[value];
  const fontSize =
    value < 100 ? "clamp(2.35rem, 7vw, 3.1rem)" : value < 1000 ? "clamp(1.95rem, 5.8vw, 2.55rem)" : "clamp(1.45rem, 4.8vw, 1.95rem)";

  if (palette) {
    return {
      "--tile-bg": palette.background,
      "--tile-fg": palette.foreground,
      "--tile-font-size": fontSize,
    } as CSSProperties;
  }

  return {
    "--tile-bg": "linear-gradient(140deg, #b66d18, #7a3f0f)",
    "--tile-fg": "#fffaf0",
    "--tile-font-size": fontSize,
  } as CSSProperties;
}

export function Tile({ value, animation }: TileProps) {
  return (
    <div className={`tile tile--${animation}`} style={getTileStyles(value)}>
      <span>{value}</span>
    </div>
  );
}
