import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const action = process.argv[2];
if (!new Set(["create", "cleanup"]).has(action)) {
  throw new Error("Usage: node scripts/qa-local-admin-analytics-fixture.mjs create|cleanup");
}

const statusResult = spawnSync("npx", ["supabase", "status", "-o", "json"], {
  cwd: process.cwd(),
  encoding: "utf8",
});
if (statusResult.status !== 0) throw new Error(statusResult.stderr || "Local Supabase is unavailable.");
const status = JSON.parse(statusResult.stdout.slice(statusResult.stdout.indexOf("{")));
if (!String(status.API_URL).startsWith("http://127.0.0.1:")) throw new Error("Fixture only supports local Supabase.");

const service = createClient(status.API_URL, status.SECRET_KEY, { auth: { persistSession: false } });
const usernames = ["qa_dash_admin", "qa_dash_writer", "qa_dash_reader", "qa_dash_newcomer"];

async function cleanup() {
  const { data: profiles, error } = await service
    .from("profiles")
    .select("id,username,display_name")
    .in("username", usernames);
  if (error) throw error;
  if ((profiles ?? []).some((profile) => !String(profile.display_name).startsWith("QA 看板"))) {
    throw new Error("Safety stop: a fixture username belongs to a non-QA profile.");
  }
  const ids = (profiles ?? []).map((profile) => profile.id);
  if (ids.length) {
    const { error: eventError } = await service.from("analytics_events").delete().in("user_id", ids);
    if (eventError) throw eventError;
    for (const id of ids) {
      const { error: userError } = await service.auth.admin.deleteUser(id);
      if (userError) throw userError;
    }
  }
}

if (action === "cleanup") {
  await cleanup();
  process.stdout.write("Local analytics dashboard fixture removed.\n");
  process.exit(0);
}

await cleanup();
const password = "StoryVerse-QA-Admin-2026!";
const signupResponse = await fetch(`${status.API_URL}/functions/v1/auth-signup`, {
  method: "POST",
  headers: {
    apikey: status.PUBLISHABLE_KEY,
    Authorization: `Bearer ${status.PUBLISHABLE_KEY}`,
    Origin: "http://127.0.0.1:4174",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    accountIdentifier: usernames[0],
    displayName: "QA 看板管理员",
    password,
    passwordConfirmation: password,
    securityQuestion: "first_school",
    securityAnswer: "QA dashboard school",
  }),
});
const signup = await signupResponse.json();
if (!signupResponse.ok || !signup.user?.id) throw new Error(signup.error || "Could not create local admin fixture.");
const adminId = signup.user.id;
const { error: promoteError } = await service.from("profiles").update({ role: "admin" }).eq("id", adminId);
if (promoteError) throw promoteError;

const participantProfiles = [];
for (const [index, username] of usernames.slice(1).entries()) {
  const { data, error } = await service.auth.admin.createUser({
    email: `${username}@qa.storyverse.local`,
    password: `${password}-${index}`,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error(`Could not create ${username}.`);
  participantProfiles.push({
    id: data.user.id,
    username,
    display_name: ["QA 看板创作者", "QA 看板阅读者", "QA 看板新用户"][index],
    anonymous_number: 9800 + index,
    role: "user",
    status: "active",
  });
}
const { error: profileError } = await service.from("profiles").insert(participantProfiles);
if (profileError) throw profileError;

const priorities = {
  home_viewed: "P1",
  auth_result: "P2",
  icebreaker_viewed: "P1",
  story_write_viewed: "P0",
  story_input_snapshot: "P0",
  story_analysis_result: "P2",
  story_submit_result: "P2",
  star_lobby_viewed: "P0",
  star_exposed: "P0",
  star_clicked: "P0",
  lobby_search_executed: "P0",
  story_read_started: "P0",
  story_read_ended: "P0",
  story_reaction_result: "P0",
  tour_completed: "P1",
};

function event(profile, name, daysAgo, properties = {}) {
  return {
    event_id: randomUUID(),
    event_name: name,
    priority: priorities[name],
    occurred_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    user_id: profile.id,
    participant_key: profile.id.replaceAll("-", "").repeat(2),
    anonymous_id: randomUUID(),
    session_id: randomUUID(),
    page_view_id: randomUUID(),
    page_id: name.includes("star") || name.includes("read") ? "star_lobby" : "qa_fixture",
    route: name.includes("star") || name.includes("read") ? "/StarLobby" : "/StoryWrite",
    language: "zh",
    theme: "day",
    device_type: "desktop",
    viewport: { width: 1440, height: 900, pixel_ratio: 2 },
    browser: "QA",
    os: "QA",
    study_id: "storyverse_lab_v1",
    condition_id: "dashboard_fixture",
    app_version: "qa",
    environment: "test",
    properties,
  };
}

const [writer, reader, newcomer] = participantProfiles;
const events = [
  event(writer, "home_viewed", 12),
  event(writer, "story_write_viewed", 11),
  event(writer, "story_input_snapshot", 11, {
    was_pasted: true,
    title_active_ms: 12_000,
    body_active_ms: 94_000,
  }),
  event(writer, "story_analysis_result", 11, { success: true }),
  event(writer, "story_submit_result", 10, { success: true, status: "published" }),
  event(writer, "star_lobby_viewed", 9),
  event(writer, "star_exposed", 9),
  event(writer, "star_clicked", 9),
  event(writer, "story_read_started", 9),
  event(writer, "story_read_ended", 9, {
    meaningful_read: true,
    is_own_story: false,
    active_duration_ms: 31_000,
  }),
  event(writer, "story_reaction_result", 9, { success: true, reaction: "like" }),
  event(writer, "lobby_search_executed", 8, { raw_query: "成长", zero_results: false }),
  event(writer, "tour_completed", 7),
  event(reader, "home_viewed", 6),
  event(reader, "auth_result", 6, { success: true, mode: "signup" }),
  event(reader, "icebreaker_viewed", 6),
  event(reader, "story_input_snapshot", 5, {
    was_pasted: false,
    title_active_ms: 18_000,
    body_active_ms: 130_000,
  }),
  event(reader, "story_analysis_result", 5, { success: true }),
  event(reader, "story_submit_result", 4, { success: true, status: "published" }),
  event(reader, "star_lobby_viewed", 3),
  event(reader, "star_exposed", 3),
  event(reader, "star_clicked", 3),
  event(reader, "story_read_started", 3),
  event(reader, "story_read_ended", 3, {
    meaningful_read: false,
    is_own_story: false,
    active_duration_ms: 8_000,
  }),
  event(reader, "story_reaction_result", 3, { success: true, reaction: "dislike" }),
  event(reader, "lobby_search_executed", 2, { raw_query: "火星", zero_results: true }),
  event(newcomer, "home_viewed", 1),
  event(newcomer, "auth_result", 1, { success: true, mode: "signup" }),
  event(newcomer, "icebreaker_viewed", 1),
  event(newcomer, "story_write_viewed", 0),
];
const { error: eventError } = await service.from("analytics_events").insert(events);
if (eventError) throw eventError;

process.stdout.write(`Local dashboard fixture ready.\nusername=${usernames[0]}\npassword=${password}\n`);
