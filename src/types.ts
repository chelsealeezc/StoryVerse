export type Theme = "家庭" | "成长" | "迁移" | "关系" | "工作" | "身份";
export type ResonanceMode = "similar" | "different";
export type Reaction = "like" | "dislike" | null;

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
  title: string;
  body: string;
  mood: string;
  time: string;
  stage: string;
  city: string;
  people: string[];
  startedAt: number;
  edits: number;
  pastedChars: number;
  saves: number;
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
  analysis: Analysis | null;
}
