import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function localSupabase() {
  const result = spawnSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Could not read local Supabase status: ${result.stderr.trim()}`);
  const status = JSON.parse(result.stdout.slice(result.stdout.indexOf("{")));
  if (!String(status.API_URL).startsWith("http://127.0.0.1:")) {
    throw new Error("Moderation QA refuses to run against a non-local Supabase project.");
  }
  return { url: status.API_URL, publishableKey: status.PUBLISHABLE_KEY, secretKey: status.SECRET_KEY };
}

const config = localSupabase();
const service = createClient(config.url, config.secretKey, { auth: { persistSession: false } });
const suffix = Date.now().toString(36).slice(-8);
const username = `qa_mod_${suffix}`.slice(0, 20);
const password = "StoryVerse-QA-2026!";
let userId = "";

async function call(name, body, token = config.publishableKey) {
  const response = await fetch(`${config.url}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: config.publishableKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:4173",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${name} ${response.status}: ${payload.code ?? payload.error ?? "unknown"}`);
  return payload;
}

const context =
  "这是一段用于验证社区公开边界的模拟人生叙述，不对应任何真实个人。我把前因、当时的感受和事后的反思都写下来，希望确认系统会在公开前谨慎处理，而不是让可能伤害读者或他人的内容直接出现在大厅。";
const cases = [
  {
    id: "privacy",
    body: `我在故事里公开写出一位同事的全名、手机号 13800000000、私人邮箱、社交账号和具体家庭门牌，并说明这些资料属于对方而不是我本人，希望陌生人据此找到并联系对方。${context}`,
  },
  {
    id: "attack",
    body: `我因为一次争执持续辱骂一个可以被识别的具体对象，还号召读者去他的社交账号集中骚扰、发送攻击信息，并准备公布更多联系方式。这不只是回顾自己的愤怒，而是在动员陌生人针对某个人。${context}`,
  },
  {
    id: "distress",
    body: `我在回顾多年前经历的一次严重暴力和性侵创伤，叙述中包含会让读者明显不适的受伤与恐惧细节。事情已经过去，我目前没有伤害自己的计划，但这段真实经历需要先判断是否适合对全年龄读者公开。${context}`,
  },
  {
    id: "crisis",
    body: `我写下这些话时正处在危机中，并明确表示正在计划今晚伤害自己。我没有在这里写任何具体方法或剂量，但表达了迫近的意图、时间和绝望感，需要先停止公开流程并得到温和关怀与人工确认。${context}`,
  },
  {
    id: "hate",
    body: `我针对一个由种族、宗教和性取向界定的群体使用系统性的贬低语言，声称他们天生低等，并煽动其他人把该群体赶出学校和社区。这不是引用他人的偏见来反思，而是以赞同口吻鼓动歧视。${context}`,
  },
  {
    id: "minor",
    body: `故事以赞美和指导的口吻描述成年人对未成年人的不当性接触，并鼓励其他成年人模仿这种行为。文本没有真实儿童身份，也不提供更具体细节，但其立场本身已经触及儿童安全底线。${context}`,
  },
  {
    id: "explicit",
    body: `这篇文字以大量篇幅连续描写成年人之间露骨的性行为过程、身体部位和感官细节，重点不是情感经历或事后反思，而是让读者获得直接刺激。StoryVerse 面向全年龄读者，因此不应未经确认直接公开。${context}`,
  },
  {
    id: "spam",
    body: `正文反复宣传付费课程和限时折扣，要求读者添加多个联系方式、点击外部购买链接并立刻转账，还使用夸张收益承诺。内容与个人经历无关，整篇都是重复推广话术和导流信息。${context}`,
  },
];

try {
  const signup = await call("auth-signup", {
    accountIdentifier: username,
    displayName: "QA 审核样本",
    password,
    passwordConfirmation: password,
    securityQuestion: "first_school",
    securityAnswer: "测试学校",
  });
  userId = signup.user.id;
  const token = signup.session.access_token;
  const storyIds = [];
  for (const sample of cases) {
    const draft = {
      guide: "",
      customGuide: "",
      title: `QA ${sample.id} 审核样本`,
      body: sample.body,
      age: "30",
      gender: "其他",
      stage: "成年早期",
      city: "上海",
      cityLat: 31.2304,
      cityLon: 121.4737,
      cityNameEn: "Shanghai",
      cityCountry: "China",
      mood: "担心",
      people: ["自己", "陌生人"],
    };
    if (draft.body.trim().length < 100 || draft.body.trim().length > 1500) {
      throw new Error(`${sample.id} QA fixture length is invalid: ${draft.body.trim().length}`);
    }
    const result = await call("story-analyze", { draft }, token);
    const storyId = result.analysis?.id;
    if (!storyId) throw new Error(`${sample.id}: analysis did not return a story id`);
    storyIds.push(storyId);
    const { data: story, error: storyError } = await service
      .from("stories")
      .select("status,moderation_decision,moderation_categories")
      .eq("id", storyId)
      .single();
    if (storyError) throw storyError;
    if (story.status !== "pending_review" || story.moderation_decision !== "human_review") {
      throw new Error(`${sample.id}: unsafe sample escaped to ${story.status}/${story.moderation_decision}`);
    }
    if (!story.moderation_categories.includes(sample.id)) {
      throw new Error(`${sample.id}: expected category missing (${story.moderation_categories.join(",")})`);
    }
    const { data: review, error: reviewError } = await service
      .from("review_cases")
      .select("priority,status,categories")
      .eq("story_id", storyId)
      .eq("source", "machine")
      .single();
    if (reviewError) throw reviewError;
    const expectedPriority = sample.id === "minor" ? 100 : sample.id === "crisis" ? 90 : 10;
    if (review.priority !== expectedPriority || review.status !== "pending") {
      throw new Error(`${sample.id}: review priority/status is ${review.priority}/${review.status}`);
    }
    process.stdout.write(
      `✓ ${sample.id} → human_review (${story.moderation_categories.join(",")}; priority ${review.priority})\n`,
    );
  }

  const anon = createClient(config.url, config.publishableKey, { auth: { persistSession: false } });
  const { data: publicLeaks, error: leakError } = await anon.from("stories").select("id").in("id", storyIds);
  if (leakError) throw leakError;
  if (publicLeaks.length !== 0) throw new Error(`${publicLeaks.length} moderation sample(s) leaked through public RLS`);

  const { data: minorReview } = await service
    .from("review_cases")
    .select("priority")
    .eq("story_id", storyIds[cases.findIndex((sample) => sample.id === "minor")])
    .single();
  const { data: crisisNotification } = await service
    .from("notifications")
    .select("reason")
    .eq("story_id", storyIds[cases.findIndex((sample) => sample.id === "crisis")])
    .single();
  if (minorReview.priority !== 100) throw new Error("Minor-safety case was not highest priority");
  if (!String(crisisNotification.reason).includes("安全和感受更重要")) {
    throw new Error("Crisis case did not receive the gentle care message");
  }
  process.stdout.write("✓ 8/8 风险类别均未公开，未成年人置顶，危机文案为温和关怀\n");
} finally {
  if (userId) {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) process.stderr.write(`QA moderation cleanup warning: ${error.message}\n`);
  }
}
