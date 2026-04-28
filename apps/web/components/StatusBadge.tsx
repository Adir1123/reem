import type { TopicStatus, CarouselStatus } from "@reem/types";

const TOPIC_STATUS_LABELS: Record<TopicStatus, string> = {
  available: "פנוי",
  generating: "מייצר…",
  pending_review: "ממתין לאישור",
  posted: "פורסם",
  archived: "בארכיון",
  exhausted: "מוצה",
};

const CAROUSEL_STATUS_LABELS: Record<CarouselStatus, string> = {
  pending_review: "ממתין לאישור",
  approved: "אושר",
  posted: "פורסם",
  rejected: "נדחה",
};

// Tone palette retuned for the black-and-gold dark theme. Old `text-navy`
// would be invisible on the new dark surfaces — replaced with cream/gold
// pairings that hold WCAG contrast.
const TONE_CLASSES = {
  neutral: "border-rule bg-bg-card text-ink/60",
  warm: "border-gold-warm/40 bg-gold-base/10 text-gold-warm",
  hot: "border-gold-warm bg-gold-warm text-bg",
  cool: "border-rule bg-bg-card text-ink",
} as const;

type Tone = keyof typeof TONE_CLASSES;

const TOPIC_TONES: Record<TopicStatus, Tone> = {
  available: "neutral",
  generating: "hot",
  pending_review: "warm",
  posted: "cool",
  archived: "neutral",
  exhausted: "neutral",
};

const CAROUSEL_TONES: Record<CarouselStatus, Tone> = {
  pending_review: "warm",
  approved: "warm",
  posted: "cool",
  rejected: "neutral",
};

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}

export function TopicStatusBadge({ status }: { status: TopicStatus }) {
  return <Badge tone={TOPIC_TONES[status]}>{TOPIC_STATUS_LABELS[status]}</Badge>;
}

export function CarouselStatusBadge({ status }: { status: CarouselStatus }) {
  return (
    <Badge tone={CAROUSEL_TONES[status]}>{CAROUSEL_STATUS_LABELS[status]}</Badge>
  );
}
