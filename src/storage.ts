import { emptyDraft } from "./data";
// 演示用假数据：刻意保留，后端审核接口就绪后连同 src/admin-mock.ts 一起删掉
import { demoInbox, demoReviewQueue } from "./admin-mock";
import type { AppState } from "./types";

const KEY = "storyverse.preferences.v1";

export const initialState: AppState = {
  language: "zh",
  onboarded: false,
  accountCreated: false,
  firstStoryComplete: false,
  screen: "intro",
  wizardStep: 0,
  openedRecommendations: [],
  resonance: { city: "similar", stage: "different", theme: "similar" },
  reactions: {},
  likedAt: {},
  draft: emptyDraft,
  draftBox: [],
  analysis: null,
  // 首次访问：localStorage 里没有记录，enabled 保持 true，引导就会自动播放
  tour: { enabled: true, seen: [] },
  reviewQueue: demoReviewQueue,   // 演示用；接后端后改为 []
  inbox: demoInbox,               // 演示用；接后端后改为 []
  isAdmin: false,
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    /*
     * 上游已经把草稿 / 故事 / 共鸣偏好挪到后端，本地只留 language。
     * 这里额外保留的四项都是「后端还没有对应接口」的东西：
     *   tour        —— 引导进度，理想上应该按用户存在服务端
     *   reviewQueue —— 人工审核队列，后端已有 reports 表但没有审核接口
     *   inbox       —— 审核结果通知，后端还没有 notifications 表
     *   isAdmin     —— 纯前端演示开关，真实角色校验必须走服务端
     * 接口就绪后这四项都应该删掉，改为服务端状态。
     */
    return parsed ? {
      ...initialState,
      language: parsed.language ?? "zh",
      tour: { ...initialState.tour, ...(parsed.tour ?? {}) },
      reviewQueue: parsed.reviewQueue ?? initialState.reviewQueue,
      inbox: parsed.inbox ?? initialState.inbox,
      isAdmin: parsed.isAdmin ?? false,
    } : initialState;
  } catch {
    return initialState;
  }
}

export function saveState(state: AppState) {
  /*
   * 上游只再持久化 language（其余状态都回后端了）。这里必须把 loadState 里
   * 额外恢复的四项一起写回去 —— 只读不写的话，刷新一次引导进度、审核队列和
   * 收件箱就全没了。等后端补上对应接口，这四项连同 loadState 里的一起删掉。
   */
  localStorage.setItem(KEY, JSON.stringify({
    language: state.language,
    tour: state.tour,
    reviewQueue: state.reviewQueue,
    inbox: state.inbox,
    isAdmin: state.isAdmin,
  }));
}

export function resetState() {
  localStorage.removeItem(KEY);
}
