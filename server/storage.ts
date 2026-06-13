import { db } from "./db";
import { users, assets, jobs, shots, variants, scriptPrompts, videoAnalyses, type User, type InsertUser, type Asset, type InsertAsset, type Job, type Shot, type InsertShot, type Variant, type InsertVariant, type ScriptPrompt, type InsertScriptPrompt, type VideoAnalysis, type InsertVideoAnalysis } from "@shared/schema";
import { eq, desc, inArray, and, asc, or } from "drizzle-orm";

export type AdminGeneralPrompts = {
  hookPrompt: string;
  captionPrompt: string;
  seoPrompt: string;
};

export const SCRIPT_DURATION_OPTIONS = [15, 30, 45, 60, 90] as const;
export const DEFAULT_SCRIPT_DURATION_SEC = 60;

export function normalizeScriptDurationSec(value: unknown): number {
  const parsed = typeof value === "number" ? value : parseInt(String(value || ""), 10);
  return SCRIPT_DURATION_OPTIONS.includes(parsed as any) ? parsed : DEFAULT_SCRIPT_DURATION_SEC;
}

const ADMIN_GENERAL_PROMPTS_NAME = "__ADMIN_GENERAL_PROMPTS__";

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;
  getExcludedWords(userId: number): Promise<string | null>;
  updateExcludedWords(userId: number, words: string): Promise<void>;
  getScriptDurationSec(userId: number): Promise<number>;
  updateSettings(userId: number, data: { excludedWords?: string; scriptDurationSec?: number }): Promise<void>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: number, data: Partial<InsertAsset>): Promise<Asset | undefined>;
  getAssets(userId?: number): Promise<Asset[]>;
  getAsset(id: number): Promise<Asset | undefined>;
  deleteAsset(id: number): Promise<void>;
  createJob(assetId: number, userId?: number, activateShuffle?: boolean): Promise<Job>;
  getJobs(userId?: number): Promise<(Job & { assetName?: string })[]>;
  getJob(id: number): Promise<Job | undefined>;
  claimQueuedJob(id: number): Promise<Job | undefined>;
  getQueuedJobs(): Promise<Job[]>;
  updateJob(id: number, data: Partial<Job>): Promise<Job | undefined>;
  appendJobLog(id: number, message: string): Promise<void>;
  deleteJob(id: number): Promise<void>;
  deleteAllJobs(userId: number): Promise<number>;
  getJobByShareToken(token: string): Promise<Job | undefined>;
  createShot(shot: InsertShot): Promise<Shot>;
  getShots(assetId: number): Promise<Shot[]>;
  getShot(id: number): Promise<Shot | undefined>;
  getShotsByIds(ids: number[]): Promise<Shot[]>;
  deleteShot(id: number): Promise<void>;
  createVideoAnalysis(data: InsertVideoAnalysis): Promise<VideoAnalysis>;
  getLatestVideoAnalysisForAsset(assetId: number): Promise<VideoAnalysis | undefined>;
  getVideoAnalysisByHash(videoHash: string, analysisVersion: string, modelUsed: string): Promise<VideoAnalysis | undefined>;
  createVariant(variant: InsertVariant): Promise<Variant>;
  getVariants(assetId: number): Promise<Variant[]>;
  getVariant(id: number): Promise<Variant | undefined>;
  updateVariant(id: number, data: Partial<Variant>): Promise<Variant | undefined>;
  deleteVariant(id: number): Promise<void>;
  getRecentVariantClipIds(assetId: number, limit: number): Promise<number[]>;
  getScriptPrompts(userId?: number): Promise<ScriptPrompt[]>;
  getScriptPrompt(id: number, userId?: number): Promise<ScriptPrompt | undefined>;
  createScriptPrompt(data: InsertScriptPrompt): Promise<ScriptPrompt>;
  updateScriptPrompt(id: number, userId: number | undefined, data: Partial<InsertScriptPrompt>): Promise<ScriptPrompt | undefined>;
  deleteScriptPrompt(id: number, userId?: number): Promise<void>;
  syncAssetsForScriptPrompt(prompt: ScriptPrompt, oldPromptText: string | undefined, newPromptText: string): Promise<number>;
  getAdminGeneralPrompts(): Promise<AdminGeneralPrompts>;
  updateAdminGeneralPrompts(data: AdminGeneralPrompts): Promise<AdminGeneralPrompts>;
}

export class DatabaseStorage implements IStorage {
  async createUser(user: InsertUser): Promise<User> {
    const [result] = await db.insert(users).values(user).returning();
    return result;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(eq(users.id, id));
    return result;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [result] = await db.select().from(users).where(eq(users.username, username));
    return result;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined> {
    const [result] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return result;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getExcludedWords(userId: number): Promise<string | null> {
    const [result] = await db.select({ excludedWords: users.excludedWords }).from(users).where(eq(users.id, userId));
    return result?.excludedWords ?? null;
  }

  async updateExcludedWords(userId: number, words: string): Promise<void> {
    await db.update(users).set({ excludedWords: words }).where(eq(users.id, userId));
  }

  async getScriptDurationSec(userId: number): Promise<number> {
    const [result] = await db.select({ scriptDurationSec: users.scriptDurationSec }).from(users).where(eq(users.id, userId));
    return normalizeScriptDurationSec(result?.scriptDurationSec);
  }

  async updateSettings(userId: number, data: { excludedWords?: string; scriptDurationSec?: number }): Promise<void> {
    await db.update(users).set({
      ...(data.excludedWords !== undefined ? { excludedWords: data.excludedWords } : {}),
      ...(data.scriptDurationSec !== undefined ? { scriptDurationSec: normalizeScriptDurationSec(data.scriptDurationSec) } : {}),
    }).where(eq(users.id, userId));
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const [result] = await db.insert(assets).values(asset).returning();
    return result;
  }

  async updateAsset(id: number, data: Partial<InsertAsset>): Promise<Asset | undefined> {
    const [result] = await db.update(assets).set(data).where(eq(assets.id, id)).returning();
    return result;
  }

  async getAssets(userId?: number): Promise<Asset[]> {
    if (userId !== undefined) {
      return db.select().from(assets).where(eq(assets.userId, userId)).orderBy(desc(assets.isFavorite), desc(assets.createdAt));
    }
    return db.select().from(assets).orderBy(desc(assets.isFavorite), desc(assets.createdAt));
  }

  async getAsset(id: number): Promise<Asset | undefined> {
    const [result] = await db.select().from(assets).where(eq(assets.id, id));
    return result;
  }

  async deleteAsset(id: number): Promise<void> {
    await db.delete(videoAnalyses).where(eq(videoAnalyses.videoAssetId, id));
    await db.delete(variants).where(eq(variants.assetId, id));
    await db.delete(shots).where(eq(shots.assetId, id));
    await db.delete(jobs).where(eq(jobs.assetId, id));
    await db.delete(assets).where(eq(assets.id, id));
  }

  async createJob(assetId: number, userId?: number, activateShuffle = false): Promise<Job> {
    const [result] = await db.insert(jobs).values({ assetId, userId: userId ?? null, activateShuffle, status: "queued" }).returning();
    return result;
  }

  async getJobs(userId?: number): Promise<(Job & { assetName?: string })[]> {
    let query = db
      .select({
        job: jobs,
        assetName: assets.name,
      })
      .from(jobs)
      .leftJoin(assets, eq(jobs.assetId, assets.id))
      .orderBy(desc(jobs.createdAt));
    if (userId !== undefined) {
      const result = await db
        .select({ job: jobs, assetName: assets.name })
        .from(jobs)
        .leftJoin(assets, eq(jobs.assetId, assets.id))
        .where(eq(jobs.userId, userId))
        .orderBy(desc(jobs.createdAt));
      return result.map((r) => ({ ...r.job, assetName: r.assetName ?? undefined }));
    }
    const result = await query;
    return result.map((r) => ({ ...r.job, assetName: r.assetName ?? undefined }));
  }

  async getJob(id: number): Promise<Job | undefined> {
    const [result] = await db.select().from(jobs).where(eq(jobs.id, id));
    return result;
  }

  async claimQueuedJob(id: number): Promise<Job | undefined> {
    const [result] = await db
      .update(jobs)
      .set({ status: "processing", lastError: null })
      .where(and(eq(jobs.id, id), eq(jobs.status, "queued")))
      .returning();
    return result;
  }

  async getQueuedJobs(): Promise<Job[]> {
    return db.select().from(jobs).where(eq(jobs.status, "queued")).orderBy(asc(jobs.createdAt));
  }

  async updateJob(id: number, data: Partial<Job>): Promise<Job | undefined> {
    const [result] = await db.update(jobs).set(data).where(eq(jobs.id, id)).returning();
    return result;
  }

  async appendJobLog(id: number, message: string): Promise<void> {
    const job = await this.getJob(id);
    if (!job) return;
    const timestamp = new Date().toISOString();
    const newLog = job.logs ? `${job.logs}\n[${timestamp}] ${message}` : `[${timestamp}] ${message}`;
    await db.update(jobs).set({ logs: newLog }).where(eq(jobs.id, id));
  }

  async deleteJob(id: number): Promise<void> {
    await db.delete(jobs).where(eq(jobs.id, id));
  }

  async deleteAllJobs(userId: number): Promise<number> {
    const deleted = await db.delete(jobs).where(eq(jobs.userId, userId)).returning({ id: jobs.id });
    return deleted.length;
  }

  async getJobByShareToken(token: string): Promise<Job | undefined> {
    const [result] = await db.select().from(jobs).where(eq(jobs.shareToken, token));
    return result;
  }

  async createShot(shot: InsertShot): Promise<Shot> {
    const [result] = await db.insert(shots).values(shot).returning();
    return result;
  }

  async getShots(assetId: number): Promise<Shot[]> {
    return db.select().from(shots).where(eq(shots.assetId, assetId)).orderBy(desc(shots.createdAt));
  }

  async getShot(id: number): Promise<Shot | undefined> {
    const [result] = await db.select().from(shots).where(eq(shots.id, id));
    return result;
  }

  async getShotsByIds(ids: number[]): Promise<Shot[]> {
    if (ids.length === 0) return [];
    return db.select().from(shots).where(inArray(shots.id, ids));
  }

  async deleteShot(id: number): Promise<void> {
    await db.delete(shots).where(eq(shots.id, id));
  }

  async createVideoAnalysis(data: InsertVideoAnalysis): Promise<VideoAnalysis> {
    const [result] = await db.insert(videoAnalyses).values(data).returning();
    return result;
  }

  async getLatestVideoAnalysisForAsset(assetId: number): Promise<VideoAnalysis | undefined> {
    const [result] = await db
      .select()
      .from(videoAnalyses)
      .where(eq(videoAnalyses.videoAssetId, assetId))
      .orderBy(desc(videoAnalyses.updatedAt), desc(videoAnalyses.createdAt));
    return result;
  }

  async getVideoAnalysisByHash(videoHash: string, analysisVersion: string, modelUsed: string): Promise<VideoAnalysis | undefined> {
    const [result] = await db
      .select()
      .from(videoAnalyses)
      .where(and(
        eq(videoAnalyses.videoHash, videoHash),
        eq(videoAnalyses.analysisVersion, analysisVersion),
        eq(videoAnalyses.modelUsed, modelUsed),
      ))
      .orderBy(desc(videoAnalyses.updatedAt), desc(videoAnalyses.createdAt));
    return result;
  }

  async createVariant(variant: InsertVariant): Promise<Variant> {
    const [result] = await db.insert(variants).values(variant).returning();
    return result;
  }

  async getVariants(assetId: number): Promise<Variant[]> {
    return db.select().from(variants).where(eq(variants.assetId, assetId)).orderBy(desc(variants.createdAt));
  }

  async getVariant(id: number): Promise<Variant | undefined> {
    const [result] = await db.select().from(variants).where(eq(variants.id, id));
    return result;
  }

  async updateVariant(id: number, data: Partial<Variant>): Promise<Variant | undefined> {
    const [result] = await db.update(variants).set(data).where(eq(variants.id, id)).returning();
    return result;
  }

  async deleteVariant(id: number): Promise<void> {
    await db.delete(variants).where(eq(variants.id, id));
  }

  async getRecentVariantClipIds(assetId: number, limit: number): Promise<number[]> {
    const recentVariants = await db.select()
      .from(variants)
      .where(eq(variants.assetId, assetId))
      .orderBy(desc(variants.createdAt))
      .limit(limit);
    const allClipIds = new Set<number>();
    for (const v of recentVariants) {
      const ids = v.clipIds as number[];
      ids.forEach((id) => allClipIds.add(id));
    }
    return Array.from(allClipIds);
  }

  async getScriptPrompts(userId?: number): Promise<ScriptPrompt[]> {
    if (userId !== undefined) {
      return db.select().from(scriptPrompts).where(eq(scriptPrompts.userId, userId)).orderBy(asc(scriptPrompts.name));
    }
    return db.select().from(scriptPrompts).orderBy(asc(scriptPrompts.name));
  }

  async getScriptPrompt(id: number, userId?: number): Promise<ScriptPrompt | undefined> {
    const whereClause = userId === undefined
      ? eq(scriptPrompts.id, id)
      : and(eq(scriptPrompts.id, id), eq(scriptPrompts.userId, userId));
    const [result] = await db.select().from(scriptPrompts).where(whereClause);
    return result;
  }

  async createScriptPrompt(data: InsertScriptPrompt): Promise<ScriptPrompt> {
    const [result] = await db.insert(scriptPrompts).values(data).returning();
    return result;
  }

  async updateScriptPrompt(id: number, userId: number | undefined, data: Partial<InsertScriptPrompt>): Promise<ScriptPrompt | undefined> {
    const whereClause = userId === undefined
      ? eq(scriptPrompts.id, id)
      : and(eq(scriptPrompts.id, id), eq(scriptPrompts.userId, userId));
    const [result] = await db.update(scriptPrompts).set(data).where(whereClause).returning();
    return result;
  }

  async deleteScriptPrompt(id: number, userId?: number): Promise<void> {
    const whereClause = userId === undefined
      ? eq(scriptPrompts.id, id)
      : and(eq(scriptPrompts.id, id), eq(scriptPrompts.userId, userId));
    await db.delete(scriptPrompts).where(whereClause);
  }

  async syncAssetsForScriptPrompt(prompt: ScriptPrompt, oldPromptText: string | undefined, newPromptText: string): Promise<number> {
    if (!newPromptText.trim()) return 0;
    const legacyMatch = oldPromptText?.trim()
      ? and(eq(assets.userId, prompt.userId), eq(assets.personaPrompt, oldPromptText.trim()))
      : undefined;
    const whereClause = legacyMatch
      ? or(eq(assets.scriptPromptId, prompt.id), legacyMatch)
      : eq(assets.scriptPromptId, prompt.id);
    const updated = await db
      .update(assets)
      .set({ personaPrompt: newPromptText.trim(), scriptPromptId: prompt.id })
      .where(whereClause)
      .returning({ id: assets.id });
    return updated.length;
  }

  async getAdminGeneralPrompts(): Promise<AdminGeneralPrompts> {
    const [record] = await db
      .select()
      .from(scriptPrompts)
      .where(and(eq(scriptPrompts.userId, 0), eq(scriptPrompts.name, ADMIN_GENERAL_PROMPTS_NAME)));
    if (!record?.promptText) return { hookPrompt: "", captionPrompt: "", seoPrompt: "" };
    try {
      const parsed = JSON.parse(record.promptText) as Partial<AdminGeneralPrompts>;
      return {
        hookPrompt: typeof parsed.hookPrompt === "string" ? parsed.hookPrompt : "",
        captionPrompt: typeof parsed.captionPrompt === "string" ? parsed.captionPrompt : "",
        seoPrompt: typeof parsed.seoPrompt === "string" ? parsed.seoPrompt : "",
      };
    } catch {
      return { hookPrompt: "", captionPrompt: "", seoPrompt: "" };
    }
  }

  async updateAdminGeneralPrompts(data: AdminGeneralPrompts): Promise<AdminGeneralPrompts> {
    const normalized = {
      hookPrompt: data.hookPrompt || "",
      captionPrompt: data.captionPrompt || "",
      seoPrompt: data.seoPrompt || "",
    };
    const promptText = JSON.stringify(normalized);
    const [existing] = await db
      .select()
      .from(scriptPrompts)
      .where(and(eq(scriptPrompts.userId, 0), eq(scriptPrompts.name, ADMIN_GENERAL_PROMPTS_NAME)));

    if (existing) {
      await db.update(scriptPrompts).set({ promptText }).where(eq(scriptPrompts.id, existing.id));
    } else {
      await db.insert(scriptPrompts).values({ userId: 0, name: ADMIN_GENERAL_PROMPTS_NAME, promptText });
    }
    return normalized;
  }
}

export const storage = new DatabaseStorage();
