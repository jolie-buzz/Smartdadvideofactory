import { sql } from "drizzle-orm";
import { pgTable, serial, text, integer, real, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  photoKey: text("photo_key").notNull(),
  videoKey: text("video_key").notNull(),
  videoSource: text("video_source").notNull().default("edited"),
  personaPrompt: text("persona_prompt").notNull(),
  voiceId: text("voice_id"),
  voiceName: text("voice_name"),
  openaiModel: text("openai_model").notNull().default("gpt-4o"),
  elevenlabsModel: text("elevenlabs_model").notNull().default("eleven_multilingual_v2"),
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
  hookModel: text("hook_model").notNull().default("gpt-4o"),
  hookFontSize: integer("hook_font_size").notNull().default(48),
  hookFontColor: text("hook_font_color").notNull().default("#FFFFFF"),
  hookStrokeColor: text("hook_stroke_color").notNull().default("#000000"),
  hookPosition: text("hook_position").notNull().default("center"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  status: text("status").notNull().default("queued"),
  scriptText: text("script_text"),
  audioRawKey: text("audio_raw_key"),
  audioCleanKey: text("audio_clean_key"),
  finalVideoKey: text("final_video_key"),
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

export const variants = pgTable("variants", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull().references(() => assets.id),
  templateDuration: integer("template_duration").notNull(),
  clipIds: jsonb("clip_ids").notNull().$type<number[]>(),
  r2Key: text("r2_key"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
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

export const insertVariantSchema = createInsertSchema(variants).omit({
  id: true,
  createdAt: true,
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Shot = typeof shots.$inferSelect;
export type InsertShot = z.infer<typeof insertShotSchema>;
export type Variant = typeof variants.$inferSelect;
export type InsertVariant = z.infer<typeof insertVariantSchema>;

export * from "./models/chat";
