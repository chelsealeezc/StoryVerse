import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { z, ZodError } from "zod";
import type pg from "pg";
import {
  AuthenticatedRequest,
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  hashPassword,
  hashToken,
  normalizeEmail,
  requireUser,
  setSessionCookie,
  verifyPassword,
} from "./auth.js";
import { createPool } from "./db.js";
import { createImageGenerationService, imageGenerationError } from "./image-generation.js";

const emailSchema = z.string().email().max(254).transform(normalizeEmail);
const passwordSchema = z.string().min(10).max(128);
const resonanceSchema = z.enum(["similar", "different"]);
const tagLayers = ["topic", "emotion", "meaning", "perspective"] as const;

const draftSchema = z.object({
  guide: z.string().max(120).default(""), customGuide: z.string().max(300).default(""),
  title: z.string().max(160).default(""), body: z.string().max(20_000).default(""), mood: z.string().max(60).default(""),
  time: z.string().max(80).default(""), stage: z.string().max(80).default(""), age: z.string().max(20).default(""),
  city: z.string().max(120).default(""), cityEn: z.string().max(120).default(""), cityCountry: z.string().max(120).default(""),
  cityLat: z.number().min(-90).max(90).nullable().default(null), cityLon: z.number().min(-180).max(180).nullable().default(null),
  people: z.array(z.string().max(60)).max(12).default([]), startedAt: z.number().int().nonnegative().default(0),
  edits: z.number().int().nonnegative().default(0), pastedChars: z.number().int().nonnegative().default(0),
  saves: z.number().int().nonnegative().default(0), savedAt: z.number().int().nonnegative().default(0),
  version: z.number().int().positive().optional(),
});

const analysisSchema = z.object({
  suggestedTitle: z.string().min(1).max(160),
  tags: z.object({
    topic: z.array(z.string().min(1).max(60)).max(3),
    emotion: z.array(z.string().min(1).max(60)).max(3),
    meaning: z.array(z.string().min(1).max(60)).max(3),
    perspective: z.array(z.string().min(1).max(60)).max(3),
  }),
  arc: z.array(z.string().max(300)).max(8),
});

function ok(request: FastifyRequest, data: unknown) {
  return { data, error: null, requestId: request.id };
}

function fail(request: FastifyRequest, code: string, message: string) {
  return { data: null, error: { code, message }, requestId: request.id };
}

function userOf(request: FastifyRequest) {
  return (request as AuthenticatedRequest).authUser;
}

function mapDraft(row: Record<string, unknown>) {
  const metrics = (row.metrics || {}) as Record<string, number>;
  return {
    id: row.id, guide: row.guide, customGuide: row.customGuide, title: row.title, body: row.body, mood: row.mood,
    time: row.time, stage: row.stage, age: row.age, city: row.city, cityEn: row.cityEn, cityCountry: row.cityCountry,
    cityLat: row.cityLat, cityLon: row.cityLon, people: row.people, version: row.version,
    startedAt: metrics.startedAt || 0, edits: metrics.edits || 0, pastedChars: metrics.pastedChars || 0,
    saves: metrics.saves || 0, savedAt: row.savedAt instanceof Date ? row.savedAt.getTime() : 0,
  };
}

function deterministicAnalysis(body: string, title: string) {
  const contains = (values: string[]) => values.find(value => body.includes(value));
  const topic = contains(["父亲", "母亲", "家", "外婆"]) ? "家庭" : contains(["工作", "辞职", "同事"]) ? "工作" : contains(["城市", "搬家", "离开"]) ? "迁移" : "成长";
  const emotion = contains(["想念", "遗憾", "害怕", "温暖", "释然"]) || "复杂";
  const meaning = contains(["告别", "归属", "理解", "独立", "选择"]) || "成长";
  return {
    suggestedTitle: title.trim() || body.trim().slice(0, 20) || "一段值得记住的故事",
    tags: { topic: [topic], emotion: [emotion], meaning: [meaning], perspective: ["自我理解"] },
    arc: ["熟悉的生活发生变化", "一个具体瞬间带来触动", "重新理解自己或他人", "带着新的意义继续生活"],
  };
}

function storySelect(prefix = "") {
  return `select s.id, s.title, s.excerpt, s.body, s.anonymous_author as author, s.city, s.life_stage as stage,
    s.theme, s.emotion, s.meaning, s.perspective, s.people, s.published_at as "publishedAt",
    greatest(1, ceil(length(s.body)::numeric / 500))::int as "readMinutes"${prefix}`;
}

async function transaction<T>(pool: pg.Pool, run: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await run(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function buildApp(options: { pool?: pg.Pool | null } = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: { redact: ["req.headers.cookie", "req.headers.authorization", "req.body.password", "req.body.story", "req.body.body", "req.body.note"] }, bodyLimit: 128 * 1024 });
  const pool = options.pool === undefined ? createPool() : options.pool;
  const allowedOrigins = new Set((process.env.FRONTEND_ORIGINS || "http://127.0.0.1:4173,http://localhost:4173").split(",").map(value => value.trim()).filter(Boolean));

  await app.register(cookie);
  await app.register(cors, { origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), credentials: true });
  await app.register(rateLimit, { global: false, max: 120, timeWindow: "1 minute" });

  app.addHook("onRequest", async (request, reply) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const origin = request.headers.origin;
      if (origin && !allowedOrigins.has(origin)) return reply.code(403).send(fail(request, "ORIGIN_FORBIDDEN", "不允许的网页来源。"));
    }
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send(fail(request, "VALIDATION_ERROR", error.issues[0]?.message || "请求内容不正确。"));
    if ((error as { code?: string }).code === "23505") return reply.code(409).send(fail(request, "CONFLICT", "数据已经存在或版本发生冲突。"));
    request.log.error({ err: error }, "request failed");
    return reply.code(500).send(fail(request, "INTERNAL_ERROR", "服务暂时不可用，请稍后重试。"));
  });

  const authenticated = async (request: FastifyRequest, reply: FastifyReply) => requireUser(request, reply, pool);

  app.get("/health/live", async request => ok(request, { status: "ok" }));
  app.get("/api/v1/health/live", async request => ok(request, { status: "ok" }));
  const ready = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!pool) return reply.code(503).send(fail(request, "DATABASE_UNAVAILABLE", "数据库尚未配置。"));
    try { await pool.query("select 1"); return ok(request, { status: "ok" }); }
    catch { return reply.code(503).send(fail(request, "DATABASE_UNAVAILABLE", "数据库连接失败。")); }
  };
  app.get("/health/ready", ready);
  app.get("/api/v1/health/ready", ready);

  app.post("/api/v1/auth/register", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
    if (!pool) return reply.code(503).send(fail(request, "DATABASE_UNAVAILABLE", "数据库尚未配置。"));
    const input = z.object({ email: emailSchema, password: passwordSchema, displayName: z.string().trim().min(2).max(40) }).parse(request.body);
    const passwordHash = await hashPassword(input.password);
    const result = await transaction(pool, async client => {
      const inserted = await client.query(`insert into users (email, password_hash, display_name) values ($1,$2,$3)
        returning id, email, display_name as "displayName", anonymous_number as "anonymousNumber"`, [input.email, passwordHash, input.displayName]);
      await client.query("insert into resonance_preferences (user_id) values ($1)", [inserted.rows[0].id]);
      return inserted.rows[0];
    });
    const token = await createSession(pool, result.id);
    setSessionCookie(reply, token);
    return reply.code(201).send(ok(request, { user: result }));
  });

  app.post("/api/v1/auth/login", { config: { rateLimit: { max: 8, timeWindow: "15 minutes" } } }, async (request, reply) => {
    if (!pool) return reply.code(503).send(fail(request, "DATABASE_UNAVAILABLE", "数据库尚未配置。"));
    const input = z.object({ email: emailSchema, password: z.string().max(128) }).parse(request.body);
    const result = await pool.query(`select id, email, password_hash as "passwordHash", display_name as "displayName", anonymous_number as "anonymousNumber"
      from users where email=$1 and status='active'`, [input.email]);
    if (!result.rowCount || !(await verifyPassword(result.rows[0].passwordHash, input.password))) return reply.code(401).send(fail(request, "INVALID_CREDENTIALS", "邮箱或密码不正确。"));
    const token = await createSession(pool, result.rows[0].id);
    setSessionCookie(reply, token);
    const { passwordHash: _, ...user } = result.rows[0];
    return ok(request, { user });
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    if (pool && request.cookies[SESSION_COOKIE]) await pool.query("delete from sessions where token_hash=$1", [hashToken(request.cookies[SESSION_COOKIE])]);
    clearSessionCookie(reply);
    return ok(request, { loggedOut: true });
  });
  app.get("/api/v1/auth/me", { preHandler: authenticated }, async request => ok(request, { user: userOf(request) }));

  app.get("/api/v1/drafts", { preHandler: authenticated }, async request => {
    const result = await pool!.query(`select id, guide, custom_guide as "customGuide", title, body, mood, occurred_at as time, life_stage as stage,
      age, city, city_en as "cityEn", city_country as "cityCountry", city_lat as "cityLat", city_lon as "cityLon", people, metrics, version, updated_at as "savedAt"
      from drafts where user_id=$1 order by updated_at desc`, [userOf(request).id]);
    return ok(request, result.rows.map(mapDraft));
  });
  app.get("/api/v1/drafts/current", { preHandler: authenticated }, async request => {
    const result = await pool!.query(`select id, guide, custom_guide as "customGuide", title, body, mood, occurred_at as time, life_stage as stage,
      age, city, city_en as "cityEn", city_country as "cityCountry", city_lat as "cityLat", city_lon as "cityLon", people, metrics, version, updated_at as "savedAt"
      from drafts where user_id=$1 and is_current=true`, [userOf(request).id]);
    return ok(request, result.rowCount ? mapDraft(result.rows[0]) : null);
  });
  app.put("/api/v1/drafts/current", { preHandler: authenticated }, async (request, reply) => {
    const input = draftSchema.parse(request.body);
    const metrics = { startedAt: input.startedAt, edits: input.edits, pastedChars: input.pastedChars, saves: input.saves };
    const result = await pool!.query(`insert into drafts (user_id,guide,custom_guide,title,body,mood,occurred_at,life_stage,age,city,city_en,city_country,city_lat,city_lon,people,metrics)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      on conflict (user_id) where is_current do update set guide=excluded.guide, custom_guide=excluded.custom_guide, title=excluded.title,
      body=excluded.body, mood=excluded.mood, occurred_at=excluded.occurred_at, life_stage=excluded.life_stage, age=excluded.age,
      city=excluded.city, city_en=excluded.city_en, city_country=excluded.city_country, city_lat=excluded.city_lat, city_lon=excluded.city_lon,
      people=excluded.people, metrics=excluded.metrics, version=drafts.version+1, updated_at=now()
      where $17::int is null or drafts.version=$17
      returning id, guide, custom_guide as "customGuide", title, body, mood, occurred_at as time, life_stage as stage, age, city,
      city_en as "cityEn", city_country as "cityCountry", city_lat as "cityLat", city_lon as "cityLon", people, metrics, version, updated_at as "savedAt"`,
      [userOf(request).id,input.guide,input.customGuide,input.title,input.body,input.mood,input.time,input.stage,input.age,input.city,input.cityEn,input.cityCountry,input.cityLat,input.cityLon,JSON.stringify(input.people),JSON.stringify(metrics),input.version ?? null]);
    if (!result.rowCount) {
      const server = await pool!.query("select version, body, updated_at as \"savedAt\" from drafts where user_id=$1 and is_current=true", [userOf(request).id]);
      return reply.code(409).send({ ...fail(request, "DRAFT_VERSION_CONFLICT", "草稿已在其他设备更新。"), server: server.rows[0] });
    }
    return ok(request, mapDraft(result.rows[0]));
  });

  app.post("/api/v1/stories/analyze", { preHandler: authenticated }, async request => {
    const input = z.object({ title: z.string().max(160).default(""), body: z.string().min(30).max(20_000), draftId: z.string().uuid().optional() }).parse(request.body);
    const analysis = deterministicAnalysis(input.body, input.title);
    const saved = await pool!.query(`insert into story_analyses (user_id,draft_id,suggested_title,tags,narrative_arc)
      values ($1,$2,$3,$4,$5) returning id`, [userOf(request).id,input.draftId ?? null,analysis.suggestedTitle,JSON.stringify(analysis.tags),JSON.stringify(analysis.arc)]);
    return ok(request, { id: saved.rows[0].id, ...analysis });
  });

  app.post("/api/v1/stories/publish", { preHandler: authenticated }, async (request, reply) => {
    const input = z.object({ draft: draftSchema, analysis: analysisSchema, analysisId: z.string().uuid().optional() }).parse(request.body);
    if (input.draft.body.trim().length < 30) return reply.code(400).send(fail(request, "STORY_TOO_SHORT", "故事正文至少需要 30 个字。"));
    const published = await transaction(pool!, async client => {
      const user = userOf(request);
      const title = input.draft.title.trim() || input.analysis.suggestedTitle;
      const topic = input.analysis.tags.topic[0] || "成长";
      const story = await client.query(`insert into stories (user_id,title,body,excerpt,anonymous_author,city,life_stage,theme,emotion,meaning,perspective,people)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        returning id,title,excerpt,body,anonymous_author as author,city,life_stage as stage,theme,emotion,meaning,perspective,people,published_at as "publishedAt"`,
        [user.id,title,input.draft.body,input.draft.body.slice(0,90),`星旅人 ${String(user.anonymousNumber).padStart(3,"0")}`,input.draft.city,input.draft.stage,topic,input.analysis.tags.emotion[0]||"",input.analysis.tags.meaning[0]||"",input.analysis.tags.perspective[0]||"",JSON.stringify(input.draft.people)]);
      const storyRow = { ...story.rows[0], readMinutes: Math.max(1, Math.ceil(input.draft.body.length / 500)) };
      for (const layer of tagLayers) for (const [position, value] of input.analysis.tags[layer].entries()) await client.query("insert into story_tags (story_id,layer,value,source,position) values ($1,$2,$3,'user', $4)", [storyRow.id,layer,value,position]);
      if (input.analysisId) await client.query("update story_analyses set story_id=$1 where id=$2 and user_id=$3", [storyRow.id,input.analysisId,user.id]);
      else await client.query("insert into story_analyses (user_id,story_id,suggested_title,tags,narrative_arc) values ($1,$2,$3,$4,$5)", [user.id,storyRow.id,input.analysis.suggestedTitle,JSON.stringify(input.analysis.tags),JSON.stringify(input.analysis.arc)]);
      await client.query("update drafts set is_current=false, updated_at=now() where user_id=$1 and is_current=true", [user.id]);
      const prefs = await client.query("select city,stage,theme from resonance_preferences where user_id=$1", [user.id]);
      const batch = await client.query("insert into recommendation_batches (user_id,preferences) values ($1,$2) returning id", [user.id,JSON.stringify(prefs.rows[0] || {city:"similar",stage:"different",theme:"similar"})]);
      const candidates = await client.query("select id,city,life_stage,theme from stories where id<>$1 and visibility='public' and moderation_status='approved' order by published_at desc limit 5", [storyRow.id]);
      for (const [position, candidate] of candidates.rows.entries()) await client.query("insert into recommendation_items (batch_id,story_id,reason,position) values ($1,$2,$3,$4)", [batch.rows[0].id,candidate.id, candidate.theme===topic ? "与你关注相近的主题，来自另一段真实生活。" : "主题不同，却同样包含一次重要的人生选择。",position]);
      return { story: storyRow, recommendationBatchId: batch.rows[0].id };
    });
    return reply.code(201).send(ok(request, published));
  });

  app.get("/api/v1/stories", { preHandler: authenticated }, async request => {
    const result = await pool!.query(`${storySelect()} from stories s where s.visibility='public' and s.moderation_status='approved' order by s.published_at desc limit 100`);
    return ok(request, result.rows);
  });
  app.get("/api/v1/stories/mine", { preHandler: authenticated }, async request => {
    const result = await pool!.query(`${storySelect()} from stories s where s.user_id=$1 order by s.published_at desc`, [userOf(request).id]);
    return ok(request, result.rows);
  });
  app.get("/api/v1/stories/:id", { preHandler: authenticated }, async (request, reply) => {
    const id = z.string().uuid().parse((request.params as { id: string }).id);
    const result = await pool!.query(`${storySelect()} from stories s where s.id=$1 and (s.user_id=$2 or (s.visibility='public' and s.moderation_status='approved'))`, [id,userOf(request).id]);
    return result.rowCount ? ok(request,result.rows[0]) : reply.code(404).send(fail(request,"NOT_FOUND","故事不存在。"));
  });

  app.get("/api/v1/resonance", { preHandler: authenticated }, async request => {
    const result = await pool!.query("select city,stage,theme from resonance_preferences where user_id=$1", [userOf(request).id]);
    return ok(request,result.rows[0]);
  });
  app.put("/api/v1/resonance", { preHandler: authenticated }, async request => {
    const input = z.object({ city: resonanceSchema, stage: resonanceSchema, theme: resonanceSchema }).parse(request.body);
    const result = await pool!.query(`insert into resonance_preferences (user_id,city,stage,theme) values ($1,$2,$3,$4)
      on conflict (user_id) do update set city=excluded.city,stage=excluded.stage,theme=excluded.theme,updated_at=now() returning city,stage,theme`, [userOf(request).id,input.city,input.stage,input.theme]);
    return ok(request,result.rows[0]);
  });

  app.post("/api/v1/recommendations", { preHandler: authenticated }, async request => {
    const result = await transaction(pool!, async client => {
      const prefs = await client.query("select city,stage,theme from resonance_preferences where user_id=$1", [userOf(request).id]);
      const batch = await client.query("insert into recommendation_batches (user_id,preferences) values ($1,$2) returning id,created_at as \"createdAt\"", [userOf(request).id,JSON.stringify(prefs.rows[0])]);
      const stories = await client.query(`${storySelect()} from stories s where s.user_id<>$1 and s.visibility='public' and s.moderation_status='approved' order by s.published_at desc limit 5`, [userOf(request).id]);
      const items=[];
      for (const [position,story] of stories.rows.entries()) {
        const reason="根据你的城市、人生阶段和主题偏好，为你保留一条可理解的连接。";
        const item=await client.query("insert into recommendation_items (batch_id,story_id,reason,position) values ($1,$2,$3,$4) returning id",[batch.rows[0].id,story.id,reason,position]);
        items.push({id:item.rows[0].id,story:{...story,reason},reason,position,openedAt:null});
      }
      return {...batch.rows[0],items};
    });
    return ok(request,result);
  });
  app.post("/api/v1/recommendations/:itemId/open", { preHandler: authenticated }, async (request, reply) => {
    const itemId=z.string().uuid().parse((request.params as {itemId:string}).itemId);
    const result=await pool!.query(`update recommendation_items i set opened_at=coalesce(opened_at,now()) from recommendation_batches b
      where i.id=$1 and i.batch_id=b.id and b.user_id=$2 returning i.id,i.opened_at as "openedAt"`,[itemId,userOf(request).id]);
    return result.rowCount?ok(request,result.rows[0]):reply.code(404).send(fail(request,"NOT_FOUND","推荐记录不存在。"));
  });

  app.put("/api/v1/stories/:id/reaction", { preHandler: authenticated }, async request => {
    const storyId=z.string().uuid().parse((request.params as {id:string}).id);
    const {value}=z.object({value:z.enum(["like","dislike"])}).parse(request.body);
    const result=await pool!.query(`insert into reactions (user_id,story_id,value) values ($1,$2,$3)
      on conflict (user_id,story_id) do update set value=excluded.value,updated_at=now() returning value,updated_at as "updatedAt"`,[userOf(request).id,storyId,value]);
    return ok(request,result.rows[0]);
  });
  app.delete("/api/v1/stories/:id/reaction", { preHandler: authenticated }, async request => {
    const storyId=z.string().uuid().parse((request.params as {id:string}).id);
    await pool!.query("delete from reactions where user_id=$1 and story_id=$2",[userOf(request).id,storyId]);
    return ok(request,{deleted:true});
  });
  app.post("/api/v1/stories/:id/reports", { preHandler: authenticated }, async (request, reply) => {
    const storyId=z.string().uuid().parse((request.params as {id:string}).id);
    const input=z.object({reason:z.string().min(1).max(80),note:z.string().max(1000).default("")}).parse(request.body);
    const result=await pool!.query("insert into reports (reporter_id,story_id,reason,note) values ($1,$2,$3,$4) returning id,status,created_at as \"createdAt\"",[userOf(request).id,storyId,input.reason,input.note]);
    return reply.code(201).send(ok(request,result.rows[0]));
  });

  const generateImage=createImageGenerationService({apiKey:process.env.DASHSCOPE_API_KEY,workspaceId:process.env.DASHSCOPE_WORKSPACE_ID,imageBaseUrl:process.env.DASHSCOPE_IMAGE_BASE_URL,qwenBaseUrl:process.env.DASHSCOPE_QWEN_BASE_URL,imageModel:process.env.DASHSCOPE_IMAGE_MODEL,qwenModel:process.env.DASHSCOPE_QWEN_MODEL});
  app.post("/api/generate-image", { config:{rateLimit:{max:6,timeWindow:"1 hour"}}, preHandler: authenticated }, async (request,reply) => {
    try {
      const result=await generateImage(request.body as Parameters<typeof generateImage>[0]);
      if ("imageUrl" in result) {
        try {
          await pool!.query(`insert into generated_images (user_id,style,prompt,highlight,status,model,expires_at)
            values ($1,$2,$3,$4,'ready',$5,now()+interval '24 hours')`,[userOf(request).id,result.imageStyle,result.imagePrompt,JSON.stringify(result.highlight),process.env.DASHSCOPE_IMAGE_MODEL||"wan2.7-image"]);
        } catch (error) {
          // Metadata persistence is observability, not part of the user's paid
          // generation result. Never discard a successfully generated image
          // because a legacy table or grant is temporarily unavailable.
          request.log.error({ err:error },"generated image metadata persistence failed");
        }
      }
      return ok(request,result);
    } catch(error) {
      const mapped=imageGenerationError(error);
      return reply.code(mapped.status).send(fail(request,"IMAGE_GENERATION_FAILED",mapped.message));
    }
  });

  app.addHook("onClose", async () => { if (options.pool === undefined) await pool?.end(); });
  return app;
}
