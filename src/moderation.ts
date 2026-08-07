import type { ModerationFlag } from "./types";

/**
 * 发布前的内容安全检查。
 *
 * 现在是跑在浏览器里的本地启发式规则，不发任何请求 —— 真实方案见调研文档：
 * OpenAI Moderation API 国内连不上，要换成百炼的 qwen，并且必须放在服务端
 * （密钥不能进前端产物，和 server/image-generation.ts 一个道理）。
 * 接好之后只要保持 ModerationResult 的结构不变，界面就不用改。
 *
 * 注意文案基调：调研文档明确要求不要直接说「内容违规」，而是给建议、留余地，
 * 并且永远保留「仍然提交」这条路。
 */

export interface ModerationResult {
  flags: ModerationFlag[];
  /** 命中的原文片段，给用户看「是哪一句触发的」 */
  samples: string[];
}

const PRIVACY_PATTERNS: RegExp[] = [
  /1[3-9]\d{9}/,                          // 手机号
  /\d{6}(?:19|20)\d{2}[01]\d[0-3]\d\w{4}/, // 身份证
  /[\w.+-]+@[\w-]+\.[\w.]+/,               // 邮箱
  /[一-龥]{2,4}(?:省|市|区|县)[一-龥0-9]{2,}(?:路|街|号|小区|栋|单元|室)/, // 具体住址
  /(?:身份证|银行卡|护照号|学号|工号)\s*[:：]?\s*\w{4,}/,
];

const ATTACK_WORDS = [
  "傻逼", "垃圾东西", "废物", "去死", "滚蛋", "贱人", "白痴", "神经病",
  "idiot", "stupid bitch", "kill yourself",
];

const DISTRESS_WORDS = [
  "自杀", "自残", "割腕", "轻生", "不想活", "结束生命", "跳楼",
  "suicide", "self-harm", "kill myself",
];

function findWord(text: string, words: string[]) {
  const lower = text.toLowerCase();
  for (const word of words) {
    const index = lower.indexOf(word.toLowerCase());
    if (index !== -1) return text.slice(Math.max(0, index - 12), index + word.length + 12).trim();
  }
  return null;
}

export function moderateStory(text: string): ModerationResult {
  const flags: ModerationFlag[] = [];
  const samples: string[] = [];

  for (const pattern of PRIVACY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      flags.push("privacy");
      samples.push(match[0]);
      break;
    }
  }

  const attack = findWord(text, ATTACK_WORDS);
  if (attack) { flags.push("attack"); samples.push(attack); }

  const distress = findWord(text, DISTRESS_WORDS);
  if (distress) { flags.push("distress"); samples.push(distress); }

  return { flags, samples };
}

/** 三类命中各自的柔和文案，措辞按调研文档给的原话。 */
export const moderationCopy = {
  zh: {
    privacy: {
      title: "先确认一下隐私",
      body: "我们检测到故事中可能包含真实姓名、电话号码或地址。如果希望分享给更多人，建议先进行匿名处理。",
    },
    attack: {
      title: "有一句可能会伤到人",
      body: "为了营造友善的故事社区，建议调整其中可能伤害他人的表达。",
    },
    distress: {
      title: "这段经历听起来不容易",
      body: "我们注意到你的故事可能涉及令人痛苦的经历。如果这是你的真实经历，你仍然可以记录它，但可能无法公开展示。",
    },
    detected: "检测到的片段",
    revise: "继续修改",
    submit: "仍然提交",
    appeal: "这是误判，申请复核",
    appealPlaceholder: "可以说明一下为什么这不算违规（选填）",
    submitNote: "选择「仍然提交」后，故事会先进入人工审核区，通过后才会公开。",
  },
  en: {
    privacy: {
      title: "One privacy check first",
      body: "We spotted what may be a real name, phone number or address. If you want this seen widely, consider anonymising it first.",
    },
    attack: {
      title: "One line might land badly",
      body: "To keep this a kind place to tell stories, consider softening the wording that could hurt someone.",
    },
    distress: {
      title: "That sounds like a hard stretch",
      body: "We noticed your story may touch on painful experiences. If this is what you lived, you can still record it — but it may not be shown publicly.",
    },
    detected: "What triggered this",
    revise: "Keep editing",
    submit: "Submit anyway",
    appeal: "This is a misjudgement — request review",
    appealPlaceholder: "Tell us why you think this isn't a violation (optional)",
    submitNote: "If you submit anyway, the story goes to human review first and is published once cleared.",
  },
} as const;
