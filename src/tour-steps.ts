/**
 * 新手引导的内容与顺序。
 *
 * 每个「场景」(TourScene) 对应一个页面/步骤，进入该页面时如果还没看过就自动播放。
 * 只写数据，不含任何 DOM 逻辑 —— 渲染与定位都在 Tour.tsx 里。
 */

export type TourSceneId = "lobby" | "guide" | "collection" | "confirm" | "resonance";

export type Placement = "top" | "bottom" | "left" | "right" | "center";

export interface TourStep {
  /** 高亮目标的 CSS 选择器。留空则居中显示，不挖洞。 */
  target?: string;
  /** 气泡相对目标的方向，默认自动选择。 */
  placement?: Placement;
  /** 高亮框的额外内边距，默认 8px。 */
  pad?: number;
  /**
   * 允许用户真的点到被高亮的控件（默认整层拦住点击，只能靠按钮推进）。
   * 语言切换那一步必须开着，否则看不懂中文的人被卡在第一步。
   */
  interactive?: boolean;
  zh: { title: string; body: string };
  en: { title: string; body: string };
}

export interface TourScene {
  id: TourSceneId;
  /** 最后一步按钮的文案；不填用默认的「完成」。 */
  finishLabel?: { zh: string; en: string };
  steps: TourStep[];
}

const scenes: Record<TourSceneId, TourScene> = {
  /* ── 1. 星空大厅 ───────────────────────────────────────────── */
  lobby: {
    id: "lobby",
    finishLabel: { zh: "开始逛逛 ✦", en: "Start exploring ✦" },
    steps: [
      {
        placement: "center",
        zh: {
          title: "欢迎来到 StoryVerse ✦",
          body: "这里是星空大厅 —— 每一颗星，都是某个真实的人写下的一段经历。\n\n花一分钟，我带你认识一下这片星空。随时可以按 Esc 跳过。",
        },
        en: {
          title: "Welcome to StoryVerse ✦",
          body: "This is the Star Lobby — every star out there is a real experience, written by a real person.\n\nGive me a minute and I'll show you around. Press Esc to skip anytime.",
        },
      },
      {
        target: ".bottom-legend",
        placement: "top",
        zh: {
          title: "怎么读这片星空",
          body: "星点不是随便撒的：\n\n· 大小 —— 故事写得越长，星越大\n· 颜色 —— 对应故事的主题\n· 距离 —— 离你越近，跟你越像\n\n点任意一颗，就能读到那个故事。",
        },
        en: {
          title: "How to read the sky",
          body: "The stars aren't scattered at random:\n\n· Size — longer stories shine bigger\n· Colour — the story's theme\n· Distance — the closer, the more it resembles yours\n\nClick any star to read it.",
        },
      },
      {
        target: "[data-tour='top-controls']",
        placement: "bottom",
        zh: {
          title: "旁边还有两个",
          body: "左边那颗月亮切白天 / 夜晚主题，右边的放大镜用来搜索特定的故事。",
        },
        en: {
          title: "Two more up here",
          body: "The moon on the left flips between day and night themes; the magnifier on the right searches for specific stories.",
        },
      },
      {
        target: "[data-tour='nav-explore']",
        placement: "top",
        zh: { title: "探索故事", body: "默认视角。整片星空都在这里，适合漫无目的地逛一逛。" },
        en: { title: "Explore", body: "The default view. The whole sky, best for wandering with no particular destination." },
      },
      {
        target: "[data-tour='nav-mine']",
        placement: "top",
        zh: { title: "我的故事", body: "只留下你自己写的那些星。刚开始这里是空的 —— 等下我们就来点亮第一颗。" },
        en: { title: "My stories", body: "Only the stars you wrote. Empty for now — we're about to light up the first one." },
      },
      {
        target: "[data-tour='nav-resonance']",
        placement: "top",
        interactive: true,
        // 文案要短：点开后「调整属性」浮窗停在屏幕正中，卡片一高就会压住它，
        // 用户反而看不到自己点出来的东西。压到两行以内正好落在浮窗下方。
        zh: {
          title: "调整属性 —— 点开看看",
          body: "按城市、人生阶段、主题，决定你想看到相近还是不同的故事。",
        },
        en: {
          title: "Resonance — open it",
          body: "By city, life stage and theme: stories close to yours, or nothing like it.",
        },
      },
      {
        target: "[data-tour='nav-liked']",
        placement: "top",
        zh: { title: "喜欢记录", body: "读到戳中你的故事，点个喜欢，它就会留在这里。" },
        en: { title: "Liked", body: "When a story lands, hit like — it'll be waiting here for you." },
      },
      {
        target: "[data-tour='nav-write']",
        placement: "top",
        zh: {
          title: "还想再写一个？",
          body: "这颗「＋」随时在。想到什么就回来写，不用等到「值得记录」的那天。",
        },
        en: {
          title: "Want to write another?",
          body: "That “+” is always here. Come back whenever something surfaces — no need to wait for a story that feels “worth it”.",
        },
      },
      {
        target: "[data-tour='account-dock']",
        placement: "right",
        zh: {
          title: "消息与账户",
          body: "故事被处理、被下架，或者审核有结果，都会出现在这里的收件箱。\n\n引导到这里就结束啦 —— 星空是你的了 🎉",
        },
        en: {
          title: "Messages & account",
          body: "If a story of yours gets reviewed or taken down, the notice lands in the inbox here.\n\nThat's the end of the tour — the sky is yours 🎉",
        },
      },
    ],
  },

  /* ── 2. 向导第一步：选择引导 ────────────────────────────────── */
  guide: {
    id: "guide",
    finishLabel: { zh: "我挑一个", en: "Let me pick one" },
    steps: [
      /*
       * 语言放在整条引导的最开头，而且两种语言的文案写在同一张卡上 ——
       * 读不懂中文的人，正是最需要看懂这一步的人。interactive 让用户真的按得到按钮。
       */
      {
        target: ".app-lang-button",
        placement: "bottom",
        interactive: true,
        zh: {
          title: "先选语言 · Choose your language",
          body: "点右上角这个按钮，可以在 中文 和 English 之间切换。整个引导会跟着一起换。\n\nTap the button up here to switch between 中文 and English. This tour follows your choice.\n\n选好了就继续 · Continue when you're set.",
        },
        en: {
          title: "Choose your language · 先选语言",
          body: "Tap the button up here to switch between English and 中文. The whole tour follows your choice.\n\n点右上角这个按钮，可以在 English 和 中文 之间切换，整个引导会跟着一起换。\n\nContinue when you're set · 选好了就继续。",
        },
      },
      {
        target: ".guide-panels",
        placement: "bottom",
        interactive: true,
        zh: {
          title: "第一步：先找个入口",
          body: "空白页最难写。所以我们不从空白开始 —— 先挑一个「切口」，让记忆有地方落脚。\n\n① 人生转折 —— 改变你人生方向的时刻\n② 生命阶段 —— 最能代表某一段日子的故事\n③ 观念转变 —— 改变你看待自己或世界的瞬间\n④ 重大经历 —— 至今仍留在你心里的事\n⑤ 其他 —— 都不合适？这张自己写\n\n现在可以直接点开看看，随便翻。",
        },
        en: {
          title: "Step one: find a way in",
          body: "Blank pages are the hardest. So we don't start blank — pick a doorway and let the memory have somewhere to land.\n\n① Turning Points — a moment that changed your direction\n② Life Stages — the story that captures one chapter\n③ Perspective Shifts — when you started seeing differently\n④ Major Experiences — what's still with you\n⑤ Something Else — none fit? write your own\n\nGo ahead and open them — click around.",
        },
      },
      {
        target: ".stack-actions",
        placement: "top",
        zh: {
          title: "选好就继续",
          body: "五张都看过了。挑一张你真正想写的 —— 点卡片就能换，下面这条会告诉你当前选的是哪个。",
        },
        en: {
          title: "Then continue",
          body: "That's all five. Pick the one you actually want to write — click any card to switch; this bar always shows where you are.",
        },
      },
    ],
  },

  /* ── 3. 向导第二步：写故事 ─────────────────────────────────── */
  collection: {
    id: "collection",
    finishLabel: { zh: "开始写 ✎", en: "Start writing ✎" },
    steps: [
      {
        placement: "center",
        zh: {
          title: "来吧，我们写一个故事 ✎",
          body: "没有字数要求，没有格式要求，也没有人会打分。\n\n想到哪写到哪 —— 写歪了也没关系，这里本来就不是作文课。",
        },
        en: {
          title: "Alright — let's write one ✎",
          body: "No word count. No format. Nobody's grading this.\n\nWander if you want to. This was never an essay class.",
        },
      },
    ],
  },

  /* ── 4. 向导第四步：确认发布 ───────────────────────────────── */
  confirm: {
    id: "confirm",
    finishLabel: { zh: "明白了", en: "Got it" },
    steps: [
      {
        placement: "center",
        zh: {
          title: "最终解释权在你 ✋",
          body: "AI 刚才做的是整理，不是改写。下面每一样，你都可以推翻。",
        },
        en: {
          title: "The final say is yours ✋",
          body: "What the AI just did was organise, not rewrite. Every single thing below can be overruled by you.",
        },
      },
      {
        target: ".compact-edit-grid",
        placement: "bottom",
        zh: {
          title: "信息可以改，正文也可以改",
          body: "标题、时间、地点、人生阶段、性别 —— 觉得 AI 读错了，直接在这里改掉。\n\n正文也一样：点下面的「修改正文」就能回到编辑状态，补一段、删一句都行。",
        },
        en: {
          title: "Fix the details — and the story",
          body: "Title, time, place, life stage, gender — if the AI misread something, correct it right here.\n\nSame for the story itself: hit \"Edit\" below to go back in and add a paragraph or cut a line.",
        },
      },
      {
        target: ".tag-editor-head",
        placement: "left",
        zh: {
          title: "标签：主题 · 情绪 · 意义",
          body: "AI 给的标签是猜测。点标签上的 × 可以删掉，也能自己加 —— 每层最多 3 个。\n\n这些标签决定了谁会在星空里遇见你。",
        },
        en: {
          title: "Tags: theme · emotion · meaning",
          body: "The AI's tags are guesses. Hit × to remove one, or add your own — up to 3 per layer.\n\nThese decide who runs into you out there.",
        },
      },
      {
        target: ".image-style-picker",
        placement: "left",
        zh: {
          title: "先挑一种画风",
          body: "卡通蜡笔、简约写实、复古拼贴 —— 三种都可以试。\n\n鼠标悬停就能看示意图。换风格会清掉已生成的图，重新画一张。",
        },
        en: {
          title: "Pick a look first",
          body: "Crayon cartoon, minimal realistic, or retro collage — all fair game.\n\nHover to preview each one. Switching styles clears the current image and redraws.",
        },
      },
      {
        target: ".comic-preview",
        placement: "left",
        zh: {
          title: "把故事画成一张图",
          body: "可选的小彩蛋：AI 会先从你的故事里挑出一个「高光时刻」，再按你选的风格画成一张图，可以下载。\n\n生成要等一会儿，不喜欢可以重来。展开还能看它到底选中了哪一段。",
        },
        en: {
          title: "Turn it into a picture",
          body: "An optional treat: the AI picks one “highlight moment” from your story and paints it in the style you chose. Downloadable.\n\nTakes a moment, and you can regenerate. Expand it to see which moment it picked.",
        },
      },
      {
        target: ".publish-note",
        placement: "top",
        zh: { title: "确认后就点亮", body: "发布是匿名的。确认之后，你的故事就会变成星空里真正的一颗星。" },
        en: { title: "Then light it up", body: "Publishing is anonymous. Once you confirm, your story becomes a real star in the sky." },
      },
    ],
  },

  /* ── 5. 共鸣设置 ───────────────────────────────────────────── */
  resonance: {
    id: "resonance",
    finishLabel: { zh: "带我去看看 ✦", en: "Take me there ✦" },
    steps: [
      {
        placement: "center",
        zh: {
          title: "你的星星亮了 ✦",
          body: "故事已经发布。最后一件事：告诉我们，接下来你想听见什么样的回声。",
        },
        en: {
          title: "Your star is lit ✦",
          body: "The story is published. One last thing: tell us what kind of echoes you want to hear next.",
        },
      },
      {
        target: ".dimension-grid",
        placement: "top",
        zh: {
          title: "三个维度，各选一边",
          body: "· 城市 —— 相近的生活语境，还是另一座城的经验\n· 人生阶段 —— 同龄人的路，还是另一个时期的声音\n· 主题 —— 熟悉的议题继续深入，还是换扇门\n\n没有对错，只是你现在想要什么。",
        },
        en: {
          title: "Three dimensions, pick a side",
          body: "· City — a familiar context, or life in another city\n· Life stage — peers walking the same road, or a voice from another chapter\n· Theme — go deeper where it's familiar, or open a new door\n\nNo wrong answers. Just what you want right now.",
        },
      },
      {
        target: ".resonance-action",
        placement: "top",
        zh: {
          title: "就到这里啦 🎉",
          body: "引导结束。这些设置随时能在星空大厅的「调整属性」里改。\n\n接下来的星空，是按你的选择排布的 —— 去看看吧。",
        },
        en: {
          title: "And that's the tour 🎉",
          body: "You're all set. You can change any of this later under “Resonance” in the Star Lobby.\n\nThe sky ahead is arranged around your choices — go have a look.",
        },
      },
    ],
  },
};

export function getScene(id: TourSceneId): TourScene {
  return scenes[id];
}

export const tourUi = {
  // 「跳过」只跳过当前这一页，后面的页面照常有引导
  zh: { skip: "跳过本页", next: "下一步", back: "上一步", done: "完成", of: "/" },
  en: { skip: "Skip this page", next: "Next", back: "Back", done: "Done", of: "/" },
};
