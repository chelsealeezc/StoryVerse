import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, CircleUserRound,
  Compass, Download, Eye, Feather, Flag, Heart, Layers3, LoaderCircle, LogOut, MapPin, Menu, Mic,
  Orbit, RefreshCw, Search, SlidersHorizontal, Sparkles, ThumbsDown, X,
} from "lucide-react";
import { extractHints } from "./ai";
import crayonStylePreview from "./assets/image-styles/crayon.jpg";
import minimalRealisticStylePreview from "./assets/image-styles/minimal-realistic.jpg";
import retroCollageStylePreview from "./assets/image-styles/retro-collage.jpg";
import { guides, icebreakers, mockAnalysis, stories } from "./data";
import { downloadStoryImage, generateStoryImage, type ImageStyle, type StoryHighlight } from "./image";
import { formatCoords, geocodePlace, searchPlaces } from "./places";
import { initialState, loadState, saveState } from "./storage";
import { Auragate as PrototypeGateway } from "./PrototypeGateway";
import { StoryGalaxy } from "./StoryGalaxy";
import type { PlaceSuggestion } from "./places";
import type { AppState, Draft, Language, Reaction, ResonanceMode, Story } from "./types";

type ThemeMode = "day" | "night";

const themeColors: Record<string, string> = {
  家庭: "#ff5b45", 成长: "#b8eb00", 迁移: "#1769ff", 关系: "#ffcc23",
  工作: "#151515", 身份: "#9f7aea",
};

const imageStyleOptions: Array<{
  id: ImageStyle;
  label: string;
  description: string;
  preview: string;
}> = [
  { id: "crayon", label: "卡通蜡笔风", description: "笨拙涂鸦、蜡笔线条与俏皮手绘感", preview: crayonStylePreview },
  { id: "minimal-realistic", label: "简约写实风", description: "扁平丝网印刷、颗粒肌理与高饱和留白", preview: minimalRealisticStylePreview },
  { id: "retro-collage", label: "复古拼贴风", description: "撕纸层次、粉彩纸纹与温暖编辑感", preview: retroCollageStylePreview },
];

const PORTAL_BG = "https://res.cloudinary.com/dy5er7kv5/image/upload/q_auto/f_auto/v1781046673/image_1_ksxfzb.png";
const WORLD_BG = "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260609_231253_53c0854c-d13c-42c1-9fc0-17e87cd34091.png&w=1280&q=85";

const blankPrompts = [
  "今天想分享哪段对你影响深远的经历？",
  "有没有一件事，让现在的你和以前不一样？",
  "没有思路？看一下旁边的例子吧～=(^.^)=",
];

const routeMap = {
  intro: "/",
  storyStart: "/StoryStart",
  storyWrite: "/StoryWrite",
  storyAnalyzing: "/StoryAnalyzing",
  storyPage: "/StoryPage",
  resonance: "/Resonance",
  recommendations: "/Recommendations",
  starLobby: "/StarLobby",
} as const;
const appBase = import.meta.env.BASE_URL.replace(/\/$/, "");

function externalPath(path: string) {
  return appBase && appBase !== "/" ? `${appBase}${path === "/" ? "/" : path}` : path;
}

function normalizedPath(pathname = window.location.pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path.startsWith("/StoryVerse/") ? path.slice("/StoryVerse".length) || "/" : path;
}

function routePatchFromPath(pathname = window.location.pathname): Partial<AppState> & { gatewaySection?: "intro" | "preview" | "auth"; authMode?: "signup" | "login" } {
  const path = normalizedPath(pathname);
  if (path === routeMap.storyStart) return { screen: "wizard", wizardStep: 0 };
  if (path === routeMap.storyWrite) return { screen: "wizard", wizardStep: 1 };
  if (path === routeMap.storyAnalyzing) return { screen: "wizard", wizardStep: 2 };
  if (path === routeMap.storyPage) return { screen: "wizard", wizardStep: 3 };
  if (path === routeMap.resonance) return { screen: "resonance" };
  if (path === routeMap.recommendations) return { screen: "recommendations" };
  if (path === routeMap.starLobby) return { screen: "atlas" };
  return { screen: "intro", gatewaySection: "intro" };
}

function pathFromState(state: AppState, gatewaySection: "intro" | "preview" | "auth", authMode: "signup" | "login") {
  if (state.screen === "wizard") {
    return [routeMap.storyStart, routeMap.storyWrite, routeMap.storyAnalyzing, routeMap.storyPage][state.wizardStep] ?? routeMap.storyStart;
  }
  if (state.screen === "resonance") return routeMap.resonance;
  if (state.screen === "recommendations") return routeMap.recommendations;
  if (state.screen === "atlas") return routeMap.starLobby;
  void gatewaySection;
  void authMode;
  return routeMap.intro;
}

const copy = {
  zh: {
    backWarmup: "返回暖场星空", journeyStart: "你的旅程从这里开始", authLead: "创建账户后，写下第一个正式故事，才能进入故事星图。",
    signup: "注册", login: "登录", localDemo: "这是 localhost 演示，不会发送真实邮件或保存真实密码。",
    createAccount: "创建你的故事账户", welcomeBack: "欢迎回来", email: "邮箱", password: "密码", passwordHint: "至少 6 位",
    agree: "我同意服务条款与隐私说明", startWriting: "创建账户，写第一个故事", enter: "进入 StoryVerse",
    privacy: "你的解释权始终属于你。", privacySub: "AI 只整理标签，不会改写你的正文。",
    guideStep: "第一步 · 故事的开始", guideTitle: "你最想讲的那个故事是什么？", guideSub: "选择一个你喜欢的开头吧",
    customGuide: "写下你的故事入口", customGuidePlaceholder: "比如：一次迟来的道歉 / 我第一次真正离开家", continueWithPrompt: "带着这个提示继续",
    changeGuide: "换一个引导", focus: "专注模式", saved: "草稿已保存", storyStep: "第二步 · Story Collection",
    storyH1: "顺着想法，慢慢写。", title: "标题", optional: "选填", titleHint: "不用着急取标题，先顺着想法写一些吧",
    yourStory: "你的故事", count: "建议 100–1500 字", gentleTip: "这段记忆已经有了开头。再多写一点细节，AI 会更容易理解它。",
    restTip: "需要休息一下吗？你的草稿已自动保存。", mood: "写完后的感受", occurred: "故事发生在", city: "城市",
    lifeStage: "当时的人生阶段", people: "故事里有谁？", multi: "可多选", prev: "上一步", ai: "故事写好了",
    pasteTitle: "这是你以前写的内容吗？可以选择其他输入方式哦。", pasteYes: "是", pasteOther: "尝试别的输入方式",
    leaveTitle: "你的故事尚未完成，是否保存草稿？", saveDraft: "保存草稿", leaveAnyway: "直接离开", keepWriting: "继续写",
    finalSay: "你的故事页面", confirmTitle: "确认后，它会成为 StoryVerse 里的一颗星。", storyTitle: "故事标题", editBody: "修改正文", doneEdit: "完成修改",
    publish: "点亮我的故事星点", backToTraits: "返回故事特质", storyPublished: "故事已发布", resonanceTitle: "你希望在 StoryVerse 里看到和你相似还是不同的故事？",
    resonanceSub: "", findStories: "进入 StoryVerse",
    explore: "探索故事", mine: "我的故事", resonance: "共鸣选择", liked: "喜欢记录", writeNew: "写下新故事", reset: "重置演示",
    atlasTitle: "今天，想走进哪一种人生？", visibleStories: "可见故事", themeGalaxies: "主题星系", search: "搜索情绪、城市、主题或人生转折",
    map: "星图", cards: "卡片", filter: "筛选", all: "全部", similarEcho: "相似的回声", differentLives: "不同的人生", minutes: "分钟阅读",
    dimension: "", similar: "相近", different: "不同",
  },
  en: {
    backWarmup: "Back to warm-up", journeyStart: "Your journey starts here", authLead: "Create an account and write your first story to enter the atlas.",
    signup: "Sign up", login: "Log in", localDemo: "This localhost demo does not send real email or store real passwords.",
    createAccount: "Create your story account", welcomeBack: "Welcome back", email: "Email", password: "Password", passwordHint: "At least 6 characters",
    agree: "I agree to the Terms and Privacy Notice", startWriting: "Create account and write", enter: "Enter StoryVerse",
    privacy: "Your interpretation stays yours.", privacySub: "AI organizes tags, but never rewrites your story.",
    guideStep: "Step 1 · Find an entry point", guideTitle: "Which moment is calling you?", guideSub: "This is not a test. It simply gives memory a place to begin.",
    customGuide: "Write your own entry point", customGuidePlaceholder: "Example: a late apology / the first time I truly left home", continueWithPrompt: "Continue with this prompt",
    changeGuide: "Change prompt", focus: "Focus mode", saved: "Draft saved", storyStep: "Step 2 · Story Collection",
    storyH1: "Follow the thought, slowly.", title: "Title", optional: "Optional", titleHint: "No need to title it yet. Start with the thought.",
    yourStory: "Your story", count: "Suggested 100-1500 words", gentleTip: "This memory has a beginning. Add a few details so AI can understand it better.",
    restTip: "Need a pause? Your draft has been saved.", mood: "How you feel after writing", occurred: "When it happened", city: "City",
    lifeStage: "Life stage then", people: "Who is in the story?", multi: "Multiple", prev: "Previous", ai: "Let AI organize",
    pasteTitle: "Is this something you wrote before? You can choose another input method.", pasteYes: "Yes", pasteOther: "Try another input method",
    leaveTitle: "Your story is not finished. Save it as a draft?", saveDraft: "Save draft", leaveAnyway: "Leave anyway", keepWriting: "Keep writing",
    finalSay: "Step 4 · The final say is yours", confirmTitle: "Confirm your story star.", storyTitle: "Story title", editBody: "Edit body", doneEdit: "Done editing",
    publish: "Light up my story star", backToTraits: "Back to story traits", storyPublished: "Story published", resonanceTitle: "What kind of echoes do you want to hear next?",
    resonanceSub: "Choose three directions. Difference still keeps one understandable connection.", findStories: "Enter StoryVerse",
    explore: "Explore", mine: "My stories", resonance: "Resonance", liked: "Likes", writeNew: "Write new story", reset: "Reset demo",
    atlasTitle: "Which life do you want to enter today?", visibleStories: "Visible stories", themeGalaxies: "Theme galaxies", search: "Search emotions, cities, themes, or turning points",
    map: "Map", cards: "Cards", filter: "Filters", all: "All", similarEcho: "Similar echoes", differentLives: "Different lives", minutes: "min read",
    dimension: "Resonance dimension", similar: "Similar to me", different: "Different from me",
  },
} satisfies Record<Language, Record<string, string>>;

function LanguageSelect({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return <button type="button" className="neon-control lang-button app-lang-button" aria-label={language === "zh" ? "切换语言" : "Switch language"} onClick={() => onChange(language === "zh" ? "en" : "zh")}>
    <span className={language === "zh" ? "lang-primary" : "lang-secondary"}>中文</span>
    <span className="lang-divider" />
    <span className={language === "en" ? "lang-primary" : "lang-secondary"}>ENG</span>
  </button>;
}

function ThemeToggle({ language, themeMode, onChange }: { language: Language; themeMode: ThemeMode; onChange: (themeMode: ThemeMode) => void }) {
  return <button type="button" className="neon-control theme-button app-theme-button" aria-label={language === "zh" ? "切换白天 / 深夜模式" : "Switch day / night mode"} onClick={() => onChange(themeMode === "night" ? "day" : "night")}>
    {themeMode === "night" ? "☀" : "☾"}
  </button>;
}

function Logo({ compact = false, onClick, inverted = false }: { compact?: boolean; onClick?: () => void; inverted?: boolean }) {
  const content = <><span className="logo-mark">✦</span>{!compact && <span>StoryVerse</span>}</>;
  if (onClick) {
    return <button className={`logo logo-button ${inverted ? "logo-inverted" : ""}`} onClick={onClick} aria-label="回到 StoryVerse 首页">{content}</button>;
  }
  return <div className={`logo ${inverted ? "logo-inverted" : ""}`}>{content}</div>;
}

function Pill({ children, tone = "default" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function PrimaryButton({ children, onClick, disabled = false, className = "" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string;
}) {
  return <button className={`button button-primary ${className}`} onClick={onClick} disabled={disabled}>{children}<ArrowRight size={18} /></button>;
}

function Intro({ onContinue }: { onContinue: () => void }) {
  const lines = [
    "欢迎进入 StoryVerse。",
    "这里不是用来证明人生足够精彩的地方。",
    "我们只收集那些真实发生过、仍在你身体里发光的片段。",
    "你可以先旁观，也可以稍后写下自己的第一颗星。",
  ];
  return (
    <main className="intro-page">
      <button className="intro-skip" onClick={onContinue}>我晕字，让我跳过</button>
      <section className="intro-hero" aria-label="StoryVerse intro">
        <div className="intro-eye"><Eye size={58} /></div>
        <div className="intro-terminal">
          <p className="intro-kicker">《StoryVerse · 入境须知》</p>
          {lines.map((line, index) => (
            <p key={line} className="intro-line" style={{ animationDelay: `${0.4 + index * 1.05}s` }}>
              {line}
            </p>
          ))}
          <div className="intro-rule" style={{ animationDelay: `${0.4 + lines.length * 1.05}s` }}>
            - 在这里，你的故事不需要完整，也不需要正确。只需要有一处是真的。
          </div>
        </div>
        <button className="intro-accept" onClick={onContinue}>[ 我接受这个宇宙 ]</button>
      </section>
    </main>
  );
}

function Preview({ onStart, onLogin }: { onStart: () => void; onLogin: () => void }) {
  const previewStories = stories.slice(0, 6);
  return (
    <main className="preview-page">
      <header className="preview-topbar">
        <Logo />
        <div>
          <button className="button button-ghost" onClick={onLogin}>登录 / 注册</button>
        </div>
      </header>
      <section className="preview-hero">
        <Pill tone="lime">PREVIEW · 先尝鲜看看</Pill>
        <h1>先听见别人的星，<br />再决定要不要<span className="serif">点亮自己。</span></h1>
        <p>你可以先浏览平台里的故事基调：迁移、关系、成长、告别、边界。等你准备好，再写下自己的第一则故事。</p>
        <PrimaryButton onClick={onStart}>开始写我的故事</PrimaryButton>
      </section>
      <section className="preview-gallery" aria-label="StoryVerse preview stories">
        {previewStories.map((story, index) => (
          <article className={`preview-story preview-story-${index}`} key={story.id}>
            <div className="preview-story-glow" style={{ background: themeColors[story.theme] }} />
            <div className="preview-story-meta"><Pill>{story.theme}</Pill><span>{story.city} · {story.stage}</span></div>
            <h2>{story.title}</h2>
            <p>{story.excerpt}</p>
            <footer><span>{story.emotion}</span><span>{story.readMinutes} 分钟阅读</span></footer>
          </article>
        ))}
      </section>
    </main>
  );
}

function GatewayLanding({ language, onLanguageChange, onComplete }: { language: Language; onLanguageChange: (language: Language) => void; onComplete: () => void }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [agreed, setAgreed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [uiVisible, setUiVisible] = useState(false);
  const introRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const authRef = useRef<HTMLElement>(null);
  const valid = email.includes("@") && password.length >= 6 && (mode === "login" || agreed);
  const t = copy[language];
  const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const easeInOut = (value: number) => value < 0.5 ? 2 * value * value : -1 + (4 - 2 * value) * value;
  const easedProgress = easeInOut(scrollProgress);
  const portalOpacity = scrollProgress <= 0.66 ? 1 : clamp(1 - (scrollProgress - 0.66) / 0.22);
  const sceneOpacity = clamp(1 - scrollProgress / 0.22);
  const portalScale = 1 + (7.5 - 1) * easedProgress;
  const worldScale = 1 + (1.16 - 1) * easedProgress;
  const lineGroups = [
    ["有没有一件事", "即使过去很多年", "你仍然会向别人讲起？"],
    ["有没有一个决定", "改变了你后来的人生？"],
    ["世界很大", "我们不怕不同的观点", "只怕只能听见一种声音"],
    ["在 StoryVerse", "你可能会看到和你天差地别的故事", "又会发现那个远隔重洋的陌生朋友", "和你当时的心境如此相似"],
    ["欢迎来到这里", "和千万种声音共鸣", "更看到不同的人生"],
  ];
  const scrollTo = (target: React.RefObject<HTMLElement | null>) => target.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  useEffect(() => {
    const reveal = window.setTimeout(() => setUiVisible(true), 420);
    return () => window.clearTimeout(reveal);
  }, []);

  useEffect(() => {
    let frame = 0;
    const paint = () => {
      frame = 0;
      if (!introRef.current) return;
      const max = Math.max(1, window.innerHeight);
      setScrollProgress(clamp(window.scrollY / max));
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(paint); };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <main
      className="gateway-page"
      style={{
        "--portal-scale": portalScale,
        "--world-scale": worldScale,
        "--portal-opacity": portalOpacity,
        "--scene-opacity": sceneOpacity,
      } as React.CSSProperties}
    >
      <div className="gateway-world-bg" aria-hidden="true">
        <div className="gateway-world-inner" style={{ backgroundImage: `url(${WORLD_BG})` }} />
      </div>
      <nav className="gateway-nav">
        <Logo />
        <div className="gateway-nav-actions">
          <LanguageSelect language={language} onChange={onLanguageChange} />
          <button className="gateway-pill" onClick={() => scrollTo(authRef)}>登录 / 注册</button>
        </div>
      </nav>

      <section className="gateway-intro-track" ref={introRef}>
        <div className="gateway-window gateway-section">
          <button className="gateway-skip" onClick={() => scrollTo(previewRef)}>跳过 intro</button>
          <div className="porthole">
            <img className="gateway-portal-img" src={PORTAL_BG} alt="" />
            <div className="porthole-glass">
              <div className="porthole-orbit orbit-a" />
              <div className="porthole-orbit orbit-b" />
              <div className={`gateway-copy-rotator ${uiVisible ? "visible" : ""}`}>
                {lineGroups.map((group, groupIndex) => (
                  <div className="gateway-copy-group" style={{ animationDelay: `${groupIndex * 4.8}s` }} key={group.join("")}>
                    {group.map((line, lineIndex) => <p key={line} style={{ "--line-delay": `${lineIndex * .18}s` } as React.CSSProperties}>{line}</p>)}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <button className="gateway-scroll" onClick={() => scrollTo(previewRef)}>向下看故事生态</button>
        </div>
      </section>

      <section className="gateway-preview gateway-section" ref={previewRef}>
        <div className="gateway-section-head">
          <Pill tone="blue">PREVIEWING · 先听见几种人生</Pill>
          <h1>故事不是答案，<br />是通往别人世界的<span className="serif">舷窗。</span></h1>
          <p>先看看几则典型故事：有人离开一座城市，有人重新理解家人，也有人在关系结束后学会告别。</p>
        </div>
        <div className="gateway-story-rail">
          {stories.slice(0, 7).map((story, index) => (
            <article className={`gateway-story-card card-${index}`} key={story.id}>
              <span className="gateway-card-index">0{index + 1}</span>
              <div className="gateway-card-sky" />
              <Pill>{story.theme}</Pill>
              <h2>{story.title}</h2>
              <p>{story.excerpt}</p>
              <footer><span>{story.city} · {story.stage}</span><span>{story.emotion}</span></footer>
            </article>
          ))}
        </div>
        <button className="gateway-scroll gateway-scroll-dark" onClick={() => scrollTo(authRef)}>继续，创建我的入口</button>
      </section>

      <section className="gateway-auth gateway-section" ref={authRef}>
        <div className="gateway-auth-card">
          <div className="gateway-auth-visual">
            <div className="auth-eye"><Eye size={56} /></div>
            <p className="eyebrow">STORYVERSE OBSERVATION HUB</p>
            <h1>StoryVerse</h1>
            <p>登录后，你会写下第一则故事。它会被整理成一颗星，也会带你进入更多真实人生的坐标。</p>
          </div>
          <div className="auth-form gateway-auth-form">
            <div className="segmented">
              <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>{t.signup}</button>
              <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>{t.login}</button>
            </div>
            <div className="form-heading">
              <Pill tone="blue">LOCAL DEMO</Pill>
              <h2>{mode === "signup" ? t.createAccount : t.welcomeBack}</h2>
              <p>{t.localDemo}</p>
            </div>
            <label>{t.email}<input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@example.com" /></label>
            <label>{t.password}<input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder={t.passwordHint} /></label>
            {mode === "signup" && <label className="checkbox-row"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} /><span>{t.agree}</span></label>}
            <PrimaryButton disabled={!valid} onClick={onComplete}>{mode === "signup" ? t.startWriting : t.enter}</PrimaryButton>
            <div className="privacy-note"><Sparkles size={18} /><span><strong>{t.privacy}</strong><br />{t.privacySub}</span></div>
          </div>
        </div>
      </section>
    </main>
  );
}

function Icebreaker({ onContinue }: { onContinue: () => void }) {
  const [selected, setSelected] = useState(icebreakers[0]);
  return (
    <main className="ice-page">
      <header className="topbar"><Logo /><Pill tone="lime">浏览功能 · 不计入首故事</Pill></header>
      <section className="ice-hero">
        <div className="hero-copy">
          <p className="eyebrow">欢迎来到故事的宇宙</p>
          <h1>每一颗星星，<br />都来自一个<span className="serif">真实的人。</span></h1>
          <p className="hero-body">有些故事很小，有些故事改变了一生。这里没有“正确的故事”，它们不需要完美，只需要是真实的。</p>
          <PrimaryButton onClick={onContinue}>开始我的旅程</PrimaryButton>
        </div>
        <div className="ice-orbit" aria-label="Icebreaker 故事星图">
          <div className="orbit-ring ring-a" />
          <div className="orbit-ring ring-b" />
          <div className="orbit-center">听见<br /><em>真实</em></div>
          {icebreakers.map((item, index) => (
            <button
              key={item.id}
              className={`ice-star ice-star-${index} ${selected.id === item.id ? "active" : ""}`}
              onClick={() => setSelected(item)}
              aria-label={item.question}
            ><span /></button>
          ))}
          <article className="ice-card">
            <div className="card-number">0{icebreakers.indexOf(selected) + 1} / 0{icebreakers.length}</div>
            <Pill>{selected.tag}</Pill>
            <h2>{selected.question}</h2>
            <p>{selected.answer}</p>
            <div className="card-nav">
              <button onClick={() => setSelected(icebreakers[(icebreakers.indexOf(selected) + icebreakers.length - 1) % icebreakers.length])}><ArrowLeft size={17} /></button>
              <button onClick={() => setSelected(icebreakers[(icebreakers.indexOf(selected) + 1) % icebreakers.length])}><ArrowRight size={17} /></button>
            </div>
          </article>
        </div>
      </section>
      <div className="principle-strip">
        <span>匿名展示</span><span>城市级标签</span><span>故事可撤回</span><span>AI 不替你写作</span>
      </div>
    </main>
  );
}

function Auth({ language, onLanguageChange, onComplete, onBack }: { language: Language; onLanguageChange: (language: Language) => void; onComplete: () => void; onBack: () => void }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [agreed, setAgreed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const valid = email.includes("@") && password.length >= 6 && (mode === "login" || agreed);
  const t = copy[language];
  return (
    <main className="auth-page">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> 返回预览</button>
      <div className="auth-language"><LanguageSelect language={language} onChange={onLanguageChange} /></div>
      <section className="auth-shell auth-shell-minimal">
        <div className="auth-brand">
          <Logo />
          <div>
            <div className="auth-eye"><Eye size={56} /></div>
            <p className="eyebrow">STORYVERSE OBSERVATION HUB</p>
            <h1>StoryVerse</h1>
            <p>登录后，你可以写下第一则故事。它会被整理成一颗星，也会带你进入更多真实人生的坐标。</p>
          </div>
          <div className="mini-orbits"><span /><span /><span /><i>✦</i></div>
        </div>
        <div className="auth-form">
          <div className="segmented">
            <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>{t.signup}</button>
            <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>{t.login}</button>
          </div>
          <div className="form-heading">
            <Pill tone="lime">LOCAL DEMO</Pill>
            <h2>{mode === "signup" ? t.createAccount : t.welcomeBack}</h2>
            <p>{t.localDemo}</p>
          </div>
          <label>{t.email}<input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@example.com" /></label>
          <label>{t.password}<input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder={t.passwordHint} /></label>
          {mode === "signup" && (
            <label className="checkbox-row"><input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} /><span>{t.agree}</span></label>
          )}
          <PrimaryButton disabled={!valid} onClick={onComplete}>{mode === "signup" ? t.startWriting : t.enter}</PrimaryButton>
          <div className="privacy-note"><Sparkles size={18} /><span><strong>{t.privacy}</strong><br />{t.privacySub}</span></div>
        </div>
      </section>
    </main>
  );
}

type AppUpdate = (patch: Partial<AppState> | ((previous: AppState) => Partial<AppState>)) => void;

const guideById = (id: string) => guides.find(guide => guide.id === id) ?? null;

function activeGuide(draft: Draft) {
  const guide = guideById(draft.guide);
  if (!guide) return null;
  if (guide.id !== "other") return guide;
  const custom = draft.customGuide.trim();
  return custom
    ? { ...guide, prompt: custom, examples: "这是你自己写下的入口，怎么讲都可以。" }
    : guide;
}

function GuideStack({ draft, setDraft }: { draft: Draft; setDraft: (patch: Partial<Draft>) => void }) {
  const previousIndex = useRef(Math.max(0, guides.findIndex(guide => guide.id === draft.guide)));
  const currentIndex = Math.max(0, guides.findIndex(guide => guide.id === draft.guide));

  useEffect(() => {
    previousIndex.current = currentIndex;
  }, [currentIndex]);

  return (
    <div
      className="guide-panels"
      style={{ "--active": currentIndex } as React.CSSProperties}
      aria-label="人生事件引导选择"
    >
      {guides.map((guide, i) => {
        const selected = draft.guide === guide.id;
        const fromLeft = currentIndex >= previousIndex.current;
        return (
          <div
            role="button"
            tabIndex={0}
            key={guide.id}
            className={`guide-panel ${selected ? "selected" : ""} ${fromLeft ? "from-left" : "from-right"}`}
            onClick={() => setDraft({ guide: guide.id })}
            onKeyDown={event => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setDraft({ guide: guide.id });
              }
            }}
            aria-expanded={selected}
          >
            <div className="guide-content">
              <div className="guide-main">
                <div className="guide-top">
                  <span className="guide-icon">{guide.icon}</span>
                  <small>0{i + 1} / 0{guides.length}</small>
                </div>
                <h2>{guide.title}</h2>
                <em>{guide.en}</em>
                <p>{guide.prompt}</p>
              </div>
              <div className="guide-side">
                {guide.id === "other" ? (
                  <label className="guide-custom">你想讲的是哪一种时刻？
                    <input
                      value={draft.customGuide}
                      maxLength={40}
                      placeholder="例如：一次没有人知道的坚持"
                      onClick={event => event.stopPropagation()}
                      onFocus={() => setDraft({ guide: "other" })}
                      onChange={event => setDraft({ customGuide: event.target.value, guide: "other" })}
                    />
                  </label>
                ) : <footer>{guide.examples}</footer>}
                <span className="guide-pick">
                  {selected ? <><Check size={16} /> 已选择</> : "选择这个入口"}
                </span>
              </div>
            </div>
            <div className="small-title" aria-hidden="true">
              <span>{guide.icon}</span>
              <p>{guide.title}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CityField({ draft, setDraft, label }: { draft: Draft; setDraft: (patch: Partial<Draft>) => void; label: string }) {
  const [query, setQuery] = useState(draft.city);
  const [options, setOptions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const committed = useRef(draft.city);

  useEffect(() => { setQuery(draft.city); }, [draft.city]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchPlaces(query).then(result => {
        if (!alive) return;
        setOptions(result);
        setActive(0);
        setLoading(false);
      });
    }, 220);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [query, open]);

  const pick = (place: PlaceSuggestion) => {
    setDraft({ city: place.name, cityEn: place.en, cityCountry: place.country, cityLat: place.lat, cityLon: place.lon });
    setQuery(place.name);
    setOpen(false);
  };
  const commitText = (text: string) => {
    const value = text.trim();
    if (value === draft.city) return;
    setDraft({ city: value, cityEn: "", cityCountry: "", cityLat: null, cityLon: null });
    committed.current = value;
    if (!value) return;
    geocodePlace(value).then(point => {
      if (point && committed.current === value) setDraft({ cityLat: point.lat, cityLon: point.lon });
    });
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open || options.length === 0) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((active + 1) % options.length); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((active - 1 + options.length) % options.length); }
    else if (event.key === "Enter") { event.preventDefault(); pick(options[active] ?? options[0]); }
    else if (event.key === "Escape") setOpen(false);
  };

  return (
    <label><span className="field-name">{label} <small>（海内外都可以填）</small></span>
      <div className="city-field">
        <input
          value={query}
          placeholder="输入城市名，例如 北京 / Tokyo"
          role="combobox"
          aria-expanded={open}
          autoComplete="off"
          onChange={event => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          onBlur={() => { window.setTimeout(() => setOpen(false), 120); commitText(query); }}
        />
        <MapPin size={16} className="field-icon" />
        {open && (options.length > 0 || loading) && (
          <div className="city-options">
            {options.map((place, i) => (
              <button
                key={place.id}
                className={i === active ? "active" : ""}
                onMouseDown={event => event.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(place)}
              ><b>{place.name}</b><span>{place.detail}</span></button>
            ))}
            {loading && <p className="city-loading">正在检索…</p>}
          </div>
        )}
      </div>
      <span className="city-coords">
        {!draft.city ? "" : draft.cityLat !== null
          ? <>已解析坐标 {formatCoords(draft.cityLat, draft.cityLon)} · 用于星图定位</>
          : <>这个地名暂时没查到坐标，仍然可以继续</>}
      </span>
    </label>
  );
}

function Wizard({ state, update, onPublished, onHome, themeMode, onThemeModeChange }: {
  state: AppState; update: AppUpdate; onPublished: () => void; onHome: () => void; themeMode: ThemeMode; onThemeModeChange: (themeMode: ThemeMode) => void;
}) {
  const step = state.wizardStep;
  const draft = state.draft;
  const language = state.language;
  const t = copy[language];
  const [analysisStage, setAnalysisStage] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [idlePromptIndex, setIdlePromptIndex] = useState(0);
  const [resting, setResting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "editing" | "saved">(draft.savedAt ? "saved" : "idle");
  const [pasteDialog, setPasteDialog] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<number | null>(null);
  const [editingBody, setEditingBody] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [tagDrafts, setTagDrafts] = useState<Record<string, string[]>>({});
  const [imageStyle, setImageStyle] = useState<ImageStyle>("minimal-realistic");
  const [storyImage, setStoryImage] = useState("");
  const [storyHighlight, setStoryHighlight] = useState<StoryHighlight | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageStatus, setImageStatus] = useState<"idle" | "generating" | "ready" | "failed">("idle");
  const [imageError, setImageError] = useState("");
  const hints = useMemo(() => extractHints(draft.body), [draft.body]);
  const mounted = useRef(false);

  const setDraft = (patch: Partial<Draft>) => update(previous => ({ draft: { ...previous.draft, ...patch } }));
  const runImageGeneration = async () => {
    if (!state.analysis) return;
    setImageStatus("generating");
    setImageError("");
    try {
      const result = await generateStoryImage(draft, state.analysis, imageStyle, Object.values(tagDrafts).flat());
      setStoryImage(result.imageUrl);
      setStoryHighlight(result.highlight);
      setImagePrompt(result.imagePrompt);
      setImageStatus("ready");
    } catch (error) {
      setImageStatus("failed");
      setImageError(error instanceof Error ? error.message : "图片生成失败，请稍后重试。");
    }
  };
  const chooseImageStyle = (nextStyle: ImageStyle) => {
    if (nextStyle === imageStyle) return;
    setImageStyle(nextStyle);
    setStoryImage("");
    setStoryHighlight(null);
    setImagePrompt("");
    setImageStatus("idle");
    setImageError("");
  };
  useEffect(() => {
    const timer = window.setInterval(() => {
      update(previous => ({ draft: { ...previous.draft, saves: previous.draft.saves + 1, savedAt: Date.now() } }));
    }, 20000);
    return () => clearInterval(timer);
  }, [update]);
  const contentKey = [draft.title, draft.body, draft.mood, draft.time, draft.stage, draft.age, draft.city, draft.people.join(",")].join("\u0000");
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (!draft.title && !draft.body) return;
    setSaveStatus("editing");
    const timer = window.setTimeout(() => {
      setDraft({ savedAt: Date.now(), saves: draft.saves + 1 });
      setSaveStatus("saved");
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [contentKey]);
  useEffect(() => {
    if (step !== 1) return;
    const timer = window.setInterval(() => setIdlePromptIndex(index => (index + 1) % blankPrompts.length), 5000);
    return () => clearInterval(timer);
  }, [step]);
  useEffect(() => {
    if (step !== 1 || !draft.body.trim()) {
      setResting(false);
      return;
    }
    const timer = window.setTimeout(() => setResting(true), 18000);
    return () => clearTimeout(timer);
  }, [step, draft.body, draft.edits]);
  useEffect(() => {
    if (step !== 1 || !draft.body.trim()) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [step, draft.body]);
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setFocusMode(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusMode]);
  useEffect(() => {
    if (!focusMode || step !== 1) return;
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    return () => window.cancelAnimationFrame(frame);
  }, [focusMode, step]);
  useEffect(() => {
    if (step !== 2) return;
    setAnalysisStage(0);
    const timers = [650, 1400, 2200].map((time, i) => window.setTimeout(() => setAnalysisStage(i + 1), time));
    const done = window.setTimeout(() => update({ analysis: mockAnalysis }), 2500);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  }, [step]);
  useEffect(() => {
    if (!state.analysis) return;
    setTagDrafts(Object.fromEntries(Object.entries(state.analysis.tags).map(([layer, tags]) => [layer, tags.slice(0, 3)])));
  }, [state.analysis]);

  const choosePerson = (person: string) => {
    const people = draft.people.includes(person) ? draft.people.filter(p => p !== person) : [...draft.people, person];
    setDraft({ people });
  };
  const selectedGuide = guides.find(g => g.id === draft.guide);
  const guide = activeGuide(draft);
  const guidePrompt = guide?.prompt;
  const hasUnfinishedStory = draft.body.trim().length > 0 && step === 1;
  const requestStep = (nextStep: number) => {
    if (hasUnfinishedStory && nextStep < step) setLeaveTarget(nextStep);
    else update({ wizardStep: nextStep });
  };
  const saveCurrentDraft = () => {
    if (!draft.body.trim() && !draft.title.trim() && !draft.customGuide.trim()) return;
    update(previous => ({
      draftBox: [{ ...previous.draft, id: crypto.randomUUID(), savedAt: Date.now() }, ...previous.draftBox],
      draft: { ...previous.draft, saves: previous.draft.saves + 1, savedAt: Date.now() },
    }));
  };
  const confirmLeave = (save: boolean) => {
    if (save) saveCurrentDraft();
    if (leaveTarget !== null) update({ wizardStep: leaveTarget });
    setLeaveTarget(null);
  };
  const missingCollection = [
    draft.body.trim().length < 100 ? "故事至少 100 字" : "",
    !draft.mood ? "选择写完后的感受" : "",
    !draft.time ? "选择故事发生时间" : "",
    !draft.city ? "选择城市" : "",
    draft.people.length === 0 ? "选择故事里有谁" : "",
  ].filter(Boolean);
  const canContinueCollection = missingCollection.length === 0;
  const canContinueGuide = !!draft.guide && (draft.guide !== "other" || draft.customGuide.trim().length >= 2);
  const savedTime = draft.savedAt ? new Date(draft.savedAt).toLocaleTimeString(language === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit" }) : "";
  const showCityHint = !!hints.city && hints.city.name !== draft.city;
  const showAgeHint = hints.age !== null && String(hints.age) !== draft.age;
  const presetTags: Record<string, string[]> = {
    topic: ["成长", "关系", "迁移", "家庭", "身份"],
    emotion: ["平静", "释然", "想念", "勇敢", "遗憾"],
    meaning: ["自我理解", "边界", "选择", "告别", "重新开始"],
  };
  const removeTag = (layer: string, tag: string) => setTagDrafts(previous => ({ ...previous, [layer]: (previous[layer] ?? []).filter(item => item !== tag) }));
  const addTag = (layer: string, custom = false) => setTagDrafts(previous => {
    const current = previous[layer] ?? [];
    if (current.length >= 3) return previous;
    const nextTag = custom ? "其他" : (presetTags[layer] ?? []).find(tag => !current.includes(tag)) ?? "其他";
    return { ...previous, [layer]: current.includes(nextTag) ? current : [...current, nextTag].slice(0, 3) };
  });

  return (
    <main className={`wizard-page ${themeMode === "night" ? "theme-night" : ""} ${focusMode && step === 1 ? "focus-mode-page" : ""}`}>
      {!(focusMode && step === 1) && <header className="wizard-header app-shell-header">
        <Logo onClick={onHome} />
        <div />
        <div className="wizard-tools"><ThemeToggle language={language} themeMode={themeMode} onChange={onThemeModeChange} /><LanguageSelect language={language} onChange={language => update({ language })} /></div>
      </header>}

      {step === 0 && (
        <section className="wizard-stage">
          <div className="section-intro guide-intro-copy"><p className="eyebrow">{t.guideStep}</p><h1>{language === "zh" ? <>你最想讲的<br />那个故事是什么？</> : t.guideTitle}</h1><p>{t.guideSub}</p></div>
          <GuideStack draft={draft} setDraft={setDraft} />
          <div className="stack-actions">
            <div className="stack-status">
              {guide
                ? <><b>已选择 · {guide.title}</b><span>{guide.prompt}</span></>
                : <><b>向下滚动，看看这 {guides.length} 种入口</b><span>没有合适的？最后一张卡可以自己写。</span></>}
            </div>
            <PrimaryButton disabled={!canContinueGuide} onClick={() => update({ wizardStep: 1 })}>{t.continueWithPrompt}</PrimaryButton>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className={`collection-layout ${focusMode ? "focus-mode" : ""}`}>
          <aside className="prompt-panel">
            <button className="text-button" onClick={() => focusMode ? setFocusMode(false) : requestStep(0)}>
              <ArrowLeft size={16} /> {!focusMode && t.changeGuide}
            </button>
            <Pill tone="lime">{guide?.title}</Pill>
            <div className="panel-detail">
              <h2>{guidePrompt}</h2>
              <p>{guide?.examples}</p>
            </div>
            <div className="save-state" data-status={saveStatus}>
                {saveStatus === "editing" ? <><i className="save-dot" /> {language === "zh" ? "正在写…" : "Writing…"}</>
                : saveStatus === "saved" ? <><Check size={15} /> {t.saved} · {savedTime}</>
                : <><Check size={15} /> 内容会自动保存在这台设备上</>}
            </div>
          </aside>
          <div className="story-form">
            <div className="story-form-title">
              <div><p className="eyebrow">{t.storyStep}</p><h1>{language === "zh" ? <>顺着想法，<span className="serif">慢慢写。</span></> : t.storyH1}</h1></div>
              <div className="story-input-tools">
                <button className="tool-line-button" title={language === "zh" ? "语音转文字将在后续版本开放" : "Speech-to-text will be available in a later version"}><Mic size={18} /><span>{language === "zh" ? "语音输入" : "Voice input"}</span></button>
                <button className="tool-line-button focus-line" onClick={() => setFocusMode(value => !value)}><span className={`switch ${focusMode ? "on" : ""}`}><i /></span><span>{language === "zh" ? "开启专注模式" : "Turn on focus mode"}</span></button>
              </div>
            </div>
            <label><span className="field-name">{t.title} <small>{t.optional}</small></span><input value={draft.title} onChange={e => setDraft({ title: e.target.value, edits: draft.edits + 1 })} placeholder={t.titleHint} /></label>
            <label>{t.yourStory}<textarea value={draft.body} onPaste={e => {
              const pasted = e.clipboardData.getData("text");
              if (pasted.trim().length >= Math.max(120, draft.body.trim().length * 0.8)) setPasteDialog(true);
              setDraft({ pastedChars: draft.pastedChars + pasted.length });
            }} onChange={e => setDraft({ body: e.target.value, edits: draft.edits + 1 })} placeholder={draft.body ? "" : blankPrompts[idlePromptIndex]} /><span className={`count ${draft.body.length > 1500 ? "warn" : ""}`}>{draft.body.length} / {t.count}</span></label>
            {resting && <div className="gentle-tip">{t.restTip}</div>}
            {draft.body.length > 0 && draft.body.length < 100 && !resting && <div className="gentle-tip">{t.gentleTip}</div>}
            {focusMode && <p className="focus-note">{language === "zh" ? "按 Esc 或再点一次开关，随时退出专注模式。" : "Press Esc or toggle the switch again to leave focus mode anytime."}</p>}
            <div className="meta-fields">
              <div className="field-group"><span className="field-label">{t.mood}</span><div className="choice-row mood-row">{["沉重", "平静", "还好", "轻松", "温暖"].map((x, i) => <button className={draft.mood === x ? "selected" : ""} onClick={() => setDraft({ mood: x })} key={x}><b>{["☂", "◌", "○", "☀", "♥"][i]}</b>{x}</button>)}</div></div>
              <div className="field-grid">
                <label><span className="field-name">{t.occurred}</span><select value={draft.time} onChange={e => setDraft({ time: e.target.value })}><option value="">请选择</option>{["今天", "最近一年", "小时候", "很久以前", "不确定"].map(x => <option key={x}>{x}</option>)}</select></label>
                <CityField draft={draft} setDraft={setDraft} label={t.city} />
                <label><span className="field-name">年龄 <small>{t.optional}</small></span>
                  <div className="age-field">
                    <input inputMode="numeric" value={draft.age} placeholder="26" onChange={e => setDraft({ age: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
                    <span>岁</span>
                  </div>
                </label>
                {(draft.time === "小时候" || draft.time === "很久以前") && <label className="field-wide"><span className="field-name">{t.lifeStage}</span><select value={draft.stage} onChange={e => setDraft({ stage: e.target.value })}><option value="">请选择</option>{["童年", "中学", "大学", "青年探索", "初入职场", "成年回望"].map(x => <option key={x}>{x}</option>)}</select></label>}
              </div>
              {(showCityHint || showAgeHint) && (
                <div className="ai-hint">
                  <Sparkles size={15} /><span>AI 从你的文字里读到：</span>
                  {showCityHint && hints.city && (
                    <button onClick={() => setDraft({ city: hints.city!.name, cityEn: hints.city!.en, cityCountry: hints.city!.country, cityLat: hints.city!.lat, cityLon: hints.city!.lon })}>
                      填入城市「{hints.city.name}」
                    </button>
                  )}
                  {showAgeHint && <button onClick={() => setDraft({ age: String(hints.age) })}>填入年龄「{hints.age} 岁」</button>}
                  <small>只是建议，可以忽略或改掉</small>
                </div>
              )}
              <div className="field-group"><span className="field-label">{t.people} <small>{t.multi}</small></span><div className="chip-row">{["自己", "家人", "恋人", "朋友", "陌生人", "老师", "同事"].map(x => <button className={draft.people.includes(x) ? "selected" : ""} onClick={() => choosePerson(x)} key={x}>{x}</button>)}</div></div>
            </div>
            {!focusMode && <div className="stage-actions split story-submit-only">
              <span className={`completion-hint ${submitAttempted && !canContinueCollection ? "warn" : ""}`}>
                {submitAttempted && !canContinueCollection ? (language === "zh" ? `还差一点：${missingCollection.join("、")}。` : `Almost there: ${missingCollection.join(", ")}.`) : (language === "zh" ? "完善故事信息后，就可以生成你的故事页面。" : "Complete the story details to generate your story page.")}
              </span>
              <PrimaryButton onClick={() => {
                if (!canContinueCollection) {
                  setSubmitAttempted(true);
                  return;
                }
                setFocusMode(false);
                update({ wizardStep: 2 });
              }}>{t.ai}</PrimaryButton>
            </div>}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="analysis-stage">
          <div className="analysis-orbit"><span className="pulse-star">✦</span>{[0,1,2].map(i => <i key={i} className={`analysis-ring ring-${i}`} />)}</div>
          <p className="eyebrow">{language === "zh" ? "AI 只整理，不改写" : "AI organizes, never rewrites"}</p>
          <h1>{state.analysis ? (language === "zh" ? "每段故事，都值得被认真倾听" : "Every story deserves to be heard with care") : (language === "zh" ? "正在认真听你的故事……" : "Listening carefully to your story…")}</h1>
          <div className="analysis-steps analysis-steps-copy">
            {[
              [language === "zh" ? "步骤 1" : "Step 1", "", language === "zh" ? "正在整理你的故事……" : "Organizing your story…"],
              [language === "zh" ? "步骤 2" : "Step 2", "", language === "zh" ? "正在理解故事内容……" : "Understanding the story…"],
              [language === "zh" ? "步骤 3" : "Step 3", "", language === "zh" ? "正在创作你的专属故事画册……" : "Creating your personal story album…"],
            ].map(([stepLabel, enLabel, label], i) => <div className={analysisStage > i || state.analysis ? "done" : i === analysisStage ? "current" : ""} key={label}><span>{analysisStage > i || state.analysis ? <Check size={15} /> : i + 1}</span><b>{stepLabel} {enLabel}</b><small>{label}</small></div>)}
          </div>
          <div className="analysis-detect">
            <span>{language === "zh" ? "已识别" : "Detected"}</span>
            <b><MapPin size={13} /> {draft.city || (language === "zh" ? "未填写城市" : "City missing")}</b>
            <b>{draft.age ? `${draft.age} ${language === "zh" ? "岁" : "years old"}` : (language === "zh" ? "未填写年龄" : "Age missing")}</b>
            {draft.cityLat !== null && <b>{formatCoords(draft.cityLat, draft.cityLon)}</b>}
          </div>
          <p className="analysis-quote">{language === "zh" ? "“每段故事，都值得被认真倾听。”" : "“Every story deserves to be heard with care.”"}</p>
          {state.analysis && <PrimaryButton onClick={() => update({ wizardStep: 3 })}>{language === "zh" ? "查收你的故事页面" : "Open your story page"}</PrimaryButton>}
        </section>
      )}

      {step === 3 && state.analysis && (
        <section className="confirm-layout">
          <div className="confirm-story story-page-editor">
            <p className="eyebrow">{t.finalSay}</p>
            <h1>{t.confirmTitle}</h1>
            <div className="compact-edit-grid">
              {/* 四个 label 都统一用 .field-name 包住标题文字，标签行等高，控件才会对齐 */}
              <label><span className="field-name">{t.storyTitle}</span><input value={draft.title || state.analysis.suggestedTitle} onChange={e => setDraft({ title: e.target.value })} /></label>
              <label><span className="field-name">时间</span><select value={draft.time} onChange={e => setDraft({ time: e.target.value })}><option value="">请选择</option>{["今天", "最近一年", "小时候", "很久以前", "不确定"].map(x => <option key={x}>{x}</option>)}</select></label>
              <CityField draft={draft} setDraft={setDraft} label="地点" />
              <label><span className="field-name">人生阶段</span><select value={draft.stage} onChange={e => setDraft({ stage: e.target.value })}><option value="">请选择</option>{["童年", "中学", "大学", "青年探索", "初入职场", "成年回望"].map(x => <option key={x}>{x}</option>)}</select></label>
            </div>
            <article className="story-preview editable-preview"><div className="preview-head"><h2>{draft.title || state.analysis.suggestedTitle}</h2><button onClick={() => setEditingBody(!editingBody)}>{editingBody ? t.doneEdit : t.editBody}</button></div>{editingBody ? <textarea value={draft.body} onChange={e => setDraft({ body: e.target.value, edits: draft.edits + 1 })} /> : <p>{draft.body}</p>}</article>
          </div>
          <div className="tag-editor">
            <div className="tag-editor-head"><Sparkles size={20} /><div><h2>智能分析结果</h2><p>你可以根据自己的理解增加或删除标签，<br />也可以增加「其他」标签</p></div></div>
            {(["topic", "emotion", "meaning"] as const).map(layer => {
              const cappedTags = (tagDrafts[layer] ?? state.analysis!.tags[layer] ?? []).slice(0, 3);
              const full = cappedTags.length >= 3;
              return <div className="tag-layer" key={layer}><span>{({topic:"主题", emotion:"情绪", meaning:"意义"} as Record<string,string>)[layer]}</span><div>{cappedTags.map(tag => <button key={tag} onClick={() => removeTag(layer, tag)}>{tag}<X size={13} /></button>)}<button className="add-tag" disabled={full} onClick={() => addTag(layer)}>＋ 预设</button><button className="add-tag" disabled={full} onClick={() => addTag(layer, true)}>＋ 其他</button>{full && <small className="tag-limit">最多 3 个</small>}</div></div>;
            })}
            <fieldset className="image-style-picker">
              <legend>生成的图片风格</legend>
              <p>悬浮或聚焦可以查看风格示意图</p>
              <div className="image-style-options">
                {imageStyleOptions.map(option => <label className={`image-style-option ${imageStyle === option.id ? "selected" : ""}`} key={option.id}>
                  <input type="radio" name="image-style" value={option.id} checked={imageStyle === option.id} onChange={() => chooseImageStyle(option.id)} />
                  <span className="image-style-copy"><b>{option.label}</b><small>{option.description}</small></span>
                  <span className="image-style-peek"><Eye size={14} />示意图</span>
                  <figure className="image-style-popover">
                    <img src={option.preview} alt={`${option.label}示意图`} />
                    <figcaption>{option.label}</figcaption>
                  </figure>
                </label>)}
              </div>
            </fieldset>
            <div className="comic-preview">
              <div className={`comic-frame ${storyImage ? "generated single-story-image" : ""}`}>
                {storyImage ? (
                  <img src={storyImage} alt={`《${draft.title || state.analysis!.suggestedTitle}》的故事高光插画`} />
                ) : imageStatus === "generating" ? (
                  <div className="comic-state"><LoaderCircle className="comic-spinner" size={38} /><b>正在寻找故事的高光时刻…</b><small>千问会先提取最值得画下来的瞬间，万相随后生成一张 {imageStyleOptions.find(option => option.id === imageStyle)?.label} 插画</small></div>
                ) : imageStatus === "failed" ? (
                  <div className="comic-state"><Sparkles className="comic-state-icon" size={38} /><b>这次没有完成故事图片</b><small>{imageError}</small><button className="retry-comic" onClick={() => void runImageGeneration()}><RefreshCw size={15} />重新生成图片</button></div>
                ) : (
                  <div className="comic-state"><Sparkles className="comic-state-icon" size={38} /><b>把故事高光变成一张插画</b><small>AI 会从正文中选择一个真实、可画的关键瞬间，并按你选择的风格生成</small><button className="retry-comic" onClick={() => void runImageGeneration()}>生成故事图片</button></div>
                )}
              </div>
              {storyImage && <div className="comic-actions"><button className="download-comic" onClick={() => downloadStoryImage(storyImage, draft.title || state.analysis!.suggestedTitle, imageStyle)}><Download size={16} />下载故事图片</button><button className="regenerate-comic" onClick={() => void runImageGeneration()}><RefreshCw size={15} />重新生成</button></div>}
              {storyHighlight && <details className="comic-storyboard"><summary>查看 AI 选中的高光时刻</summary><div className="highlight-detail"><b>{storyHighlight.title}</b><p>{storyHighlight.moment}</p><span>{storyHighlight.scene} · {storyHighlight.action}</span><em>{storyHighlight.emotion}</em>{imagePrompt && <details><summary>查看绘画 Prompt</summary><p>{imagePrompt}</p></details>}</div></details>}
              <p className="comic-privacy">生成时会将故事正文发送给阿里云百炼；每次只生成一张图片并按一张计费。图片只保留在当前页面，刷新后消失。</p>
            </div>
            <div className="publish-note"><Check size={17} />确认后将进入模拟安全检查，并匿名加入故事池。</div>
            <PrimaryButton onClick={onPublished}>{t.publish}</PrimaryButton>
          </div>
        </section>
      )}
      {pasteDialog && <div className="modal-backdrop"><div className="report-dialog"><h2>{t.pasteTitle}</h2><div className="dialog-actions"><button className="button button-ghost" onClick={() => setPasteDialog(false)}>{t.pasteYes}</button><button className="button button-primary" onClick={() => setPasteDialog(false)}>{t.pasteOther}</button></div></div></div>}
      {leaveTarget !== null && <div className="modal-backdrop"><div className="report-dialog"><h2>{t.leaveTitle}</h2><div className="dialog-actions three"><button className="button button-ghost" onClick={() => setLeaveTarget(null)}>{t.keepWriting}</button><button className="button button-ghost" onClick={() => confirmLeave(false)}>{t.leaveAnyway}</button><button className="button button-primary" onClick={() => confirmLeave(true)}>{t.saveDraft}</button></div></div></div>}
    </main>
  );
}

function Resonance({ state, update, onBack, onContinue, onHome, themeMode, onThemeModeChange }: { state: AppState; update: AppUpdate; onBack: () => void; onContinue: () => void; onHome: () => void; themeMode: ThemeMode; onThemeModeChange: (themeMode: ThemeMode) => void }) {
  const t = copy[state.language];
  const dimensions = [
    { key: "city" as const, title: state.language === "zh" ? "城市" : "City", icon: "⌖", similar: state.language === "zh" ? "遇见来自相近城市语境的故事" : "Meet stories from a similar city context", different: state.language === "zh" ? "走进另一座城市的生活经验" : "Step into life in another city" },
    { key: "stage" as const, title: state.language === "zh" ? "人生阶段" : "Life stage", icon: "◷", similar: state.language === "zh" ? "看看相近阶段的人如何走过" : "See how people in a similar stage moved through it", different: state.language === "zh" ? "听见另一段生命时期的声音" : "Hear a voice from another life phase" },
    { key: "theme" as const, title: state.language === "zh" ? "主题" : "Theme", icon: "✦", similar: state.language === "zh" ? "从熟悉的议题继续深入" : "Go deeper from a familiar theme", different: state.language === "zh" ? "从新的主题打开另一扇门" : "Open a door through a new theme" },
  ];
  const setMode = (key: keyof AppState["resonance"], mode: ResonanceMode) => update({ resonance: { ...state.resonance, [key]: mode } });
  return (
    <main className={`resonance-page ${themeMode === "night" ? "theme-night" : ""}`}>
      <header className="topbar app-shell-header"><Logo onClick={onHome} /><div className="topbar-actions"><button className="button button-ghost mini" onClick={onBack}><ArrowLeft size={16} /> {t.backToTraits}</button><ThemeToggle language={state.language} themeMode={themeMode} onChange={onThemeModeChange} /><LanguageSelect language={state.language} onChange={language => update({ language })} /></div></header>
      <section className="resonance-hero">
        <div><p className="eyebrow">{state.language === "zh" ? "你的故事已经成为一颗星星" : "Your story is now a star"}</p><h1>{t.resonanceTitle}</h1>{t.resonanceSub && <p>{t.resonanceSub}</p>}</div>
        <div className="new-star"><i /><span>你的星点</span><small>{state.draft.city || "未知城市"} · {state.draft.title || state.analysis?.suggestedTitle}</small></div>
      </section>
      <section className="dimension-grid">
        {dimensions.map(dim => <article key={dim.key} className="dimension-card">
          <div className="dimension-title"><span>{dim.icon}</span><div><small>{t.dimension}</small><h2>{dim.title}</h2></div></div>
          <div className="mode-picker">
            <button className={state.resonance[dim.key] === "similar" ? "selected" : ""} onClick={() => setMode(dim.key, "similar")}><span>≈</span><b>{t.similar}</b><small>{dim.similar}</small></button>
            <button className={state.resonance[dim.key] === "different" ? "selected" : ""} onClick={() => setMode(dim.key, "different")}><span>↗</span><b>{t.different}</b><small>{dim.different}</small></button>
          </div>
        </article>)}
      </section>
      <div className="resonance-action"><PrimaryButton onClick={onContinue}>{t.findStories}</PrimaryButton><small>{state.language === "zh" ? "随时可以在主页修改" : "You can adjust this anytime on the home page."}</small></div>
    </main>
  );
}

function StoryDetail({ story, reaction, onReact, onClose, onReport }: {
  story: Story; reaction: Reaction; onReact: (reaction: Reaction) => void; onClose: () => void; onReport: () => void;
}) {
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <article className="story-modal">
      <button className="modal-close" onClick={onClose}><X size={20} /></button>
      <div className={`visual visual-${story.visualStatus}`}>
        <span>✦</span>
        <div>{story.visualStatus === "ready" ? "故事意象 · 本地占位" : story.visualStatus === "generating" ? "意象正在生成" : story.visualStatus === "failed" ? "意象暂时迷路了" : "意象未通过审核"}</div>
      </div>
      <div className="story-content">
        <div className="story-meta"><Pill tone="lime">{story.theme}</Pill><span>{story.city}</span><span>{story.stage}</span><span>{story.readMinutes} 分钟阅读</span></div>
        <h1>{story.title}</h1>
        <p className="author">@{story.author} · 匿名分享</p>
        {story.reason && <div className="reason"><Sparkles size={16} /><span><b>为什么推荐给你</b>{story.reason}</span></div>}
        <p className="story-body">{story.body}</p>
        <div className="tag-row"><Pill>{story.emotion}</Pill><Pill>{story.meaning}</Pill><Pill>{story.perspective}</Pill></div>
      </div>
      <footer className="story-actions">
        <div><button className={reaction === "like" ? "active like" : ""} onClick={() => onReact(reaction === "like" ? null : "like")}><Heart size={19} />喜欢</button><button className={reaction === "dislike" ? "active dislike" : ""} onClick={() => onReact(reaction === "dislike" ? null : "dislike")}><ThumbsDown size={19} />不喜欢</button></div>
        <button onClick={onReport}><Flag size={18} />举报</button>
      </footer>
    </article>
  </div>;
}

function ReportDialog({ story, onClose }: { story: Story; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState(false);
  if (done) return <div className="modal-backdrop"><div className="report-dialog success-dialog"><span className="success-icon"><Check size={28} /></span><h2>举报已受理</h2><p>谢谢你帮助守护故事社区。审核前不会向故事作者公开你的身份。</p><PrimaryButton onClick={onClose}>返回故事</PrimaryButton></div></div>;
  return <div className="modal-backdrop"><div className="report-dialog">
    <button className="modal-close" onClick={onClose}><X size={18} /></button>
    {!confirm ? <><Pill tone="orange">社区安全</Pill><h2>举报「{story.title}」</h2><p>请选择最符合的原因。举报说明仅供审核人员查看。</p>
      <div className="report-reasons">{["隐私泄露", "仇恨或骚扰", "危险内容", "垃圾内容", "其他"].map(x => <button className={reason === x ? "selected" : ""} onClick={() => setReason(x)} key={x}>{reason === x && <Check size={15} />}{x}</button>)}</div>
      <label>补充说明 <small>选填</small><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="请提供有助于审核的上下文…" /></label>
      <PrimaryButton disabled={!reason} onClick={() => setConfirm(true)}>检查并继续</PrimaryButton>
    </> : <><Pill tone="orange">二次确认</Pill><h2>确认提交这次举报？</h2><div className="confirm-report"><span>举报原因</span><b>{reason}</b>{note && <p>{note}</p>}</div><p>提交后会进入人工审核队列。请确认信息准确。</p><div className="dialog-actions"><button className="button button-ghost" onClick={() => setConfirm(false)}>返回修改</button><button className="button button-danger" onClick={() => setDone(true)}>确认提交举报</button></div></>}
  </div></div>;
}

function Recommendations({ state, update, onEnterAtlas, onHome, themeMode, onThemeModeChange }: { state: AppState; update: (patch: Partial<AppState>) => void; onEnterAtlas: () => void; onHome: () => void; themeMode: ThemeMode; onThemeModeChange: (themeMode: ThemeMode) => void }) {
  const [detail, setDetail] = useState<Story | null>(null);
  const [report, setReport] = useState<Story | null>(null);
  const recommended = stories.slice(0, 5).map((s, i) => ({
    ...s,
    reason: [
      "与你同样关注“归属”，但来自不同城市。",
      "处于相近的人生阶段，也在重新理解家人的沉默。",
      "来自不同城市，并用更轻盈的方式回应成长焦虑。",
      "与你的主题不同，却同样面对一次重要选择。",
      "城市和阶段都不同，但都在重新看见亲密关系。",
    ][i],
  }));
  const open = (story: Story) => {
    if (!state.openedRecommendations.includes(story.id)) update({ openedRecommendations: [...state.openedRecommendations, story.id] });
    setDetail(story);
  };
  const react = (id: string, reaction: Reaction) => {
    const likedAt = { ...state.likedAt };
    if (reaction === "like") likedAt[id] = Date.now(); else delete likedAt[id];
    update({ reactions: { ...state.reactions, [id]: reaction }, likedAt });
  };
  return <main className={`recommend-page ${themeMode === "night" ? "theme-night" : ""}`}>
    <header className="topbar app-shell-header"><Logo onClick={onHome} /><div className="topbar-actions"><ThemeToggle language={state.language} themeMode={themeMode} onChange={onThemeModeChange} /><LanguageSelect language={state.language} onChange={language => update({ language })} /></div></header>
    <section className="recommend-heading"><div><p className="eyebrow">FIRST CONSTELLATION</p><h1>为你找到的<span className="serif">五则故事。</span></h1><p>至少打开一则，就可以进入完整轻量星图。你不需要读完固定数量。</p></div><PrimaryButton disabled={state.openedRecommendations.length < 1} onClick={onEnterAtlas}>进入故事星图</PrimaryButton></section>
    <section className="recommend-grid">
      {recommended.map((story, i) => <button className={`recommend-card card-${i}`} onClick={() => open(story)} key={story.id}>
        <div className="rec-orbit"><span style={{ background: themeColors[story.theme] }} /><i /></div>
        <div className="rec-index">0{i + 1}</div>
        <div className="rec-meta"><Pill>{story.theme}</Pill><span>{story.city}</span></div>
        <h2>{story.title}</h2><p>{story.excerpt}</p>
        <div className="rec-reason"><Sparkles size={15} />{story.reason}</div>
        <footer><span>{story.readMinutes} 分钟</span><span>{state.openedRecommendations.includes(story.id) ? "已打开 ✓" : "阅读故事 →"}</span></footer>
      </button>)}
    </section>
    {detail && <StoryDetail story={detail} reaction={state.reactions[detail.id] ?? null} onReact={r => react(detail.id, r)} onClose={() => setDetail(null)} onReport={() => setReport(detail)} />}
    {report && <ReportDialog story={report} onClose={() => setReport(null)} />}
  </main>;
}

function Atlas({ state, update, onWrite, onHome }: { state: AppState; update: AppUpdate; onWrite: () => void; onHome: () => void }) {
  const [view, setView] = useState<"map" | "cards">("map");
  const [nav, setNav] = useState<"explore" | "mine" | "liked" | "resonance">("explore");
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState("全部");
  const [detail, setDetail] = useState<Story | null>(null);
  const [report, setReport] = useState<Story | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const t = copy[state.language];
  const visible = useMemo(() => {
    let list = stories;
    if (nav === "liked") list = list.filter(s => state.reactions[s.id] === "like").sort((a,b) => (state.likedAt[b.id] || 0) - (state.likedAt[a.id] || 0));
    if (theme !== "全部") list = list.filter(s => s.theme === theme);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(s => [s.title, s.city, s.stage, s.theme, s.emotion, s.body].join(" ").toLowerCase().includes(q));
    return list;
  }, [nav, theme, search, state.reactions, state.likedAt]);
  const react = (id: string, reaction: Reaction) => {
    const likedAt = { ...state.likedAt };
    if (reaction === "like") likedAt[id] = Date.now(); else delete likedAt[id];
    update({ reactions: { ...state.reactions, [id]: reaction }, likedAt });
  };
  const navItems = [
    { id: "explore", label: t.explore, icon: Compass },
    { id: "mine", label: t.mine, icon: CircleUserRound },
    { id: "resonance", label: t.resonance, icon: SlidersHorizontal },
    { id: "liked", label: t.liked, icon: Heart },
  ] as const;
  return <main className="atlas-page">
    <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
      <Logo onClick={onHome} />
      <nav>{navItems.map(item => <button key={item.id} className={nav === item.id ? "active" : ""} onClick={() => {setNav(item.id); setMobileMenu(false);}}><item.icon size={19} />{item.label}{item.id === "liked" && <span>{Object.values(state.reactions).filter(x => x === "like").length}</span>}</button>)}</nav>
      <button className="write-button" onClick={onWrite}><Feather size={18} />{t.writeNew}</button>
      <div className="sidebar-bottom"><div className="avatar">旅</div><div><b>星旅人 001</b><small>本地演示账户</small></div><button title="退出演示"><LogOut size={17} /></button></div>
    </aside>
    <section className="atlas-main">
      <header className="atlas-header app-shell-header">
        <button className="mobile-menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={20} /></button>
        <Logo onClick={onHome} compact />
        <div className="search-box"><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} /><kbd>⌘ K</kbd></div>
        <div className="view-toggle"><button className={view === "map" ? "active" : ""} onClick={() => setView("map")}><Orbit size={17} />{t.map}</button><button className={view === "cards" ? "active" : ""} onClick={() => setView("cards")}><Layers3 size={17} />{t.cards}</button></div>
        <LanguageSelect language={state.language} onChange={language => update({ language })} />
      </header>
      <div className="atlas-title">
        <div><p className="eyebrow">{state.language === "zh" ? (nav === "liked" ? "你的共鸣" : nav === "mine" ? "你的故事" : nav === "resonance" ? "共鸣设置" : "故事星图") : (nav === "liked" ? "YOUR RESONANCE" : nav === "mine" ? "YOUR STORIES" : nav === "resonance" ? "RESONANCE SETTINGS" : "STORY ATLAS")}</p><h1>{nav === "liked" ? (state.language === "zh" ? "曾与你产生共鸣的故事" : "Stories that resonated with you") : nav === "mine" ? (state.language === "zh" ? "你的故事星点" : "Your story stars") : nav === "resonance" ? (state.language === "zh" ? "调整故事相遇的方向" : "Adjust how stories find you") : t.atlasTitle}</h1></div>
        <div className="atlas-stats"><div><b>{visible.length}</b><span>{t.visibleStories}</span></div><div><b>6</b><span>{t.themeGalaxies}</span></div></div>
      </div>
      {nav === "resonance" ? <div className="inline-resonance">
        {(["city","stage","theme"] as const).map((key, i) => <div key={key}><span>{state.language === "zh" ? ["城市","人生阶段","主题"][i] : ["City","Life stage","Theme"][i]}</span><div><button className={state.resonance[key] === "similar" ? "active" : ""} onClick={() => update({ resonance: {...state.resonance,[key]:"similar"} })}>≈ {t.similar}</button><button className={state.resonance[key] === "different" ? "active" : ""} onClick={() => update({ resonance: {...state.resonance,[key]:"different"} })}>↗ {t.different}</button></div></div>)}
        <p><Sparkles size={17} />{state.language === "zh" ? "修改会立即影响下一次推荐。相异故事仍会保留一条可理解的连接。" : "Changes affect your next recommendations immediately. Different stories still keep one understandable connection."}</p>
      </div> : <>
        <div className="filter-row"><button className="filter-icon"><SlidersHorizontal size={17} />{t.filter}</button>{["全部","家庭","成长","迁移","关系","工作","身份"].map((x, i) => <button className={theme === x ? "active" : ""} onClick={() => setTheme(x)} key={x}>{state.language === "zh" ? x : [t.all,"Family","Growth","Migration","Relationships","Work","Identity"][i]}</button>)}</div>
        {visible.length === 0 ? <div className="empty-state"><span>✦</span><h2>这片星域暂时很安静</h2><p>试着清除搜索或放宽主题筛选。</p><button className="button button-ghost" onClick={() => {setSearch("");setTheme("全部");}}>清除筛选</button></div> :
        view === "map" ? <div className="star-map">
          <div className="map-orbit orbit-one" /><div className="map-orbit orbit-two" /><div className="map-orbit orbit-three" />
          <div className="map-label label-a">{t.similarEcho}</div><div className="map-label label-b">{t.differentLives}</div>
          {visible.map((story, i) => <button key={story.id} className="map-node" style={{ left: `${story.x}%`, top: `${story.y}%`, "--node": themeColors[story.theme], "--size": `${38 + story.readMinutes * 5}px`, animationDelay: `${i * 70}ms` } as React.CSSProperties} onClick={() => setDetail(story)}>
            <i /><span className="node-card"><small>{story.theme} · {story.city}</small><b>{story.title}</b><em>{story.readMinutes} {t.minutes}</em></span>
          </button>)}
          <div className="map-legend"><span>{state.language === "zh" ? "星点大小 = 阅读长度" : "Star size = reading length"}</span>{Object.entries(themeColors).slice(0,4).map(([x,c]) => <span key={x}><i style={{background:c}} />{x}</span>)}</div>
        </div> : <div className="atlas-cards">{visible.map(story => <button onClick={() => setDetail(story)} key={story.id}><div className="story-color" style={{ background: themeColors[story.theme] }} /><div className="story-card-meta"><Pill>{story.theme}</Pill><span>{story.city} · {story.stage}</span></div><h2>{story.title}</h2><p>{story.excerpt}</p><footer><span>{story.readMinutes} {t.minutes}</span><ChevronRight size={17} /></footer></button>)}</div>}
      </>}
    </section>
    {detail && <StoryDetail story={detail} reaction={state.reactions[detail.id] ?? null} onReact={r => react(detail.id, r)} onClose={() => setDetail(null)} onReport={() => setReport(detail)} />}
    {report && <ReportDialog story={report} onClose={() => setReport(null)} />}
  </main>;
}

export default function App() {
  const initialRoute = typeof window !== "undefined" ? routePatchFromPath() : {};
  const [state, setState] = useState<AppState>(() => ({ ...loadState(), ...initialRoute }));
  const [gatewaySection, setGatewaySection] = useState<"intro" | "preview" | "auth">(() => initialRoute.gatewaySection ?? "intro");
  const [authMode, setAuthMode] = useState<"signup" | "login">(() => initialRoute.authMode ?? "signup");
  const [themeMode, setThemeMode] = useState<ThemeMode>("day");
  const lastPathRef = useRef<string>(typeof window !== "undefined" ? normalizedPath() : "/");
  const poppingRef = useRef(false);
  const update: AppUpdate = (patch) => setState(previous => ({ ...previous, ...(typeof patch === "function" ? patch(previous) : patch) }));
  useEffect(() => saveState(state), [state]);
  useEffect(() => {
    const onPop = () => {
      const route = routePatchFromPath();
      poppingRef.current = true;
      if (route.gatewaySection) setGatewaySection(route.gatewaySection);
      if (route.authMode) setAuthMode(route.authMode);
      const { gatewaySection: _gatewaySection, authMode: _authMode, ...statePatch } = route;
      update(statePatch);
      lastPathRef.current = normalizedPath();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const path = pathFromState(state, gatewaySection, authMode);
    if (path === lastPathRef.current) {
      poppingRef.current = false;
      return;
    }
    const method = poppingRef.current ? "replaceState" : "pushState";
    window.history[method]({}, "", externalPath(path));
    lastPathRef.current = path;
    poppingRef.current = false;
  }, [state.screen, state.wizardStep, gatewaySection, authMode]);
  const go = (screen: string) => update({ screen });
  const goHome = () => { setGatewaySection("intro"); update({ screen: "intro", onboarded: false }); };
  const startNewStory = () => update(previous => {
    const shouldArchive = previous.draft.body.trim() || previous.draft.title.trim();
    return {
      screen: "wizard",
      wizardStep: 0,
      analysis: null,
      draft: { ...initialState.draft, startedAt: Date.now() },
      draftBox: shouldArchive
        ? [{ ...previous.draft, id: crypto.randomUUID(), savedAt: Date.now() }, ...previous.draftBox]
        : previous.draftBox,
    };
  });
  const publishStory = () => update({ firstStoryComplete: true, screen: "resonance" });

  let content: React.ReactNode;
  if (["intro", "icebreaker", "preview", "auth"].includes(state.screen)) {
    content = <PrototypeGateway
      language={state.language}
      onLanguageChange={language => update({ language })}
      onHome={goHome}
      onComplete={() => update({ onboarded: true, accountCreated: true, screen: state.firstStoryComplete ? "atlas" : "wizard" })}
      section={gatewaySection}
      authMode={authMode}
      onAuthModeChange={setAuthMode}
      onSectionChange={setGatewaySection}
      themeMode={themeMode}
      onThemeModeChange={setThemeMode}
    />;
  }
  else if (state.screen === "wizard") content = <Wizard state={state} update={update} onPublished={publishStory} onHome={goHome} themeMode={themeMode} onThemeModeChange={setThemeMode} />;
  else if (state.screen === "resonance") content = <Resonance state={state} update={update} onBack={() => update({ screen: "wizard", wizardStep: 3 })} onContinue={() => go("atlas")} onHome={goHome} themeMode={themeMode} onThemeModeChange={setThemeMode} />;
  else if (state.screen === "recommendations") content = <Recommendations state={state} update={update} onEnterAtlas={() => go("atlas")} onHome={goHome} themeMode={themeMode} onThemeModeChange={setThemeMode} />;
  else content = <StoryGalaxy
    language={state.language}
    themeMode={themeMode}
    onLanguageChange={language => update({ language })}
    onThemeModeChange={setThemeMode}
    onWrite={startNewStory}
    onHome={goHome}
    onLogout={goHome}
    resonance={state.resonance}
    onResonanceChange={resonance => update({ resonance })}
  />;

  return <>{content}</>;
}
