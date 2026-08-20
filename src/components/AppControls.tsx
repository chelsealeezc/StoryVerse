import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import type { Language } from "../types/domain";
import type { ThemeMode } from "../types/ui";
import { BrandLogo } from "./BrandLogo";

export function LanguageSelect({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return (
    <button
      type="button"
      className="neon-control lang-button app-lang-button"
      aria-label={language === "zh" ? "切换语言" : "Switch language"}
      onClick={() => onChange(language === "zh" ? "en" : "zh")}
    >
      <span className={language === "zh" ? "lang-primary" : "lang-secondary"}>中文</span>
      <span className="lang-divider" />
      <span className={language === "en" ? "lang-primary" : "lang-secondary"}>ENG</span>
    </button>
  );
}

export function ThemeToggle({
  language,
  themeMode,
  onChange,
}: {
  language: Language;
  themeMode: ThemeMode;
  onChange: (themeMode: ThemeMode) => void;
}) {
  return (
    <button
      type="button"
      className="neon-control theme-button app-theme-button"
      aria-label={language === "zh" ? "切换白天 / 深夜模式" : "Switch day / night mode"}
      onClick={() => onChange(themeMode === "night" ? "day" : "night")}
    >
      {themeMode === "night" ? "☀" : "☾"}
    </button>
  );
}

export function AppLogo({
  compact = false,
  onClick,
  inverted = false,
  language = "zh",
}: {
  compact?: boolean;
  onClick?: () => void;
  inverted?: boolean;
  language?: Language;
}) {
  const content = <BrandLogo compact={compact} inverted={inverted} />;
  if (onClick) {
    return (
      <button
        className={`logo logo-button ${inverted ? "logo-inverted" : ""}`}
        onClick={onClick}
        aria-label={language === "zh" ? "回到 StoryVerse 首页" : "Back to StoryVerse home"}
      >
        {content}
      </button>
    );
  }
  return <div className={`logo ${inverted ? "logo-inverted" : ""}`}>{content}</div>;
}

export function Pill({ children, tone = "default" }: { children: ReactNode; tone?: string }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  className = "",
  showArrow = true,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  showArrow?: boolean;
}) {
  return (
    <button className={`button button-primary ${className}`} onClick={onClick} disabled={disabled}>
      {children}
      {showArrow && <ArrowRight size={18} />}
    </button>
  );
}
