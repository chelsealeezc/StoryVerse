export type Theme = "家庭" | "成长" | "迁移" | "关系" | "工作" | "身份";
export type ResonanceMode = "similar" | "different";
export type Reaction = "like" | "dislike" | null;
export type Language = "zh" | "en";
export type ThemeReviewStatus = "approved" | "pending_review";

export interface StoryEmotionTag {
  value: string;
  labelZh: string;
  labelEn?: string;
}

export interface StoryEventTypeTag {
  parentType: string;
  parentLabelZh: string;
  subtype: string;
  value: string;
  labelEn: string;
  labelZh: string;
}

export interface StoryThemeTag {
  value: string;
  status: ThemeReviewStatus;
}

export interface StoryTagSet {
  emotions: StoryEmotionTag[];
  eventType: StoryEventTypeTag;
  themes: StoryThemeTag[];
}

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
  tags?: StoryTagSet;
  visualStatus: "ready" | "generating" | "failed" | "blocked";
  x: number;
  y: number;
  reason?: string;
}

export interface Draft {
  id?: string;
  version?: number;
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
  id?: string;
  suggestedTitle: string;
  tags: {
    topic: string[];
    emotion: string[];
    meaning: string[];
    perspective: string[];
  };
  arc: string[];
  storyTags?: StoryTagSet;
}

/** 进入人工审核区的三种来源 */
export type ReviewBucket =
  | "reported"   // 被其它用户举报
  | "uncertain"  // 审核系统不确定是否违规（用户选了「仍然提交」）
  | "appealed";  // 系统误判（作者本人申诉）

export type ReviewStatus = "pending" | "kept" | "removed";

/** 内容审核命中的类别，对应三段柔和提示 */
/** 与 src/moderation.ts 的 ModerationCategory 保持一致（审核准则七类 + 危机） */
export type ModerationFlag =
  | "privacy" | "attack" | "distress" | "crisis"
  | "hate" | "minor" | "explicit" | "spam";

export interface ReviewItem {
  id: string;
  /** 对应星图上的星点 id；有值时下架会让那颗星消失 */
  nodeId?: string;
  title: string;
  body: string;
  tags: string[];
  author: string;
  city: string;
  createdAt: number;
  bucket: ReviewBucket;
  status: ReviewStatus;
  /** 被举报时：举报次数与理由 */
  reportCount?: number;
  reportReasons?: string[];
  /** 机器审核命中的类别 */
  flags?: ModerationFlag[];
  /** 作者申诉时写的说明 */
  appealNote?: string;
  /** 管理员下架时填的理由，会推送到作者收件箱 */
  removalReason?: string;
  /** 是否是当前用户写的，用来决定收件箱要不要收到通知 */
  mine?: boolean;
  /**
   * 审核台内部状态：这条有没有被审核人员打开过。
   * 没打开 = 待审核，打开过 = 审核中。和 status（pending/kept/removed）是两回事 ——
   * status 说的是「处理完了没有」，opened 说的是「有没有人正在看」。
   */
  opened?: boolean;
}

/**
 * 通知的三种状态，对应人工审核的生命周期：
 *   pending   —— 已提交，还没人看（进队列时创建）
 *   reviewing —— 审核人员已经打开了这条（在审核台点开时切换）
 *   resolved  —— 已有结果，kind 才有意义（保留 / 下架）
 */
export type InboxStatus = "pending" | "reviewing" | "resolved";

export interface InboxMessage {
  id: string;
  status: InboxStatus;
  kind: "removed" | "kept" | "flagged";
  storyTitle: string;
  reason: string;
  createdAt: number;
  read: boolean;
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
  /** 人工审核队列（管理员页面的数据源） */
  reviewQueue: ReviewItem[];
  /** 作者收件箱：下架通知、审核结果等 */
  inbox: InboxMessage[];
  /** 是否以管理员身份登录。纯前端演示，不是真实权限控制。 */
  isAdmin: boolean;
}
