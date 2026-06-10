import { sql } from "drizzle-orm";
import { pgTable, serial, text, integer, real, timestamp, boolean, jsonb, varchar, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("pending"),
  excludedWords: text("excluded_words"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const sessions = pgTable("session", {
  sid: varchar("sid").primaryKey().notNull(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (table) => [
  index("IDX_session_expire").on(table.expire),
]);

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  photoKey: text("photo_key").notNull(),
  videoKey: text("video_key").notNull(),
  videoSource: text("video_source").notNull().default("builder"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  personaPrompt: text("persona_prompt").notNull(),
  voiceId: text("voice_id"),
  voiceName: text("voice_name"),
  openaiModel: text("openai_model").notNull().default("gpt-4.1"),
  elevenlabsModel: text("elevenlabs_model").notNull().default("eleven_turbo_v2_5"),
  useEnhance: boolean("use_enhance").notNull().default(true),
  thresholdDb: real("threshold_db").notNull().default(-35),
  removeSilencesLongerThan: real("remove_silences_longer_than").notNull().default(0.2),
  ignoreDetectionsShorterThan: real("ignore_detections_shorter_than").notNull().default(0.75),
  musicKey: text("music_key"),
  voiceVolume: real("voice_volume").notNull().default(1.0),
  musicVolume: real("music_volume").notNull().default(0.3),
  autoCaptions: boolean("auto_captions").notNull().default(false),
  hookHeadline: boolean("hook_headline").notNull().default(false),
  hookPrompt: text("hook_prompt"),
  hookModel: text("hook_model").notNull().default("gpt-4.1"),
  captionEnabled: boolean("caption_enabled").notNull().default(false),
  captionPrompt: text("caption_prompt"),
  captionModel: text("caption_model").notNull().default("gpt-4.1"),
  seoEnabled: boolean("seo_enabled").notNull().default(false),
  seoPrompt: text("seo_prompt"),
  seoModel: text("seo_model").notNull().default("gpt-4.1"),
  timelineJson: jsonb("timeline_json").$type<Record<string, unknown> | null>(),
  userId: integer("user_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  userId: integer("user_id"),
  status: text("status").notNull().default("queued"),
  scriptText: text("script_text"),
  headlineText: text("headline_text"),
  captionText: text("caption_text"),
  seoText: text("seo_text"),
  audioRawKey: text("audio_raw_key"),
  audioCleanKey: text("audio_clean_key"),
  finalVideoKey: text("final_video_key"),
  activateShuffle: boolean("activate_shuffle").notNull().default(false),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lastError: text("last_error"),
  shareEnabled: boolean("share_enabled").notNull().default(false),
  shareToken: text("share_token"),
  shareRevokedAt: timestamp("share_revoked_at"),
  logs: text("logs").notNull().default(""),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const shots = pgTable("shots", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  category: text("category").notNull(),
  shotType: text("shot_type"),
  durationSec: real("duration_sec").notNull(),
  r2Key: text("r2_key").notNull(),
  orientation: text("orientation").notNull().default("portrait"),
  filename: text("filename"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const videoAnalyses = pgTable("video_analysis", {
  id: serial("id").primaryKey(),
  videoAssetId: integer("video_asset_id").notNull().references(() => assets.id),
  videoHash: text("video_hash").notNull(),
  analysisJson: jsonb("analysis_json").$type<Record<string, unknown>>().notNull(),
  sourceR2Key: text("source_r2_key"),
  modelUsed: text("model_used").notNull(),
  analysisVersion: text("analysis_version").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("idx_video_analysis_asset_id").on(table.videoAssetId),
  index("idx_video_analysis_hash").on(table.videoHash),
  index("idx_video_analysis_version_model").on(table.analysisVersion, table.modelUsed),
]);

export const scriptPrompts = pgTable("script_prompts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  promptText: text("prompt_text").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const variants = pgTable("variants", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  templateDuration: integer("template_duration").notNull(),
  clipIds: jsonb("clip_ids").notNull().$type<number[]>(),
  r2Key: text("r2_key"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true,
  createdAt: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
});

export const insertShotSchema = createInsertSchema(shots).omit({
  id: true,
  createdAt: true,
});

export const insertVideoAnalysisSchema = createInsertSchema(videoAnalyses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVariantSchema = createInsertSchema(variants).omit({
  id: true,
  createdAt: true,
});

export const insertScriptPromptSchema = createInsertSchema(scriptPrompts).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Shot = typeof shots.$inferSelect;
export type InsertShot = z.infer<typeof insertShotSchema>;
export type VideoAnalysis = typeof videoAnalyses.$inferSelect;
export type InsertVideoAnalysis = z.infer<typeof insertVideoAnalysisSchema>;
export type Variant = typeof variants.$inferSelect;
export type InsertVariant = z.infer<typeof insertVariantSchema>;
export type ScriptPrompt = typeof scriptPrompts.$inferSelect;
export type InsertScriptPrompt = z.infer<typeof insertScriptPromptSchema>;

export * from "./models/chat";
export * from "./models/timeline";
