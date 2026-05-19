import { cn } from "@/lib/utils";

interface ModelContributionRingProps {
  percentage: number;
  color?: string;
  className?: string;
}

const SIZE = 40;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ModelContributionRing({
  percentage,
  color = "var(--color-accent)",
  className,
}: ModelContributionRingProps) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;
  const center = SIZE / 2;

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <circle
        cx={center}
        cy={center}
        r={RADIUS}
        fill="none"
        stroke="var(--color-border)"
        strokeWidth={STROKE}
      />
      <circle
        cx={center}
        cy={center}
        r={RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
      <text
        x={center}
        y={center}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-[9px] font-semibold"
      >
        {clamped}%
      </text>
    </svg>
  );
}
