export type Theme = "家庭" | "成长" | "迁移" | "关系" | "工作" | "身份";
export type ResonanceMode = "similar" | "different";
export type Reaction = "like" | "dislike" | null;
export type Language = "zh" | "en";

export interface Story {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  author: string;
  city: string;
  stage: string;
  theme: Theme;
  emotion: string;
  meaning: string;
  perspective: string;
  people: string[];
  readMinutes: number;
  visualStatus: "ready" | "generating" | "failed" | "blocked";
  x: number;
  y: number;
  reason?: string;
}

export interface Draft {
  guide: string;
  customGuide: string;
  title: string;
  body: string;
  mood: string;
  time: string;
  stage: string;
  age: string;
  /** "男" | "女" | "其他" | ""（未填）。会传给生图接口，影响画面里的人物呈现。 */
  gender: string;
  city: string;
  cityEn: string;
  cityCountry: string;
  cityLat: number | null;
  cityLon: number | null;
  people: string[];
  startedAt: number;
  edits: number;
  pastedChars: number;
  saves: number;
  savedAt: number;
}

export interface SavedDraft extends Draft {
  id: string;
  savedAt: number;
}

export interface Analysis {
  suggestedTitle: string;
  tags: {
    topic: string[];
    emotion: string[];
    meaning: string[];
    perspective: string[];
  };
  arc: string[];
}

export interface AppState {
  language: Language;
  onboarded: boolean;
  accountCreated: boolean;
  firstStoryComplete: boolean;
  screen: string;
  wizardStep: number;
  openedRecommendations: string[];
  resonance: Record<"city" | "stage" | "theme", ResonanceMode>;
  reactions: Record<string, Reaction>;
  likedAt: Record<string, number>;
  draft: Draft;
  draftBox: SavedDraft[];
  analysis: Analysis | null;
  /**
   * 新手引导。enabled 为 true 表示还在引导流程里（首次访问的默认值）；
   * seen 记录已经播放完的场景，避免退回上一步时重复弹出。
   */
  tour: { enabled: boolean; seen: string[] };
}
