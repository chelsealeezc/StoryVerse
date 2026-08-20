import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

function localSupabase() {
  const result = spawnSync("npx", ["supabase", "status", "-o", "json"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`Could not read local Supabase status: ${result.stderr.trim()}`);
  const start = result.stdout.indexOf("{");
  const status = JSON.parse(result.stdout.slice(start));
  if (!String(status.API_URL).startsWith("http://127.0.0.1:")) {
    throw new Error("This QA utility refuses to operate on a remote Supabase project.");
  }
  return { url: status.API_URL, secretKey: status.SECRET_KEY };
}

const [action, username, value] = process.argv.slice(2);
if (!action || !username) {
  throw new Error("Usage: node scripts/qa-local-test-user.mjs inspect|reset-password|cleanup <username> [password]");
}

const config = localSupabase();
const service = createClient(config.url, config.secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: profile, error: profileError } = await service
  .from("profiles")
  .select("id,username,display_name,role,status,created_at")
  .eq("username", username)
  .maybeSingle();
if (profileError) throw profileError;
if (!profile) throw new Error(`Test profile not found: ${username}`);
if (!/qa/i.test(profile.display_name) && !/^qa[_-]/i.test(profile.username)) {
  throw new Error(`Safety stop: ${username} is not recognizably an isolated QA account.`);
}

async function count(table, column, id) {
  const { count: result, error } = await service.from(table).select("*", { count: "exact", head: true }).eq(column, id);
  if (error) throw error;
  return result ?? 0;
}

if (action === "inspect") {
  const [{ data: stories, error: storiesError }, { data: images, error: imagesError }] = await Promise.all([
    service
      .from("stories")
      .select("id,title,status,moderation_decision,city,age,gender,created_at")
      .eq("user_id", profile.id)
      .order("created_at"),
    service.from("generated_images").select("story_id,status,style,prompt").eq("user_id", profile.id),
  ]);
  if (storiesError || imagesError) throw storiesError ?? imagesError;
  const summary = {
    profile,
    stories,
    drafts: await count("story_drafts", "user_id", profile.id),
    images,
    reports: await count("reports", "reporter_id", profile.id),
    auditLogs: await count("admin_audit_logs", "admin_id", profile.id),
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else if (action === "reset-password") {
  if (!value || value.length < 10 || value.length > 72) throw new Error("Provide a 10–72 character QA password.");
  const { error } = await service.auth.admin.updateUserById(profile.id, { password: value });
  if (error) throw error;
  process.stdout.write(`Reset password for isolated QA account ${username}.\n`);
} else if (action === "cleanup") {
  const { data: images, error: imageError } = await service
    .from("generated_images")
    .select("storage_path")
    .eq("user_id", profile.id);
  if (imageError) throw imageError;
  const paths = (images ?? []).map((image) => image.storage_path).filter(Boolean);
  if (paths.length) {
    const { error } = await service.storage.from("story-images").remove(paths);
    if (error) throw error;
  }

  const { data: reports, error: reportError } = await service
    .from("reports")
    .select("id,review_case_id,story:stories(id,source_kind,created_at)")
    .eq("reporter_id", profile.id);
  if (reportError) throw reportError;
  const reviewIds = (reports ?? []).map((report) => report.review_case_id).filter(Boolean);
  for (const report of reports ?? []) {
    const story = Array.isArray(report.story) ? report.story[0] : report.story;
    if (story?.source_kind === "seed") {
      const { error } = await service.from("stories").update({ published_at: story.created_at }).eq("id", story.id);
      if (error) throw error;
    }
  }
  const { error: reportsDeleteError } = await service.from("reports").delete().eq("reporter_id", profile.id);
  if (reportsDeleteError) throw reportsDeleteError;
  if (reviewIds.length) {
    const { error } = await service.from("review_cases").delete().in("id", reviewIds);
    if (error) throw error;
  }
  const { error: auditDeleteError } = await service.from("admin_audit_logs").delete().eq("admin_id", profile.id);
  if (auditDeleteError) throw auditDeleteError;
  const { error: deleteError } = await service.auth.admin.deleteUser(profile.id);
  if (deleteError) throw deleteError;
  process.stdout.write(
    `Removed isolated QA account ${username}, ${paths.length} Storage object(s), ${reports?.length ?? 0} report(s), and ${reviewIds.length} review case(s).\n`,
  );
} else {
  throw new Error(`Unknown action: ${action}`);
}
