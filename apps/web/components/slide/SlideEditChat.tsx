"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { Slide, Language } from "@reem/types";
import { SlideCanvas } from "./SlideCanvas";
import {
  type ChatRow,
  editSlideAction,
  loadSlideChatAction,
  revertLastSlideEditAction,
} from "@/app/preview/chat-actions";

interface Props {
  carouselId: string;
  slideIdx: number;
  slide: Slide;
  totalSlides: number;
  lang: Language;
  /** Controlled by the parent (PreviewClient). Always reflects the latest
   *  slides_version we've successfully written. */
  slidesVersion: number;
  onSlideChange: (next: Slide, newVersion: number) => void;
}

const QUICK_CHIPS_HE: string[] = [
  "תגדיל את הכותרת",
  "תקטין את הכותרת",
  "תקצר את הגוף",
  "תארך את הגוף",
  "תסתיר את ה-eyebrow",
  "החזר את ה-eyebrow",
  "יישר למרכז",
  "יישר לימין",
  "החזר ברירת מחדל",
];

const USD_TO_ILS = 3.7;
const OPUS_INPUT_PER_MTOK = 15; // USD
const OPUS_OUTPUT_PER_MTOK = 75; // USD

function formatCostILS(input: number, output: number): string {
  const usd =
    (input / 1_000_000) * OPUS_INPUT_PER_MTOK +
    (output / 1_000_000) * OPUS_OUTPUT_PER_MTOK;
  return `~₪${(usd * USD_TO_ILS).toFixed(2)}`;
}

interface OptimisticBubble {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending: boolean;
}

export function SlideEditChat({
  carouselId,
  slideIdx,
  slide,
  totalSlides,
  lang,
  slidesVersion,
  onSlideChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ChatRow[]>([]);
  const [optimistic, setOptimistic] = useState<OptimisticBubble[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastCost, setLastCost] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [listening, setListening] = useState(false);
  const recogRef = useRef<unknown>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Reload chat history whenever the active slide / language / carousel changes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadSlideChatAction(carouselId, slideIdx, lang).then((rows) => {
      if (cancelled) return;
      setHistory(rows);
      setOptimistic([]);
    });
    return () => {
      cancelled = true;
    };
  }, [open, carouselId, slideIdx, lang]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history, optimistic, pending]);

  // Esc closes the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;
      setError(null);
      const optimisticId = `opt-${Date.now()}`;
      setOptimistic((prev) => [
        ...prev,
        { id: optimisticId, role: "user", content: trimmed, pending: false },
        {
          id: optimisticId + "-a",
          role: "assistant",
          content: "כותב…",
          pending: true,
        },
      ]);
      setInput("");

      startTransition(async () => {
        const result = await editSlideAction({
          carouselId,
          slideIdx,
          lang,
          message: trimmed,
          slidesVersion,
        });
        if (!result.ok) {
          setError(result.message);
          setOptimistic((prev) => prev.filter((b) => !b.id.startsWith(optimisticId)));
          return;
        }
        // Refresh from server so the diff chip + revertable flag are correct.
        const rows = await loadSlideChatAction(carouselId, slideIdx, lang);
        setHistory(rows);
        setOptimistic([]);
        setLastCost(formatCostILS(result.cost.input_tokens, result.cost.output_tokens));
        onSlideChange(result.mergedSlide, result.newSlidesVersion);
      });
    },
    [
      pending,
      carouselId,
      slideIdx,
      lang,
      slidesVersion,
      onSlideChange,
    ],
  );

  const revertLast = useCallback(() => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await revertLastSlideEditAction({
        carouselId,
        slideIdx,
        lang,
        slidesVersion,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const rows = await loadSlideChatAction(carouselId, slideIdx, lang);
      setHistory(rows);
      onSlideChange(result.mergedSlide, result.newSlidesVersion);
    });
  }, [pending, carouselId, slideIdx, lang, slidesVersion, onSlideChange]);

  // Hebrew dictation via Web Speech API. Silently no-ops on Safari/Firefox.
  const toggleMic = useCallback(() => {
    if (typeof window === "undefined") return;
    type SpeechCtor = new () => {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      start: () => void;
      stop: () => void;
      onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
      onend: () => void;
      onerror: () => void;
    };
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    if (listening && recogRef.current) {
      (recogRef.current as { stop: () => void }).stop();
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "he-IL";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      setInput((cur) => (cur ? cur + " " + transcript : transcript));
    };
    recognition.onend = () => {
      setListening(false);
      recogRef.current = null;
    };
    recognition.onerror = () => {
      setListening(false);
      recogRef.current = null;
    };
    recogRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [listening]);

  const merged = useMemo<(ChatRow | OptimisticBubble)[]>(
    () => [...history, ...optimistic],
    [history, optimistic],
  );
  const slideNumber = slide.n ?? slideIdx + 1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 left-6 z-40 rounded-full border border-[var(--gold-warm)] bg-[var(--bg-card)] px-5 py-3 text-sm font-medium text-[var(--gold-warm)] shadow-lg shadow-black/40 hover:bg-[var(--bg-card-2)]"
        aria-label={open ? "סגור צ'אט" : "פתח צ'אט עריכה"}
      >
        {open ? "סגור צ'אט" : "צ'אט עריכה"}
      </button>

      {open ? (
        <aside
          dir="rtl"
          className="fixed bottom-0 left-0 top-0 z-50 flex w-[440px] max-w-[95vw] flex-col border-l border-[var(--rule)] bg-[var(--bg-card)] text-[var(--ink)] shadow-2xl shadow-black/60"
        >
          {/* Header */}
          <header className="flex items-center justify-between gap-3 border-b border-[var(--rule)] px-4 py-3">
            <div className="flex items-center gap-3">
              <div
                className="overflow-hidden rounded-md border border-[var(--rule)]"
                style={{ width: 56, height: 70 }}
              >
                <div
                  style={{
                    width: 1080,
                    height: 1350,
                    transform: `scale(${56 / 1080})`,
                    transformOrigin: "top left",
                  }}
                >
                  <SlideCanvas
                    slide={slide}
                    lang={lang}
                    totalSlides={totalSlides}
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-semibold text-[var(--ink)]">
                  עריכת שקופית #{slideNumber}
                </p>
                <p className="text-xs text-[var(--cream-mute)]">
                  {lang === "he" ? "עברית" : "אנגלית"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-[var(--cream-mute)] hover:bg-[var(--bg-card-2)] hover:text-[var(--ink)]"
              aria-label="סגור"
            >
              ✕
            </button>
          </header>

          {/* Chat history */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {merged.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--rule)] p-4 text-sm leading-6 text-[var(--cream-mute)]">
                כתבו מה לשנות בשקופית. לדוגמה: &quot;תגדיל את הכותרת&quot; או &quot;תקצר את הגוף&quot;.
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {merged.map((m) => (
                  <li
                    key={m.id}
                    className={
                      m.role === "user"
                        ? "self-end max-w-[85%]"
                        : "self-start max-w-[90%]"
                    }
                  >
                    <div
                      className={
                        m.role === "user"
                          ? "rounded-2xl rounded-bl-md bg-[var(--gold-deep)] px-3 py-2 text-sm text-[var(--ink)]"
                          : "rounded-2xl rounded-br-md bg-[var(--bg-card-2)] px-3 py-2 text-sm text-[var(--ink)]"
                      }
                    >
                      {m.content}
                    </div>
                    {"diff_labels" in m && m.diff_labels && m.diff_labels.length > 0 ? (
                      <p className="mt-1 text-xs text-[var(--gold-warm)]">
                        שיניתי: {m.diff_labels.join(", ")}
                      </p>
                    ) : null}
                    {"is_revertable" in m && m.is_revertable ? (
                      <button
                        type="button"
                        onClick={revertLast}
                        disabled={pending}
                        className="mt-1 rounded border border-[var(--rule)] px-2 py-1 text-xs text-[var(--cream-mute)] hover:text-[var(--ink)] disabled:opacity-50"
                      >
                        בטל שינוי
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick chips */}
          <div className="flex flex-wrap gap-2 border-t border-[var(--rule)] px-4 py-2">
            {QUICK_CHIPS_HE.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setInput(chip)}
                className="rounded-full border border-[var(--rule)] px-2 py-1 text-xs text-[var(--cream-soft)] hover:bg-[var(--bg-card-2)]"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Error / status */}
          {error ? (
            <p
              role="alert"
              className="border-t border-[var(--rule)] bg-[var(--gold-deep)] px-4 py-2 text-xs text-[var(--ink)]"
            >
              {error}
            </p>
          ) : null}

          {/* Input row */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 border-t border-[var(--rule)] px-4 py-3"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="מה לשנות בשקופית?"
              rows={2}
              className="min-h-[44px] flex-1 resize-none rounded-md border border-[var(--rule)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--cream-faint)] focus:border-[var(--gold-warm)] focus:outline-none"
              disabled={pending}
              dir="rtl"
            />
            <button
              type="button"
              onClick={toggleMic}
              className={
                "rounded-md border px-3 py-2 text-sm " +
                (listening
                  ? "border-[var(--gold-warm)] bg-[var(--gold-warm)] text-[var(--bg)]"
                  : "border-[var(--rule)] text-[var(--cream-soft)] hover:bg-[var(--bg-card-2)]")
              }
              aria-label={listening ? "עצור הקלטה" : "הקלט בעברית"}
              title={listening ? "עצור הקלטה" : "הקלט בעברית"}
            >
              🎤
            </button>
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="rounded-md bg-[var(--gold-warm)] px-4 py-2 text-sm font-medium text-[var(--bg)] disabled:opacity-50"
            >
              שלח
            </button>
          </form>

          {lastCost ? (
            <p className="border-t border-[var(--rule)] px-4 py-1 text-[11px] text-[var(--cream-mute)]">
              עלות הודעה אחרונה: {lastCost}
            </p>
          ) : null}
        </aside>
      ) : null}
    </>
  );
}
