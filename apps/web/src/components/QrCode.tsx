import { encode } from "uqr";

/**
 * A QR code drawn as one SVG path. It stays dark on white in both themes,
 * since phone cameras read that best.
 */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { data, size } = encode(value, { ecc: "L", border: 4 });
  let d = "";
  data.forEach((line, y) => {
    line.forEach((on, x) => {
      if (on) d += `M${x} ${y}h1v1h-1z`;
    });
  });
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className="h-auto w-full max-w-72 rounded-lg bg-white"
    >
      <path d={d} fill="#000" />
    </svg>
  );
}
