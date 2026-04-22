// Lucide-style stroked SVG icons sized for Instagram chrome (24px default).
// Instagram uses outline icons at this exact weight; tweak `strokeWidth` if
// the visual feels off after eyeballing against a real screenshot.

type IconProps = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

const baseProps = (size: number, strokeWidth: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
});

export function HeartIcon({ size = 24, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

export function CommentIcon({ size = 24, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

export function PaperPlaneIcon({ size = 24, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

export function BookmarkIcon({ size = 24, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function ThreeDotsIcon({ size = 24, strokeWidth = 2, className }: IconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}

// Status bar — simplified iOS glyphs at 14×14 monochrome.
export function SignalIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
    >
      <rect x="1" y="9" width="2.5" height="3" rx="0.5" />
      <rect x="5" y="6.5" width="2.5" height="5.5" rx="0.5" />
      <rect x="9" y="3.5" width="2.5" height="8.5" rx="0.5" />
      <rect x="13" y="0.5" width="2.5" height="11.5" rx="0.5" />
    </svg>
  );
}

export function WifiIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
    >
      <path d="M8 13.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm0-3.5c-1.4 0-2.7.5-3.7 1.4l-1-1.1A6.5 6.5 0 0 1 8 8.5a6.5 6.5 0 0 1 4.7 1.8l-1 1.1A5.5 5.5 0 0 0 8 10zm0-3.5a8 8 0 0 0-5.7 2.3l-1-1A9.5 9.5 0 0 1 8 5a9.5 9.5 0 0 1 6.7 2.3l-1 1A8 8 0 0 0 8 6.5zm0-3A11 11 0 0 0 .3 4.6l-1-1A12.5 12.5 0 0 1 8 0a12.5 12.5 0 0 1 8.7 3.6l-1 1A11 11 0 0 0 8 3z" />
    </svg>
  );
}

export function BatteryIcon({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={(size * 11) / 24}
      viewBox="0 0 24 11"
      fill="none"
      className={className}
    >
      <rect
        x="0.5"
        y="0.5"
        width="20"
        height="10"
        rx="2.5"
        stroke="currentColor"
        opacity="0.6"
      />
      <rect x="2" y="2" width="17" height="7" rx="1.5" fill="currentColor" />
      <rect x="21" y="3.5" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.6" />
    </svg>
  );
}
