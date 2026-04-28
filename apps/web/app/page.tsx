import { MarqueeHero } from "@/components/MarqueeHero";

// Hero-only welcome page. Functional dashboard data (recent carousels, KPIs,
// cron schedule) lives on /carousels and /history. The hero CTAs link there.
export default function HomePage() {
  return <MarqueeHero />;
}
