/* ============================================================================
 * 演示用假数据 —— 提 PR 之前请整个文件删掉
 * ----------------------------------------------------------------------------
 * 只是为了让管理员页面的三个分类里都有东西可看。移除方式：
 *   1) 删掉这个文件
 *   2) 删掉 src/storage.ts 里那一行 `import { demoReviewQueue } ...` 和它的引用
 * 除此之外没有别处引用它。
 * ========================================================================== */

import type { InboxMessage, ReviewItem } from "./types";

const HOUR = 3600_000;
const now = Date.now();

/**
 * 演示账号「林小满」已经收到过一次管理员处理结果 —— 一条下架、一条保留，
 * 用来直接看用户端收到通知长什么样（星空大厅右下角铃铛会有红点）。
 */
export const demoInbox: InboxMessage[] = [
  // 三种状态各来一条，方便直接看到通知的完整生命周期
  {
    id: "msg-rv-3",              // 对应审核台里「后来的人生」，还没人点开
    status: "pending",
    kind: "flagged",
    storyTitle: "后来的人生",
    reason: "",
    createdAt: now - 1 * HOUR,
    read: false,
  },
  {
    id: "msg-rv-5",              // 对应「没有走的路」，审核人员已经打开过
    status: "reviewing",
    kind: "flagged",
    storyTitle: "没有走的路",
    reason: "",
    createdAt: now - 6 * HOUR,
    read: false,
  },
  {
    id: "msg-demo-1",
    status: "resolved",
    kind: "removed",
    storyTitle: "那年冬天的电话",
    reason: "故事里出现了完整的手机号和门牌号。做匿名处理后可以重新发布，星点会重新亮起来。",
    createdAt: now - 26 * HOUR,
    read: false,
  },
  {
    id: "msg-demo-2",
    status: "resolved",
    kind: "kept",
    storyTitle: "搬家那天",
    reason: "",
    createdAt: now - 30 * HOUR,
    read: true,
  },
];

/**
 * 演示账号。没有后端，所以「登录」不校验任何东西 ——
 * 任何一次登录都会把这个账号的状态载进来，方便直接看用户端收到通知的样子。
 */
export const demoAccount = {
  nickname: "林小满",
  email: "linxiaoman@demo.storyverse",
  password: "demo1234",
};

/** 演示账号被下架的那条故事，出现在审核台的「已处理」计数里 */
export const demoHandled: ReviewItem[] = [
  {
    id: "rv-demo-removed",
    nodeId: "n3",
    title: "那年冬天的电话",
    body: "他打来的时候我正在楼下便利店，手里还捏着找回来的零钱。那通电话我记了很多年，久到我已经想不起自己当时到底说了什么。",
    tags: ["记忆", "家庭", "遗憾"],
    author: "林小满",
    city: "哈尔滨",
    createdAt: now - 50 * HOUR,
    bucket: "uncertain",
    status: "removed",
    flags: ["privacy"],
    removalReason: "故事里出现了完整的手机号和门牌号。做匿名处理后可以重新发布，星点会重新亮起来。",
    mine: true,
  },
];

export const demoReviewQueue: ReviewItem[] = [
  ...demoHandled,
  /* ── 被其它用户举报 ─────────────────────────────────────── */
  {
    id: "rv-1",
    nodeId: "n4",
    title: "给母亲的信",
    body: "他终于理解，那些争吵背后藏着两代人不同的害怕。写下来的时候我犹豫了很久，因为里面提到了家里的一些具体的事，我不确定她看到会怎么想。但如果不写出来，我大概永远不会真的原谅那段时间的自己。",
    tags: ["家庭", "和解", "代际"],
    author: "匿名用户 · 3f21",
    city: "南京",
    createdAt: now - 5 * HOUR,
    bucket: "reported",
    status: "pending",
    reportCount: 3,
    reportReasons: ["隐私泄露", "隐私泄露", "其他"],
  },
  {
    id: "rv-2",
    nodeId: "n12",
    title: "不一样的观点",
    body: "世界很大，我们不怕不同的观点，只怕只能听见一种声音。那天在会议室里我说了一句很重的话，现在回想起来，我针对的其实不是那个人，而是我自己没能说服任何人这件事。",
    tags: ["选择", "冲突", "反思"],
    author: "匿名用户 · a90c",
    city: "北京",
    createdAt: now - 26 * HOUR,
    bucket: "reported",
    status: "pending",
    reportCount: 1,
    reportReasons: ["仇恨或骚扰"],
  },

  /* ── 审核系统不确定是否违规（用户选了「仍然提交」）───────── */
  {
    id: "rv-3",
    nodeId: "n9",
    title: "后来的人生",
    body: "他把遗憾换成方向，用很长时间完成一个很小的转身。那年最难的时候，我确实想过不再继续了，但撑过来之后才发现，所谓的转折并不是某一天突然想通，而是很多个没有放弃的普通早晨叠起来的。",
    tags: ["未来", "低谷", "坚持"],
    author: "匿名用户 · 7b55",
    city: "成都",
    createdAt: now - 2 * HOUR,
    bucket: "uncertain",
    status: "pending",
    flags: ["distress"],
    mine: true,
  },
  {
    id: "rv-4",
    nodeId: "n7",
    title: "雨中的车站",
    body: "她突然发现自己记住的不是目的地，而是站台上那些陌生人的脸。那天下午我在城南的老车站等了三个小时，旁边有个阿姨一直在打电话，说的是她女儿的事。",
    tags: ["城市", "陌生人", "等待"],
    author: "匿名用户 · c118",
    city: "武汉",
    createdAt: now - 9 * HOUR,
    bucket: "uncertain",
    status: "pending",
    flags: ["privacy"],
  },

  /* ── 系统误判（作者本人申诉）────────────────────────────── */
  {
    id: "rv-5",
    nodeId: "n5",
    title: "没有走的路",
    body: "另一种人生并没有消失，它只是以想象的方式陪你走到今天。我写的是大学时放弃保研的那个决定，里面有一句「那天我几乎想把自己整个人删掉」，其实是形容当时的羞耻感，不是真的想做什么。",
    tags: ["未来", "选择", "遗憾"],
    author: "匿名用户 · e402",
    city: "上海",
    createdAt: now - 31 * HOUR,
    bucket: "appealed",
    status: "pending",
    flags: ["distress"],
    appealNote: "那句是比喻，形容当时很羞耻，不是自伤的意思。希望人工看一下。",
    mine: true,
  },
  {
    id: "rv-6",
    nodeId: "n2",
    title: "异乡第一夜",
    body: "凌晨三点的便利店灯光，让他想起很久以前没说出口的告别。我在里面写了当时住的那条街的名字，因为那条街对我来说就是那一夜本身，删掉之后整段就没有味道了。",
    tags: ["城市", "迁移", "孤独"],
    author: "匿名用户 · 1d76",
    city: "广州",
    createdAt: now - 48 * HOUR,
    bucket: "appealed",
    status: "pending",
    flags: ["privacy"],
    appealNote: "只是一条街名，不是我的住址，希望保留。",
  },
];
