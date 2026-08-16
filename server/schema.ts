import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const accountStatus = pgEnum("account_status", ["active", "disabled"]);
export const storyVisibility = pgEnum("story_visibility", ["public", "private"]);
export const moderationStatus = pgEnum("moderation_status", ["pending", "approved", "rejected"]);
export const reactionValue = pgEnum("reaction_value", ["like", "dislike"]);
export const resonanceMode = pgEnum("resonance_mode", ["similar", "different"]);
export const reportStatus = pgEnum("report_status", ["pending", "reviewing", "resolved", "dismissed"]);
export const jobStatus = pgEnum("job_status", ["pending", "ready", "failed", "blocked"]);
export const tagLayer = pgEnum("tag_layer", ["topic", "emotion", "meaning", "perspective"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  anonymousNumber: integer("anonymous_number").generatedAlwaysAsIdentity().notNull(),
  status: accountStatus("status").default("active").notNull(),
  ...timestamps,
}, table => [uniqueIndex("users_email_unique").on(table.email)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex("sessions_token_hash_unique").on(table.tokenHash), index("sessions_user_id_idx").on(table.userId)]);

export const drafts = pgTable("drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  guide: text("guide").default("").notNull(),
  customGuide: text("custom_guide").default("").notNull(),
  title: text("title").default("").notNull(),
  body: text("body").default("").notNull(),
  mood: text("mood").default("").notNull(),
  occurredAt: text("occurred_at").default("").notNull(),
  lifeStage: text("life_stage").default("").notNull(),
  age: text("age").default("").notNull(),
  city: text("city").default("").notNull(),
  cityEn: text("city_en").default("").notNull(),
  cityCountry: text("city_country").default("").notNull(),
  cityLat: doublePrecision("city_lat"),
  cityLon: doublePrecision("city_lon"),
  people: jsonb("people").$type<string[]>().default([]).notNull(),
  metrics: jsonb("metrics").$type<Record<string, number>>().default({}).notNull(),
  version: integer("version").default(1).notNull(),
  isCurrent: boolean("is_current").default(true).notNull(),
  ...timestamps,
}, table => [uniqueIndex("drafts_one_current_per_user").on(table.userId).where(sql`is_current`), index("drafts_user_updated_idx").on(table.userId, table.updatedAt)]);

export const stories = pgTable("stories", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  excerpt: text("excerpt").notNull(),
  anonymousAuthor: text("anonymous_author").notNull(),
  city: text("city").default("").notNull(),
  lifeStage: text("life_stage").default("").notNull(),
  theme: text("theme").default("成长").notNull(),
  emotion: text("emotion").default("").notNull(),
  meaning: text("meaning").default("").notNull(),
  perspective: text("perspective").default("").notNull(),
  people: jsonb("people").$type<string[]>().default([]).notNull(),
  visibility: storyVisibility("visibility").default("public").notNull(),
  moderationStatus: moderationStatus("moderation_status").default("approved").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }).defaultNow().notNull(),
  ...timestamps,
}, table => [index("stories_feed_idx").on(table.visibility, table.moderationStatus, table.publishedAt), index("stories_user_idx").on(table.userId)]);

export const storyTags = pgTable("story_tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "cascade" }).notNull(),
  layer: tagLayer("layer").notNull(),
  value: text("value").notNull(),
  source: text("source").default("analysis").notNull(),
  position: integer("position").default(0).notNull(),
}, table => [uniqueIndex("story_tags_unique").on(table.storyId, table.layer, table.value)]);

export const storyAnalyses = pgTable("story_analyses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  draftId: uuid("draft_id").references(() => drafts.id, { onDelete: "set null" }),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "cascade" }),
  suggestedTitle: text("suggested_title").notNull(),
  tags: jsonb("tags").$type<Record<string, string[]>>().notNull(),
  narrativeArc: jsonb("narrative_arc").$type<string[]>().notNull(),
  status: jobStatus("status").default("ready").notNull(),
  failureReason: text("failure_reason"),
  model: text("model").default("deterministic-v1").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const resonancePreferences = pgTable("resonance_preferences", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).primaryKey(),
  city: resonanceMode("city").default("similar").notNull(),
  stage: resonanceMode("stage").default("different").notNull(),
  theme: resonanceMode("theme").default("similar").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const recommendationBatches = pgTable("recommendation_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  preferences: jsonb("preferences").$type<Record<string, string>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("recommendation_batches_user_idx").on(table.userId, table.createdAt)]);

export const recommendationItems = pgTable("recommendation_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  batchId: uuid("batch_id").references(() => recommendationBatches.id, { onDelete: "cascade" }).notNull(),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "cascade" }).notNull(),
  reason: text("reason").notNull(),
  position: integer("position").notNull(),
  openedAt: timestamp("opened_at", { withTimezone: true }),
}, table => [uniqueIndex("recommendation_item_story_unique").on(table.batchId, table.storyId)]);

export const reactions = pgTable("reactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "cascade" }).notNull(),
  value: reactionValue("value").notNull(),
  ...timestamps,
}, table => [uniqueIndex("reactions_user_story_unique").on(table.userId, table.storyId)]);

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "restrict" }).notNull(),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "restrict" }).notNull(),
  reason: text("reason").notNull(),
  note: text("note").default("").notNull(),
  status: reportStatus("status").default("pending").notNull(),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("reports_status_idx").on(table.status, table.createdAt)]);

export const generatedImages = pgTable("generated_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  storyId: uuid("story_id").references(() => stories.id, { onDelete: "set null" }),
  style: text("style").notNull(),
  prompt: text("prompt").notNull(),
  highlight: jsonb("highlight").$type<Record<string, unknown>>().notNull(),
  providerUrl: text("provider_url"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  status: jobStatus("status").default("pending").notNull(),
  model: text("model").notNull(),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  properties: jsonb("properties").$type<Record<string, string | number | boolean>>().default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, table => [index("analytics_events_name_created_idx").on(table.name, table.createdAt)]);

// Imported last to keep the schema declarations readable.
import { sql } from "drizzle-orm";
