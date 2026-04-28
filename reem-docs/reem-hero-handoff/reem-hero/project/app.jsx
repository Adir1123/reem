// Reem — premium Hebrew carousel dashboard
// Single SPA: dashboard + carousels list + detail view + new-carousel modal.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ── Tweak defaults (persisted) ──────────────────────────────────────────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "goldHue": "antique",
  "serif": "frank",
  "sans": "heebo",
  "density": "breathy",
  "motion": "full",
  "recentLayout": "row",
  "parallaxIntensity": 6,
  "heroScale": 100,
  "dashLayout": "cinematic",
  "heroLayout": "cinematic",
  "bgTint": "neutral",
  "grain": false,
  "vignette": 50,
  "sideRules": "none",
  "cornerOrn": "off",
  "heroTextAlign": "right",
  "headlineWeight": "300",
  "subheadStyle": "italic",
  "ctaStyle": "filled",
  "scrollHint": "visible",
  "eyebrowOrn": "none",
  "greeting": "welcome",
  "dustDensity": 28,
  "dustColor": "gold",
  "headlineTrack": 0,
  "bodySize": 16,
  "dropCap": false,
  "containerWidth": 1400,
  "sectionSpacing": "normal",
  "pillStyle": "rounded",
  "navAlign": "right",
  "showMonogram": true,
  "hoverLift": 4,
  "pageTransition": "fade"
} /*EDITMODE-END*/;

// ── Gold palette presets ────────────────────────────────────────────────────
const GOLD_HUES = {
  antique: { base: '#b8924a', warm: '#d4a861', deep: '#7a5e2d', soft: 'rgba(184,146,74,.12)', glow: 'rgba(212,168,97,.35)' },
  champagne: { base: '#c9b27a', warm: '#e3cd96', deep: '#8a7647', soft: 'rgba(201,178,122,.12)', glow: 'rgba(227,205,150,.35)' },
  brass: { base: '#a87a2c', warm: '#c89343', deep: '#6e4f1c', soft: 'rgba(168,122,44,.14)', glow: 'rgba(200,147,67,.4)' }
};

const SERIFS = {
  frank: "'Frank Ruhl Libre', 'David Libre', Georgia, serif",
  david: "'David Libre', 'Frank Ruhl Libre', Georgia, serif",
  cormorant: "'Cormorant Garamond', 'Frank Ruhl Libre', Georgia, serif"
};

const SANS_FAMILIES = {
  heebo: "'Heebo', system-ui, sans-serif",
  assistant: "'Assistant', system-ui, sans-serif",
  rubik: "'Rubik', system-ui, sans-serif"
};

const BG_TINTS = {
  warm:    { bg: '#0d0805', deep: '#070403' },
  neutral: { bg: '#0a0a0a', deep: '#050505' },
  cool:    { bg: '#080a0d', deep: '#040608' }
};

const DUST_COLORS = {
  gold:   '212,168,97',
  silver: '210,210,220',
  cream:  '236,225,200'
};

const GREETINGS = {
  welcome:  'ברוך הבא ראם',
  morning:  'בוקר טוב ראם',
  evening:  'ערב טוב ראם',
  private:  'הסטודיו של ראם'
};

// ── Mock data ───────────────────────────────────────────────────────────────
const TOPICS = [
{ he: "תקציב 50/30/20", count: 4 },
{ he: "גיוון תיק השקעות", count: 7 },
{ he: "קרן חירום למתחילים", count: 3 },
{ he: "השקעה ב-S&P 500", count: 5 },
{ he: "סיכון מול תשואה", count: 2 },
{ he: "דירוג אשראי מ-A עד Z", count: 6 },
{ he: "הימנעות ממלכודת המינימום", count: 1 },
{ he: "ניהול חוב סטודנטים", count: 3 }];


// Carousel covers — generated SVG covers in the brand palette so the recents row feels real.
const COVERS = [
{ id: 'c1', title: "השקעה לטווח ארוך", subtitle: "מדריך למתחילים", topic: "השקעה ב-S&P 500", slides: 8, date: "לפני 2 ימים", style: 'numeral' },
{ id: 'c2', title: "תקציב 50/30/20", subtitle: "החוק שישנה את הכסף שלך", topic: "תקציב 50/30/20", slides: 6, date: "לפני 4 ימים", style: 'split' },
{ id: 'c3', title: "קרן חירום", subtitle: "כמה באמת אתם צריכים", topic: "קרן חירום למתחילים", slides: 7, date: "לפני שבוע", style: 'mark' },
{ id: 'c4', title: "סיכון מול תשואה", subtitle: "המשוואה שאף אחד לא מסביר", topic: "סיכון מול תשואה", slides: 9, date: "לפני 9 ימים", style: 'rule' },
{ id: 'c5', title: "דירוג אשראי A→Z", subtitle: "מה הבנקים לא רוצים שתדעו", topic: "דירוג אשראי מ-A עד Z", slides: 10, date: "לפני 12 ימים", style: 'numeral' },
{ id: 'c6', title: "חוב סטודנטים", subtitle: "תוכנית פירעון אגרסיבית", topic: "ניהול חוב סטודנטים", slides: 5, date: "לפני 14 ימים", style: 'split' },
{ id: 'c7', title: "המשכורת לא תספיק", subtitle: "למה אתם זקוקים לזרם פסיבי", topic: "למה משכורת לא תהפוך אותך לעשיר", slides: 8, date: "לפני 18 ימים", style: 'mark' },
{ id: 'c8', title: "גיוון תיק השקעות", subtitle: "אמנות הפיזור הנכון", topic: "גיוון תיק השקעות", slides: 7, date: "לפני 21 ימים", style: 'rule' }];


const STATS = [
{ value: 47, label: "סך קרוסלות" },
{ value: 12, label: "החודש" },
{ value: 4.2, label: "ממוצע שבועי" },
{ value: "אתמול", label: "השראה אחרונה" }];


// ── Utility: fade-through-black route transition ────────────────────────────
function useRouteTransition(initial = 'home') {
  const [route, setRoute] = useState(initial);
  const [veil, setVeil] = useState(0); // 0..1
  const goto = useCallback((next) => {
    if (next === route) return;
    setVeil(1);
    setTimeout(() => {
      setRoute(next);
      window.scrollTo({ top: 0, behavior: 'instant' });
      requestAnimationFrame(() => setVeil(0));
    }, 280);
  }, [route]);
  return { route, goto, veil };
}

// ── Top Nav ─────────────────────────────────────────────────────────────────
function TopNav({ route, goto, gold }) {
  const items = [
  { id: 'home', label: 'בית' },
  { id: 'carousels', label: 'קרוסלות' },
  { id: 'topics', label: 'נושאים' },
  { id: 'settings', label: 'הגדרות' },
  { id: 'logout', label: 'יציאה' }];

  return (
    <header className="reem-nav" dir="rtl">
      <div className="reem-nav-inner">
        <a className="reem-logo" onClick={(e) => {e.preventDefault();goto('home');}} href="#">
          <span className="reem-logo-mark" aria-hidden="true">
            <svg viewBox="0 0 28 28" width="22" height="22">
              <circle cx="14" cy="14" r="12.5" fill="none" stroke={gold.base} strokeWidth=".7" opacity=".55" />
              <text x="14" y="19" textAnchor="middle" fontFamily="'Frank Ruhl Libre', serif" fontSize="14" fill={gold.warm} letterSpacing=".02em">ר</text>
            </svg>
          </span>
          <span className="reem-logo-word">REEM</span>
        </a>
        <nav className="reem-nav-items">
          {items.map((it) =>
          <a key={it.id}
          href="#"
          className={"reem-nav-link" + (route === it.id ? " is-active" : "")}
          onClick={(e) => {e.preventDefault();if (it.id !== 'logout') goto(it.id);}}>
              {it.label}
              <span className="reem-nav-underline" aria-hidden="true" />
            </a>
          )}
        </nav>
      </div>
    </header>);

}

// ── Hero (full viewport) ────────────────────────────────────────────────────
function Hero({ goto, motion, parallaxIntensity, heroScale, gold, layout }) {
  const heroRef = useRef(null);
  const figureRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Parallax
  useEffect(() => {
    if (motion === 'off') return;
    const onScroll = () => {
      const el = figureRef.current;
      if (!el) return;
      const y = window.scrollY;
      const intensity = motion === 'full' ? parallaxIntensity : Math.min(parallaxIntensity, 3);
      const shift = Math.min(y * 0.08, intensity);
      el.style.transform = `translateX(${-shift}px) scale(${heroScale / 100})`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [motion, parallaxIntensity, heroScale]);

  // Hebrew letter stagger: split H1 into characters, RTL stagger
  // (Hebrew reads right-to-left, so animation starts from rightmost char)
  const h1 = "ברוך הבא ראם";
  const chars = Array.from(h1);

  return (
    <section ref={heroRef} className={"reem-hero reem-hero--" + layout} dir="rtl">
      <div ref={figureRef} className="reem-hero-figure" aria-hidden="true">
        <img src="assets/hero-figure.png" alt="" />
        <div className="reem-hero-veil-l" />
        <div className="reem-hero-veil-r" />
      </div>

      {motion !== 'off' && motion === 'full' && <DustMotes />}

      <div className="reem-hero-content">
        <div className={"reem-hero-text" + (mounted ? " is-in" : "")}>
          <p className="reem-eyebrow" style={{ '--delay': '0ms' }}>
            <span className="reem-eyebrow-rule" />
            <span className="reem-eyebrow-text">{
              layout === 'diptych' ? 'גליון 47 · אביב' :
              layout === 'marquee' ? 'כלכלה' :
              layout === 'frontispiece' ? 'כרך א' :
              layout === 'atrium' ? 'הסטודיו · 2026' :
              layout === 'letterhead' ? 'מכתב פרטי · גליון 47' :
              'סטודיו פרטי'
            }</span>
            <span className="reem-eyebrow-rule" />
          </p>
          <h1 className="reem-h1">
            {chars.map((c, i) =>
            <span
              key={i}
              className="reem-h1-char"
              style={{ '--delay': `${(chars.length - 1 - i) * 55}ms` }}>
              
                {c === ' ' ? '\u00A0' : c}
              </span>
            )}
          </h1>
          <p className="reem-subhead" style={{ '--delay': '780ms' }}>
            הקרוסלות שלך מוכנות
          </p>
          <div className="reem-cta-row" style={{ '--delay': '980ms' }}>
            <button
              className="reem-cta-primary"
              onClick={() => goto('carousels')}>
              
              <span>צפה בקרוסלות</span>
              <span className="reem-cta-arrow" aria-hidden="true">←</span>
            </button>
            <button
              className="reem-cta-ghost"
              onClick={() => goto('new')}>
              
              צור קרוסלה חדשה
            </button>
          </div>
        </div>
      </div>

      <div className="reem-hero-scrollhint" aria-hidden="true">
        <span>גלול</span>
        <span className="reem-hero-scrollhint-line" />
      </div>

      {layout === 'marquee' && (
        <div className="reem-hero-ticker" aria-hidden="true">
          <div className="reem-hero-ticker-track">
            {Array.from({ length: 2 }).map((_, ii) => (
              <span key={ii} className="reem-hero-ticker-row">
                <span>תקציב משק בית</span><span aria-hidden="true">✦</span>
                <span>S&amp;P 500</span><span aria-hidden="true">✦</span>
                <span>אג"ח ממשלתי</span><span aria-hidden="true">✦</span>
                <span>קרנות פנסיה</span><span aria-hidden="true">✦</span>
                <span>דירוג אשראי</span><span aria-hidden="true">✦</span>
                <span>מדד תל אביב 35</span><span aria-hidden="true">✦</span>
                <span>השקעות אלטרנטיביות</span><span aria-hidden="true">✦</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {layout === 'frontispiece' && (
        <div className="reem-hero-frontis-rule" aria-hidden="true" />
      )}
      {layout === 'atrium' && (
        <>
          <div className="reem-hero-atrium-frame" aria-hidden="true" />
          <div className="reem-hero-atrium-corners" aria-hidden="true">
            <span /><span /><span /><span />
          </div>
        </>
      )}
      {layout === 'letterhead' && (
        <>
          <div className="reem-hero-letter-date" aria-hidden="true">
            <span>כ"ח באייר תשפ"ו</span>
            <span className="reem-hero-letter-rule" />
            <span>ראם · ת"א</span>
          </div>
          <div className="reem-hero-letter-sig" aria-hidden="true">
            <span className="reem-hero-letter-sig-mark">ר</span>
            <span className="reem-hero-letter-sig-line">בברכה,</span>
          </div>
        </>
      )}
    </section>);

}

// ── Dust motes (warm embers drifting upward) ────────────────────────────────
function DustMotes() {
  const motes = useMemo(() => {
    return Array.from({ length: 28 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 1 + Math.random() * 2.4,
      duration: 14 + Math.random() * 18,
      delay: -Math.random() * 30,
      drift: -8 + Math.random() * 16,
      opacity: 0.25 + Math.random() * 0.5
    }));
  }, []);
  return (
    <div className="reem-motes" aria-hidden="true">
      {motes.map((m) =>
      <span
        key={m.id}
        className="reem-mote"
        style={{
          left: `${m.left}%`,
          width: `${m.size}px`,
          height: `${m.size}px`,
          animationDuration: `${m.duration}s`,
          animationDelay: `${m.delay}s`,
          opacity: m.opacity,
          '--drift': `${m.drift}px`
        }} />

      )}
    </div>);

}

// ── Reveal-on-scroll wrapper ────────────────────────────────────────────────
function Reveal({ children, delay = 0, motion }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(motion === 'off');
  useEffect(() => {
    if (motion === 'off') {setShown(true);return;}
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {if (e.isIntersecting) setShown(true);});
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, [motion]);
  return (
    <div ref={ref} className={"reem-reveal" + (shown ? " is-in" : "")} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>);

}

// ── Section header ──────────────────────────────────────────────────────────
function SectionHeader({ title, eyebrow, action }) {
  return (
    <div className="reem-section-head" dir="rtl">
      <div>
        {eyebrow && <p className="reem-section-eyebrow">{eyebrow}</p>}
        <h2 className="reem-section-title">{title}</h2>
      </div>
      {action}
    </div>);

}

// ── Carousel cover thumbnail (SVG, brand-styled) ───────────────────────────
function CarouselCover({ c, gold, serif }) {
  const goldBase = gold.base;
  const goldWarm = gold.warm;
  // Style variants
  const renderStyle = () => {
    if (c.style === 'numeral') {
      return (
        <>
          <text x="50%" y="42%" textAnchor="middle" fill={goldWarm} fontFamily={serif} fontSize="120" opacity=".18" letterSpacing="-2">{(c.id.replace('c', '') || '0').padStart(2, '0')}</text>
          <line x1="20%" y1="58%" x2="80%" y2="58%" stroke={goldBase} strokeOpacity=".4" strokeWidth=".8" />
        </>);

    }
    if (c.style === 'split') {
      return (
        <>
          <rect x="0" y="0" width="50%" height="100%" fill="rgba(184,146,74,.05)" />
          <line x1="50%" y1="10%" x2="50%" y2="90%" stroke={goldBase} strokeOpacity=".35" strokeWidth=".7" />
          <circle cx="50%" cy="42%" r="22" fill="none" stroke={goldWarm} strokeOpacity=".55" strokeWidth=".8" />
        </>);

    }
    if (c.style === 'mark') {
      return (
        <>
          <text x="50%" y="44%" textAnchor="middle" fill={goldBase} fontFamily={serif} fontSize="56" opacity=".75">℞</text>
          <line x1="36%" y1="55%" x2="64%" y2="55%" stroke={goldBase} strokeOpacity=".5" strokeWidth=".7" />
        </>);

    }
    // rule
    return (
      <>
        <line x1="14%" y1="36%" x2="86%" y2="36%" stroke={goldBase} strokeOpacity=".35" strokeWidth=".7" />
        <line x1="14%" y1="64%" x2="86%" y2="64%" stroke={goldBase} strokeOpacity=".35" strokeWidth=".7" />
        <text x="50%" y="54%" textAnchor="middle" fill={goldWarm} fontFamily={serif} fontSize="40" opacity=".7" letterSpacing="6">REEM</text>
      </>);

  };

  return (
    <svg viewBox="0 0 320 320" className="reem-cover-svg" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`vig-${c.id}`} cx="50%" cy="40%" r="80%">
          <stop offset="0%" stopColor="#1a1612" stopOpacity="1" />
          <stop offset="100%" stopColor="#0a0a0a" stopOpacity="1" />
        </radialGradient>
      </defs>
      <rect width="320" height="320" fill={`url(#vig-${c.id})`} />
      {renderStyle()}
      {/* Grain overlay */}
      <rect width="320" height="320" fill="url(#reem-grain-pattern)" opacity=".4" />
      {/* Bottom title block */}
      <text x="50%" y="78%" textAnchor="middle" fill="#e8d9b8" fontFamily={serif} fontSize="22" letterSpacing=".5">{c.title}</text>
      <text x="50%" y="86%" textAnchor="middle" fill="#e8d9b8" opacity=".55" fontFamily={serif} fontSize="11" letterSpacing=".5">{c.subtitle}</text>
    </svg>);

}

// Shared SVG defs (grain pattern) injected once
function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <pattern id="reem-grain-pattern" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
          <filter id="reem-grain-filter">
            <feTurbulence type="fractalNoise" baseFrequency="2.4" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 0.7  0 0 0 0 0.55  0 0 0 0 0.25  0 0 0 .14 0" />
          </filter>
          <rect width="120" height="120" filter="url(#reem-grain-filter)" />
        </pattern>
      </defs>
    </svg>);

}

// ── Recent carousels row / grid ────────────────────────────────────────────
function RecentCarousels({ items, layout, onOpen, onCreate, gold, serif }) {
  return (
    <div className={`reem-recents reem-recents--${layout}`} dir="rtl">
      <button className="reem-create-card" onClick={onCreate} aria-label="צור קרוסלה חדשה">
        <span className="reem-create-plus" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="28" height="28">
            <line x1="16" y1="6" x2="16" y2="26" stroke={gold.warm} strokeWidth="1" />
            <line x1="6" y1="16" x2="26" y2="16" stroke={gold.warm} strokeWidth="1" />
          </svg>
        </span>
        <span className="reem-create-title">קרוסלה חדשה</span>
        <span className="reem-create-sub">התחל מכלום, או מנושא</span>
      </button>
      {items.map((c) =>
      <button key={c.id} className="reem-cover-card" onClick={() => onOpen(c)}>
          <span className="reem-cover-frame">
            <CarouselCover c={c} gold={gold} serif={serif} />
            <span className="reem-cover-badge" aria-hidden="true">{c.slides} שקופיות</span>
          </span>
          <span className="reem-cover-meta">
            <span className="reem-cover-topic">{c.topic}</span>
            <span className="reem-cover-date">{c.date}</span>
          </span>
        </button>
      )}
    </div>);

}

// ── Topics row ──────────────────────────────────────────────────────────────
function Topics({ topics, active, setActive }) {
  return (
    <div className="reem-topics" dir="rtl">
      {topics.map((t) => {
        const isOn = active === t.he;
        return (
          <button
            key={t.he}
            className={"reem-topic" + (isOn ? " is-on" : "")}
            onClick={() => setActive(isOn ? null : t.he)}>
            
            <span className="reem-topic-dot" aria-hidden="true" />
            <span>{t.he}</span>
            <span className="reem-topic-count">{t.count}</span>
          </button>);

      })}
    </div>);

}

// ── Stats strip ─────────────────────────────────────────────────────────────
function StatsStrip({ stats, serif }) {
  return (
    <div className="reem-stats" dir="rtl">
      {stats.map((s, i) =>
      <div key={i} className="reem-stat">
          <div className="reem-stat-value" style={{ fontFamily: serif }}>
            {typeof s.value === 'number' ?
          <>
                {Number.isInteger(s.value) ? s.value : s.value.toFixed(1)}
              </> :
          s.value}
          </div>
          <div className="reem-stat-label">{s.label}</div>
          {i < stats.length - 1 && <div className="reem-stat-divider" aria-hidden="true" />}
        </div>
      )}
    </div>);

}

// ── Carousels list page ─────────────────────────────────────────────────────
function CarouselsPage({ items, onOpen, onCreate, gold, serif, motion }) {
  return (
    <main className="reem-page" dir="rtl">
      <Reveal motion={motion}>
        <div className="reem-page-head">
          <p className="reem-section-eyebrow">הספרייה שלי</p>
          <h1 className="reem-page-title" style={{ fontFamily: serif }}>קרוסלות</h1>
          <p className="reem-page-sub">{items.length} פריטים · ממוינים לפי תאריך עריכה</p>
        </div>
      </Reveal>
      <Reveal motion={motion} delay={120}>
        <div className="reem-grid">
          <button className="reem-create-card reem-create-card--grid" onClick={onCreate}>
            <span className="reem-create-plus">
              <svg viewBox="0 0 32 32" width="32" height="32">
                <line x1="16" y1="6" x2="16" y2="26" stroke={gold.warm} strokeWidth="1" />
                <line x1="6" y1="16" x2="26" y2="16" stroke={gold.warm} strokeWidth="1" />
              </svg>
            </span>
            <span className="reem-create-title">קרוסלה חדשה</span>
            <span className="reem-create-sub">התחל מכלום, או מנושא</span>
          </button>
          {items.map((c) =>
          <button key={c.id} className="reem-cover-card" onClick={() => onOpen(c)}>
              <span className="reem-cover-frame">
                <CarouselCover c={c} gold={gold} serif={serif} />
                <span className="reem-cover-badge">{c.slides} שקופיות</span>
              </span>
              <span className="reem-cover-meta">
                <span className="reem-cover-topic">{c.topic}</span>
                <span className="reem-cover-date">{c.date}</span>
              </span>
            </button>
          )}
        </div>
      </Reveal>
    </main>);

}

// ── Carousel detail / edit view ─────────────────────────────────────────────
function CarouselDetail({ carousel, onBack, gold, serif, motion }) {
  const [active, setActive] = useState(0);
  const slides = Array.from({ length: carousel.slides }, (_, i) => ({
    n: i + 1,
    cover: i === 0
  }));
  return (
    <main className="reem-page reem-detail" dir="rtl">
      <Reveal motion={motion}>
        <div className="reem-detail-head">
          <button className="reem-back" onClick={onBack}>
            <span aria-hidden="true">→</span><span>חזרה לספרייה</span>
          </button>
          <p className="reem-section-eyebrow">{carousel.topic}</p>
          <h1 className="reem-page-title" style={{ fontFamily: serif }}>{carousel.title}</h1>
          <p className="reem-page-sub">{carousel.subtitle} · {carousel.slides} שקופיות · {carousel.date}</p>
          <div className="reem-detail-actions">
            <button className="reem-cta-primary reem-cta-primary--sm">
              <span>פרסם לאינסטגרם</span>
              <span className="reem-cta-arrow">←</span>
            </button>
            <button className="reem-cta-ghost reem-cta-ghost--sm">הורד PNG</button>
            <button className="reem-cta-ghost reem-cta-ghost--sm">שכפל</button>
          </div>
        </div>
      </Reveal>

      <Reveal motion={motion} delay={120}>
        <div className="reem-detail-stage">
          <div className="reem-detail-cover">
            <CarouselCover c={{ ...carousel, id: `${carousel.id}-${active}` }} gold={gold} serif={serif} />
            <div className="reem-detail-cover-num">{String(active + 1).padStart(2, '0')} / {String(carousel.slides).padStart(2, '0')}</div>
          </div>
        </div>
      </Reveal>

      <Reveal motion={motion} delay={200}>
        <div className="reem-detail-strip">
          {slides.map((s, i) =>
          <button
            key={i}
            className={"reem-detail-thumb" + (active === i ? " is-active" : "")}
            onClick={() => setActive(i)}>
            
              <span className="reem-detail-thumb-num">{String(s.n).padStart(2, '0')}</span>
              <span className="reem-detail-thumb-frame">
                <CarouselCover c={{ ...carousel, id: `${carousel.id}-t${i}` }} gold={gold} serif={serif} />
              </span>
            </button>
          )}
        </div>
      </Reveal>
    </main>);

}

// ── Topics page (simple list) ───────────────────────────────────────────────
function TopicsPage({ gold, serif, motion }) {
  return (
    <main className="reem-page" dir="rtl">
      <Reveal motion={motion}>
        <div className="reem-page-head">
          <p className="reem-section-eyebrow">המעקב שלי</p>
          <h1 className="reem-page-title" style={{ fontFamily: serif }}>נושאים</h1>
          <p className="reem-page-sub">נושאים שאני עוקב אחריהם ומשתמש בהם להשראה</p>
        </div>
      </Reveal>
      <Reveal motion={motion} delay={120}>
        <div className="reem-topics-grid">
          {TOPICS.map((t) =>
          <div key={t.he} className="reem-topic-card">
              <div className="reem-topic-card-rule" />
              <h3 className="reem-topic-card-title" style={{ fontFamily: serif }}>{t.he}</h3>
              <p className="reem-topic-card-meta">{t.count} קרוסלות · עודכן השבוע</p>
            </div>
          )}
        </div>
      </Reveal>
    </main>);

}

function SettingsPage({ serif, motion }) {
  return (
    <main className="reem-page" dir="rtl">
      <Reveal motion={motion}>
        <div className="reem-page-head">
          <h1 className="reem-page-title" style={{ fontFamily: serif }}>הגדרות</h1>
          <p className="reem-page-sub">חשבון, חיבורים, ופרטיות</p>
        </div>
      </Reveal>
    </main>);

}

// ── New carousel modal ──────────────────────────────────────────────────────
function NewCarouselModal({ open, onClose, gold, serif, onCreate }) {
  const [step, setStep] = useState(0); // 0: topic, 1: tone, 2: review
  const [topic, setTopic] = useState(null);
  const [tone, setTone] = useState('cinematic');
  useEffect(() => {
    if (!open) {setStep(0);setTopic(null);setTone('cinematic');}
  }, [open]);
  useEffect(() => {
    const onKey = (e) => {if (e.key === 'Escape' && open) onClose();};
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="reem-modal" dir="rtl" onClick={onClose}>
      <div className="reem-modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="reem-modal-close" onClick={onClose} aria-label="סגור">✕</button>
        <p className="reem-section-eyebrow">קרוסלה חדשה · שלב {step + 1}/3</p>
        <h2 className="reem-modal-title" style={{ fontFamily: serif }}>
          {step === 0 && "מאיזה נושא נתחיל?"}
          {step === 1 && "איזה טון?"}
          {step === 2 && "מוכן ליצור"}
        </h2>

        {step === 0 &&
        <div className="reem-modal-topics">
            {TOPICS.map((t) =>
          <button
            key={t.he}
            className={"reem-modal-topic" + (topic === t.he ? " is-on" : "")}
            onClick={() => setTopic(t.he)}>
            
                {t.he}
              </button>
          )}
            <button
            className={"reem-modal-topic reem-modal-topic--blank" + (topic === '__blank' ? " is-on" : "")}
            onClick={() => setTopic('__blank')}>
            
              + מסמך ריק
            </button>
          </div>
        }

        {step === 1 &&
        <div className="reem-modal-tones">
            {[
          { id: 'cinematic', he: 'קולנועי', sub: 'דרמטי, חשוך, מינימליסטי' },
          { id: 'editorial', he: 'מערכתי', sub: 'נקי, אינפורמטיבי, ארוך' },
          { id: 'punchy', he: 'חד', sub: 'קצר, מפתיע, סלוגן-לסלוגן' }].
          map((t) =>
          <button
            key={t.id}
            className={"reem-modal-tone" + (tone === t.id ? " is-on" : "")}
            onClick={() => setTone(t.id)}>
            
                <span className="reem-modal-tone-he" style={{ fontFamily: serif }}>{t.he}</span>
                <span className="reem-modal-tone-sub">{t.sub}</span>
              </button>
          )}
          </div>
        }

        {step === 2 &&
        <div className="reem-modal-review">
            <div className="reem-modal-review-row">
              <span className="reem-modal-review-k">נושא</span>
              <span className="reem-modal-review-v" style={{ fontFamily: serif }}>{topic === '__blank' ? 'מסמך ריק' : topic}</span>
            </div>
            <div className="reem-modal-review-row">
              <span className="reem-modal-review-k">טון</span>
              <span className="reem-modal-review-v" style={{ fontFamily: serif }}>{tone === 'cinematic' ? 'קולנועי' : tone === 'editorial' ? 'מערכתי' : 'חד'}</span>
            </div>
            <div className="reem-modal-review-row">
              <span className="reem-modal-review-k">מספר שקופיות</span>
              <span className="reem-modal-review-v" style={{ fontFamily: serif }}>7</span>
            </div>
          </div>
        }

        <div className="reem-modal-foot">
          {step > 0 ?
          <button className="reem-cta-ghost reem-cta-ghost--sm" onClick={() => setStep(step - 1)}>חזור</button> :
          <span />}
          {step < 2 ?
          <button
            className="reem-cta-primary reem-cta-primary--sm"
            disabled={step === 0 && !topic || step === 1 && !tone}
            onClick={() => setStep(step + 1)}>
            
              <span>המשך</span>
              <span className="reem-cta-arrow">←</span>
            </button> :

          <button className="reem-cta-primary reem-cta-primary--sm" onClick={onCreate}>
              <span>צור קרוסלה</span>
              <span className="reem-cta-arrow">←</span>
            </button>
          }
        </div>
      </div>
    </div>);

}

// ── Home dashboard sections ─────────────────────────────────────────────────
function Dashboard({ goto, onOpen, gold, serif, motion, recentLayout, density, layout }) {
  const [activeTopic, setActiveTopic] = useState(null);
  const filtered = activeTopic ? COVERS.filter((c) => c.topic === activeTopic) : COVERS;

  const Body =
    layout === 'gallery' ? <DashGallery items={filtered} onOpen={onOpen} onCreate={() => goto('new')} gold={gold} serif={serif} motion={motion} topics={TOPICS} active={activeTopic} setActive={setActiveTopic} goto={goto} /> :
    layout === 'reel' ? <DashReel items={filtered} onOpen={onOpen} onCreate={() => goto('new')} gold={gold} serif={serif} motion={motion} topics={TOPICS} active={activeTopic} setActive={setActiveTopic} goto={goto} /> :
    layout === 'cards' ? <DashCards items={filtered} onOpen={onOpen} onCreate={() => goto('new')} gold={gold} serif={serif} motion={motion} topics={TOPICS} active={activeTopic} setActive={setActiveTopic} goto={goto} /> :
    layout === 'cinematic' ? <DashCinematic items={filtered} onOpen={onOpen} onCreate={() => goto('new')} gold={gold} serif={serif} motion={motion} topics={TOPICS} active={activeTopic} setActive={setActiveTopic} goto={goto} recentLayout={recentLayout} /> :
    <DashEditorial items={filtered} onOpen={onOpen} onCreate={() => goto('new')} gold={gold} serif={serif} motion={motion} topics={TOPICS} active={activeTopic} setActive={setActiveTopic} goto={goto} recentLayout={recentLayout} />;

  return (
    <main className={"reem-dashboard reem-density-" + density + " reem-layout--" + layout} dir="rtl">
      {Body}
      <footer className="reem-foot" data-screen-label="foot">
        <div className="reem-foot-rule" />
        <p className="reem-foot-text">
</p>
      </footer>
    </main>);
}

// Editorial = the current TOC-style flow (existing behaviour)
function DashEditorial({ items, onOpen, onCreate, gold, serif, motion, topics, active, setActive, goto, recentLayout }) {
  return (
    <>
      <Reveal motion={motion}>
        <section className="reem-section" data-screen-label="recents">
          <SectionHeader
            eyebrow="הספרייה שלי"
            title="הקרוסלות האחרונות שלך"
            action={<button className="reem-section-link" onClick={() => goto('carousels')}>הצג הכל <span aria-hidden="true">←</span></button>} />
          <RecentCarousels items={items} layout={recentLayout} onOpen={onOpen} onCreate={onCreate} gold={gold} serif={serif} />
        </section>
      </Reveal>
      <Reveal motion={motion}>
        <section className="reem-section" data-screen-label="topics">
          <SectionHeader
            eyebrow="המעקב שלי"
            title="נושאים פעילים"
            action={<button className="reem-section-link" onClick={() => goto('topics')}>כל הנושאים <span aria-hidden="true">←</span></button>} />
          <Topics topics={topics} active={active} setActive={setActive} />
        </section>
      </Reveal>
    </>);
}

// Cinematic = original — feature "now playing" tile + gold ornament + horizontal recents row
function DashCinematic({ items, onOpen, onCreate, gold, serif, motion, topics, active, setActive, goto }) {
  const [feature, ...rest] = items;
  return (
    <>
      <Reveal motion={motion}>
        <section className="reem-section reem-cinema-feature" data-screen-label="now-playing">
          <div className="reem-cinema-feature-grid">
            <div className="reem-cinema-feature-meta">
              <p className="reem-eyebrow"><span className="reem-eyebrow-rule" /><span className="reem-eyebrow-text">כעת בסטודיו</span></p>
              <h2 className="reem-cinema-feature-title" style={{ fontFamily: 'var(--serif)' }}>{feature?.title}</h2>
              <p className="reem-cinema-feature-sub">{feature?.topic} · {feature?.slides} שקופיות · {feature?.date}</p>
              <div className="reem-cinema-feature-actions">
                <button className="reem-btn reem-btn--primary" onClick={() => onOpen(feature)}>פתח עריכה</button>
                <button className="reem-btn reem-btn--ghost" onClick={onCreate}>צור חדשה</button>
              </div>
            </div>
            <button className="reem-cinema-feature-cover" onClick={() => onOpen(feature)}>
              <CarouselCover c={feature} gold={gold} serif={serif} />
            </button>
          </div>
        </section>
      </Reveal>

      <div className="reem-ornament" aria-hidden="true">
        <span className="reem-ornament-rule" />
        <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" fill={gold.warm} /></svg>
        <span className="reem-ornament-rule" />
      </div>

      <Reveal motion={motion}>
        <section className="reem-section" data-screen-label="recents">
          <SectionHeader
            eyebrow="הספרייה שלי"
            title="קרוסלות אחרונות"
            action={<button className="reem-section-link" onClick={() => goto('carousels')}>הצג הכל <span aria-hidden="true">←</span></button>} />
          <div className="reem-cinema-row" dir="rtl">
            {rest.map((c) => (
              <button key={c.id} className="reem-cinema-tile" onClick={() => onOpen(c)}>
                <span className="reem-cinema-tile-cover"><CarouselCover c={c} gold={gold} serif={serif} /></span>
                <span className="reem-cinema-tile-meta">
                  <span className="reem-cinema-tile-topic">{c.topic}</span>
                  <span className="reem-cinema-tile-title">{c.title}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal motion={motion}>
        <section className="reem-section" data-screen-label="topics">
          <SectionHeader eyebrow="המעקב שלי" title="נושאים פעילים" action={<button className="reem-section-link" onClick={() => goto('topics')}>כל הנושאים <span aria-hidden="true">←</span></button>} />
          <Topics topics={topics} active={active} setActive={setActive} />
        </section>
      </Reveal>
    </>);
}

// Gallery = asymmetric bento mosaic
function DashGallery({ items, onOpen, onCreate, gold, serif, motion, topics, active, setActive, goto }) {
  const [hero, a, b, c, d, e, ...rest] = items;
  return (
    <Reveal motion={motion}>
      <section className="reem-section" data-screen-label="gallery">
        <SectionHeader eyebrow="הסטודיו" title="הספרייה שלי" action={<button className="reem-section-link" onClick={() => goto('carousels')}>הצג הכל <span aria-hidden="true">←</span></button>} />
        <div className="reem-bento">
          <button className="reem-bento-cell reem-bento-hero" onClick={() => hero && onOpen(hero)}>
            {hero && <CarouselCover c={hero} gold={gold} serif={serif} />}
            <span className="reem-bento-tag">מועדף</span>
            <span className="reem-bento-meta"><span className="reem-bento-topic">{hero?.topic}</span><span className="reem-bento-title" style={{ fontFamily: 'var(--serif)' }}>{hero?.title}</span></span>
          </button>
          <button className="reem-bento-cell reem-bento-create" onClick={onCreate} aria-label="חדשה">
            <span className="reem-create-plus" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="28" height="28"><line x1="16" y1="6" x2="16" y2="26" stroke={gold.warm} strokeWidth="1" /><line x1="6" y1="16" x2="26" y2="16" stroke={gold.warm} strokeWidth="1" /></svg>
            </span>
            <span className="reem-create-title">קרוסלה חדשה</span>
          </button>
          {[a, b, c, d, e].filter(Boolean).map((it, i) => (
            <button key={it.id} className={"reem-bento-cell reem-bento-tile reem-bento-tile--" + i} onClick={() => onOpen(it)}>
              <CarouselCover c={it} gold={gold} serif={serif} />
              <span className="reem-bento-meta"><span className="reem-bento-topic">{it.topic}</span><span className="reem-bento-title-sm" style={{ fontFamily: 'var(--serif)' }}>{it.title}</span></span>
            </button>
          ))}
          <div className="reem-bento-cell reem-bento-topics">
            <p className="reem-eyebrow"><span className="reem-eyebrow-rule" /><span className="reem-eyebrow-text">נושאים</span></p>
            <Topics topics={topics} active={active} setActive={setActive} />
          </div>
          {rest.map((it) => (
            <button key={it.id} className="reem-bento-cell reem-bento-tile" onClick={() => onOpen(it)}>
              <CarouselCover c={it} gold={gold} serif={serif} />
              <span className="reem-bento-meta"><span className="reem-bento-topic">{it.topic}</span><span className="reem-bento-title-sm" style={{ fontFamily: 'var(--serif)' }}>{it.title}</span></span>
            </button>
          ))}
        </div>
      </section>
    </Reveal>);
}

// Reel = filmstrip with sprocket holes, numbered slates per row
function DashReel({ items, onOpen, onCreate, gold, serif, motion, topics, active, setActive, goto }) {
  const reels = [
    { label: 'REEL · 01', sub: 'אחרונות', items: items.slice(0, 6) },
    { label: 'REEL · 02', sub: 'בעבודה', items: items.slice(2, 8).concat(items.slice(0, 2)).slice(0, 6) }
  ];
  return (
    <>
      {reels.map((r, ri) => (
        <Reveal motion={motion} key={r.label}>
          <section className="reem-section reem-reel-section" data-screen-label={"reel-" + ri}>
            <div className="reem-reel-head">
              <div className="reem-reel-slate">
                <span className="reem-reel-slate-num">{r.label}</span>
                <span className="reem-reel-slate-sub">{r.sub}</span>
              </div>
              {ri === 0 && <button className="reem-section-link" onClick={() => goto('carousels')}>הצג הכל <span aria-hidden="true">←</span></button>}
            </div>
            <div className="reem-filmstrip">
              <div className="reem-sprocket reem-sprocket--top" aria-hidden="true">
                {Array.from({ length: 18 }).map((_, i) => <span key={i} className="reem-sprocket-hole" />)}
              </div>
              <div className="reem-filmstrip-track" dir="rtl">
                {ri === 0 && (
                  <button className="reem-filmstrip-frame reem-filmstrip-frame--create" onClick={onCreate}>
                    <span className="reem-create-plus" aria-hidden="true">
                      <svg viewBox="0 0 32 32" width="32" height="32"><line x1="16" y1="6" x2="16" y2="26" stroke={gold.warm} strokeWidth="1" /><line x1="6" y1="16" x2="26" y2="16" stroke={gold.warm} strokeWidth="1" /></svg>
                    </span>
                    <span className="reem-create-title">חדשה</span>
                  </button>
                )}
                {r.items.map((c, i) => (
                  <button key={c.id + '-' + ri} className="reem-filmstrip-frame" onClick={() => onOpen(c)}>
                    <span className="reem-filmstrip-num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="reem-filmstrip-cover"><CarouselCover c={c} gold={gold} serif={serif} /></span>
                    <span className="reem-filmstrip-caption">
                      <span className="reem-filmstrip-topic">{c.topic}</span>
                      <span className="reem-filmstrip-title" style={{ fontFamily: 'var(--serif)' }}>{c.title}</span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="reem-sprocket reem-sprocket--bottom" aria-hidden="true">
                {Array.from({ length: 18 }).map((_, i) => <span key={i} className="reem-sprocket-hole" />)}
              </div>
            </div>
          </section>
        </Reveal>
      ))}
      <Reveal motion={motion}>
        <section className="reem-section" data-screen-label="topics">
          <SectionHeader eyebrow="המעקב שלי" title="נושאים פעילים" action={<button className="reem-section-link" onClick={() => goto('topics')}>כל הנושאים <span aria-hidden="true">←</span></button>} />
          <Topics topics={topics} active={active} setActive={setActive} />
        </section>
      </Reveal>
    </>);
}

// Cards = fanned diagonal stack that spreads on hover
function DashCards({ items, onOpen, onCreate, gold, serif, motion, topics, active, setActive, goto }) {
  const stack = items.slice(0, 5);
  const grid = items.slice(5);
  return (
    <>
      <Reveal motion={motion}>
        <section className="reem-section reem-cards-section" data-screen-label="card-stack">
          <SectionHeader eyebrow="הסטודיו" title="חפיסת הקרוסלות" action={<button className="reem-section-link" onClick={() => goto('carousels')}>הצג הכל <span aria-hidden="true">←</span></button>} />
          <div className="reem-cards-grid">
            <div className="reem-card-stack-wrap">
              <div className="reem-card-stack" style={{ '--count': stack.length }}>
                {stack.map((c, i) => (
                  <button key={c.id} className="reem-stack-card" style={{ '--i': i, '--n': stack.length }} onClick={() => onOpen(c)}>
                    <span className="reem-stack-card-frame">
                      <CarouselCover c={c} gold={gold} serif={serif} />
                    </span>
                    <span className="reem-stack-card-meta">
                      <span className="reem-stack-card-topic">{c.topic}</span>
                      <span className="reem-stack-card-title" style={{ fontFamily: 'var(--serif)' }}>{c.title}</span>
                    </span>
                  </button>
                ))}
              </div>
              <p className="reem-cards-hint">העבר עכבר על החפיסה</p>
            </div>
            <div className="reem-cards-side">
              <button className="reem-card-create" onClick={onCreate}>
                <span className="reem-create-plus" aria-hidden="true">
                  <svg viewBox="0 0 32 32" width="28" height="28"><line x1="16" y1="6" x2="16" y2="26" stroke={gold.warm} strokeWidth="1" /><line x1="6" y1="16" x2="26" y2="16" stroke={gold.warm} strokeWidth="1" /></svg>
                </span>
                <span className="reem-create-title">קרוסלה חדשה</span>
                <span className="reem-create-sub">התחל מכלום, או מנושא</span>
              </button>
              <div className="reem-cards-topics">
                <p className="reem-eyebrow"><span className="reem-eyebrow-rule" /><span className="reem-eyebrow-text">נושאים</span></p>
                <Topics topics={topics} active={active} setActive={setActive} />
              </div>
            </div>
          </div>
        </section>
      </Reveal>
      {grid.length > 0 && (
        <Reveal motion={motion}>
          <section className="reem-section" data-screen-label="cards-grid">
            <SectionHeader eyebrow="כל השאר" title="בארכיון" />
            <div className="reem-cards-archive">
              {grid.map((c) => (
                <button key={c.id} className="reem-cover-card" onClick={() => onOpen(c)}>
                  <span className="reem-cover-frame"><CarouselCover c={c} gold={gold} serif={serif} /><span className="reem-cover-badge">{c.slides} שקופיות</span></span>
                  <span className="reem-cover-meta"><span className="reem-cover-topic">{c.topic}</span><span className="reem-cover-date">{c.date}</span></span>
                </button>
              ))}
            </div>
          </section>
        </Reveal>
      )}
    </>);
}

// ── App ─────────────────────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const gold = GOLD_HUES[t.goldHue] || GOLD_HUES.antique;
  const serif = SERIFS[t.serif] || SERIFS.frank;

  const { route, goto, veil } = useRouteTransition('home');
  const [openCarousel, setOpenCarousel] = useState(null);
  const [newOpen, setNewOpen] = useState(false);

  // Inject CSS variables
  useEffect(() => {
    const r = document.documentElement;
    r.style.setProperty('--gold', gold.base);
    r.style.setProperty('--gold-warm', gold.warm);
    r.style.setProperty('--gold-deep', gold.deep);
    r.style.setProperty('--gold-soft', gold.soft);
    r.style.setProperty('--gold-glow', gold.glow);
    r.style.setProperty('--serif', serif);
    r.style.setProperty('--motion', t.motion);

    // Sans family
    r.style.setProperty('--sans', SANS_FAMILIES[t.sans] || SANS_FAMILIES.heebo);
    // Background tint
    const tint = BG_TINTS[t.bgTint] || BG_TINTS.neutral;
    r.style.setProperty('--bg', tint.bg);
    r.style.setProperty('--bg-deep', tint.deep);
    // Vignette intensity (0-100 → 0-0.85 alpha)
    r.style.setProperty('--vignette-alpha', String((t.vignette / 100) * 0.85));
    // Dust color rgb
    r.style.setProperty('--dust-rgb', DUST_COLORS[t.dustColor] || DUST_COLORS.gold);
    // Headline tracking (-2 to +2 → -0.04em to 0.04em)
    r.style.setProperty('--headline-track', String(t.headlineTrack / 50) + 'em');
    // Body size px
    r.style.setProperty('--body-size', String(t.bodySize) + 'px');
    // Container width
    r.style.setProperty('--container-w', String(t.containerWidth) + 'px');
    // Hover lift
    r.style.setProperty('--hover-lift', String(-t.hoverLift) + 'px');

    // Body classes — flip many CSS hooks at once
    const body = document.body;
    const classFlags = [
      `reem-bg-${t.bgTint}`,
      `reem-grain-${t.grain ? 'on' : 'off'}`,
      `reem-side-rules-${t.sideRules}`,
      `reem-corner-orn-${t.cornerOrn}`,
      `reem-hero-text-${t.heroTextAlign}`,
      `reem-headline-w-${t.headlineWeight}`,
      `reem-subhead-${t.subheadStyle}`,
      `reem-cta-${t.ctaStyle}`,
      `reem-scrollhint-${t.scrollHint}`,
      `reem-eyebrow-orn-${t.eyebrowOrn}`,
      `reem-dropcap-${t.dropCap ? 'on' : 'off'}`,
      `reem-section-${t.sectionSpacing}`,
      `reem-pill-${t.pillStyle}`,
      `reem-nav-${t.navAlign}`,
      `reem-monogram-${t.showMonogram ? 'on' : 'off'}`,
      `reem-trans-${t.pageTransition}`
    ];
    // Strip old reem-* class flags, then add the current set
    body.className = body.className.replace(/\breem-(bg|grain|side-rules|corner-orn|hero-text|headline-w|subhead|cta|scrollhint|eyebrow-orn|dropcap|section|pill|nav|monogram|trans)-\S+/g, '').trim();
    classFlags.forEach((c) => body.classList.add(c));
  }, [gold, serif, t.motion, t.sans, t.bgTint, t.vignette, t.dustColor, t.headlineTrack,
      t.bodySize, t.containerWidth, t.hoverLift, t.grain, t.sideRules, t.cornerOrn,
      t.heroTextAlign, t.headlineWeight, t.subheadStyle, t.ctaStyle, t.scrollHint,
      t.eyebrowOrn, t.dropCap, t.sectionSpacing, t.pillStyle, t.navAlign,
      t.showMonogram, t.pageTransition]);

  // Routes that pop the modal
  useEffect(() => {
    if (route === 'new') {
      setNewOpen(true);
      goto('home');
    }
  }, [route, goto]);

  const onOpen = useCallback((c) => {
    setOpenCarousel(c);
    goto('detail');
  }, [goto]);

  const onCreate = () => {
    setNewOpen(false);
  };

  return (
    <>
      <SvgDefs />
      <TopNav route={route === 'detail' ? 'carousels' : route} goto={goto} gold={gold} />

      {route === 'home' &&
      <>
          <Hero
          goto={goto}
          motion={t.motion}
          parallaxIntensity={t.parallaxIntensity}
          heroScale={t.heroScale}
          gold={gold}
          layout={t.heroLayout} />
        
          <Dashboard
          goto={(r) => r === 'new' ? setNewOpen(true) : goto(r)}
          onOpen={onOpen}
          gold={gold}
          serif={serif}
          motion={t.motion}
          recentLayout={t.recentLayout}
          density={t.density}
          layout={t.dashLayout} />
        
        </>
      }

      {route === 'carousels' &&
      <CarouselsPage
        items={COVERS}
        onOpen={onOpen}
        onCreate={() => setNewOpen(true)}
        gold={gold}
        serif={serif}
        motion={t.motion} />

      }

      {route === 'detail' && openCarousel &&
      <CarouselDetail
        carousel={openCarousel}
        onBack={() => goto('carousels')}
        gold={gold}
        serif={serif}
        motion={t.motion} />

      }

      {route === 'topics' && <TopicsPage gold={gold} serif={serif} motion={t.motion} />}
      {route === 'settings' && <SettingsPage serif={serif} motion={t.motion} />}

      <NewCarouselModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        gold={gold}
        serif={serif}
        onCreate={onCreate} />
      

      {/* Page transition veil */}
      <div
        className="reem-veil"
        style={{ opacity: veil, pointerEvents: veil > 0 ? 'auto' : 'none' }}
        aria-hidden="true" />
      

      <TweaksPanel title="Tweaks">
        <TweakSection label="Aesthetic" />
        <TweakRadio
          label="Gold hue"
          value={t.goldHue}
          options={[
          { value: 'antique', label: 'Antique' },
          { value: 'champagne', label: 'Champagne' },
          { value: 'brass', label: 'Brass' }]
          }
          onChange={(v) => setTweak('goldHue', v)} />
        
        <TweakSelect
          label="Hebrew serif"
          value={t.serif}
          options={[
          { value: 'frank', label: 'Frank Ruhl Libre' },
          { value: 'david', label: 'David Libre' },
          { value: 'cormorant', label: 'Cormorant Garamond' }]
          }
          onChange={(v) => setTweak('serif', v)} />
        
        <TweakRadio
          label="Density"
          value={t.density}
          options={[
          { value: 'breathy', label: 'Breathy' },
          { value: 'compact', label: 'Compact' }]
          }
          onChange={(v) => setTweak('density', v)} />
        

        <TweakSection label="Motion" />
        <TweakRadio
          label="Motion"
          value={t.motion}
          options={[
          { value: 'off', label: 'Off' },
          { value: 'restrained', label: 'Restrained' },
          { value: 'full', label: 'Full' }]
          }
          onChange={(v) => setTweak('motion', v)} />
        
        <TweakSlider
          label="Parallax"
          value={t.parallaxIntensity}
          min={0} max={20} step={1} unit="px"
          onChange={(v) => setTweak('parallaxIntensity', v)} />
        
        <TweakSlider
          label="Hero scale"
          value={t.heroScale}
          min={90} max={120} step={1} unit="%"
          onChange={(v) => setTweak('heroScale', v)} />
        

        <TweakSection label="Layout" />
        <TweakSelect
          label="Hero"
          value={t.heroLayout}
          options={[
          { value: 'cinematic', label: 'Cinematic (original)' },
          { value: 'diptych', label: 'Diptych (split spread)' },
          { value: 'marquee', label: 'Marquee (banner)' },
          { value: 'frontispiece', label: 'Frontispiece' },
          { value: 'atrium', label: 'Atrium (portrait frame)' },
          { value: 'letterhead', label: 'Letterhead (private letter)' }]
          }
          onChange={(v) => setTweak('heroLayout', v)} />
        <TweakSelect
          label="Dashboard"
          value={t.dashLayout}
          options={[
          { value: 'cinematic', label: 'Cinematic (original)' },
          { value: 'editorial', label: 'Editorial (TOC)' },
          { value: 'gallery', label: 'Gallery (bento)' },
          { value: 'reel', label: 'Reel (filmstrip)' },
          { value: 'cards', label: 'Card stack' }]
          }
          onChange={(v) => setTweak('dashLayout', v)} />
        <TweakRadio
          label="Recents"
          value={t.recentLayout}
          options={[
          { value: 'row', label: 'Row' },
          { value: 'grid', label: 'Grid' }]
          }
          onChange={(v) => setTweak('recentLayout', v)} />
        
      </TweaksPanel>
    </>);

}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);