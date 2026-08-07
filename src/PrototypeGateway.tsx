import { CSSProperties, RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import generatedPortalBg from "./assets/auragate-portal-bg-transparent.png";
import nightWorldBg from "./assets/storyverse-night-bg.png";

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

const gatewayCopy = {
  zh: {
    homeAria: "回到 StoryVerse 首页",
    introAria: "StoryVerse 开场介绍",
    skip: "跳过",
    scrollDown: "下滑",
    heroPrefix: "Begin",
    heroMain: "Your",
    heroBrand: "StoryVerse",
    heroBody: "各种意义上的异乡者，终会在这里相逢。",
    partner: "和千万种声音共鸣，也看到不同的人生。",
    previewTitle: ["真实故事。", "真实声音。"],
    previewSubtitle: "在 StoryVerse，看见和你天差地别的故事，也看见和你如此相似的人。",
    previousStory: "上一张故事卡片",
    nextStory: "下一张故事卡片",
    footerHowItWorks: "它如何运作",
    footerHowItWorksTitle: "新手引导正在准备中",
    footerHowItWorksBody: "这里会接入一段轻量的新手引导，帮助第一次来到 StoryVerse 的用户理解如何写故事、选择共鸣方向、进入星图。",
    footerContact: "联系",
    footerRed: "小红书",
    footerEmail: "zicuili25@stu.pku.edu.cn",
    footerLegal: "法律",
    footerPrivacy: "隐私政策",
    footerTerms: "服务条款",
    loginEyebrow: "进入 StoryVerse",
    welcome: "欢迎来到",
    signup: "注册",
    login: "登录",
    nickname: "昵称",
    nicknamePlaceholder: "给自己起一个在 StoryVerse 中的名字吧",
    email: "邮箱/电话",
    emailPlaceholder: "邮箱或中国大陆手机号",
    password: "密码",
    signupPasswordPlaceholder: "设置一个安全密码",
    loginPasswordPlaceholder: "输入你的密码",
    createAccount: "创建账户",
    enter: "进入 StoryVerse",
    already: "已经有账户？",
    newHere: "第一次来到这里？",
    forgotPrefix: "忘记密码？",
    forgotAction: "点击找回",
    resetTitle: "找回密码",
    resetLead: "输入注册邮箱/手机号和新密码。后端接入后会自动发送短信或邮件验证码。",
    resetAccount: "注册邮箱/手机号",
    resetPassword: "新密码",
    resetConfirm: "确认密码",
    resetCode: "验证码",
    sendCode: "发送验证码",
    resetSubmit: "使用新密码",
    resetDone: "密码重置前端流程已就绪，接入后端后即可发送验证码并更新密码。",
  },
  en: {
    homeAria: "Back to StoryVerse home",
    introAria: "StoryVerse intro",
    skip: "Skip",
    scrollDown: "Scroll",
    heroPrefix: "Begin",
    heroMain: "Your",
    heroBrand: "StoryVerse",
    heroBody: "Strangers in every sense can still meet here.",
    partner: "Resonate with countless voices, and see different lives.",
    previewTitle: ["Real stories.", "Real voices."],
    previewSubtitle: "In StoryVerse, meet stories far from yours and people unexpectedly close to you.",
    previousStory: "Previous story card",
    nextStory: "Next story card",
    footerHowItWorks: "How it works",
    footerHowItWorksTitle: "New user guide is in progress",
    footerHowItWorksBody: "This will open a lightweight onboarding guide explaining how to write a story, choose resonance directions, and enter the atlas.",
    footerContact: "Contact",
    footerRed: "RED",
    footerEmail: "zicuili25@stu.pku.edu.cn",
    footerLegal: "Legal",
    footerPrivacy: "Privacy Policy",
    footerTerms: "Terms of Service",
    loginEyebrow: "Step into StoryVerse",
    welcome: "Welcome to",
    signup: "Sign up",
    login: "Log in",
    nickname: "Nickname",
    nicknamePlaceholder: "Choose a name for yourself in StoryVerse",
    email: "Email / phone",
    emailPlaceholder: "Email or Mainland China phone number",
    password: "Password",
    signupPasswordPlaceholder: "Create a strong password",
    loginPasswordPlaceholder: "Enter your password",
    createAccount: "Create account",
    enter: "Enter StoryVerse",
    already: "Already have an account?",
    newHere: "New here?",
    forgotPrefix: "Forgot password?",
    forgotAction: "Recover",
    resetTitle: "Recover password",
    resetLead: "Enter your registered email/phone and new password. Backend integration will send the SMS/email code automatically.",
    resetAccount: "Registered email / phone",
    resetPassword: "New password",
    resetConfirm: "Confirm password",
    resetCode: "Verification code",
    sendCode: "Send code",
    resetSubmit: "Use new password",
    resetDone: "Password reset frontend flow is ready. Backend can later send the code and update the password.",
  },
} as const;

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
const privacyUrl = "https://icnh1tjz358q.feishu.cn/wiki/CG8Hw371bidxwDkT9YGck2kwnfe";
const termsUrl = "https://icnh1tjz358q.feishu.cn/wiki/Wb3NwnFEWig5V0kTROGcd35nnlc";

function isValidEmailOrChinaPhone(value: string) {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export type GatewayAuthInput = { mode: "signup" | "login"; displayName: string; email: string; password: string };

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

function Wordmark({ isMobile, onClick, ariaLabel = "回到 StoryVerse 首页" }: { isMobile: boolean; onClick?: () => void; ariaLabel?: string }) {
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
    return <button type="button" style={{ ...styles.wordmark, ...styles.wordmarkButton }} onClick={onClick} aria-label={ariaLabel}>{content}</button>;
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

function UnifiedLanguageButton({ language, onChange }: { language: "zh" | "en"; onChange: (language: "zh" | "en") => void }) {
  return (
    <button
      type="button"
      className="neon-control lang-button"
      aria-label={language === "zh" ? "切换语言" : "Switch language"}
      onClick={() => onChange(language === "zh" ? "en" : "zh")}
    >
      <span className={language === "zh" ? "lang-primary" : "lang-secondary"}>中文</span>
      <span className="lang-divider" />
      <span className={language === "en" ? "lang-primary" : "lang-secondary"}>ENG</span>
    </button>
  );
}

function LoginWordmark({ isMobile }: { isMobile: boolean }) {
  return (
    <span style={styles.loginWordmarkLoose}>
      <span
        style={{
          fontFamily: '"Mr Dafoe Regular", cursive',
          fontSize: isMobile ? 30 : 46,
          lineHeight: 0.8,
        }}
      >
        Story
      </span>
      <span
        style={{
          fontSize: isMobile ? 21 : 34,
          fontWeight: 500,
          letterSpacing: "0.01em",
          marginLeft: isMobile ? 2 : 5,
        }}
      >
        Verse
      </span>
    </span>
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

function ArcCardCarousel({ isMobile, language }: { isMobile: boolean; language: "zh" | "en" }) {
  const [active, setActive] = useState(Math.floor(quotes.length / 2));
  const t = gatewayCopy[language];
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
              pointerEvents: abs <= 2 ? "auto" : "none",
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
          aria-label={t.previousStory}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
            advance(-1);
          }}
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
          aria-label={t.nextStory}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
            advance(1);
          }}
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

type GatewaySection = "intro" | "preview" | "auth";

export function Auragate({
  language = "zh",
  onLanguageChange = () => {},
  onHome,
  onComplete,
  section = "intro",
  authMode = "signup",
  onSectionChange,
  onAuthModeChange,
  themeMode = "day",
  onThemeModeChange = () => {},
}: {
  language?: "zh" | "en";
  onLanguageChange?: (language: "zh" | "en") => void;
  onHome?: () => void;
  onComplete: (input: GatewayAuthInput) => Promise<void> | void;
  section?: GatewaySection;
  authMode?: "signup" | "login";
  onSectionChange?: (section: GatewaySection) => void;
  onAuthModeChange?: (mode: "signup" | "login") => void;
  themeMode?: "day" | "night";
  onThemeModeChange?: (themeMode: "day" | "night") => void;
}) {
  const introRef = useRef<HTMLDivElement>(null);
  const loginRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const downHintRef = useRef<HTMLButtonElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const scrollProgress = useRef(0);
  const mouse = useRef({ rawX: 0, rawY: 0, x: 0, y: 0 });
  const isMobile = useIsMobile();
  const [uiVisible, setUiVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [portalLoaded, setPortalLoaded] = useState(true);
  const t = gatewayCopy[language];

  useEffect(() => {
    const timer = window.setTimeout(() => setUiVisible(true), 600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const target = section === "intro" ? introRef.current : section === "preview" ? previewRef.current : loginRef.current;
    if (!target) return;
    const frame = window.requestAnimationFrame(() => target.scrollIntoView({ behavior: "auto", block: "start" }));
    return () => window.cancelAnimationFrame(frame);
  }, [section]);

  const goToSection = useCallback(
    (nextSection: GatewaySection, behavior: ScrollBehavior = "smooth") => {
      const target =
        nextSection === "intro" ? introRef.current : nextSection === "preview" ? previewRef.current : loginRef.current;
      onSectionChange?.(nextSection);
      window.requestAnimationFrame(() => {
        target?.scrollIntoView({ behavior, block: "start" });
      });
    },
    [onSectionChange],
  );

  useEffect(() => {
    const downHintButton = downHintRef.current;
    const goPreview = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      goToSection("preview");
    };
    downHintButton?.addEventListener("pointerdown", goPreview);
    downHintButton?.addEventListener("click", goPreview);
    return () => {
      downHintButton?.removeEventListener("pointerdown", goPreview);
      downHintButton?.removeEventListener("click", goPreview);
    };
  }, [goToSection]);

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
  const isNight = themeMode === "night";

  const visibleMotion = useMemo<CSSProperties>(
    () => ({
      opacity: uiVisible ? scene1Opacity : 0,
      transform: uiVisible ? "translateY(0)" : "translateY(24px)",
      pointerEvents: scene1Opacity < 0.05 ? "none" : "auto",
    }),
    [scene1Opacity, uiVisible],
  );

  return (
    <main style={{ ...styles.root, background: isNight ? "#000" : styles.root.background }}>
      <div style={{ ...styles.worldLayer, background: isNight ? "#000" : undefined }}>
        <div ref={worldRef} style={styles.worldInner}>
          <img
            src={isNight ? nightWorldBg : WORLD_BG}
            alt=""
            style={{
              ...styles.worldImage,
              filter: isNight ? "contrast(1.08) saturate(0.9)" : styles.worldImage.filter,
            }}
          />
        </div>
      </div>

      <nav style={{ ...styles.nav, padding: isMobile ? "18px 20px" : "26px 40px" }}>
        <Wordmark isMobile={isMobile} onClick={onHome} ariaLabel={t.homeAria} />
        <div style={styles.navActions}>
          <button
            type="button"
            className="neon-control theme-button"
            aria-label={language === "zh" ? "切换白天 / 深夜模式" : "Switch day / night mode"}
            onClick={() => onThemeModeChange(isNight ? "day" : "night")}
          >
            {isNight ? "☀" : "☾"}
          </button>
          {progress < 0.58 ? (
            <>
              <button
                ref={skipRef}
                type="button"
                className="neon-control gateway-skip-control"
                style={{ ...styles.watchDemo, padding: isMobile ? "9px 16px" : "11px 22px" }}
                onClick={() => goToSection("auth")}
              >
                {t.skip}
              </button>
              <UnifiedLanguageButton language={language} onChange={onLanguageChange} />
            </>
          ) : (
              <UnifiedLanguageButton language={language} onChange={onLanguageChange} />
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
              ref={downHintRef}
              type="button"
              onClick={() => goToSection("preview")}
              onPointerDown={() => goToSection("preview")}
              style={{ ...styles.portalDownHint, opacity: scene1Opacity }}
            >
              <span style={{ display: "inline-block", transform: "scaleX(1.45)" }}>↓</span> {t.scrollDown}
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
                <span style={styles.discover}>{t.heroPrefix}</span>{t.heroMain}
                <br />
                {t.heroBrand}
              </h1>
              <p style={styles.heroBody}>
                {t.heroBody}
              </p>
            </div>

            {!isMobile && (
              <div style={styles.partner}>
                <span style={styles.partnerMark}>S.</span>
                <p style={styles.partnerCopy}>{t.partner}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section ref={previewRef} style={{ ...styles.sectionTwo, paddingTop: isMobile ? "12vh" : "14vh" }}>
        <div style={styles.sectionHeader}>
          <h2 style={{ ...styles.sectionTitle, fontSize: "clamp(34px,4vw,52px)" }}>
            {t.previewTitle[0]}
            <br />
            {t.previewTitle[1]}
          </h2>
          <p style={styles.sectionSubtitle}>
            {t.previewSubtitle}
          </p>
        </div>
        <ArcCardCarousel isMobile={isMobile} language={language} />
        <ImmersiveLogin
          isMobile={isMobile}
          onComplete={onComplete}
          authRef={loginRef}
          mode={authMode}
          language={language}
          onModeChange={mode => onAuthModeChange?.(mode)}
        />
        <Footer isMobile={isMobile} language={language} />
      </section>
    </main>
  );
}

function Footer({ isMobile, language }: { isMobile: boolean; language: "zh" | "en" }) {
  const t = gatewayCopy[language];
  const [guideOpen, setGuideOpen] = useState(false);

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
        <div>
          <h3 style={styles.footerTitle}>{language === "zh" ? "探索" : "Explore"}</h3>
          <div style={styles.footerLinks}>
            <button type="button" style={{ ...styles.footerLink, ...styles.footerButtonLink }} onClick={() => setGuideOpen(true)}>
              {t.footerHowItWorks}
            </button>
          </div>
        </div>
        <div>
          <h3 style={styles.footerTitle}>{t.footerContact}</h3>
          <div style={styles.footerLinks}>
            <a href="https://www.xiaohongshu.com/" target="_blank" rel="noreferrer" style={styles.footerLink}>
              {t.footerRed}
            </a>
            <a href={`mailto:${t.footerEmail}`} style={styles.footerLink}>
              {t.footerEmail}
            </a>
          </div>
        </div>
        <div>
          <h3 style={styles.footerTitle}>{t.footerLegal}</h3>
          <div style={styles.footerLinks}>
            <a href={privacyUrl} target="_blank" rel="noreferrer" style={styles.footerLink}>
              {t.footerPrivacy}
            </a>
            <a href={termsUrl} target="_blank" rel="noreferrer" style={styles.footerLink}>
              {t.footerTerms}
            </a>
          </div>
        </div>
      </div>
      {guideOpen && (
        <div style={styles.gatewayModalBackdrop} onMouseDown={(event) => event.target === event.currentTarget && setGuideOpen(false)}>
          <div style={styles.gatewayModal}>
            <button type="button" style={styles.gatewayModalClose} onClick={() => setGuideOpen(false)}>×</button>
            <p style={styles.gatewayModalEyebrow}>StoryVerse Guide</p>
            <h2 style={styles.gatewayModalTitle}>{t.footerHowItWorksTitle}</h2>
            <p style={styles.gatewayModalBody}>{t.footerHowItWorksBody}</p>
          </div>
        </div>
      )}
    </footer>
  );
}

function ImmersiveLogin({ isMobile, onComplete, authRef, mode, language, onModeChange }: {
  isMobile: boolean;
  onComplete: (input: GatewayAuthInput) => Promise<void> | void;
  authRef: RefObject<HTMLElement>;
  mode: "signup" | "login";
  language: "zh" | "en";
  onModeChange: (mode: "signup" | "login") => void;
}) {
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState("");
  const valid = isValidEmailOrChinaPhone(email) && password.length >= 10 && (mode === "login" || nickname.trim().length >= 2);
  const t = gatewayCopy[language];
  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setAuthError("");
    try { await onComplete({ mode, displayName: nickname.trim(), email: email.trim(), password }); }
    catch (error) { setAuthError(error instanceof Error ? error.message : (language === "zh" ? "暂时无法登录，请稍后重试。" : "Unable to sign in. Please try again.")); }
    finally { setSubmitting(false); }
  };

  return (
    <section id="storyverse-auth" ref={authRef} style={{ ...styles.loginSection, padding: isMobile ? "92px 22px 40px" : "132px 44px 36px" }}>
      <div style={{ ...styles.loginPanel, gridTemplateColumns: isMobile ? "1fr" : "1fr 420px", minHeight: isMobile ? "auto" : "min(720px,78vh)" }}>
        <div style={styles.loginCopy}>
          <p style={styles.loginEyebrow}>{t.loginEyebrow}</p>
          <h2 style={{ ...styles.loginTitle, fontSize: isMobile ? 44 : 72 }}>
            <span style={styles.welcomeLight}>{t.welcome}</span>
            <span style={styles.loginWordmarkLine}><LoginWordmark isMobile={isMobile} /></span>
          </h2>
        </div>
        <div style={styles.authCard}>
          <div style={styles.segmented}>
            <button
              style={{ ...styles.segmentButton, background: mode === "signup" ? "#fff" : "transparent", color: mode === "signup" ? "#151515" : "#0b8fe8" }}
              onClick={() => onModeChange("signup")}
            >
              {t.signup}
            </button>
            <button
              style={{ ...styles.segmentButton, background: mode === "login" ? "#fff" : "transparent", color: mode === "login" ? "#151515" : "#0b8fe8" }}
              onClick={() => onModeChange("login")}
            >
              {t.login}
            </button>
          </div>
          {mode === "signup" && (
            <label style={styles.fieldLabel}>
              {t.nickname}
              <input
                style={styles.inputShell}
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                type="text"
                placeholder={t.nicknamePlaceholder}
              />
            </label>
          )}
          <label style={styles.fieldLabel}>
            {t.email}
            <input
              style={styles.inputShell}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="text"
              inputMode="email"
              placeholder={t.emailPlaceholder}
            />
          </label>
          <label style={styles.fieldLabel}>
            {t.password}
            <input
              style={styles.inputShell}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder={mode === "signup" ? t.signupPasswordPlaceholder : t.loginPasswordPlaceholder}
            />
          </label>
          {authError && <p role="alert" style={{ color: "#b42318", fontSize: 13, margin: "0 0 12px" }}>{authError}</p>}
          <button style={{ ...styles.primaryButton, opacity: valid && !submitting ? 1 : 0.48, cursor: valid && !submitting ? "pointer" : "not-allowed" }} disabled={!valid || submitting} onClick={() => void submit()}>
            {submitting ? (language === "zh" ? "正在连接…" : "Connecting…") : mode === "signup" ? t.createAccount : t.enter}
          </button>
          <div style={styles.loginAssist}>
            {mode === "login" && (
              <p style={styles.loginHint}>
                {t.forgotPrefix}{" "}
                <button type="button" style={styles.loginHintLink} onClick={() => setResetOpen(true)}>
                  {t.forgotAction}
                </button>
              </p>
            )}
            <p style={styles.loginHint}>
              {mode === "signup" ? `${t.already} ` : `${t.newHere} `}
              <button type="button" style={styles.loginHintLink} onClick={() => onModeChange(mode === "signup" ? "login" : "signup")}>
                {mode === "signup" ? t.login : t.signup}
              </button>
            </p>
          </div>
        </div>
      </div>
      {resetOpen && <PasswordResetDialog language={language} onClose={() => setResetOpen(false)} />}
    </section>
  );
}

function PasswordResetDialog({ language, onClose }: { language: "zh" | "en"; onClose: () => void }) {
  const t = gatewayCopy[language];
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const canSend = isValidEmailOrChinaPhone(account);
  const canSubmit = canSend && password.length >= 6 && password === confirm && code.trim().length >= 4;

  return (
    <div style={styles.gatewayModalBackdrop} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div style={{ ...styles.gatewayModal, ...styles.resetModal }}>
        <button type="button" style={styles.gatewayModalClose} onClick={onClose}>×</button>
        <p style={styles.gatewayModalEyebrow}>Account Recovery</p>
        <h2 style={styles.gatewayModalTitle}>{t.resetTitle}</h2>
        <p style={styles.gatewayModalBody}>{done ? t.resetDone : t.resetLead}</p>
        {!done && (
          <div style={styles.resetForm}>
            <label style={styles.resetLabel}>{t.resetAccount}<input style={styles.resetInput} value={account} onChange={(event) => setAccount(event.target.value)} placeholder={t.emailPlaceholder} /></label>
            <label style={styles.resetLabel}>{t.resetPassword}<input style={styles.resetInput} value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder={t.signupPasswordPlaceholder} /></label>
            <label style={styles.resetLabel}>{t.resetConfirm}<input style={styles.resetInput} value={confirm} onChange={(event) => setConfirm(event.target.value)} type="password" placeholder={t.resetConfirm} /></label>
            <div style={styles.resetCodeRow}>
              <label style={{ ...styles.resetLabel, margin: 0 }}>{t.resetCode}<input style={styles.resetInput} value={code} onChange={(event) => setCode(event.target.value)} placeholder="123456" /></label>
              <button type="button" style={{ ...styles.resetSecondary, opacity: canSend ? 1 : 0.48 }} disabled={!canSend} onClick={() => setSent(true)}>
                {sent ? (language === "zh" ? "已发送" : "Sent") : t.sendCode}
              </button>
            </div>
            <button type="button" style={{ ...styles.primaryButton, marginTop: 18, opacity: canSubmit ? 1 : 0.48 }} disabled={!canSubmit} onClick={() => setDone(true)}>
              {t.resetSubmit}
            </button>
          </div>
        )}
      </div>
    </div>
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
    gap: 14,
    pointerEvents: "auto",
  },
  watchDemo: {
    position: "relative",
    zIndex: 80,
    border: 0,
    borderRadius: 999,
    background: "#fff",
    color: "#161616",
    fontSize: 13,
    fontWeight: 600,
    transition: "background 0.25s",
    cursor: "pointer",
    pointerEvents: "auto",
    touchAction: "manipulation",
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
    zIndex: 999,
    pointerEvents: "auto",
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
    margin: "50px 0 0",
    color: "#fff",
    fontWeight: 500,
    lineHeight: 1.02,
    letterSpacing: "-0.045em",
    textShadow: "0 2px 24px rgba(0,0,0,0.26)",
  },
  welcomeLight: {
    display: "block",
    fontWeight: 300,
    letterSpacing: "-0.04em",
  },
  loginWordmarkLine: {
    display: "block",
    marginTop: 24,
    transformOrigin: "left center",
  },
  loginWordmarkLoose: {
    display: "inline-flex",
    alignItems: "baseline",
    color: "#fff",
    whiteSpace: "nowrap",
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
    padding: "24px 26px 28px",
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
    marginBottom: 24,
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
    marginTop: 16,
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
    marginTop: 26,
    border: 0,
    borderRadius: 18,
    background: "#0057ff",
    color: "#fff",
    fontSize: 16,
    fontWeight: 800,
    boxShadow: "0 14px 34px rgba(0,87,255,0.34)",
  },
  loginHint: {
    margin: 0,
    textAlign: "center",
    color: "rgba(255,255,255,0.66)",
    fontSize: 13,
  },
  loginAssist: {
    display: "grid",
    gap: 10,
    marginTop: 18,
    justifyItems: "center",
  },
  loginHintLink: {
    border: 0,
    padding: 0,
    background: "transparent",
    color: "#0078ff",
    fontWeight: 800,
    cursor: "pointer",
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
    display: "inline-flex",
    alignItems: "center",
    color: "#fff",
    fontWeight: 500,
    fontSize: 14,
    textDecoration: "none",
  },
  footerButtonLink: {
    border: 0,
    padding: 0,
    background: "transparent",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
  },
  gatewayModalBackdrop: {
    position: "fixed",
    zIndex: 90,
    inset: 0,
    display: "grid",
    placeItems: "center",
    padding: 22,
    background: "rgba(0,28,46,0.34)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },
  gatewayModal: {
    position: "relative",
    width: "min(520px, 92vw)",
    padding: "34px 34px 32px",
    border: "1px solid rgba(255,255,255,0.48)",
    borderRadius: 30,
    color: "#fff",
    background: "linear-gradient(145deg, rgba(18,184,238,0.28), rgba(255,255,255,0.14))",
    boxShadow: "inset 0 1px 1px rgba(255,255,255,0.5), 0 34px 90px rgba(0,57,104,0.28)",
    backdropFilter: "blur(28px) saturate(150%)",
    WebkitBackdropFilter: "blur(28px) saturate(150%)",
  },
  gatewayModalClose: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 38,
    height: 38,
    border: "1px solid rgba(255,255,255,0.44)",
    borderRadius: "50%",
    color: "#fff",
    background: "rgba(255,255,255,0.16)",
    fontSize: 24,
    lineHeight: 1,
    cursor: "pointer",
  },
  gatewayModalEyebrow: {
    margin: 0,
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
  },
  gatewayModalTitle: {
    margin: "12px 0 10px",
    fontSize: 30,
    lineHeight: 1.2,
    letterSpacing: "-0.04em",
  },
  gatewayModalBody: {
    margin: 0,
    color: "rgba(255,255,255,0.76)",
    fontSize: 14,
    lineHeight: 1.75,
  },
  resetModal: {
    width: "min(560px, 92vw)",
  },
  resetForm: {
    display: "grid",
    gap: 14,
    marginTop: 22,
  },
  resetLabel: {
    display: "grid",
    gap: 8,
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    fontWeight: 750,
  },
  resetInput: {
    height: 50,
    padding: "0 16px",
    border: "1px solid rgba(255,255,255,0.42)",
    borderRadius: 16,
    outline: "none",
    color: "#132030",
    background: "rgba(255,255,255,0.86)",
    fontSize: 14,
    fontWeight: 650,
  },
  resetCodeRow: {
    display: "grid",
    gridTemplateColumns: "1fr 138px",
    gap: 12,
    alignItems: "end",
  },
  resetSecondary: {
    height: 50,
    border: "1px solid rgba(255,255,255,0.5)",
    borderRadius: 16,
    color: "#063d5d",
    background: "rgba(255,255,255,0.88)",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
};
