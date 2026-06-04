import { db } from "./db";
import { users, assets, jobs, shots, variants, scriptPrompts, type User, type InsertUser, type Asset, type InsertAsset, type Job, type Shot, type InsertShot, type Variant, type InsertVariant, type ScriptPrompt, type InsertScriptPrompt } from "@shared/schema";
import { eq, desc, inArray, and, asc } from "drizzle-orm";

export interface IStorage {
  createUser(user: InsertUser): Promise<User>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;
  getExcludedWords(userId: number): Promise<string | null>;
  updateExcludedWords(userId: number, words: string): Promise<void>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: number, data: Partial<InsertAsset>): Promise<Asset | undefined>;
  getAssets(userId?: number): Promise<Asset[]>;
  getAsset(id: number): Promise<Asset | undefined>;
  deleteAsset(id: number): Promise<void>;
  createJob(assetId: number, userId?: number, activateShuffle?: boolean): Promise<Job>;
  getJobs(userId?: number): Promise<(Job & { assetName?: string })[]>;
  getJob(id: number): Promise<Job | undefined>;
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
  createVariant(variant: InsertVariant): Promise<Variant>;
  getVariants(assetId: number): Promise<Variant[]>;
  getVariant(id: number): Promise<Variant | undefined>;
  updateVariant(id: number, data: Partial<Variant>): Promise<Variant | undefined>;
  deleteVariant(id: number): Promise<void>;
  getRecentVariantClipIds(assetId: number, limit: number): Promise<number[]>;
  getScriptPrompts(userId?: number): Promise<ScriptPrompt[]>;
  createScriptPrompt(data: InsertScriptPrompt): Promise<ScriptPrompt>;
  updateScriptPrompt(id: number, userId: number | undefined, data: Partial<InsertScriptPrompt>): Promise<ScriptPrompt | undefined>;
  deleteScriptPrompt(id: number, userId?: number): Promise<void>;
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
}

export const storage = new DatabaseStorage();
