CREATE TYPE "account_status" AS ENUM ('active', 'disabled');
CREATE TYPE "story_visibility" AS ENUM ('public', 'private');
CREATE TYPE "moderation_status" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "reaction_value" AS ENUM ('like', 'dislike');
CREATE TYPE "resonance_mode" AS ENUM ('similar', 'different');
CREATE TYPE "report_status" AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');
CREATE TYPE "job_status" AS ENUM ('pending', 'ready', 'failed', 'blocked');
CREATE TYPE "tag_layer" AS ENUM ('topic', 'emotion', 'meaning', 'perspective');

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "email" text NOT NULL, "password_hash" text NOT NULL,
  "display_name" text NOT NULL, "anonymous_number" integer GENERATED ALWAYS AS IDENTITY,
  "status" account_status NOT NULL DEFAULT 'active', "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email");

CREATE TABLE "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL, "expires_at" timestamptz NOT NULL, "last_used_at" timestamptz NOT NULL DEFAULT now(), "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "sessions_token_hash_unique" ON "sessions" ("token_hash");
CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id");

CREATE TABLE "drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "guide" text NOT NULL DEFAULT '', "custom_guide" text NOT NULL DEFAULT '', "title" text NOT NULL DEFAULT '', "body" text NOT NULL DEFAULT '',
  "mood" text NOT NULL DEFAULT '', "occurred_at" text NOT NULL DEFAULT '', "life_stage" text NOT NULL DEFAULT '', "age" text NOT NULL DEFAULT '',
  "city" text NOT NULL DEFAULT '', "city_en" text NOT NULL DEFAULT '', "city_country" text NOT NULL DEFAULT '', "city_lat" double precision, "city_lon" double precision,
  "people" jsonb NOT NULL DEFAULT '[]', "metrics" jsonb NOT NULL DEFAULT '{}', "version" integer NOT NULL DEFAULT 1, "is_current" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "drafts_one_current_per_user" ON "drafts" ("user_id") WHERE is_current;
CREATE INDEX "drafts_user_updated_idx" ON "drafts" ("user_id", "updated_at");

CREATE TABLE "stories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "title" text NOT NULL, "body" text NOT NULL, "excerpt" text NOT NULL, "anonymous_author" text NOT NULL,
  "city" text NOT NULL DEFAULT '', "life_stage" text NOT NULL DEFAULT '', "theme" text NOT NULL DEFAULT '成长', "emotion" text NOT NULL DEFAULT '',
  "meaning" text NOT NULL DEFAULT '', "perspective" text NOT NULL DEFAULT '', "people" jsonb NOT NULL DEFAULT '[]',
  "visibility" story_visibility NOT NULL DEFAULT 'public', "moderation_status" moderation_status NOT NULL DEFAULT 'approved',
  "published_at" timestamptz NOT NULL DEFAULT now(), "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "stories_feed_idx" ON "stories" ("visibility", "moderation_status", "published_at");
CREATE INDEX "stories_user_idx" ON "stories" ("user_id");

CREATE TABLE "story_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "story_id" uuid NOT NULL REFERENCES "stories"("id") ON DELETE CASCADE,
  "layer" tag_layer NOT NULL, "value" text NOT NULL, "source" text NOT NULL DEFAULT 'analysis', "position" integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "story_tags_unique" ON "story_tags" ("story_id", "layer", "value");

CREATE TABLE "story_analyses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "draft_id" uuid REFERENCES "drafts"("id") ON DELETE SET NULL, "story_id" uuid REFERENCES "stories"("id") ON DELETE CASCADE,
  "suggested_title" text NOT NULL, "tags" jsonb NOT NULL, "narrative_arc" jsonb NOT NULL, "status" job_status NOT NULL DEFAULT 'ready',
  "failure_reason" text, "model" text NOT NULL DEFAULT 'deterministic-v1', "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "resonance_preferences" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "city" resonance_mode NOT NULL DEFAULT 'similar', "stage" resonance_mode NOT NULL DEFAULT 'different', "theme" resonance_mode NOT NULL DEFAULT 'similar',
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "recommendation_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "preferences" jsonb NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "recommendation_batches_user_idx" ON "recommendation_batches" ("user_id", "created_at");
CREATE TABLE "recommendation_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "batch_id" uuid NOT NULL REFERENCES "recommendation_batches"("id") ON DELETE CASCADE,
  "story_id" uuid NOT NULL REFERENCES "stories"("id") ON DELETE CASCADE, "reason" text NOT NULL, "position" integer NOT NULL, "opened_at" timestamptz
);
CREATE UNIQUE INDEX "recommendation_item_story_unique" ON "recommendation_items" ("batch_id", "story_id");

CREATE TABLE "reactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "story_id" uuid NOT NULL REFERENCES "stories"("id") ON DELETE CASCADE, "value" reaction_value NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "reactions_user_story_unique" ON "reactions" ("user_id", "story_id");

CREATE TABLE "reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "reporter_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "story_id" uuid NOT NULL REFERENCES "stories"("id") ON DELETE RESTRICT, "reason" text NOT NULL, "note" text NOT NULL DEFAULT '',
  "status" report_status NOT NULL DEFAULT 'pending', "reviewed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamptz, "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "reports_status_idx" ON "reports" ("status", "created_at");

CREATE TABLE "generated_images" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "story_id" uuid REFERENCES "stories"("id") ON DELETE SET NULL, "style" text NOT NULL, "prompt" text NOT NULL, "highlight" jsonb NOT NULL,
  "provider_url" text, "expires_at" timestamptz, "status" job_status NOT NULL DEFAULT 'pending', "model" text NOT NULL,
  "failure_reason" text, "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "analytics_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "name" text NOT NULL, "properties" jsonb NOT NULL DEFAULT '{}', "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "analytics_events_name_created_idx" ON "analytics_events" ("name", "created_at");

-- Idempotent public seed stories. The disabled system account can never authenticate.
INSERT INTO users (id,email,password_hash,display_name,status)
VALUES ('00000000-0000-4000-8000-000000000001','seed@storyverse.invalid','disabled-account','StoryVerse','disabled')
ON CONFLICT (id) DO NOTHING;

INSERT INTO stories (id,user_id,title,excerpt,body,anonymous_author,city,life_stage,theme,emotion,meaning,perspective,people)
VALUES
('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','把故乡装进一只蓝色行李箱','离开昆明那天，我只带走了外婆缝的一块蓝布……','离开昆明那天，我只带走了外婆缝的一块蓝布。抵达上海后的第一个雨夜，我把它铺在陌生出租屋的桌上，忽然觉得房间里有了一小块故乡。后来我搬过三次家，那块布一直在箱子最上面。它没有让我不再想家，却让我明白，归属感有时不是一个地点，而是一件愿意一直带着走的小东西。','星旅人 042','昆明','初入职场','迁移','想念','归属','温柔现实主义','["自己","家人"]'),
('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','父亲第一次问我累不累','我们一直不擅长说柔软的话，直到那个凌晨……','大学毕业后的那个凌晨，我加班回家，发现父亲还坐在客厅。他没有问工作怎么样，只递给我一碗已经热过两次的汤，然后问：累不累？我们之间没有因此变得无话不谈，但我开始学会辨认他沉默里的关心。','匿名星点 117','广州','初入职场','家庭','温暖','理解','关系修复','["自己","家人"]'),
('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','二十七岁重新学会迷路','在东京交换的第三周，我故意没有打开地图……','在东京交换的第三周，我故意没有打开地图。迷路的两个小时里，我经过一间旧书店、一所放学的小学和一条没有游客的河。没有任何事情因此被解决，但我久违地感到自己正在生活，而不是完成一张无限延伸的任务清单。','星旅人 236','东京','青年探索','成长','释然','自由','慢下来','["自己","陌生人"]'),
('10000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','没有寄出的那封邮件','辞职前我写了很长一封邮件，最后只留下六个字……','辞职前我写了很长一封邮件，解释那些被忽视的努力。修改到深夜，最后却删掉所有控诉，只留下“谢谢，我决定离开”。有些选择不是为了证明谁错了，而是停止把自己交给一个已经无法生长的地方。','匿名星点 081','深圳','职业转折','工作','坚定','边界','自我选择','["自己","同事"]'),
('10000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','和母亲在厨房里重新认识','回家住的那个月，我们第一次像两个成年人那样聊天……','回家住的那个月，我和母亲每天在厨房一起准备晚饭。那天我终于问她，年轻时真正想做什么。她沉默很久，说想当一名地理老师。我们第一次不是作为母女，而是作为两个曾经犹豫、也曾错过什么的成年人聊天。','星旅人 305','成都','成年回望','家庭','复杂','看见','代际理解','["自己","家人"]'),
('10000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000001','我们在毕业典礼后走散','没有争吵，也没有正式告别，只是消息越来越短……','没有争吵，也没有正式告别，只是消息越来越短。毕业典礼那天我们约定每年见面，第三年却谁也没有再提。很久以后我才接受，有些关系不是因为做错了什么才结束。记得并不意味着必须回去。','匿名星点 193','武汉','大学毕业','关系','遗憾','告别','接纳变化','["朋友"]'),
('10000000-0000-4000-8000-000000000007','00000000-0000-4000-8000-000000000001','第一次用自己的名字签字','那张租房合同很普通，却像一份迟来的独立宣言……','那张租房合同很普通，却像一份迟来的独立宣言。签字时我的手有点抖，因为这意味着房租、水电和每一个决定都由自己承担。独立不是突然变得无所不能，而是终于允许自己在犯错后收拾残局。','星旅人 410','北京','独自生活','身份','勇气','独立','成长实践','["自己"]')
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'storyverse_app') THEN
    GRANT USAGE ON SCHEMA public TO storyverse_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO storyverse_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO storyverse_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO storyverse_app;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO storyverse_app;
  END IF;
END $$;
