import { db } from "./db";
import { assets, jobs, type Asset, type InsertAsset, type Job } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

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
}

export const storage = new DatabaseStorage();
