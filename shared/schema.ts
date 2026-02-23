import { sql } from "drizzle-orm";
import { pgTable, serial, text, integer, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const assets = pgTable("assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  photoKey: text("photo_key").notNull(),
  videoKey: text("video_key").notNull(),
  personaPrompt: text("persona_prompt").notNull(),
  voiceId: text("voice_id"),
  voiceName: text("voice_name"),
  openaiModel: text("openai_model").notNull().default("gpt-4o"),
  elevenlabsModel: text("elevenlabs_model").notNull().default("eleven_multilingual_v2"),
  useEnhance: boolean("use_enhance").notNull().default(true),
  thresholdDb: real("threshold_db").notNull().default(-35),
  removeSilencesLongerThan: real("remove_silences_longer_than").notNull().default(0.2),
  ignoreDetectionsShorterThan: real("ignore_detections_shorter_than").notNull().default(0.75),
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

export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true,
  createdAt: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;

export * from "./models/chat";
