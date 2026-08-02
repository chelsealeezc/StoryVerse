import { CSSProperties, Ref, useEffect, useMemo, useRef, useState } from "react";
import generatedPortalBg from "./assets/auragate-portal-bg-transparent.png";

const PORTAL_BG = generatedPortalBg;
const WORLD_BG =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260609_231253_53c0854c-d13c-42c1-9fc0-17e87cd34091.png&w=1280&q=85";

const quotes = [
  "你可能会看到和你天差地别的故事",
  "也会发现那个远隔重洋的陌生朋友",
  "和你当时的心境如此相似",
  "和千万种声音共鸣",
  "也看到不同的人生",
  "每一个故事，都可能是一扇新的窗",
  "欢迎来到这里",
];

const introSlides = [
  ["有没有一件事", "即使过去很多年", "你仍然会向别人讲起？"],
  ["有没有一个决定", "改变了你后来的人生？"],
  ["欢迎来到这里", "和千万种声音共鸣", "也看到不同的人生"],
];

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

function Wordmark({ isMobile, onClick }: { isMobile: boolean; onClick?: () => void }) {
  const content = (
    <>
      <span
        style={{
          fontFamily: '"Mr Dafoe Regular", cursive',
          fontSize: isMobile ? 30 : 36,
          lineHeight: 0.8,
        }}
      >
        Story
      </span>
      <span
        style={{
          fontSize: isMobile ? 20 : 24,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          marginLeft: -2,
        }}
      >
        Verse
      </span>
    </>
  );
  if (onClick) {
    return <button type="button" style={{ ...styles.wordmark, ...styles.wordmarkButton }} onClick={onClick} aria-label="回到 StoryVerse 首页">{content}</button>;
  }
  return (
    <div style={styles.wordmark}>{content}</div>
  );
}

function InlineLanguageSwitch({ language, onChange }: { language: "zh" | "en"; onChange: (language: "zh" | "en") => void }) {
  return (
    <div style={styles.inlineLanguage} aria-label="Language">
      <button style={{ ...styles.langPart, color: language === "zh" ? "#161616" : "rgba(22,22,22,0.42)" }} onClick={() => onChange("zh")}>中文</button>
      <span style={styles.langDivider}>|</span>
      <button style={{ ...styles.langPart, color: language === "en" ? "#161616" : "rgba(22,22,22,0.42)" }} onClick={() => onChange("en")}>ENG</button>
    </div>
  );
}

function PortalIntro({ isMobile, sceneOpacity }: { isMobile: boolean; sceneOpacity: number }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((value) => (value + 1) % introSlides.length);
    }, 3600);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      aria-label="StoryVerse intro"
      style={{
        ...styles.portalIntro,
        opacity: Math.min(sceneOpacity, 1),
        transform: isMobile ? "translate(-50%, -51%) scale(0.86)" : "translate(-50%, -51%)",
      }}
    >
      {introSlides.map((slide, index) => (
        <div
          key={slide.join("")}
          style={{
            ...styles.portalIntroSlide,
            opacity: active === index ? 1 : 0,
            transform: active === index ? "translateY(0)" : "translateY(10px)",
          }}
        >
          {slide.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Chevron({ dir }: { dir: -1 | 1 }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d={dir === -1 ? "M11.25 4.5 6.75 9l4.5 4.5" : "M6.75 4.5 11.25 9l-4.5 4.5"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArcCardCarousel({ isMobile }: { isMobile: boolean }) {
  const [active, setActive] = useState(Math.floor(quotes.length / 2));
  const total = quotes.length;
  const half = Math.floor(total / 2);
  const cardW = isMobile ? 230 : 270;
  const cardH = isMobile ? 320 : 390;
  const stepX = isMobile ? 170 : 215;
  const dropY = isMobile ? 34 : 44;
  const tilt = isMobile ? 7 : 8;
  const containerH = isMobile ? 460 : 560;
  const centerBump = isMobile ? 22 : 30;

  const advance = (dir: -1 | 1) => setActive((value) => (value + dir + total) % total);

  return (
    <div style={{ ...styles.carousel, height: containerH }}>
      {quotes.map((quote, index) => {
        let pos = index - active;
        if (pos > half) pos -= total;
        if (pos < -half) pos += total;

        const abs = Math.abs(pos);
        const isCenter = pos === 0;
        const opacity = isCenter ? 1 : Math.max(0, 0.6 - (abs - 1) * 0.2);
        const transform = `translateX(${pos * stepX}px) translateY(${
          abs * dropY + (isCenter ? centerBump : 0)
        }px) rotate(${pos * tilt}deg)`;

        return (
          <button
            key={quote}
            style={{
              ...styles.arcCard,
              width: cardW,
              height: cardH,
              borderRadius: isMobile ? 22 : 28,
              opacity,
              zIndex: 100 - abs,
              pointerEvents: "auto",
              transform,
              background: isCenter
                ? "rgb(247,251,255)"
                : "linear-gradient(135deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.24) 100%)",
              border: isCenter
                ? "1px solid rgba(255,255,255,0.6)"
                : "1px solid rgba(255,255,255,0.28)",
              boxShadow: isCenter
                ? "0 8px 24px rgba(0,0,0,0.08), 0 0 50px rgba(255,255,255,0.55), 0 0 90px rgba(255,255,255,0.35)"
                : "inset 0 1px 1px rgba(255,255,255,0.45)",
              backdropFilter: isCenter ? "none" : "blur(18px) saturate(140%)",
              WebkitBackdropFilter: isCenter ? "none" : "blur(18px) saturate(140%)",
              cursor: isCenter ? "default" : "pointer",
            }}
            onClick={() => setActive(index)}
          >
            <p
              style={{
                ...styles.quote,
                color: isCenter ? "#2c2420" : "rgba(255,255,255,0.85)",
                fontSize: isMobile ? 15 : 17,
              }}
            >
              “{quote}”
            </p>
          </button>
        );
      })}

      <div style={styles.carouselNav}>
        <button
          aria-label="Previous testimonial"
          onClick={() => advance(-1)}
          style={{
            ...styles.carouselButton,
            width: isMobile ? 42 : 46,
            height: isMobile ? 42 : 46,
            background: "rgba(255,255,255,0.2)",
            color: "#fff",
            filter: "drop-shadow(rgba(255,255,255,0.7) 0 0 6px) drop-shadow(rgba(255,255,255,0.4) 0 0 14px)",
          }}
        >
          <Chevron dir={-1} />
        </button>
        <button
          aria-label="Next testimonial"
          onClick={() => advance(1)}
          style={{
            ...styles.carouselButton,
            width: isMobile ? 42 : 46,
            height: isMobile ? 42 : 46,
            background: "rgba(255,255,255,0.9)",
            color: "#2c2420",
            boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
          }}
        >
          <Chevron dir={1} />
        </button>
      </div>
    </div>
  );
}

export function Auragate({ language = "zh", onLanguageChange = () => {}, onHome, onComplete }: { language?: "zh" | "en"; onLanguageChange?: (language: "zh" | "en") => void; onHome?: () => void; onComplete: () => void }) {
  const introRef = useRef<HTMLDivElement>(null);
  const loginRef = useRef<HTMLElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const scrollProgress = useRef(0);
  const mouse = useRef({ rawX: 0, rawY: 0, x: 0, y: 0 });
  const isMobile = useIsMobile();
  const [uiVisible, setUiVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [portalLoaded, setPortalLoaded] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setUiVisible(true), 600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const updateScroll = () => {
      if (!introRef.current) return;
      const distance = introRef.current.offsetHeight - window.innerHeight;
      const next = distance <= 0 ? 0 : clamp(window.scrollY / distance);
      scrollProgress.current = next;
      setProgress(next);
    };

    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    window.addEventListener("resize", updateScroll);
    return () => {
      window.removeEventListener("scroll", updateScroll);
      window.removeEventListener("resize", updateScroll);
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      mouse.current.rawX = (event.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.rawY = (event.clientY / window.innerHeight - 0.5) * 2;
    };

    let raf = 0;
    const tick = () => {
      const ep = easeInOut(scrollProgress.current);
      mouse.current.x = lerp(mouse.current.x, mouse.current.rawX, 0.07);
      mouse.current.y = lerp(mouse.current.y, mouse.current.rawY, 0.07);
      const rx = -mouse.current.x;
      const ry = -mouse.current.y;
      const worldScale = lerp(1, 1.18, ep);
      const portalScale = lerp(1, 7.5, ep);

      if (worldRef.current) {
        worldRef.current.style.transform = `scale(${worldScale}) translate(${rx * 6}px, ${ry * 6}px)`;
      }
      if (portalRef.current) {
        portalRef.current.style.transform = `scale(${portalScale}) translate(${rx * 7}px, ${ry * 7}px)`;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", onMouseMove);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const scene1Opacity = clamp(1 - progress / 0.22);
  const portalOpacity = progress <= 0.66 ? 1 : clamp(1 - (progress - 0.66) / 0.22);

  const visibleMotion = useMemo<CSSProperties>(
    () => ({
      opacity: uiVisible ? scene1Opacity : 0,
      transform: uiVisible ? "translateY(0)" : "translateY(24px)",
      pointerEvents: scene1Opacity < 0.05 ? "none" : "auto",
    }),
    [scene1Opacity, uiVisible],
  );

  return (
    <main style={styles.root}>
      <div style={styles.worldLayer}>
        <div ref={worldRef} style={styles.worldInner}>
          <img src={WORLD_BG} alt="" style={styles.worldImage} />
        </div>
      </div>

      <nav style={{ ...styles.nav, padding: isMobile ? "18px 20px" : "26px 40px" }}>
        <Wordmark isMobile={isMobile} onClick={onHome} />
        <div style={styles.navActions}>
          {progress < 0.58 ? (
            <button
              style={{ ...styles.watchDemo, padding: isMobile ? "9px 16px" : "11px 22px" }}
              onClick={() => loginRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              Skip
            </button>
          ) : (
            <InlineLanguageSwitch language={language} onChange={onLanguageChange} />
          )}
        </div>
      </nav>

      <section ref={introRef} style={styles.introTrack}>
        <div style={styles.stickyStage}>
          <div
            ref={portalRef}
            style={{
              ...styles.portalLayer,
              opacity: portalOpacity,
            }}
          >
            <div style={{ ...styles.portalFallback, opacity: portalLoaded ? 0 : 1 }}>
              <div style={styles.fallbackWindowShadow} />
              <div style={styles.fallbackWindowOuter}>
                <div style={styles.fallbackTopVent} />
                <div style={styles.fallbackWindowRim}>
                  <div style={styles.fallbackSkyOpening} />
                </div>
              </div>
            </div>
            <img
              src={PORTAL_BG}
              alt=""
              onLoad={() => setPortalLoaded(true)}
              onError={() => setPortalLoaded(false)}
              style={{
                ...styles.portalImage,
                opacity: portalLoaded ? 1 : 0,
              }}
            />
            <PortalIntro isMobile={isMobile} sceneOpacity={scene1Opacity} />
            <button
              type="button"
              onClick={() => loginRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              style={{ ...styles.portalDownHint, opacity: scene1Opacity }}
            >
              <span style={{ display: "inline-block", transform: "scaleX(1.45)" }}>↓</span> 下滑
            </button>
          </div>

          <div
            className="absolute inset-x-0 bottom-0 flex flex-col md:flex-row md:items-end md:justify-between gap-12 md:gap-20"
            style={{
              ...styles.sceneOne,
              flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "flex-start" : "flex-end",
              gap: isMobile ? 48 : 80,
              padding: isMobile ? "0 22px 40px" : "0 44px 52px",
              ...visibleMotion,
            }}
          >
            <div style={styles.heroColumn}>
              <h1
                style={{
                  ...styles.heroTitle,
                  fontSize: isMobile ? "clamp(30px,9vw,44px)" : "clamp(40px,4vw,58px)",
                }}
              >
                <span style={styles.discover}>Begin</span>Your
                <br />
                StoryVerse
              </h1>
              <p style={styles.heroBody}>
                各种意义上的异乡者，终会在这里相逢。
              </p>
            </div>

            {!isMobile && (
              <div style={styles.partner}>
                <span style={styles.partnerMark}>S.</span>
                <p style={styles.partnerCopy}>和千万种声音共鸣，也看到不同的人生。</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section style={{ ...styles.sectionTwo, paddingTop: isMobile ? "12vh" : "14vh" }}>
        <div style={styles.sectionHeader}>
          <h2 style={{ ...styles.sectionTitle, fontSize: "clamp(34px,4vw,52px)" }}>
            Real stories.
            <br />
            Real voices.
          </h2>
          <p style={styles.sectionSubtitle}>
            在 StoryVerse，看见和你天差地别的故事，也看见和你如此相似的人。
          </p>
        </div>
        <ArcCardCarousel isMobile={isMobile} />
        <ImmersiveLogin isMobile={isMobile} onComplete={onComplete} ref={loginRef} />
        <Footer isMobile={isMobile} />
      </section>
    </main>
  );
}

function Footer({ isMobile }: { isMobile: boolean }) {
  const columns = [
    ["Explore", "How it works", "Story Map"],
    ["Contact", "X (Twitter)", "hello@storyverse.com"],
    ["Legal", "Privacy Policy", "Terms of Service"],
  ];

  return (
    <footer style={{ ...styles.footer, padding: isMobile ? "120px 22px 40px" : "160px 44px 52px" }}>
      <div
        style={{
          ...styles.footerGrid,
          gridTemplateColumns: isMobile ? "1fr 1fr" : "1.4fr 1fr 1fr 1fr",
          gap: isMobile ? "32px 20px" : 40,
        }}
      >
        <div style={{ gridColumn: isMobile ? "1 / -1" : "auto" }}>
          <Wordmark isMobile={false} />
          <p style={styles.copyright}>© 2026 StoryVerse</p>
        </div>
        {columns.map(([title, ...links]) => (
          <div key={title}>
            <h3 style={styles.footerTitle}>{title}</h3>
            <div style={styles.footerLinks}>
              {links.map((link) => (
                <a href="#" key={link} style={styles.footerLink}>
                  {link}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
}

function ImmersiveLogin({ isMobile, onComplete, ref }: { isMobile: boolean; onComplete: () => void; ref: Ref<HTMLElement> }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const valid = email.includes("@") && password.length >= 6;

  return (
    <section ref={ref} style={{ ...styles.loginSection, padding: isMobile ? "92px 22px 40px" : "132px 44px 36px" }}>
      <div style={{ ...styles.loginPanel, gridTemplateColumns: isMobile ? "1fr" : "1fr 420px", minHeight: isMobile ? "auto" : "min(720px,78vh)" }}>
        <div style={styles.loginCopy}>
          <p style={styles.loginEyebrow}>Step into StoryVerse</p>
          <h2 style={{ ...styles.loginTitle, fontSize: isMobile ? 42 : 64 }}>
            欢迎来到 <span style={{ display: "inline-flex", verticalAlign: "baseline" }}><Wordmark isMobile={isMobile} /></span>
          </h2>
        </div>
        <div style={styles.authCard}>
          <div style={styles.segmented}>
            <button
              style={{ ...styles.segmentButton, background: mode === "signup" ? "#fff" : "transparent", color: mode === "signup" ? "#151515" : "rgba(255,255,255,0.64)" }}
              onClick={() => setMode("signup")}
            >
              Sign up
            </button>
            <button
              style={{ ...styles.segmentButton, background: mode === "login" ? "#fff" : "transparent", color: mode === "login" ? "#151515" : "rgba(255,255,255,0.64)" }}
              onClick={() => setMode("login")}
            >
              Log in
            </button>
          </div>
          <label style={styles.fieldLabel}>
            Email
            <input
              style={styles.inputShell}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="you@example.com"
            />
          </label>
          <label style={styles.fieldLabel}>
            Password
            <input
              style={styles.inputShell}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder={mode === "signup" ? "Create a strong password" : "Enter your password"}
            />
          </label>
          <button style={{ ...styles.primaryButton, opacity: valid ? 1 : 0.48, cursor: valid ? "pointer" : "not-allowed" }} disabled={!valid} onClick={onComplete}>
            {mode === "signup" ? "Create account" : "Enter StoryVerse"}
          </button>
          <p style={styles.loginHint}>
            {mode === "signup" ? "Already have an account? Log in" : "New here? Create your first account"}
          </p>
        </div>
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    position: "relative",
    minHeight: "260vh",
    overflowX: "hidden",
    background: "#0a0608",
    color: "#fff",
    fontFamily: '"Helvetica Now Display", Inter, sans-serif',
  },
  worldLayer: {
    position: "fixed",
    inset: 0,
    overflow: "hidden",
    zIndex: 0,
  },
  worldInner: {
    width: "100%",
    height: "100%",
    transformOrigin: "50% 50%",
    willChange: "transform",
  },
  worldImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  nav: {
    position: "fixed",
    inset: "0 0 auto 0",
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    pointerEvents: "none",
  },
  wordmark: {
    display: "inline-flex",
    alignItems: "baseline",
    color: "#fff",
    pointerEvents: "auto",
  },
  wordmarkButton: {
    border: 0,
    padding: 0,
    background: "transparent",
    cursor: "pointer",
  },
  inlineLanguage: {
    height: 42,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "0 18px",
    border: "1px solid rgba(255,255,255,0.58)",
    borderRadius: 999,
    background: "rgba(255,255,255,0.88)",
    boxShadow: "0 8px 24px rgba(2,92,145,.12)",
  },
  langPart: {
    border: 0,
    padding: 0,
    background: "transparent",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  langDivider: {
    color: "rgba(22,22,22,0.24)",
    fontWeight: 800,
  },
  navActions: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    pointerEvents: "auto",
  },
  watchDemo: {
    border: 0,
    borderRadius: 999,
    background: "#fff",
    color: "#161616",
    fontSize: 13,
    fontWeight: 600,
    transition: "background 0.25s",
    cursor: "pointer",
  },
  introTrack: {
    position: "relative",
    zIndex: 5,
    height: "160vh",
  },
  stickyStage: {
    position: "sticky",
    top: 0,
    height: "100vh",
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
  },
  portalLayer: {
    position: "absolute",
    inset: 0,
    transformOrigin: "52% 38%",
    willChange: "transform, opacity",
    pointerEvents: "none",
  },
  portalImage: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    transition: "opacity 0.2s ease",
  },
  portalIntro: {
    position: "absolute",
    left: "50%",
    top: "46.2%",
    zIndex: 2,
    width: "min(24vw, 330px)",
    minWidth: 240,
    height: 132,
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    color: "rgba(255,255,255,0.96)",
    textShadow: "0 2px 16px rgba(0,0,0,0.18)",
    pointerEvents: "none",
    transition: "opacity 0.9s ease",
  },
  portalIntroSlide: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontFamily: '"PingFang HK", "PingFang SC", "Helvetica Now Display", Inter, sans-serif',
    fontSize: "clamp(16px, 1.35vw, 22px)",
    fontWeight: 300,
    lineHeight: 1.38,
    letterSpacing: "-0.015em",
    transition: "opacity 900ms ease, transform 900ms cubic-bezier(0.22,1,0.36,1)",
  },
  portalDownHint: {
    position: "absolute",
    left: "50%",
    top: "62%",
    transform: "translateX(-50%)",
    zIndex: 4,
    border: 0,
    background: "transparent",
    color: "rgba(255,255,255,0.92)",
    borderRadius: 0,
    padding: 0,
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textShadow: "0 2px 14px rgba(0,0,0,0.24)",
    pointerEvents: "auto",
    cursor: "pointer",
    animation: "portalHintFloat 1.8s ease-in-out infinite",
  },
  portalFallback: {
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    background:
      "radial-gradient(circle at 52% 37%, rgba(255,255,255,0.13), transparent 26%), linear-gradient(135deg, #252527 0%, #343436 48%, #202022 100%)",
    transition: "opacity 0.2s ease",
  },
  fallbackWindowShadow: {
    position: "absolute",
    left: "50%",
    top: "43%",
    width: "min(49vw, 650px)",
    height: "min(70vw, 850px)",
    borderRadius: "48% / 43%",
    transform: "translate(-50%, -50%)",
    background: "rgba(0,0,0,0.36)",
    filter: "blur(36px)",
  },
  fallbackWindowOuter: {
    position: "absolute",
    left: "50%",
    top: "42%",
    width: "min(43vw, 570px)",
    height: "min(59vw, 735px)",
    borderRadius: "48% / 43%",
    transform: "translate(-50%, -50%)",
    background:
      "radial-gradient(circle at 30% 12%, #ffffff 0%, #d6d6d2 18%, transparent 36%), linear-gradient(135deg, #f5f5f2 0%, #a8a8a4 50%, #ececea 100%)",
    boxShadow:
      "inset 24px 20px 42px rgba(255,255,255,0.82), inset -35px -42px 68px rgba(0,0,0,0.22), 0 58px 75px rgba(0,0,0,0.5)",
  },
  fallbackTopVent: {
    position: "absolute",
    left: "50%",
    top: "7%",
    width: "43%",
    height: "5.5%",
    borderRadius: "50%",
    transform: "translateX(-50%)",
    background: "linear-gradient(180deg, rgba(36,36,36,0.45), rgba(255,255,255,0.62))",
    boxShadow: "inset 0 8px 10px rgba(0,0,0,0.35)",
  },
  fallbackWindowRim: {
    position: "absolute",
    left: "50%",
    top: "51%",
    width: "73%",
    height: "73%",
    borderRadius: "40% / 36%",
    transform: "translate(-50%, -50%)",
    padding: "3.8%",
    background:
      "linear-gradient(135deg, #fbfbfb 0%, #c5c5c2 45%, #ffffff 70%, #b3b3b1 100%)",
    boxShadow: "inset 10px 12px 20px rgba(0,0,0,0.18), inset -10px -14px 20px rgba(255,255,255,0.72)",
  },
  fallbackSkyOpening: {
    width: "100%",
    height: "100%",
    borderRadius: "38% / 34%",
    background: "linear-gradient(180deg, #17bff2 0%, #20c7ed 100%)",
    boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.18), inset 0 -16px 18px rgba(255,255,255,0.18)",
  },
  sceneOne: {
    position: "absolute",
    inset: "auto 0 0 0",
    zIndex: 6,
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 80,
    transition: "opacity 1s ease, transform 1s ease",
    transitionDelay: "0.3s",
  },
  heroColumn: {
    maxWidth: 500,
    textAlign: "left",
  },
  heroTitle: {
    margin: 0,
    fontWeight: 500,
    color: "#fff",
    lineHeight: 1.05,
    letterSpacing: "-0.02em",
  },
  discover: {
    fontFamily: '"Mr Dafoe Regular", cursive',
    color: "#9a9a9a",
    fontSize: "1.15em",
    marginRight: "0.12em",
  },
  heroBody: {
    margin: "22px 0 0",
    maxWidth: 420,
    fontWeight: 400,
    fontSize: 16,
    lineHeight: 1.65,
    letterSpacing: "-0.02em",
    color: "rgba(255,255,255,0.58)",
  },
  partner: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  partnerMark: {
    fontFamily: '"Mr Dafoe Regular", cursive',
    fontSize: 64,
    color: "#fff",
    lineHeight: 0.8,
  },
  partnerCopy: {
    margin: 0,
    maxWidth: 150,
    fontWeight: 400,
    fontSize: 11,
    lineHeight: 1.35,
    color: "rgba(255,255,255,0.5)",
  },
  sectionTwo: {
    position: "relative",
    zIndex: 10,
    minHeight: "100vh",
    paddingBottom: 60,
  },
  sectionHeader: {
    textAlign: "center",
  },
  sectionTitle: {
    margin: 0,
    fontWeight: 500,
    color: "#fff",
    letterSpacing: "-0.02em",
    lineHeight: 1.1,
    textShadow: "0 2px 20px rgba(0,0,0,0.35)",
  },
  sectionSubtitle: {
    margin: "16px auto 0",
    maxWidth: 420,
    fontWeight: 500,
    fontSize: 17,
    lineHeight: 1.45,
    color: "#fff",
    textShadow: "0 2px 16px rgba(0,0,0,0.3)",
  },
  carousel: {
    position: "relative",
    width: "100%",
    marginTop: 64,
  },
  arcCard: {
    position: "absolute",
    left: "50%",
    top: 0,
    translate: "-50% 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 34,
    cursor: "default",
    transition: "transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.55s ease",
  },
  quote: {
    margin: 0,
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: "-0.01em",
    textAlign: "center",
  },
  carouselNav: {
    position: "absolute",
    left: "50%",
    bottom: -40,
    transform: "translateX(-50%)",
    display: "flex",
    gap: 10,
  },
  carouselButton: {
    border: 0,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
  },
  footer: {
    position: "relative",
  },
  loginSection: {
    position: "relative",
    display: "grid",
    placeItems: "center",
    minHeight: "100vh",
  },
  loginPanel: {
    maxWidth: 1180,
    margin: "0 auto",
    display: "grid",
    gap: 28,
    alignItems: "stretch",
  },
  loginCopy: {
    minHeight: 430,
    border: "1px solid rgba(255,255,255,0.34)",
    borderRadius: 36,
    padding: "48px 52px",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.34), rgba(255,255,255,0.14)), radial-gradient(circle at 24% 20%, rgba(255,255,255,0.42), transparent 32%)",
    backdropFilter: "blur(22px) saturate(135%)",
    WebkitBackdropFilter: "blur(22px) saturate(135%)",
    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.22), 0 28px 90px rgba(0,0,0,0.18)",
  },
  loginEyebrow: {
    margin: 0,
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  loginTitle: {
    margin: "48px 0 0",
    color: "#fff",
    fontWeight: 500,
    lineHeight: 1.06,
    letterSpacing: "-0.055em",
    textShadow: "0 2px 24px rgba(0,0,0,0.26)",
  },
  loginBody: {
    maxWidth: 520,
    margin: "26px 0 0",
    color: "rgba(255,255,255,0.78)",
    fontSize: 16,
    lineHeight: 1.72,
    fontWeight: 400,
  },
  authCard: {
    border: "1px solid rgba(255,255,255,0.46)",
    borderRadius: 34,
    padding: 24,
    background: "rgba(255,255,255,0.2)",
    backdropFilter: "blur(26px) saturate(150%)",
    WebkitBackdropFilter: "blur(26px) saturate(150%)",
    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.46), 0 30px 88px rgba(0,0,0,0.18)",
  },
  segmented: {
    height: 54,
    padding: 4,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 4,
    borderRadius: 999,
    background: "rgba(255,255,255,0.16)",
    marginBottom: 26,
  },
  segmentButton: {
    border: 0,
    borderRadius: 999,
    background: "transparent",
    fontSize: 14,
    fontWeight: 700,
  },
  fieldLabel: {
    display: "block",
    marginTop: 18,
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: 700,
  },
  inputShell: {
    height: 54,
    marginTop: 9,
    padding: "0 18px",
    display: "flex",
    alignItems: "center",
    borderRadius: 17,
    border: "1px solid rgba(255,255,255,0.38)",
    background: "rgba(255,255,255,0.82)",
    color: "rgba(20,20,20,0.42)",
    fontSize: 15,
    fontWeight: 500,
  },
  primaryButton: {
    width: "100%",
    height: 56,
    marginTop: 28,
    border: 0,
    borderRadius: 18,
    background: "#0057ff",
    color: "#fff",
    fontSize: 16,
    fontWeight: 800,
    boxShadow: "0 14px 34px rgba(0,87,255,0.34)",
  },
  loginHint: {
    margin: "18px 0 0",
    textAlign: "center",
    color: "rgba(255,255,255,0.66)",
    fontSize: 13,
  },
  footerGrid: {
    maxWidth: 1280,
    margin: "0 auto",
    display: "grid",
  },
  copyright: {
    margin: "18px 0 0",
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
  },
  footerTitle: {
    margin: "0 0 18px",
    color: "rgba(255,255,255,0.55)",
    fontWeight: 500,
    fontSize: 13,
  },
  footerLinks: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  footerLink: {
    color: "#fff",
    fontWeight: 500,
    fontSize: 14,
    textDecoration: "none",
  },
};
