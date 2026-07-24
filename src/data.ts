import type { Analysis, Draft, Story } from "./types";

export const icebreakers = [
  { id: "i1", question: "你曾经非常相信，但现在已经开始怀疑的一件事？", answer: "我曾相信只要足够忙碌，就一定在靠近理想。后来第一次停下来，才发现方向比速度重要。", tag: "身份", x: 14, y: 32 },
  { id: "i2", question: "哪座城市会带出你性格中最陌生的一面？", answer: "在重庆，我总想沿着没有目的地的阶梯一直走。好像迷路反而让我变得坦率。", tag: "城市", x: 36, y: 17 },
  { id: "i3", question: "最近一次灵光一闪是什么时候？", answer: "收拾外婆旧抽屉时，我突然明白，纪念不是保存所有东西，而是知道什么已经留在身上。", tag: "成长", x: 68, y: 28 },
  { id: "i4", question: "一件起初像自我提升、后来却伤害你的事？", answer: "我把每一分钟都排满，以为那叫自律。直到某天朋友问我，上一次真正开心是什么时候。", tag: "反思", x: 82, y: 54 },
  { id: "i5", question: "一个从未说出口的好奇？", answer: "如果小时候搬家前没有和她告别，她后来还会偶尔想起我吗？", tag: "关系", x: 48, y: 66 },
];

export const guides = [
  { id: "turning", icon: "↗", title: "人生转折", en: "Turning Points", prompt: "讲述一个改变你人生方向的时刻。", examples: "搬到新城市 · 遇见重要的人 · 改变职业" },
  { id: "stages", icon: "◷", title: "生命阶段", en: "Life Stages", prompt: "讲述一段最能代表某个生命阶段的故事。", examples: "童年 · 大学 · 第一份工作 · 成为父母" },
  { id: "perspective", icon: "✦", title: "观念转变", en: "Perspective Shifts", prompt: "讲述一个改变你看待自己或世界的瞬间。", examples: "放下一个信念 · 学到艰难的一课 · 克服恐惧" },
  { id: "experience", icon: "◎", title: "重大经历", en: "Major Experiences", prompt: "讲述一个至今仍留在你心里的经历。", examples: "第一次远行 · 独自生活 · 疾病 · 迁移" },
];

export const stories: Story[] = [
  {
    id: "s1", title: "把故乡装进一只蓝色行李箱", excerpt: "离开昆明那天，我只带走了外婆缝的一块蓝布……",
    body: "离开昆明那天，我只带走了外婆缝的一块蓝布。它本来是要做成枕套的，边缘还有没收好的线。抵达上海后的第一个雨夜，我把它铺在陌生出租屋的桌上，忽然觉得房间里有了一小块故乡。后来我搬过三次家，那块布一直在箱子最上面。它没有让我不再想家，却让我明白，归属感有时不是一个地点，而是一件愿意一直带着走的小东西。",
    author: "星旅人 042", city: "昆明", stage: "初入职场", theme: "迁移", emotion: "想念", meaning: "归属", perspective: "温柔现实主义", people: ["自己", "家人"], readMinutes: 3, visualStatus: "ready", x: 15, y: 23,
  },
  {
    id: "s2", title: "父亲第一次问我累不累", excerpt: "我们一直不擅长说柔软的话，直到那个凌晨……",
    body: "我们一直不擅长说柔软的话。大学毕业后的那个凌晨，我加班回家，发现父亲还坐在客厅。他没有问工作怎么样，只递给我一碗已经热过两次的汤，然后问：累不累？那三个字让我突然想起小时候每一次发烧，他也是这样坐着。我们之间并没有因为那一晚变得无话不谈，但我开始学会辨认他沉默里的关心。",
    author: "匿名星点 117", city: "广州", stage: "初入职场", theme: "家庭", emotion: "温暖", meaning: "理解", perspective: "关系修复", people: ["自己", "家人"], readMinutes: 2, visualStatus: "generating", x: 39, y: 38,
  },
  {
    id: "s3", title: "二十七岁重新学会迷路", excerpt: "在东京交换的第三周，我故意没有打开地图……",
    body: "在东京交换的第三周，我故意没有打开地图。那段时间我对未来极度焦虑，仿佛每一步都必须有产出。迷路的两个小时里，我经过一间旧书店、一所放学的小学和一条没有游客的河。没有任何事情因此被解决，但我久违地感到自己正在生活，而不是完成一张无限延伸的任务清单。",
    author: "星旅人 236", city: "东京", stage: "青年探索", theme: "成长", emotion: "释然", meaning: "自由", perspective: "慢下来", people: ["自己", "陌生人"], readMinutes: 3, visualStatus: "ready", x: 66, y: 18,
  },
  {
    id: "s4", title: "没有寄出的那封邮件", excerpt: "辞职前我写了很长一封邮件，最后只留下六个字……",
    body: "辞职前我写了很长一封邮件，解释那些被忽视的努力和我为什么失望。修改到深夜，最后却删掉所有控诉，只留下“谢谢，我决定离开”。过去我把离开理解为失败，后来才意识到，有些选择不是为了证明谁错了，而是停止把自己交给一个已经无法生长的地方。",
    author: "匿名星点 081", city: "深圳", stage: "职业转折", theme: "工作", emotion: "坚定", meaning: "边界", perspective: "自我选择", people: ["自己", "同事"], readMinutes: 3, visualStatus: "failed", x: 79, y: 41,
  },
  {
    id: "s5", title: "和母亲在厨房里重新认识", excerpt: "回家住的那个月，我们第一次像两个成年人那样聊天……",
    body: "回家住的那个月，我和母亲每天在厨房一起准备晚饭。以前她总问我工作和婚姻，像在检查一张人生进度表。那天我终于问她，年轻时真正想做什么。她沉默很久，说想当一名地理老师。我们第一次不是作为母女，而是作为两个曾经犹豫、也曾错过什么的成年人聊天。",
    author: "星旅人 305", city: "成都", stage: "成年回望", theme: "家庭", emotion: "复杂", meaning: "看见", perspective: "代际理解", people: ["自己", "家人"], readMinutes: 4, visualStatus: "blocked", x: 26, y: 68,
  },
  {
    id: "s6", title: "我们在毕业典礼后走散", excerpt: "没有争吵，也没有正式告别，只是消息越来越短……",
    body: "没有争吵，也没有正式告别，只是消息越来越短。毕业典礼那天我们约定每年见面，第三年却谁也没有再提。很久以后我才接受，有些关系不是因为做错了什么才结束。共同生活曾把我们放在同一条路上，时间又温和地把路分开。记得并不意味着必须回去。",
    author: "匿名星点 193", city: "武汉", stage: "大学毕业", theme: "关系", emotion: "遗憾", meaning: "告别", perspective: "接纳变化", people: ["朋友"], readMinutes: 2, visualStatus: "ready", x: 54, y: 73,
  },
  {
    id: "s7", title: "第一次用自己的名字签字", excerpt: "那张租房合同很普通，却像一份迟来的独立宣言……",
    body: "那张租房合同很普通，却像一份迟来的独立宣言。签字时我的手有点抖，因为这意味着房租、水电和每一个决定都由自己承担。晚上坐在还没有家具的房间里，我既害怕又兴奋。独立不是突然变得无所不能，而是终于允许自己在犯错后收拾残局。",
    author: "星旅人 410", city: "北京", stage: "独自生活", theme: "身份", emotion: "勇气", meaning: "独立", perspective: "成长实践", people: ["自己"], readMinutes: 2, visualStatus: "ready", x: 89, y: 69,
  },
];

export const emptyDraft: Draft = {
  guide: "", title: "", body: "", mood: "", time: "", stage: "", city: "", people: [],
  startedAt: Date.now(), edits: 0, pastedChars: 0, saves: 0,
};

export const mockAnalysis: Analysis = {
  suggestedTitle: "雨停之前，我学会了告别",
  tags: {
    topic: ["成长", "关系"],
    emotion: ["释然", "想念"],
    meaning: ["告别", "归属"],
    perspective: ["自我理解"],
  },
  arc: ["一个熟悉的生活被打破", "在迟疑中重新看见过去", "一次微小选择改变了理解", "带着新的意义继续生活"],
};
