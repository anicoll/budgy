/**
 * The budgy mark: three slanted numbat stripes rising like a bar chart, the
 * last one in apricot. Matches src/app/icon.svg, which is the favicon.
 */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect width="64" height="64" rx="16" className="fill-[#0e5561] dark:fill-[#b0ecfb]" />
      <g transform="skewX(-12) translate(7 0)">
        <rect
          x="13"
          y="34"
          width="9"
          height="18"
          rx="4.5"
          className="fill-[#f8fafa] dark:fill-[#004e5a]"
        />
        <rect
          x="27.5"
          y="24"
          width="9"
          height="28"
          rx="4.5"
          className="fill-[#f8fafa] dark:fill-[#004e5a]"
        />
        <rect
          x="42"
          y="14"
          width="9"
          height="38"
          rx="4.5"
          className="fill-[#f4a27a] dark:fill-[#c25f33]"
        />
      </g>
    </svg>
  );
}
