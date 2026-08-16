/**
 * 发布前的内容安全检查 —— 按《人生故事网站内容审核准则（柔性提示版）》实现。
 *
 * 现在是跑在浏览器里的本地启发式规则，不发任何请求。真实方案见调研文档：
 * OpenAI Moderation 国内连不上，要换成百炼 qwen，并且必须放在服务端
 * （密钥不能进前端产物，和 server/image-generation.ts 一个道理）。
 * 接好之后只要保持 ModerationResult 的结构不变，界面就不用改。
 *
 * 核心设计原则（来自准则第一节）：
 *   · 不做裁判，做温和的陪伴者 —— 不出现「违规」「禁止」「不合规」
 *   · 保留自主权 —— 除 L3 外永远给「仍然提交」
 *   · 区分「记录」与「公开」—— L2 提供私密保存，而不是彻底拦截
 */

export type ModerationLevel = "L1" | "L2" | "L3";

export type ModerationCategory =
  | "privacy"      // 隐私泄露
  | "attack"       // 攻击性 / 辱骂
  | "distress"     // 危险 / 创伤触发（回顾性叙述）
  | "crisis"       // 疑似当下正处于危机 —— 特殊流程，不走常规审核
  | "hate"         // 仇恨言论与歧视
  | "minor"        // 涉及未成年人的不当内容
  | "explicit"     // 露骨性内容
  | "spam";        // 广告与垃圾营销

/** 命中出现在哪一部分。标题和正文都出现时是 "both"，提示里要两边都说。 */
export type ModerationWhere = "title" | "body" | "both";

export interface ModerationHit {
  category: ModerationCategory;
  level: ModerationLevel;
  /** 命中的原文片段，给用户看「是哪一句触发的」 */
  sample: string;
  /** 触发的词本身，用来判断它出现在标题还是正文 */
  term: string;
  where: ModerationWhere;
}

export interface ModerationResult {
  hits: ModerationHit[];
  /** 全篇取最高等级，决定弹窗给哪组按钮 */
  level: ModerationLevel | null;
  /** 危机信号独立标记：安全优先，不适用常规流程 */
  crisis: boolean;
}

/* ── 识别信号 ─────────────────────────────────────────────── */

const PRIVACY_PATTERNS: RegExp[] = [
  /1[3-9]\d{9}/,                                    // 手机号
  /\d{6}(?:19|20)\d{2}[01]\d[0-3]\d[\dxX]{4}/,      // 身份证
  /[\w.+-]+@[\w-]+\.[\w.]+/,                        // 邮箱
  /[一-龥]{2,4}(?:省|市|区|县)[一-龥0-9]{2,}(?:路|街|号|小区|栋|单元|室)/,
  /(?:身份证|银行卡|护照号|学号|工号|微信号|QQ)\s*[:：]?\s*\w{4,}/,
];

/** 第三方身份信息：出现在隐私命中附近时升级为 L2 */
const THIRD_PARTY_HINTS = ["我同事", "我同学", "我室友", "我前夫", "我前妻", "我老板", "他的电话", "她的电话", "他家住", "她家住"];
const MINOR_HINTS = ["我女儿", "我儿子", "未成年", "小学生", "初中生", "上小学", "上初中"];

const ATTACK_WORDS = ["傻逼", "垃圾东西", "废物", "去死", "滚蛋", "贱人", "白痴", "神经病",
  "idiot", "moron", "scumbag", "piece of trash", "kill yourself", "go to hell"];
/** 人肉搜索式攻击 / 煽动骚扰 → L3 */
const DOXX_WORDS = ["他的地址是", "她的地址是", "大家去骂", "人肉他", "人肉她", "曝光他的", "曝光她的", "去骚扰"];

/** 回顾性创伤叙述 → L2 */
/*
 * 回顾性创伤叙述 → L2。
 * 注意这里刻意不收单个 "die"/"death" —— 「我外婆去世了」是完全正当的故事，
 * 收进来会大量误伤。只匹配指向自身、意图明确的短语。
 */
const DISTRESS_WORDS = ["自杀", "自残", "割腕", "轻生", "不想活", "活不下去", "撑不下去",
  "结束生命", "结束这一切", "跳楼", "跳下去", "上吊", "服毒",
  "suicide", "suicidal", "self-harm", "self harm",
  "want to die", "wanted to die", "wanna die", "wish i was dead",
  "wished i were dead", "end my life", "end it all", "take my own life",
  "kill myself", "killed myself", "killing myself", "wanted to kill myself",
  "thought about killing myself", "hurt myself", "harm myself", "cut myself",
  "unalive myself", "off myself"];

/*
 * 只用来看标题的词表。
 * 正文里的 "die" 几乎总是有上下文（「我外婆去世了」），所以 DISTRESS_WORDS 刻意不收；
 * 但标题只有一个「die」时并没有上下文可以消歧 —— 它要么是测试输入，要么就是求助信号。
 * 两种情况都不该直接放行，所以标题单独走一条更严的规则。
 */
const BARE_HARM_TITLES = ["die", "death", "dead", "kill", "kill me", "suicide", "end it",
  "死", "去死", "想死", "自杀", "轻生", "结束"];
/** 具体方法 / 剂量 → L3，不论叙述目的 */
const METHOD_WORDS = ["吃了多少片", "多少毫克", "怎么割", "上吊的方法", "烧炭", "药物过量",
  "how to kill myself", "how many pills", "overdose on", "easiest way to die",
  "jump off a building", "jump off the building", "jump off the roof", "jump off a bridge",
  "hang myself", "slit my wrists", "slit my wrist"];
/** 疑似当下危机 → 特殊流程 */
const CRISIS_WORDS = ["我现在就想死", "我准备好了", "今晚就结束", "我正在计划", "我打算今天", "写完这个我就",
  "我想结束这一切", "我已经准备好了", "我打算今晚",
  "i want to die right now", "tonight is the night", "i have a plan", "after i write this i"];

const HATE_WORDS = ["残废", "瘸子", "疯子该关起来", "那种人就是", "他们那个地方的人都"];
const SEVERE_HATE = ["都该死", "应该被清除", "滚出这个国家"];

const MINOR_EXPLICIT = ["未成年人的身体", "小女孩的身体", "小男孩的身体"];
const EXPLICIT_WORDS = ["做爱的细节", "性行为描写", "脱光了她", "脱光了他", "explicit sex", "graphic sex"];

const SPAM_PATTERNS: RegExp[] = [
  /(https?:\/\/[^\s]+){2,}/,
  /(加微信|加我微信|扫码|优惠券|限时折扣|代购|招代理)/,
  /(add me on wechat|dm me for|limited offer|discount code|buy now)/i,
];

/* ── 匹配工具 ─────────────────────────────────────────────── */

type Match = { term: string; sample: string };
type Found = { inTitle: Match | null; inBody: Match | null };

/**
 * 去掉所有空白，同时记下每个字符在原文里的位置。
 * 这样 "killmyself"、"kill  myself"、"kill
myself" 都能匹配到 "kill myself"，
 * 而报给用户看的片段仍然是原文的样子。
 */
function squash(text: string) {
  let squashed = "";
  const positions: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) continue;
    squashed += text[i].toLowerCase();
    positions.push(i);
  }
  return { squashed, positions };
}

/*
 * 高信号的自伤短语单独再做一次容错匹配。
 * 用户实际打出来的是 "killmyslef" —— 两个字母调换了位置，精确匹配一个都收不到。
 * 这种词打错一两个字母太常见了，而漏掉的代价远大于偶尔多问一句。
 *
 * 只对这批长短语做容错：短词（"die"、"死"）做容错会把 did / dye / diet 全扫进来。
 */
/** 具体方法 → L3。打错字的方法描述仍然是方法描述，等级不该因此降下来。 */
const FUZZY_METHOD_PHRASES = [
  "how to kill myself", "jump off a building", "jump off the building",
  "jump off the roof", "jump off a bridge", "hang myself",
  "slit my wrists", "slit my wrist", "overdose on",
];
/** 回顾性叙述 → L2 */
const FUZZY_DISTRESS_PHRASES = [
  "kill myself", "killing myself", "wanted to kill myself", "end my life",
  "take my own life", "hurt myself", "harm myself", "cut myself",
  "unalive myself", "want to die", "wanted to die", "wanna die",
  "commit suicide", "suicide",
];

/**
 * Damerau-Levenshtein 距离，超过 max 就提前退出。
 * 比普通 Levenshtein 多认一种「相邻两个字符调换」，正好是 killmyself → killmyslef 这种手误。
 */
function editDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, prev2[j - 2] + 1);
      }
      row.push(value);
      if (value < best) best = value;
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = row;
  }
  return prev[b.length];
}

/** 允许的手误个数：短语越长，容忍度越高一点 */
function slackFor(length: number) {
  return length >= 14 ? 2 : 1;
}

function findFuzzy(text: string, phrases: string[]): Match | null {
  const { squashed, positions } = squash(text);
  for (const phrase of phrases) {
    const needle = phrase.toLowerCase().replace(/\s+/g, "");
    const slack = slackFor(needle.length);
    for (let width = needle.length - slack; width <= needle.length + slack; width++) {
      if (width < 4) continue;
      for (let start = 0; start + width <= squashed.length; start++) {
        const window = squashed.slice(start, start + width);
        // 先用首字母粗筛，省掉绝大多数窗口的距离计算
        if (window[0] !== needle[0] && window[1] !== needle[0] && window[0] !== needle[1]) continue;
        if (editDistance(window, needle, slack) > slack) continue;
        const from = positions[start];
        const to = positions[start + width - 1] + 1;
        return {
          term: text.slice(from, to),
          sample: text.slice(Math.max(0, from - 12), to + 12).trim(),
        };
      }
    }
  }
  return null;
}

function findWord(text: string, words: string[]): Match | null {
  const { squashed, positions } = squash(text);
  for (const word of words) {
    const needle = word.toLowerCase().replace(/\s+/g, "");
    if (!needle) continue;
    const at = squashed.indexOf(needle);
    if (at === -1) continue;
    const start = positions[at];
    const end = positions[at + needle.length - 1] + 1;
    return {
      term: text.slice(start, end),
      sample: text.slice(Math.max(0, start - 12), end + 12).trim(),
    };
  }
  return null;
}

/**
 * 标题去掉标点空白后如果就是一个自伤类词，返回它，否则返回 null。
 * 只对「整个标题」成立时才算命中 ——「妈妈去世的那天」不会被匹配。
 */
function findBareHarmTitle(title: string): Match | null {
  const bare = title.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
  if (!bare) return null;
  return BARE_HARM_TITLES.some(word => bare === word.replace(/\s/g, ""))
    ? { term: title.trim(), sample: title.trim() }
    : null;
}

function findPattern(text: string, patterns: RegExp[]): Match | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return { term: match[0], sample: match[0] };
  }
  return null;
}

const LEVEL_ORDER: Record<ModerationLevel, number> = { L1: 1, L2: 2, L3: 3 };

/* ── 主函数 ───────────────────────────────────────────────── */

export function moderateStory(text: string, title = "", body?: string): ModerationResult {
  const hits: ModerationHit[] = [];
  /*
   * 同一个词可能标题和正文里都有。之前只报一处，用户改完标题以为过了，
   * 结果正文里还留着 —— 所以这里把两边都查一遍。
   * body 没传时，从 text 里把标题那一段去掉当作正文。
   */
  const bodyText = body ?? (title && text.startsWith(title) ? text.slice(title.length) : text);

  /**
   * 标题和正文分开扫。合起来扫的话只会报最先命中的那一处 ——
   * 用户改完就以为过了，另一处还留着。
   * 两边命中的是同一个词就合成一条（where: "both"），不同的词就报两条。
   */
  const push = (category: ModerationCategory, level: ModerationLevel, found: Found) => {
    const { inTitle, inBody } = found;
    if (inTitle && inBody) {
      const same = (a: string) => a.toLowerCase().replace(/\s+/g, "");
      if (same(inTitle.term) === same(inBody.term)) {
        hits.push({ category, level, sample: inTitle.sample, term: inTitle.term, where: "both" });
      } else {
        hits.push({ category, level, sample: inTitle.sample, term: inTitle.term, where: "title" });
        hits.push({ category, level, sample: inBody.sample, term: inBody.term, where: "body" });
      }
      return;
    }
    const only = inTitle ?? inBody;
    if (only) hits.push({ category, level, sample: only.sample, term: only.term, where: inTitle ? "title" : "body" });
  };

  const scanWords = (words: string[]): Found => ({
    inTitle: findWord(title, words),
    inBody: findWord(bodyText, words),
  });
  /** 精确匹配没中的话再做一次容错匹配 */
  const scanFuzzy = (words: string[], phrases: string[]): Found => {
    const exact = scanWords(words);
    return {
      inTitle: exact.inTitle ?? findFuzzy(title, phrases),
      inBody: exact.inBody ?? findFuzzy(bodyText, phrases),
    };
  };
  const scanPatterns = (patterns: RegExp[]): Found => ({
    inTitle: findPattern(title, patterns),
    inBody: findPattern(bodyText, patterns),
  });
  const hasAny = (found: Found) => Boolean(found.inTitle || found.inBody);

  // 1. 隐私 —— 默认 L1；涉及未成年人或第三方身份信息升级 L2
  const privacy = scanPatterns(PRIVACY_PATTERNS);
  if (hasAny(privacy)) {
    const thirdParty = findWord(text, THIRD_PARTY_HINTS) || findWord(text, MINOR_HINTS);
    push("privacy", thirdParty ? "L2" : "L1", privacy);
  }

  // 2. 攻击 —— L1；人肉搜索式攻击升级 L3
  const doxx = scanWords(DOXX_WORDS);
  if (hasAny(doxx)) push("attack", "L3", doxx);
  else {
    const attack = scanWords(ATTACK_WORDS);
    if (hasAny(attack)) push("attack", "L1", attack);
  }

  // 3. 危险 / 创伤 —— 危机 > 具体方法 > 回顾性叙述
  const crisis = scanWords(CRISIS_WORDS);
  const method = scanFuzzy(METHOD_WORDS, FUZZY_METHOD_PHRASES);
  const distress = scanFuzzy(DISTRESS_WORDS, FUZZY_DISTRESS_PHRASES);
  // 标题只有一个自伤词时没有上下文可以消歧，单独收一条（正文里的 "die" 仍然不算）
  const bareTitle = findBareHarmTitle(title);
  if (bareTitle && !distress.inTitle) distress.inTitle = bareTitle;

  if (hasAny(crisis)) push("crisis", "L3", crisis);
  else if (hasAny(method)) push("distress", "L3", method);
  else if (hasAny(distress)) push("distress", "L2", distress);

  /*
   * 上面三个分支是互斥的（危机 > 具体方法 > 回顾性叙述），只会报赢的那一个。
   * 但标题和正文可能各自踩到不同的分支 —— 比如标题写「die」、正文写「jump off a building」，
   * 赢的是正文的 L3，标题那条就被吃掉了，用户改完正文还以为标题没问题。
   * 所以这里补一条：只要标题有信号而上面没报到标题，就单独再报一条。
   */
  const titleSignal = crisis.inTitle ?? method.inTitle ?? distress.inTitle;
  if (titleSignal && !hits.some(hit => hit.where === "title" || hit.where === "both")) {
    const titleLevel: ModerationLevel = crisis.inTitle ? "L3" : method.inTitle ? "L3" : "L2";
    hits.push({
      category: crisis.inTitle ? "crisis" : "distress",
      level: titleLevel,
      sample: titleSignal.sample,
      term: titleSignal.term,
      where: "title",
    });
  }

  // 4. 仇恨与歧视 —— 轻度 L1；系统性 L3
  const severeHate = scanWords(SEVERE_HATE);
  if (hasAny(severeHate)) push("hate", "L3", severeHate);
  else {
    const hate = scanWords(HATE_WORDS);
    if (hasAny(hate)) push("hate", "L1", hate);
  }

  // 5. 涉及未成年人的不当内容 —— 始终 L3，无例外
  const minor = scanWords(MINOR_EXPLICIT);
  if (hasAny(minor)) push("minor", "L3", minor);

  // 6. 露骨性内容 —— L2
  const explicit = scanWords(EXPLICIT_WORDS);
  if (hasAny(explicit)) push("explicit", "L2", explicit);

  // 7. 广告垃圾 —— L2
  const spam = scanPatterns(SPAM_PATTERNS);
  if (hasAny(spam)) push("spam", "L2", spam);

  const level = hits.length
    ? hits.reduce<ModerationLevel>((max, hit) => LEVEL_ORDER[hit.level] > LEVEL_ORDER[max] ? hit.level : max, "L1")
    : null;

  return { hits, level, crisis: hits.some(hit => hit.category === "crisis") };
}

/* ── 文案 ─────────────────────────────────────────────────── */
/*
 * 语气规则（准则第七节）：共情/观察 → 说明潜在影响 → 给出仍可行的路径 → 保留选择权。
 * 一律以「我们 / StoryVerse」的口吻，不用「系统」「AI」，不出现「违规」。
 */

export const moderationCopy = {
  zh: {
    categories: {
      privacy: {
        title: "先确认一下隐私",
        body: "我们检测到故事中可能包含真实姓名、电话号码或地址。如果希望分享给更多人，建议先进行匿名处理（如昵称、称谓等）。",
      },
      attack: {
        title: "有一句可能会伤到人",
        body: "为了营造友善的故事社区，建议调整其中可能伤害他人的表达。",
      },
      distress: {
        title: "这段经历听起来不容易",
        body: "我们注意到你的故事可能涉及令人痛苦的经历。如果这是你的真实经历，你仍然可以记录它，但可能无法公开展示。",
      },
      crisis: {
        title: "先照顾好你自己",
        body: "看起来你现在可能正在经历很艰难的时刻。你的感受是真实且重要的。如果你需要，可以先缓一缓，再寻求专业人士的帮助 —— 你的安全和感受，比这个故事重要得多。",
      },
      hate: {
        title: "某些表达可能会让人不适",
        body: "故事中的某些表达可能会让部分读者感到被冒犯，是否要调整一下措辞？",
      },
      minor: {
        title: "这部分我们需要人工看一下",
        body: "这段内容涉及未成年人相关的描写，已转交人工审核。你可以先写一个别的故事。",
      },
      explicit: {
        title: "这段描写比较私密",
        body: "这段内容涉及较为私密的描写，建议确认是否希望所有读者都能看到。StoryVerse 面向全年龄段，若坚持提交，可能无法公开。",
      },
      spam: {
        title: "这里更适合真实的故事",
        body: "这里更适合分享真实的人生故事，推广类内容会被系统屏蔽。要不要调整一下？",
      },
    } as Record<ModerationCategory, { title: string; body: string }>,
    detected: "检测到的片段",
    whereTitle: "标题", whereBody: "正文", whereBoth: "标题和正文都出现",
    // L1
    revise: "继续修改",
    submit: "仍然提交",
    submitNote: "选择「仍然提交」后，故事会正常发布。",
    // L2
    savePrivate: "仅保存为私密日记",
    applyPublic: "修改后申请公开审核",
    noteL2: "这段内容更适合先留给自己。你仍然可以完整记录它，只是暂时不公开展示。",
    // L3
    blocked: "已转人工审核",
    writeAnother: "写一个别的故事",
    noteL3: "这一篇已经转交人工审核，暂时无法发布。你随时可以再写一个故事。",
    // 危机
    crisisAction: "我知道了，先缓一缓",
    crisisSecondary: "我没事，继续写",
  },
  en: {
    categories: {
      privacy: {
        title: "One privacy check first",
        body: "We spotted what may be a real name, phone number or address. If you want this seen widely, consider anonymising it first (a nickname or a relationship word works well).",
      },
      attack: {
        title: "One line might land badly",
        body: "To keep this a kind place to tell stories, consider softening the wording that could hurt someone.",
      },
      distress: {
        title: "That sounds like a hard stretch",
        body: "We noticed your story may touch on painful experiences. If this is what you lived, you can still record it — but it may not be shown publicly.",
      },
      crisis: {
        title: "Take care of yourself first",
        body: "It sounds like you may be going through something really hard right now. What you feel is real and it matters. Take a pause if you need one, and consider reaching out to someone qualified — your safety matters far more than this story does.",
      },
      hate: {
        title: "Some wording may sting",
        body: "A few phrases here might land badly with some readers. Would you like to adjust the wording?",
      },
      minor: {
        title: "A person will review this",
        body: "This passage involves a minor, so it has been sent for human review. You're welcome to write a different story in the meantime.",
      },
      explicit: {
        title: "This part is quite intimate",
        body: "This passage is fairly explicit. StoryVerse is open to all ages — if you submit anyway, it may not be shown publicly.",
      },
      spam: {
        title: "This place is for real stories",
        body: "This space is for lived stories; promotional content gets filtered out. Want to adjust it?",
      },
    } as Record<ModerationCategory, { title: string; body: string }>,
    detected: "What triggered this",
    whereTitle: "in the title", whereBody: "in the story", whereBoth: "in both the title and the story",
    revise: "Keep editing",
    submit: "Submit anyway",
    submitNote: "If you submit anyway, the story publishes normally.",
    savePrivate: "Keep it as a private entry",
    applyPublic: "Edit, then request review",
    noteL2: "This one may be better kept for yourself for now. You can still record it in full — it just won't be shown publicly yet.",
    blocked: "Sent for human review",
    writeAnother: "Write a different story",
    noteL3: "This one has gone to human review and can't be published yet. You're welcome to write another whenever you like.",
    crisisAction: "Got it — I'll pause",
    crisisSecondary: "I'm okay, keep writing",
  },
} as const;
