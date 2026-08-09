import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, CircleUserRound,
  Compass, Download, Eye, Feather, Flag, Heart, Layers3, LoaderCircle, LogOut, MapPin, Menu, Mic,
  Orbit, RefreshCw, Search, SlidersHorizontal, Sparkles, ThumbsDown, X,
} from "lucide-react";
import { extractHints } from "./ai";
import { api, type RecommendationItem, type User } from "./api";
import crayonStylePreview from "./assets/image-styles/crayon.jpg";
import minimalRealisticStylePreview from "./assets/image-styles/minimal-realistic.jpg";
import retroCollageStylePreview from "./assets/image-styles/retro-collage.jpg";
import { guides, icebreakers, stories } from "./data";
import { downloadStoryImage, generateStoryImage, type ImageStyle, type StoryHighlight } from "./image";
import { formatCoords, geocodePlace, searchPlaces } from "./places";
import { initialState, loadState, saveState } from "./storage";
import { clearRecoveryDraft, loadRecoveryDraft, saveRecoveryDraft } from "./offline-drafts";
import { Auragate as PrototypeGateway } from "./PrototypeGateway";
import { StoryGalaxy } from "./StoryGalaxy";
import { Tour } from "./Tour";
import { AdminConsole } from "./AdminConsole";
import { moderateStory, moderationCopy } from "./moderation";
import type { ModerationResult } from "./moderation";
import type { PlaceSuggestion } from "./places";
import type { TourSceneId } from "./tour-steps";
import type { AppState, Draft, InboxMessage, Language, Reaction, ResonanceMode, ReviewItem, Story } from "./types";
import "./tour.css";

/** 引导相关的三个回调在 Wizard / Resonance 之间是同一组，抽出来少写几遍 */
interface TourProps {
  tourActive: (scene: TourSceneId) => boolean;
  onTourFinish: (scene: TourSceneId) => void;
  onTourSkip: (scene: TourSceneId) => void;
}

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
  admin: "/Admin",
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
  if (path === routeMap.admin) return { screen: "admin" };
  return { screen: "intro", gatewaySection: "intro" };
}

function pathFromState(state: AppState, gatewaySection: "intro" | "preview" | "auth", authMode: "signup" | "login") {
  if (state.screen === "wizard") {
    return [routeMap.storyStart, routeMap.storyWrite, routeMap.storyAnalyzing, routeMap.storyPage][state.wizardStep] ?? routeMap.storyStart;
  }
  if (state.screen === "resonance") return routeMap.resonance;
  if (state.screen === "recommendations") return routeMap.recommendations;
  if (state.screen === "atlas") return routeMap.starLobby;
  if (state.screen === "admin") return routeMap.admin;
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
    gender: "性别", genderPick: "请选择", genderMale: "男", genderFemale: "女", genderOther: "其他",
    genderOtherHint: "选择「其他」时，AI生图可能无法准确呈现人物形象哦。", genderOtherNote: "只是建议，可以忽略",
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
    gender: "Gender", genderPick: "Please choose", genderMale: "Male", genderFemale: "Female", genderOther: "Other",
    genderOtherHint: "With “Other”, the AI may not portray the character accurately in the generated image.", genderOtherNote: "Just a suggestion — feel free to ignore",
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

/**
 * 性别选择。第二步和第四步共用同一个组件，选项文案跟随语言，
 * 但存进 draft 的值固定是中文（男 / 女 / 其他），这样切换语言不会把已选的值弄丢，
 * 传给生图接口的取值也保持稳定。
 */
const GENDER_KEYS = [
  { value: "男", label: "genderMale" },
  { value: "女", label: "genderFemale" },
  { value: "其他", label: "genderOther" },
] as const;

function GenderField({ draft, setDraft, t, wide }: {
  draft: Draft;
  setDraft: (patch: Partial<Draft>) => void;
  t: typeof copy["zh"] | typeof copy["en"];
  wide?: boolean;
}) {
  return (
    <label className={wide ? "field-wide" : undefined}>
      <span className="field-name">{t.gender} <small>{t.optional}</small></span>
      <select value={draft.gender} onChange={event => setDraft({ gender: event.target.value })}>
        <option value="">{t.genderPick}</option>
        {GENDER_KEYS.map(option => <option key={option.value} value={option.value}>{t[option.label]}</option>)}
      </select>
    </label>
  );
}

/**
 * 管理端登录。刻意做成独立页面而不是塞进 PrototypeGateway ——
 * 那个文件上游改得很频繁，动它每次同步都要解冲突。
 *
 * 注意：这是纯前端的演示门禁，任何知道 /Admin 的人改一下 localStorage 就能进，
 * 不构成任何真实的权限控制。真正的角色校验必须放在后端。
 */
function AdminGate({ language, themeMode, onBack, onSignedIn, onThemeModeChange }: {
  language: Language; themeMode: ThemeMode; onBack: () => void; onSignedIn: () => void; onThemeModeChange: (theme: ThemeMode) => void;
}) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);
  const zh = language === "zh";

  const submit = () => {
    if (user.trim() === "admin" && pass === "admin123") { onSignedIn(); return; }
    setError(true);
  };

  return (
    <main className={`admin-gate ${themeMode === "night" ? "theme-night admin-universe" : "admin-sky"}`}>
      <div className="admin-gate-card">
        <button className="admin-gate-theme" aria-label={zh ? "切换主题" : "Switch theme"} onClick={() => onThemeModeChange(themeMode === "night" ? "day" : "night")}>
          {themeMode === "night" ? "☀" : "☾"}
        </button>
        <button className="admin-gate-back" onClick={onBack}>← {zh ? "返回 StoryVerse" : "Back to StoryVerse"}</button>
        <h1>{zh ? "内容审核台" : "Moderation desk"}</h1>
        <p>{zh ? "仅供审核人员使用。登录后可以处理被举报、机器不确定与申诉的故事。" : "For reviewers only. Sign in to handle reported, uncertain and appealed stories."}</p>
        <label><span>{zh ? "工号" : "Staff ID"}</span>
          <input value={user} onChange={e => { setUser(e.target.value); setError(false); }} placeholder="admin" />
        </label>
        <label><span>{zh ? "密码" : "Password"}</span>
          <input type="password" value={pass} onChange={e => { setPass(e.target.value); setError(false); }} placeholder="admin123" />
        </label>
        {error && <em className="admin-gate-error">{zh ? "工号或密码不对。" : "Wrong staff ID or password."}</em>}
        <button className="admin-gate-submit" onClick={submit}>{zh ? "进入审核台" : "Enter the desk"}</button>
        <p className="admin-gate-demo">
          {zh ? "演示账号：admin / admin123 —— 这是纯前端门禁，不是真实权限控制。" : "Demo credentials: admin / admin123 — front-end only, not real access control."}
        </p>
      </div>
    </main>
  );
}

function Wizard({ state, update, onPublished, onHome, themeMode, onThemeModeChange, tourActive, onTourFinish, onTourSkip }: {
  state: AppState; update: AppUpdate; onPublished: (draft: Draft, analysis: NonNullable<AppState["analysis"]>) => Promise<void>; onHome: () => void; themeMode: ThemeMode; onThemeModeChange: (themeMode: ThemeMode) => void;
} & TourProps) {
  const step = state.wizardStep;
  const draft = state.draft;
  const language = state.language;
  const t = copy[language];
  /* 步骤 → 引导场景。第 2 步是 AI 整理的等待页，按需求不做引导。 */
  const sceneForStep: Record<number, TourSceneId | undefined> = { 0: "guide", 1: "collection", 3: "confirm" };
  const candidateScene = sceneForStep[step];
  // 第 4 步要等 analysis 出来、内容真正渲染了才有目标可高亮
  const wizardTourScene = candidateScene && tourActive(candidateScene) && (step !== 3 || !!state.analysis)
    ? candidateScene
    : null;
  const [analysisStage, setAnalysisStage] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const [idlePromptIndex, setIdlePromptIndex] = useState(0);
  const [resting, setResting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "editing" | "saved">(draft.savedAt ? "saved" : "idle");
  const [pasteDialog, setPasteDialog] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<number | null>(null);
  const [editingBody, setEditingBody] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [moderation, setModeration] = useState<ModerationResult | null>(null);
  const [appealNote, setAppealNote] = useState("");
  const [tagDrafts, setTagDrafts] = useState<Record<string, string[]>>({});
  const [imageStyle, setImageStyle] = useState<ImageStyle>("minimal-realistic");
  const [storyImage, setStoryImage] = useState("");
  const [storyHighlight, setStoryHighlight] = useState<StoryHighlight | null>(null);
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageStatus, setImageStatus] = useState<"idle" | "generating" | "ready" | "failed">("idle");
  const [imageError, setImageError] = useState("");
  const [publishError, setPublishError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [analysisAttempt, setAnalysisAttempt] = useState(0);
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
    setAnalysisError("");
    const timers = [650, 1400, 2200].map((time, i) => window.setTimeout(() => setAnalysisStage(i + 1), time));
    let cancelled = false;
    api.analyze(draft).then(analysis => { if (!cancelled) update({ analysis }); }).catch(error => {
      if (!cancelled) setAnalysisError(error instanceof Error ? error.message : "智能分析暂时失败，请重新尝试。");
    });
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [step, analysisAttempt]);
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
  const mCopy = moderationCopy[language];

  /*
   * 发布前的安全检查。命中就弹柔和提示，不直接说「违规」，并且永远留一条
   * 「仍然提交」的路 —— 提交后进人工审核区，由管理员决定。没命中就直接发布。
   */
  /** 真正调用上游的发布接口（POST /stories/publish），带上标签与错误处理 */
  const runPublish = () => {
    setPublishing(true); setPublishError("");
    return onPublished(draft, { ...state.analysis!, tags: { ...state.analysis!.tags, ...tagDrafts } })
      .catch(error => { setPublishError(error instanceof Error ? error.message : "发布失败，请稍后重试。"); })
      .finally(() => setPublishing(false));
  };

  const attemptPublish = () => {
    const result = moderateStory(draft.body);
    if (result.flags.length === 0) { void runPublish(); return; }
    setModeration(result);
  };

  const sendToReview = (bucket: "uncertain" | "appealed") => {
    const title = draft.title || state.analysis?.suggestedTitle || "未命名故事";
    const item: ReviewItem = {
      // 别截断 UUID：切成 8 位只剩 32 bit，几万条就会开始撞
      id: `rv-${crypto.randomUUID()}`,
      title,
      body: draft.body,
      tags: Object.values(tagDrafts).flat().length ? Object.values(tagDrafts).flat() : Object.values(state.analysis?.tags ?? {}).flat(),
      author: language === "zh" ? "我（本机演示）" : "Me (local demo)",
      city: draft.city,
      createdAt: Date.now(),
      bucket,
      status: "pending",
      flags: moderation?.flags,
      appealNote: bucket === "appealed" ? appealNote.trim() || undefined : undefined,
      mine: true,
    };
    // 进队列的同时给作者一条「待审核」通知，后续状态由管理端推进
    const notice: InboxMessage = {
      id: `msg-${item.id}`,
      status: "pending",
      kind: "flagged",
      storyTitle: title,
      reason: "",
      createdAt: Date.now(),
      read: false,
    };
    update(previous => ({
      reviewQueue: [item, ...previous.reviewQueue],
      inbox: [notice, ...previous.inbox],
    }));
    setModeration(null);
    setAppealNote("");
    void runPublish();
  };
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
                <GenderField draft={draft} setDraft={setDraft} t={t} />
                {(draft.time === "小时候" || draft.time === "很久以前") && <label className="field-wide"><span className="field-name">{t.lifeStage}</span><select value={draft.stage} onChange={e => setDraft({ stage: e.target.value })}><option value="">请选择</option>{["童年", "中学", "大学", "青年探索", "初入职场", "成年回望"].map(x => <option key={x}>{x}</option>)}</select></label>}
              </div>
              {draft.gender === "其他" && <p className="gender-hint">{t.genderOtherHint}<small>{t.genderOtherNote}</small></p>}
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
          {analysisError && <div className="api-error" role="alert"><p>{analysisError}</p><button className="button button-ghost" onClick={() => setAnalysisAttempt(value => value + 1)}>重新分析</button></div>}
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
              <GenderField draft={draft} setDraft={setDraft} t={t} wide />
            </div>
            {draft.gender === "其他" && <p className="gender-hint">{t.genderOtherHint}<small>{t.genderOtherNote}</small></p>}
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
                  <div className="comic-state"><Sparkles className="comic-state-icon" size={38} /><b>这次没有完成故事图片</b><small>{imageError}</small><div className="comic-fallback-actions"><button className="retry-comic" onClick={() => void runImageGeneration()}><RefreshCw size={15} />重新生成图片</button><button className="skip-comic" disabled={publishing} onClick={attemptPublish}>{publishing ? "正在发布…" : "跳过图片，继续发布"}</button></div></div>
                ) : (
                  <div className="comic-state"><Sparkles className="comic-state-icon" size={38} /><b>把故事高光变成一张插画</b><small>AI 会从正文中选择一个真实、可画的关键瞬间，并按你选择的风格生成</small><button className="retry-comic" onClick={() => void runImageGeneration()}>生成故事图片</button></div>
                )}
              </div>
              {storyImage && <div className="comic-actions"><button className="download-comic" onClick={() => downloadStoryImage(storyImage, draft.title || state.analysis!.suggestedTitle, imageStyle)}><Download size={16} />下载故事图片</button><button className="regenerate-comic" onClick={() => void runImageGeneration()}><RefreshCw size={15} />重新生成</button></div>}
              {storyHighlight && <details className="comic-storyboard"><summary>查看 AI 选中的高光时刻</summary><div className="highlight-detail"><b>{storyHighlight.title}</b><p>{storyHighlight.moment}</p><span>{storyHighlight.scene} · {storyHighlight.action}</span><em>{storyHighlight.emotion}</em>{imagePrompt && <details><summary>查看绘画 Prompt</summary><p>{imagePrompt}</p></details>}</div></details>}
              <p className="comic-privacy">生图是可选项，不会阻止你发布故事。生成时会将故事正文发送给阿里云百炼；每次只生成一张图片并按一张计费。图片只保留在当前页面，刷新后消失。</p>
            </div>
            <div className="publish-note"><Check size={17} />确认后将进入模拟安全检查，并匿名加入故事池。</div>
            {publishError && <p className="api-error" role="alert">{publishError}</p>}
            <PrimaryButton disabled={publishing} onClick={attemptPublish}>{publishing ? "正在发布…" : t.publish}</PrimaryButton>
          </div>
        </section>
      )}
      {moderation && (
        <div className="modal-backdrop">
          <div className="report-dialog moderation-dialog">
            {moderation.flags.map(flag => (
              <div className="moderation-block" key={flag}>
                <h2>{mCopy[flag].title}</h2>
                <p>{mCopy[flag].body}</p>
              </div>
            ))}
            {moderation.samples.length > 0 && (
              <div className="moderation-samples">
                <span>{mCopy.detected}</span>
                {moderation.samples.map((sample, i) => <code key={i}>{sample}</code>)}
              </div>
            )}
            <label className="moderation-appeal">
              <span className="field-name">{mCopy.appeal}</span>
              <input value={appealNote} placeholder={mCopy.appealPlaceholder} onChange={e => setAppealNote(e.target.value)} />
            </label>
            <p className="moderation-note">{mCopy.submitNote}</p>
            <div className="dialog-actions three">
              <button className="button button-ghost" onClick={() => { setModeration(null); setAppealNote(""); }}>{mCopy.revise}</button>
              <button className="button button-ghost" onClick={() => sendToReview("appealed")}>{mCopy.appeal}</button>
              <button className="button button-primary" onClick={() => sendToReview("uncertain")}>{mCopy.submit}</button>
            </div>
          </div>
        </div>
      )}
      {pasteDialog && <div className="modal-backdrop"><div className="report-dialog"><h2>{t.pasteTitle}</h2><div className="dialog-actions"><button className="button button-ghost" onClick={() => setPasteDialog(false)}>{t.pasteYes}</button><button className="button button-primary" onClick={() => setPasteDialog(false)}>{t.pasteOther}</button></div></div></div>}
      {leaveTarget !== null && <div className="modal-backdrop"><div className="report-dialog"><h2>{t.leaveTitle}</h2><div className="dialog-actions three"><button className="button button-ghost" onClick={() => setLeaveTarget(null)}>{t.keepWriting}</button><button className="button button-ghost" onClick={() => confirmLeave(false)}>{t.leaveAnyway}</button><button className="button button-primary" onClick={() => confirmLeave(true)}>{t.saveDraft}</button></div></div></div>}
      {/* 第 3 步（AI 整理）按需求不做引导，所以这里只有 0 / 1 / 3 三个场景 */}
      {wizardTourScene && !pasteDialog && leaveTarget === null && (
        <Tour
          scene={wizardTourScene}
          language={state.language}
          onFinish={onTourFinish}
          onSkip={onTourSkip}
        />
      )}
    </main>
  );
}

function Resonance({ state, update, onBack, onContinue, onHome, themeMode, onThemeModeChange, tourActive, onTourFinish, onTourSkip }: { state: AppState; update: AppUpdate; onBack: () => void; onContinue: () => void; onHome: () => void; themeMode: ThemeMode; onThemeModeChange: (themeMode: ThemeMode) => void } & TourProps) {
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
      {/* 引导的最后一站：走完这里整条引导就结束（见 App 里的 finishTour） */}
      {tourActive("resonance") && (
        <Tour scene="resonance" language={state.language} onFinish={onTourFinish} onSkip={onTourSkip} />
      )}
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

function ReportDialog({ story, onClose, onSubmit }: { story: Story; onClose: () => void; onSubmit?: (reason: string, note: string) => Promise<void> }) {
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
    </> : <><Pill tone="orange">二次确认</Pill><h2>确认提交这次举报？</h2><div className="confirm-report"><span>举报原因</span><b>{reason}</b>{note && <p>{note}</p>}</div><p>提交后会进入人工审核队列。请确认信息准确。</p><div className="dialog-actions"><button className="button button-ghost" onClick={() => setConfirm(false)}>返回修改</button><button className="button button-danger" onClick={() => { void (onSubmit ? onSubmit(reason,note) : Promise.resolve()).then(() => setDone(true)); }}>确认提交举报</button></div></>}
  </div></div>;
}

function Recommendations({ state, update, onEnterAtlas, onHome, themeMode, onThemeModeChange }: { state: AppState; update: (patch: Partial<AppState>) => void; onEnterAtlas: () => void; onHome: () => void; themeMode: ThemeMode; onThemeModeChange: (themeMode: ThemeMode) => void }) {
  const [detail, setDetail] = useState<Story | null>(null);
  const [report, setReport] = useState<Story | null>(null);
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.recommendations().then(batch => setItems(batch.items)).finally(() => setLoading(false)); }, []);
  const recommended = items.map(item => ({ ...item.story, reason: item.reason, recommendationItemId: item.id }));
  const open = (story: Story) => {
    if (!state.openedRecommendations.includes(story.id)) update({ openedRecommendations: [...state.openedRecommendations, story.id] });
    const item = items.find(candidate => candidate.story.id === story.id);
    if (item) void api.openRecommendation(item.id);
    setDetail(story);
  };
  const react = (id: string, reaction: Reaction) => {
    const likedAt = { ...state.likedAt };
    if (reaction === "like") likedAt[id] = Date.now(); else delete likedAt[id];
    update({ reactions: { ...state.reactions, [id]: reaction }, likedAt });
    void (reaction ? api.react(id,reaction) : api.removeReaction(id));
  };
  return <main className={`recommend-page ${themeMode === "night" ? "theme-night" : ""}`}>
    <header className="topbar app-shell-header"><Logo onClick={onHome} /><div className="topbar-actions"><ThemeToggle language={state.language} themeMode={themeMode} onChange={onThemeModeChange} /><LanguageSelect language={state.language} onChange={language => update({ language })} /></div></header>
    <section className="recommend-heading"><div><p className="eyebrow">FIRST CONSTELLATION</p><h1>为你找到的<span className="serif">五则故事。</span></h1><p>至少打开一则，就可以进入完整轻量星图。你不需要读完固定数量。</p></div><PrimaryButton disabled={state.openedRecommendations.length < 1} onClick={onEnterAtlas}>进入故事星图</PrimaryButton></section>
    <section className="recommend-grid">
      {loading && <p>正在为你寻找故事…</p>}
      {!loading && recommended.length === 0 && <p>故事池还没有足够的公开故事，稍后再来看看。</p>}
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
    {report && <ReportDialog story={report} onClose={() => setReport(null)} onSubmit={(reason,note) => api.report(report.id,reason,note).then(() => undefined)} />}
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
  const [state, setState] = useState<AppState>(() => {
    const loaded = { ...loadState(), ...initialRoute };
    /*
     * 加 ?tour=1 可以把新手引导重新打开一次，方便演示和回归验证。
     * 引导一旦看完或跳过就永久关闭，否则想再看一遍只能去清 localStorage。
     */
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("tour")) {
      return { ...loaded, tour: { enabled: true, seen: [] } };
    }
    return loaded;
  });
  const [gatewaySection, setGatewaySection] = useState<"intro" | "preview" | "auth">(() => initialRoute.gatewaySection ?? "intro");
  const [authMode, setAuthMode] = useState<"signup" | "login">(() => initialRoute.authMode ?? "signup");
  const [themeMode, setThemeMode] = useState<ThemeMode>("day");
  const [user, setUser] = useState<User | null>(null);
  const [cloudStories, setCloudStories] = useState<Story[]>([]);
  const [mineIds, setMineIds] = useState<string[]>([]);
  const lastPathRef = useRef<string>(typeof window !== "undefined" ? normalizedPath() : "/");
  const poppingRef = useRef(false);
  const update: AppUpdate = (patch) => setState(previous => ({ ...previous, ...(typeof patch === "function" ? patch(previous) : patch) }));
  useEffect(() => saveState(state), [state]);
  useEffect(() => {
    let active = true;
    api.me().then(async ({ user: currentUser }) => {
      if (!active) return;
      setUser(currentUser);
      const [cloudDraft, resonance, storyList, mine] = await Promise.all([api.currentDraft(), api.getResonance(), api.stories(), api.mine()]);
      if (!active) return;
      setCloudStories(storyList);
      setMineIds(mine.map(story => story.id));
      update({ onboarded: true, accountCreated: true, firstStoryComplete: !cloudDraft, ...(cloudDraft ? { draft: { ...initialState.draft, ...cloudDraft } } : {}), resonance });
    }).catch(async () => {
      const recovery = await loadRecoveryDraft().catch(() => undefined);
      if (active && recovery?.body.trim()) update({ draft: { ...initialState.draft, ...recovery } });
    });
    return () => { active = false; };
  }, []);
  const draftContentKey = [state.draft.guide,state.draft.customGuide,state.draft.title,state.draft.body,state.draft.mood,state.draft.time,state.draft.stage,state.draft.age,state.draft.city,state.draft.cityLat,state.draft.cityLon,state.draft.people.join("|")].join("\u0000");
  useEffect(() => {
    if (!state.draft.title.trim() && !state.draft.body.trim()) return;
    void saveRecoveryDraft(state.draft);
    if (!user) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      api.saveDraft(state.draft).then(saved => {
        if (cancelled) return;
        update(previous => ({ draft: { ...previous.draft, id: saved.id, version: saved.version, savedAt: saved.savedAt, saves: saved.saves } }));
        void clearRecoveryDraft();
      }).catch(() => undefined);
    }, 2000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [draftContentKey, user?.id]);
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

  /*
   * 管理员做完决定：更新队列状态；下架时把对应的星点记下来（星图会过滤掉），
   * 并且只有作者本人的故事才往收件箱推通知。
   */
  const decideReview = (item: ReviewItem, keep: boolean, reason: string, message: InboxMessage) => {
    update(previous => ({
      reviewQueue: previous.reviewQueue.map(entry =>
        entry.id === item.id
          ? { ...entry, status: keep ? "kept" as const : "removed" as const, removalReason: keep ? undefined : reason }
          : entry),
      // 已有同一条故事的通知就就地改成「已有结果」，没有才新插一条
      inbox: !item.mine
        ? previous.inbox
        : previous.inbox.some(m => m.id === `msg-${item.id}`)
          ? previous.inbox.map(m => m.id === `msg-${item.id}`
              ? { ...m, status: "resolved" as const, kind: message.kind, reason: message.reason, createdAt: message.createdAt, read: false }
              : m)
          : [message, ...previous.inbox],
    }));
  };

  /** 审核人员打开某条 → 队列里标记为「审核中」，作者那边的通知同步跟进 */
  const openReview = (item: ReviewItem) => {
    update(previous => ({
      reviewQueue: previous.reviewQueue.map(entry =>
        entry.id === item.id && !entry.opened ? { ...entry, opened: true } : entry),
      inbox: !item.mine ? previous.inbox : previous.inbox.map(m =>
        m.id === `msg-${item.id}` && m.status === "pending"
          ? { ...m, status: "reviewing" as const, read: false }
          : m),
    }));
  };
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
  const publishStory = async (draft: Draft, analysis: NonNullable<AppState["analysis"]>) => {
    const { story } = await api.publish(draft, analysis);
    setCloudStories(previous => [story, ...previous]);
    setMineIds(previous => [story.id, ...previous]);
    await clearRecoveryDraft().catch(() => undefined);
    update({ firstStoryComplete: true, screen: "resonance" });
  };
  const completeAuth = async (input: { mode: "signup" | "login"; displayName: string; email: string; password: string }) => {
    const result = input.mode === "signup"
      ? await api.register({ email: input.email, password: input.password, displayName: input.displayName })
      : await api.login({ email: input.email, password: input.password });
    setUser(result.user);
    const [cloudDraft,resonance,storyList,mine] = await Promise.all([api.currentDraft(),api.getResonance(),api.stories(),api.mine()]);
    setCloudStories(storyList);
    setMineIds(mine.map(story => story.id));
    /*
     * 注册 ＝ 全新账号：重开新手引导，并强制回到第一步。
     * 不重置的话，浏览器里残留的 tour.enabled=false / firstStoryComplete=true
     * 会让新注册的人看不到引导、或者直接掉进星空大厅 —— 而大厅按设计是最后一站。
     * 登录保持上游原逻辑（有云端草稿就续写）。
     */
    const signup = input.mode === "signup";
    update({
      onboarded: true,
      accountCreated: true,
      screen: cloudDraft ? "wizard" : signup ? "wizard" : state.firstStoryComplete ? "atlas" : "wizard",
      ...(cloudDraft ? { draft: { ...initialState.draft, ...cloudDraft } } : {}),
      ...(signup ? { tour: { enabled: true, seen: [] }, firstStoryComplete: false, analysis: null, wizardStep: 0 } : {}),
      resonance,
    });
  };

  /*
   * 新手引导的调度。每个场景只在「引导还开着」且「这个场景没播过」时出现，
   * 所以用户往回退一步不会被同一段引导再拦一次。
   *
   * 「跳过本页」只把当前场景标记成看过，后面的页面照常播 —— 在第一步嫌啰嗦
   * 而跳过，不该连带失去后面所有页面的引导。整条引导只在走完最后一站
   * （星空大厅）时才真正关闭。
   */
  const tourSeen = (scene: TourSceneId) => state.tour.seen.includes(scene);
  const tourActive = (scene: TourSceneId) => state.tour.enabled && !tourSeen(scene);
  const markSeen = (previous: AppState, scene: TourSceneId, done: boolean) => ({
    tour: {
      enabled: done ? false : previous.tour.enabled,
      seen: previous.tour.seen.includes(scene) ? previous.tour.seen : [...previous.tour.seen, scene],
    },
  });
  // 大厅是流程的最后一站，走完＝整条引导结束
  const finishTour = (scene: TourSceneId) => update(previous => markSeen(previous, scene, scene === "lobby"));
  const skipTour = (scene: TourSceneId) => update(previous => markSeen(previous, scene, false));

  let content: React.ReactNode;
  if (state.screen === "admin") {
    content = state.isAdmin
      ? <AdminConsole
          language={state.language}
          themeMode={themeMode}
          queue={state.reviewQueue}
          onDecide={decideReview}
          onOpen={openReview}
          // 退出只清管理员身份，screen 仍是 admin，于是落回管理员登录页
          onLogout={() => update({ isAdmin: false })}
          onResetDemo={() => update({ reviewQueue: initialState.reviewQueue, inbox: [] })}
          onLanguageChange={language => update({ language })}
          onThemeModeChange={setThemeMode}
        />
      : <AdminGate
          language={state.language}
          themeMode={themeMode}
          onBack={() => update({ screen: "intro" })}
          onSignedIn={() => update({ isAdmin: true })}
          onThemeModeChange={setThemeMode}
        />;
  }
  else if (["intro", "icebreaker", "preview", "auth"].includes(state.screen)) {
    content = <PrototypeGateway
      language={state.language}
      onLanguageChange={language => update({ language })}
      onHome={goHome}
      onComplete={completeAuth}
      onAdmin={() => update({ screen: "admin" })}
      section={gatewaySection}
      authMode={authMode}
      onAuthModeChange={setAuthMode}
      onSectionChange={setGatewaySection}
      themeMode={themeMode}
      onThemeModeChange={setThemeMode}
    />;
  }
  else if (state.screen === "wizard") content = <Wizard state={state} update={update} onPublished={publishStory} onHome={goHome} themeMode={themeMode} onThemeModeChange={setThemeMode} tourActive={tourActive} onTourFinish={finishTour} onTourSkip={skipTour} />;
  else if (state.screen === "resonance") content = <Resonance state={state} update={update} onBack={() => update({ screen: "wizard", wizardStep: 3 })} onContinue={() => { void api.saveResonance(state.resonance).then(() => go("recommendations")); }} onHome={goHome} themeMode={themeMode} onThemeModeChange={setThemeMode} tourActive={tourActive} onTourFinish={finishTour} onTourSkip={skipTour} />;
  else if (state.screen === "recommendations") content = <Recommendations state={state} update={update} onEnterAtlas={() => go("atlas")} onHome={goHome} themeMode={themeMode} onThemeModeChange={setThemeMode} />;
  else content = <StoryGalaxy
    language={state.language}
    themeMode={themeMode}
    onLanguageChange={language => update({ language })}
    onThemeModeChange={setThemeMode}
    onWrite={startNewStory}
    onHome={goHome}
    onLogout={() => { void api.logout().finally(() => { setUser(null); setCloudStories([]); setMineIds([]); goHome(); }); }}
    resonance={state.resonance}
    onResonanceChange={resonance => { update({ resonance }); void api.saveResonance(resonance); }}
    stories={cloudStories}
    mineIds={mineIds}
    reactions={state.reactions}
    onReact={(storyId,reaction) => {
      update(previous => ({ reactions:{...previous.reactions,[storyId]:reaction} }));
      void (reaction ? api.react(storyId,reaction) : api.removeReaction(storyId));
    }}
    /*
     * 举报同时做两件事：
     *   1) 上游接口 POST /stories/:id/reports —— 真正写进后端 reports 表
     *   2) 本地审核队列 —— 后端目前只有「创建举报」，还没有给审核台用的
     *      列表 / 认领 / 处理接口，所以审核台的数据先留在前端。
     *      等后端补上这些接口，第 2 段整段删掉即可。
     */
    onReport={(storyId, reason, note) => {
      const sent = api.report(storyId, reason, note).then(() => undefined);
      update(previous => {
        const existing = previous.reviewQueue.find(item => item.nodeId === storyId && item.status === "pending");
        if (existing) {
          return { reviewQueue: previous.reviewQueue.map(item => item === existing
            ? { ...item, bucket: "reported" as const, reportCount: (item.reportCount ?? 0) + 1, reportReasons: [...(item.reportReasons ?? []), reason] }
            : item) };
        }
        const story = cloudStories.find(entry => entry.id === storyId);
        const item: ReviewItem = {
          id: `rv-${crypto.randomUUID()}`,
          nodeId: storyId,
          title: story?.title ?? storyId,
          body: note.trim() ? `${story?.excerpt ?? ""}

（举报补充说明：${note.trim()}）` : (story?.excerpt ?? ""),
          tags: story?.theme ? [story.theme] : [],
          author: story?.author ?? (state.language === "zh" ? "匿名用户" : "Anonymous"),
          city: story?.city ?? "",
          createdAt: Date.now(),
          bucket: "reported",
          status: "pending",
          reportCount: 1,
          reportReasons: [reason],
        };
        return { reviewQueue: [item, ...previous.reviewQueue] };
      });
      return sent;
    }}
    showTour={tourActive("lobby")}
    onTourFinish={() => finishTour("lobby")}
    onTourSkip={() => skipTour("lobby")}
    removedNodeIds={state.reviewQueue.filter(item => item.status === "removed" && item.nodeId).map(item => item.nodeId!)}
    inbox={state.inbox}
    onReadInbox={() => update(previous => ({ inbox: previous.inbox.map(m => ({ ...m, read: true })) }))}
  />;

  return <>{content}</>;
}
