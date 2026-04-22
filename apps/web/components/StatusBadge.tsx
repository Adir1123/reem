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

const TONE_CLASSES = {
  neutral: "border-navy/15 bg-cream-soft text-navy",
  warm: "border-gold/40 bg-gold/15 text-navy",
  hot: "border-gold bg-gold text-navy",
  cool: "border-navy/30 bg-navy text-cream",
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
