// Shared TypeScript types for the Reem Carousel Dashboard.
// Mirrors the JSON output schema documented at
// apps/trigger/src/python/references/output-schema.md (skill v1).

export type SchemaVersion = 1;

export type SlideRole = "HOOK" | "TIP" | "CTA";

export type VisualEnergy = "HIGH" | "MEDIUM" | "LOW";

export type CarouselAngle =
  | "hook-driven"
  | "practical"
  | "counter-frame"
  | "story"
  | "data";

export type Language = "en" | "he";

export type SizePreset = "sm" | "md" | "lg" | "xl";
export type AlignPreset = "start" | "center" | "end";

// Optional render-time overlay produced by the per-slide chat editor. Stored
// inside the existing `Slide` JSONB blob so no DB schema change is needed.
// Presets only — no raw px or hex — to keep brand drift impossible.
export interface SlideStyle {
  headline_size?: SizePreset;
  body_size?: Exclude<SizePreset, "xl">;
  eyebrow_size?: Exclude<SizePreset, "lg" | "xl">;
  headline_align?: AlignPreset;
  body_align?: AlignPreset;
  hide_eyebrow?: boolean;
  hide_step_number?: boolean;
}

export interface Slide {
  n: number;
  role: SlideRole;
  visual_energy: VisualEnergy;
  eyebrow: string | null;
  headline: string;
  headline_italic: string | null;
  body: string;
  body_emphasis: string[];
  step_number: string | null;
  ref_image: string | null;
  visual_direction: string;
  // undefined → brand defaults; the chat editor populates this when the user
  // asks for visual tweaks ("תגדיל את הכותרת").
  style?: SlideStyle;
}

// "this_slide" → patch lands on the active slide only (default).
// "all_slides" → patch is mergeSlide'd over every slide in the carousel.
// Server enforces that all_slides is restricted to style + nullable text fields.
export type EditScope = "this_slide" | "all_slides";

// Shape returned by the chat editor's `apply_slide_edit` tool. Strict shallow
// partial of the editable surface — anything not listed cannot be touched.
export interface SlidePatch {
  eyebrow?: string | null;
  headline?: string;
  headline_italic?: string | null;
  body?: string;
  body_emphasis?: string[];
  step_number?: string | null;
  style?: Partial<SlideStyle>;
  scope?: EditScope;
}

export interface Carousel {
  id: string;
  concept: string;
  angle: CarouselAngle;
  source_urls: string[];
  slides_en: Slide[];
  slides_he: Slide[];
}

export interface Source {
  url: string;
  video_id: string;
  title: string;
  channel: string;
  subscribers: number | null;
  views: number | null;
  duration_seconds: number | null;
  upload_date: string | null;
  engagement_ratio: number | null;
  transcript_chars: number;
  language: string | null;
  key_points: string[];
}

export interface Recommendations {
  rendering_notes: string;
  ref_images_dir: string;
  brand_handle: string;
  next_carousels_run_suggestion: string;
}

export interface RunStats {
  videos_requested: number;
  videos_succeeded: number;
  carousels_requested: number;
  carousels_produced: number;
  duration_seconds: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
}

export interface PipelineOutput {
  schema_version: SchemaVersion;
  query: string;
  generated_at: string;
  model: string;
  sources: Source[];
  carousels: Carousel[];
  recommendations_for_dashboard: Recommendations;
  run_stats: RunStats;
  warnings?: string[];
}

// Database row shapes (rich types live with their respective layer).

export type TopicStatus =
  | "available"
  | "generating"
  | "pending_review"
  | "posted"
  | "archived"
  | "exhausted";

export type TopicSource = "seed" | "client_added";

export type RunTrigger = "manual" | "cron";

export type RunStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "cancelled";

export type CarouselStatus =
  | "pending_review"
  | "approved"
  | "posted"
  | "rejected";

export type Theme =
  | "saving"
  | "investing"
  | "debt"
  | "mindset"
  | "tools";
