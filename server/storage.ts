import { db } from "./db";
import { assets, jobs, shots, variants, type Asset, type InsertAsset, type Job, type Shot, type InsertShot, type Variant, type InsertVariant } from "@shared/schema";
import { eq, desc, inArray } from "drizzle-orm";

export interface IStorage {
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: number, data: Partial<InsertAsset>): Promise<Asset | undefined>;
  getAssets(): Promise<Asset[]>;
  getAsset(id: number): Promise<Asset | undefined>;
  deleteAsset(id: number): Promise<void>;
  createJob(assetId: number): Promise<Job>;
  getJobs(): Promise<(Job & { assetName?: string })[]>;
  getJob(id: number): Promise<Job | undefined>;
  updateJob(id: number, data: Partial<Job>): Promise<Job | undefined>;
  appendJobLog(id: number, message: string): Promise<void>;
  deleteJob(id: number): Promise<void>;
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
}

export class DatabaseStorage implements IStorage {
  async createAsset(asset: InsertAsset): Promise<Asset> {
    const [result] = await db.insert(assets).values(asset).returning();
    return result;
  }

  async updateAsset(id: number, data: Partial<InsertAsset>): Promise<Asset | undefined> {
    const [result] = await db.update(assets).set(data).where(eq(assets.id, id)).returning();
    return result;
  }

  async getAssets(): Promise<Asset[]> {
    return db.select().from(assets).orderBy(desc(assets.createdAt));
  }

  async getAsset(id: number): Promise<Asset | undefined> {
    const [result] = await db.select().from(assets).where(eq(assets.id, id));
    return result;
  }

  async deleteAsset(id: number): Promise<void> {
    await db.delete(assets).where(eq(assets.id, id));
  }

  async createJob(assetId: number): Promise<Job> {
    const [result] = await db.insert(jobs).values({ assetId, status: "queued" }).returning();
    return result;
  }

  async getJobs(): Promise<(Job & { assetName?: string })[]> {
    const result = await db
      .select({
        job: jobs,
        assetName: assets.name,
      })
      .from(jobs)
      .leftJoin(assets, eq(jobs.assetId, assets.id))
      .orderBy(desc(jobs.createdAt));
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
}

export const storage = new DatabaseStorage();
