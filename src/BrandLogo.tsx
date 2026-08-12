import type { CSSProperties } from "react";
import wordmark from "./assets/storyverse-wordmark.svg";

type BrandLogoProps = {
  compact?: boolean;
  inverted?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function BrandLogo({ compact = false, inverted = false, className = "", style }: BrandLogoProps) {
  return (
    <img
      className={`brand-logo ${compact ? "brand-logo-compact" : ""} ${inverted ? "brand-logo-inverted" : ""} ${className}`.trim()}
      src={wordmark}
      alt="StoryVerse"
      draggable={false}
      style={style}
    />
  );
}
