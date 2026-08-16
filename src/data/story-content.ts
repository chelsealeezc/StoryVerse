import type { StoryDraft } from "../types/domain";

export const guides = [
  {
    id: "agency",
    icon: "↗",
    construct: "自主能动性",
    title: "命运在我手中",
    shortTitle: "命运",
    en: "In My Hands",
    enShort: "Agency",
    prompt: "有没有一件事让你突然意识到「命运永远掌握在自己手里」？具体发生了什么？",
    enPrompt: "Was there a moment when you realized your life was still in your own hands? What happened?",
    examples: "有段时间，我面临学业、工作、生活的三重压力，但意外的是，最后所有我定下的目标全都靠自己实现了。",
    enExamples:
      "There was a time when school, work, and life pressed on me all at once. Somehow, every goal I set was eventually reached by my own effort.",
    definition:
      "叙事主角改变自身命运、影响周遭他人环境的能力，常体现为自我掌控、自我赋权、成就、社会地位；高自主叙事突出个人成就、掌控人生走向。",
  },
  {
    id: "communion",
    icon: "♥",
    construct: "社群联结性",
    title: "离不开的TA们",
    shortTitle: "联结",
    en: "The Ones Who Hold Me",
    enShort: "Bond",
    prompt: "哪个瞬间，因为某个陌生、朋友或动物等，让你又爱上了这个世界？",
    enPrompt:
      "Was there a moment when a stranger, friend, animal, or someone else made you fall in love with the world again?",
    examples:
      "我很喜欢变魔术，那天我在社团意外认识了一群魔术同好者，大家在一起交流着共同热爱的事，我真切感受到无条件的爱与温暖。",
    enExamples:
      "I love magic. One day in a club, I unexpectedly met a group of people who loved it too. Sharing that passion made me feel unconditional warmth.",
    definition: "主角通过爱、友谊、沟通、集体归属建立人际联结，叙事核心是亲密、关怀、归属感。",
  },
  {
    id: "redemption",
    icon: "◷",
    construct: "救赎叙事",
    title: "轻舟已过万重山",
    shortTitle: "救赎",
    en: "Past Ten Thousand Mountains",
    enShort: "Relief",
    prompt: "哪件事发生的时候你觉得天都要塌了，但如今回头看却发现「轻舟已过万重山」？",
    enPrompt: "What once felt like the sky was falling, but now feels like something you have already sailed through?",
    examples:
      "我在公司干了五年突然被裁。当时觉得天塌了，失眠整整一个月。结果不久之后，之前一直想创业但没敢动手的前同事找我合伙，现在比上班赚了三倍。",
    enExamples:
      "After five years at a company, I was suddenly laid off. I could not sleep for a month. Later, a former colleague asked me to start a business together — now I earn three times more than before.",
    definition: "明确消极、痛苦的事件，最终导向积极、正向结果；前期负面经历被后续美好体验“救赎”。",
  },
  {
    id: "contamination",
    icon: "◎",
    construct: "污损叙事",
    title: "黑色苦痛",
    shortTitle: "苦痛",
    en: "Dark Irony",
    enShort: "Irony",
    prompt: "有没有哪次你以为抓住了幸福或者赢了，但命运却在暗中给你开了一个巨大的玩笑？",
    enPrompt:
      "Was there a time when you thought you had won or found happiness, only for life to play a dark joke on you?",
    examples: "本来升职我特别开心，后来才知道这次晋升是以我的好友被辞退为代价换来的。",
    enExamples:
      "I was thrilled about my promotion, until I learned it came at the cost of my close friend being laid off.",
    definition: "原本积极美好的事件急转直下，负面情绪彻底覆盖、消解之前所有正向体验。",
  },
  {
    id: "exploration",
    icon: "✦",
    construct: "探索型叙事",
    title: "和自己对话",
    shortTitle: "成长",
    en: "A Talk With Myself",
    enShort: "Growth",
    prompt: "如果把过去的自己拉出来和现在的你对话，有什么事让你可以自信地和Ta说：「现在的我长大了」？",
    enPrompt:
      "If your past self could talk with you now, what story would let you say with confidence: “I have grown up”?",
    examples:
      "那一年我的人生跌入谷底……但我慢慢重建生活，变成更独立、情绪稳定的人。那段时光满是痛苦、不断试错，回头看，正是它塑造了现在的我。",
    enExamples:
      "That year, my life hit bottom. Slowly, I rebuilt it and became more independent and emotionally steady. Looking back, that painful trial-and-error shaped who I am now.",
    definition: "叙事中展现深度自我探索，形成丰富、立体的自我认知，高分代表充分的自我复盘与成长探索。",
  },
  {
    id: "resolution",
    icon: "○",
    construct: "积极完整化解",
    title: "解开心结",
    shortTitle: "释怀",
    en: "Untying the Knot",
    enShort: "Closure",
    prompt: "你有没有什么很久才解开的心结，最后是怎么放下的？",
    enPrompt: "Was there a knot in your heart that took a long time to untie? How did you finally let it go?",
    examples: "多年过去，我终于原谅了弟弟的过错，接纳他所有不完美，我们的关系也因此更加亲近。",
    enExamples:
      "After many years, I finally forgave my younger brother and accepted his imperfections. Our relationship became closer because of it.",
    definition: "故事冲突得到妥善收尾，结局正向圆满。",
  },
  {
    id: "other",
    icon: "＋",
    construct: "其他",
    title: "其他",
    shortTitle: "其他",
    en: "Other",
    enShort: "Other",
    prompt: "写下一个只属于你的故事入口。",
    enPrompt: "Write an entry point that belongs only to your story.",
    examples: "自由编辑你的引导标题或提示。",
    enExamples: "Freely write your own prompt or story entry point.",
    definition: "用户自定义故事入口。",
  },
];

export const emptyDraft: StoryDraft = {
  guide: "",
  customGuide: "",
  title: "",
  body: "",
  mood: "",
  stage: "",
  age: "",
  gender: "",
  city: "",
  cityNameEn: "",
  cityCountry: "",
  cityLat: null,
  cityLon: null,
  people: [],
  startedAt: Date.now(),
  edits: 0,
  pastedChars: 0,
  saves: 0,
  savedAt: 0,
};
