import clsx from "clsx";

type SpiceLevelIndicatorProps = {
  level: number;
  max?: number;
  showLabel?: boolean;
  className?: string;
  hideWhenZero?: boolean;
};

const clampLevel = (value: number, max: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= max) return max;
  return Math.round(value);
};

const parseLevel = (value: unknown): number => {
  if (typeof value === "number") return value;
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return 0;

  const numeric = Number(raw.replace(",", "."));
  if (Number.isFinite(numeric)) return numeric;

  if (
    raw.includes("poco") ||
    raw.includes("lieve") ||
    raw.includes("basso") ||
    raw.includes("low")
  ) {
    return 1;
  }
  if (
    raw.includes("medio") ||
    raw.includes("media") ||
    raw.includes("medium")
  ) {
    return 2;
  }
  if (
    raw.includes("molto") ||
    raw.includes("alto") ||
    raw.includes("forte") ||
    raw.includes("high")
  ) {
    return 3;
  }

  return 0;
};

const getSpiceLabel = (level: number): string => {
  if (level <= 0) return "Non piccante";
  if (level === 1) return "Poco piccante";
  if (level === 2) return "Piccante";
  return "Molto piccante";
};

function PepperIcon() {
  return (
    <svg
      viewBox="0 0 32 20"
      className="spice-pepper-icon"
      aria-hidden
      focusable="false"
    >
      <path
        d="M24.6 5.1c-4 .2-8.6 2.6-12.1 6.1-2.8 2.9-4 5.7-3.4 7.3.5 1.3 2.3 1.7 4.8 1 3.8-1.1 8.1-4.7 10.8-8.4 1.9-2.6 2.5-4.9 1.6-5.7-.3-.3-.8-.4-1.7-.3z"
        fill="#d32f2f"
      />
      <path
        d="M23.3 6.7c-3.2.4-6.8 2.5-9.8 5.4-1.7 1.7-2.9 3.6-3.4 5.1"
        fill="none"
        stroke="#ffb0a3"
        strokeWidth="1"
        strokeLinecap="round"
      />
      <path
        d="M24.7 4.8c-.5-1.4.2-2.8 1.7-3.6"
        fill="none"
        stroke="#2e7d32"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M24.1 5.5c1.4-.8 3-.8 4.4-.1"
        fill="none"
        stroke="#43a047"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SpiceLevelIndicator({
  level,
  max = 3,
  showLabel = true,
  className,
  hideWhenZero = false,
}: SpiceLevelIndicatorProps) {
  const safeMax = max <= 0 ? 3 : max;
  const safeLevel = clampLevel(parseLevel(level), safeMax);
  if (hideWhenZero && safeLevel <= 0) return null;

  const label = getSpiceLabel(safeLevel);

  return (
    <div
      className={clsx("spice-level", className)}
      aria-label={`Piccantezza: ${label}`}
    >
      <span className="spice-level-icons" aria-hidden>
        {Array.from({ length: safeMax }).map((_, index) => {
          const active = index + 1 <= safeLevel;
          return (
            <span
              key={`pepper-${index}`}
              className={
                active ? "spice-level-item active" : "spice-level-item"
              }
            >
              <PepperIcon />
            </span>
          );
        })}
      </span>
      {showLabel ? <span className="spice-level-label">{label}</span> : null}
    </div>
  );
}
