import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const [action, username] = process.argv.slice(2);
if (!["verify", "cleanup"].includes(action) || !/^qa_ui_[a-z0-9_]{1,14}$/i.test(username ?? "")) {
  throw new Error("Usage: node scripts/qa-online-analytics-journey.mjs verify|cleanup <qa_ui_username>");
}

const projectRef = (await readFile("supabase/.temp/project-ref", "utf8")).trim();
if (!/^[a-z0-9]{20}$/.test(projectRef)) throw new Error("Supabase project is not linked safely.");
const projectUrl = `https://${projectRef}.supabase.co`;

function apiKeys() {
  const result = spawnSync(
    "npx",
    ["supabase", "projects", "api-keys", "--project-ref", projectRef, "--reveal", "--output", "json"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(result.stderr || "Could not read Supabase API keys.");
  const starts = [result.stdout.indexOf("{"), result.stdout.indexOf("[")].filter((index) => index >= 0);
  if (!starts.length) throw new Error("Supabase API key response was not JSON.");
  const payload = JSON.parse(result.stdout.slice(Math.min(...starts)));
  const keys = Array.isArray(payload) ? payload : (payload.api_keys ?? payload.keys ?? []);
  const secret = keys.find((item) => item.type === "secret") ?? keys.find((item) => item.name === "service_role");
  const secretKey = String(secret?.api_key ?? secret?.key ?? "");
  if (!secretKey) throw new Error("Could not resolve the Supabase secret key.");
  return secretKey;
}

const service = createClient(projectUrl, apiKeys(), { auth: { autoRefreshToken: false, persistSession: false } });
const { data: profile, error: profileError } = await service
  .from("profiles")
  .select("id,username,display_name,created_at")
  .eq("username", username)
  .maybeSingle();
if (profileError) throw profileError;
if (!profile || !/QA/i.test(profile.display_name))
  throw new Error("Isolated QA profile not found or failed safety check.");
if (Date.now() - new Date(profile.created_at).getTime() > 6 * 60 * 60 * 1000) {
  throw new Error("Safety stop: QA profile is older than six hours.");
}

const { data: identityRow, error: identityError } = await service
  .from("analytics_events")
  .select("anonymous_id")
  .eq("user_id", profile.id)
  .order("received_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (identityError) throw identityError;
const anonymousId = identityRow?.anonymous_id ?? null;

async function journeyEvents() {
  if (!anonymousId) return [];
  const { data, error } = await service
    .from("analytics_events")
    .select(
      "event_id,event_name,priority,user_id,anonymous_id,lobby_view_id,recommendation_batch_id,properties,occurred_at",
    )
    .or(`user_id.eq.${profile.id},anonymous_id.eq.${anonymousId}`)
    .order("occurred_at");
  if (error) throw error;
  return data ?? [];
}

function assert(value, label) {
  if (!value) throw new Error(label);
  process.stdout.write(`✓ ${label}\n`);
}

if (action === "verify") {
  const events = await journeyEvents();
  const counts = Object.fromEntries(
    [...new Set(events.map((event) => event.event_name))]
      .sort()
      .map((name) => [name, events.filter((event) => event.event_name === name).length]),
  );
  const p0 = [
    "story_write_viewed",
    "story_paste_detected",
    "story_input_snapshot",
    "star_lobby_viewed",
    "star_exposed",
    "star_clicked",
    "lobby_nav_clicked",
    "lobby_search_executed",
    "lobby_search_cleared",
    "story_read_started",
    "story_read_ended",
    "story_reaction_clicked",
    "story_reaction_result",
    "lobby_resonance_option_clicked",
    "lobby_resonance_confirm_clicked",
    "lobby_resonance_refresh_result",
  ];
  const missingP0 = p0.filter((name) => !counts[name]);
  assert(missingP0.length === 0, `完整 UI 旅程覆盖全部 16 个 P0 事件（缺失：${missingP0.join(", ") || "无"}）`);
  assert(
    events.filter((event) => p0.includes(event.event_name)).every((event) => event.priority === "P0"),
    "P0 优先级全部正确",
  );

  const snapshot = events.find((event) => event.event_name === "story_input_snapshot")?.properties ?? {};
  assert(
    typeof snapshot.title === "string" &&
      snapshot.title.length > 0 &&
      typeof snapshot.body === "string" &&
      snapshot.body.length >= 100 &&
      snapshot.was_pasted === true &&
      Array.isArray(snapshot.pasted_texts) &&
      snapshot.pasted_texts.length > 0,
    "故事快照包含完整标题、正文和粘贴内容",
  );
  assert(
    Number(snapshot.title_active_ms) >= 0 &&
      Number(snapshot.body_active_ms) >= 0 &&
      Number(snapshot.wall_duration_ms) > 0,
    "故事输入有效时长与页面停留时长已记录",
  );

  const exposureKeys = events
    .filter((event) => event.event_name === "star_exposed")
    .map((event) => `${event.lobby_view_id}:${event.properties?.story_id}:${event.properties?.view_mode}`);
  assert(exposureKeys.length > 0, "Three.js 星空产生真实星点曝光");
  assert(new Set(exposureKeys).size === exposureKeys.length, "同一 lobby + story + view 没有重复曝光");

  const meaningful = events.find(
    (event) =>
      event.event_name === "story_read_ended" &&
      event.properties?.meaningful_read === true &&
      event.properties?.is_own_story === false,
  );
  assert(
    Boolean(meaningful) && Number(meaningful.properties.active_duration_ms) >= 20_000,
    "非本人故事有效阅读达到 20 秒",
  );
  const ownRead = events.find(
    (event) => event.event_name === "story_read_ended" && event.properties?.is_own_story === true,
  );
  assert(!ownRead || ownRead.properties?.meaningful_read === false, "本人故事不会计入有效阅读");

  const refresh = events.find(
    (event) => event.event_name === "lobby_resonance_refresh_result" && event.properties?.success === true,
  );
  assert(
    Boolean(refresh?.properties?.new_recommendation_batch_id) &&
      refresh.properties.new_recommendation_batch_id !== refresh.properties.old_recommendation_batch_id,
    "大厅共鸣确认成功生成新推荐批次",
  );
  assert(
    events.some((event) => event.event_name === "lobby_search_executed" && event.properties?.zero_results === true),
    "搜索 800ms 防抖路径记录无结果查询",
  );
  assert(
    events
      .filter((event) => event.event_name === "story_reaction_result")
      .some((event) => event.properties?.success === true),
    "喜欢/不喜欢服务端结果成功",
  );
  assert(
    events.some((event) => event.event_name === "ai_label_edited"),
    "AI 类型修改已记录",
  );
  assert(
    events.some((event) => event.event_name === "image_generation_result" && event.properties?.success === true),
    "图片生成成功已记录",
  );
  assert(
    events.some((event) => event.event_name === "tour_completed"),
    "引导完成分支已记录",
  );
  assert(
    events.some((event) => event.event_name === "tour_skipped"),
    "引导跳过分支已记录",
  );
  assert(
    events.some((event) => event.event_name === "language_changed"),
    "中英文切换已记录",
  );
  assert(
    events.some(
      (event) =>
        event.event_name === "auth_result" && event.properties?.success === true && event.user_id === profile.id,
    ),
    "登录成功事件携带 JWT 并由服务端确定 user_id",
  );
  assert(
    events.some((event) => event.event_name === "logout_clicked"),
    "退出事件已立即发送",
  );

  process.stdout.write(
    `${JSON.stringify(
      {
        username,
        totalEvents: events.length,
        uniqueEvents: Object.keys(counts).length,
        p0Events: Object.fromEntries(p0.map((name) => [name, counts[name] ?? 0])),
        meaningfulReadMs: Number(meaningful?.properties?.active_duration_ms ?? 0),
        starExposureCount: exposureKeys.length,
      },
      null,
      2,
    )}\n`,
  );
} else {
  const [{ data: images, error: imageError }, { data: reports, error: reportError }] = await Promise.all([
    service.from("generated_images").select("storage_path").eq("user_id", profile.id),
    service.from("reports").select("id,review_case_id").eq("reporter_id", profile.id),
  ]);
  if (imageError || reportError) throw imageError ?? reportError;
  const paths = (images ?? []).map((image) => image.storage_path).filter(Boolean);
  if (paths.length) {
    const { error } = await service.storage.from("story-images").remove(paths);
    if (error) throw error;
  }
  const reviewIds = (reports ?? []).map((report) => report.review_case_id).filter(Boolean);
  if ((reports ?? []).length) {
    const { error } = await service.from("reports").delete().eq("reporter_id", profile.id);
    if (error) throw error;
  }
  if (reviewIds.length) {
    const { error } = await service.from("review_cases").delete().in("id", reviewIds);
    if (error) throw error;
  }
  await service.from("admin_audit_logs").delete().eq("admin_id", profile.id);
  if (anonymousId) {
    const { error } = await service
      .from("analytics_events")
      .delete()
      .or(`user_id.eq.${profile.id},anonymous_id.eq.${anonymousId}`);
    if (error) throw error;
  }
  const { error: deleteError } = await service.auth.admin.deleteUser(profile.id);
  if (deleteError) throw deleteError;
  const { count: remainingEvents, error: remainingError } = await service
    .from("analytics_events")
    .select("event_id", { count: "exact", head: true })
    .eq("user_id", profile.id);
  if (remainingError) throw remainingError;
  assert((remainingEvents ?? 0) === 0, "QA 用户及合成埋点清理完成");
  process.stdout.write(
    `Removed ${username}: ${paths.length} image object(s), ${(reports ?? []).length} report(s), ${reviewIds.length} review case(s).\n`,
  );
}
