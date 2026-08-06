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
    finishLabel: { zh: "去写第一个故事 →", en: "Write my first story →" },
    steps: [
      /*
       * 第一步必须是语言，而且两种语言的文案都要写在同一张卡上 ——
       * 读不懂中文的人，正是最需要看懂这一步的人。这一步也是 interactive 的，
       * 用户要能真的按到那个按钮。
       */
      {
        target: "[data-tour='lang-button']",
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
        zh: {
          title: "调整属性",
          body: "决定你想看到什么样的故事：跟你相近的，还是完全不同的。\n\n可以按城市、人生阶段、主题分别设定，随时能改。",
        },
        en: {
          title: "Resonance",
          body: "Decide what kind of stories reach you: ones close to yours, or ones nothing like it.\n\nSet it by city, life stage and theme — changeable anytime.",
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
          title: "写下新故事 ✦",
          body: "重点来了。这颗「＋」是你的入口。\n\n不需要文采，不需要完整 —— 只要是真的。准备好了吗？",
        },
        en: {
          title: "Write a new story ✦",
          body: "Here's the important one. That “+” is your way in.\n\nNo craft required, no need to be complete — just true. Ready?",
        },
      },
    ],
  },

  /* ── 2. 向导第一步：选择引导 ────────────────────────────────── */
  guide: {
    id: "guide",
    finishLabel: { zh: "我挑一个", en: "Let me pick one" },
    steps: [
      {
        placement: "center",
        zh: {
          title: "第一步：先找个入口",
          body: "空白页最难写。所以我们不从空白开始 —— 先挑一个「切口」，让记忆有地方落脚。",
        },
        en: {
          title: "Step one: find a way in",
          body: "Blank pages are the hardest. So we don't start blank — pick a doorway first, and let the memory have somewhere to land.",
        },
      },
      {
        target: ".guide-panels",
        placement: "bottom",
        zh: {
          title: "五种入口，点开看看",
          body: "身份、生命阶段、观念转变、重大经历 —— 每一栏都是一个提问。\n\n点哪一栏，它就展开成你这次写作的提示。",
        },
        en: {
          title: "Five doorways — open one",
          body: "Identity, life stages, shifts in perspective, defining experiences — each panel is a question.\n\nClick one and it expands into the prompt you'll write from.",
        },
      },
      {
        target: ".guide-panels .guide-panel:last-child",
        placement: "left",
        pad: 4,
        zh: {
          title: "都不合适？",
          body: "最后一栏是「其他」—— 你可以自己写下想讲的那种时刻。没有标准答案，这本来就是你的故事。",
        },
        en: {
          title: "None of them fit?",
          body: "The last panel is “Something Else” — write your own doorway. There's no right answer here; it's your story to begin with.",
        },
      },
      {
        target: ".stack-actions",
        placement: "top",
        zh: { title: "选好就继续", body: "下面这条会一直告诉你当前选了哪个入口。选定之后，点右边继续。" },
        en: { title: "Then continue", body: "This bar always shows which doorway you're on. Once you've chosen, continue on the right." },
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
      {
        target: ".prompt-panel",
        placement: "right",
        zh: {
          title: "你的提示一直在这",
          body: "刚才选的入口会留在左边陪着你。写不下去的时候抬头看一眼。\n\n想换一个？点上面的返回箭头。",
        },
        en: {
          title: "Your prompt stays here",
          body: "The doorway you picked sits on the left, keeping you company. Glance up when you get stuck.\n\nWant a different one? Use the back arrow above.",
        },
      },
      {
        target: ".story-input-tools",
        placement: "bottom",
        zh: {
          title: "专注模式",
          body: "打开它，左边的面板和下面的选项都会收起来，只剩你和文字。\n\n填过的内容不会丢，按 Esc 就能退出。",
        },
        en: {
          title: "Focus mode",
          body: "Turn it on and the side panel and the fields below fold away — just you and the words.\n\nNothing you've filled in is lost. Esc brings it back.",
        },
      },
      {
        target: ".story-form textarea",
        placement: "top",
        zh: {
          title: "正文写在这里",
          body: "建议 100–1500 字，但那只是建议。\n\n草稿每隔几秒会自动存在这台设备上，不用担心写着写着没了。",
        },
        en: {
          title: "The story goes here",
          body: "100–1500 words is suggested — emphasis on suggested.\n\nYour draft autosaves to this device every few seconds, so it won't vanish on you.",
        },
      },
      {
        target: ".meta-fields",
        placement: "top",
        zh: {
          title: "给故事一点坐标",
          body: "心情、时间、城市、年龄、故事里有谁 —— 这些决定了你的星星落在星空的哪个位置。\n\n城市支持海内外；填了就能解析出经纬度。",
        },
        en: {
          title: "Give the story coordinates",
          body: "Mood, when, where, your age, who was there — these decide where your star lands in the sky.\n\nCities worldwide work; we'll resolve the coordinates for you.",
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
        zh: { title: "信息可以改", body: "标题、时间、地点、人生阶段 —— 觉得 AI 读错了，直接在这里改掉。" },
        en: { title: "Fix the details", body: "Title, time, place, life stage — if the AI misread something, just correct it here." },
      },
      {
        target: ".editable-preview",
        placement: "right",
        zh: { title: "正文也可以改", body: "点「修改正文」就能回到编辑状态。想再补一段、想删掉一句，都行。" },
        en: { title: "And the story itself", body: "Hit “Edit” to go back in. Add a paragraph, cut a line — whatever it needs." },
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
  zh: { skip: "跳过引导", next: "下一步", back: "上一步", done: "完成", of: "/" },
  en: { skip: "Skip tour", next: "Next", back: "Back", done: "Done", of: "/" },
};
