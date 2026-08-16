import { cities } from "../data/cities";
import type { City } from "../data/cities";

export interface StoryHints {
  city: City | null;
  age: number | null;
}

const CN_DIGITS: Record<string, number | undefined> = {
  零: 0,
  〇: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

// 「在 / 去 / 到 / 回 …上海」这类前缀，说明大概率真的在说地点
const PREPOSITIONS = "在去到回从来往赴离";
// 容易误伤的组合：大理石 ≠ 大理
const FALSE_FRIENDS: Record<string, string[] | undefined> = { 大理: ["石"], 米兰: ["达"], 罗马: ["尼"] };

function parseChineseNumber(text: string): number | null {
  if (/^\d+$/.test(text)) return Number(text);
  const t = text.replace(/廿/g, "二十").replace(/卅/g, "三十");
  if (!/^[零〇一二两三四五六七八九十]+$/.test(t)) return null;
  if (t === "十") return 10;
  const tenIndex = t.indexOf("十");
  if (tenIndex === -1) {
    let value = 0;
    for (const char of t) {
      const digit = CN_DIGITS[char];
      if (digit === undefined) return null;
      value = value * 10 + digit;
    }
    return value;
  }
  const head = t.slice(0, tenIndex);
  const tail = t.slice(tenIndex + 1);
  const tens = head ? CN_DIGITS[head] : 1;
  const ones = tail ? CN_DIGITS[tail] : 0;
  if (tens === undefined || ones === undefined) return null;
  return tens * 10 + ones;
}

const AGE_PATTERNS = [
  /(\d{1,3})\s*(?:岁|周岁)/,
  /([零〇一二两三四五六七八九十廿卅]{1,4})\s*(?:岁|周岁)/,
  /(?:那年|当时|今年)\s*(?:我|他|她|它)?\s*(\d{1,3})/,
  /(\d{1,3})\s*years?\s*old/i,
];

export function extractAge(text: string): number | null {
  for (const pattern of AGE_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = parseChineseNumber(match[1]);
    if (value !== null && value >= 1 && value <= 120) return value;
  }
  return null;
}

export function extractCity(text: string): City | null {
  let best: { city: City; score: number } | null = null;
  for (const city of cities) {
    const needles = [city.name, ...city.aliases.filter((alias) => /[一-龥]{2,}/.test(alias))];
    for (const needle of needles) {
      const index = text.indexOf(needle);
      if (index === -1) continue;
      const before = index > 0 ? text[index - 1] : "";
      const after = text[index + needle.length] ?? "";
      if (FALSE_FRIENDS[needle]?.includes(after)) continue;
      let score = 1 + needle.length * 0.1;
      if (PREPOSITIONS.includes(before)) score += 3;
      if (after === "市" || after === "的") score += 1;
      if (!best || score > best.score) best = { city, score };
    }
  }
  return best ? best.city : null;
}

/**
 * 「简单识别」：从正文里读出城市与年龄，只用来给用户一个可点可忽略的填空建议。
 * 这里是浏览器内的启发式规则，不上传正文，也不依赖远端服务。
 */
export function extractHints(text: string): StoryHints {
  const trimmed = text.trim();
  if (trimmed.length < 8) return { city: null, age: null };
  return { city: extractCity(trimmed), age: extractAge(trimmed) };
}
