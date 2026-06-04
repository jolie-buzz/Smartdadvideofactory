import "dotenv/config";
import pg from "pg";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

type R2Object = {
  key: string;
  size: number;
  lastModified: Date | undefined;
};

type AssetGroup = {
  assetId: string;
  objects: R2Object[];
  photoKey: string;
  videoKey: string;
  musicKey: string | null;
  latest: Date | null;
};

const requiredEnv = [
  "DATABASE_URL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
] as const;

const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`Missing required env vars: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const confirm = args.has("--confirm");
const dryRun = !confirm || args.has("--dry-run");

const safeDefaultPrompt = [
  "Recovered from existing R2 media.",
  "Review this setup, then update the product details, persona prompt, voice, and settings before activating.",
].join(" ");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

function isImage(key: string) {
  return /\.(png|jpe?g|webp|gif)$/i.test(key);
}

function isVideo(key: string) {
  return /\.(mp4|mov|m4v|webm)$/i.test(key);
}

function isAudio(key: string) {
  return /\.(mp3|wav|m4a|aac|ogg)$/i.test(key);
}

function sortByPreference(files: R2Object[], preferredBase: string, matcher: (key: string) => boolean) {
  return files
    .filter((file) => matcher(file.key))
    .sort((a, b) => {
      const aName = a.key.split("/").pop() || "";
      const bName = b.key.split("/").pop() || "";
      const aPreferred = aName.toLowerCase().startsWith(preferredBase) ? 0 : 1;
      const bPreferred = bName.toLowerCase().startsWith(preferredBase) ? 0 : 1;
      if (aPreferred !== bPreferred) return aPreferred - bPreferred;
      return aName.localeCompare(bName);
    });
}

function buildGroup(assetId: string, objects: R2Object[]): AssetGroup | null {
  const photo = sortByPreference(objects, "photo.", isImage)[0];
  const video = sortByPreference(objects, "video.", isVideo)[0];
  const music = sortByPreference(objects, "music.", isAudio)[0] ?? null;
  const latest = objects.reduce<Date | null>((current, object) => {
    if (!object.lastModified) return current;
    if (!current || object.lastModified > current) return object.lastModified;
    return current;
  }, null);

  if (!photo && !video && !music) return null;

  return {
    assetId,
    objects,
    photoKey: photo?.key ?? "",
    videoKey: video?.key ?? "",
    musicKey: music?.key ?? null,
    latest,
  };
}

async function listR2AssetGroups() {
  const groups = new Map<string, R2Object[]>();
  let continuationToken: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET,
        Prefix: "assets/",
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      }),
    );

    for (const object of response.Contents ?? []) {
      if (!object.Key) continue;
      const [, assetId] = object.Key.split("/");
      if (!assetId) continue;
      const existing = groups.get(assetId) ?? [];
      existing.push({
        key: object.Key,
        size: object.Size ?? 0,
        lastModified: object.LastModified,
      });
      groups.set(assetId, existing);
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return Array.from(groups.entries())
    .map(([assetId, objects]) => buildGroup(assetId, objects))
    .filter((group): group is AssetGroup => Boolean(group))
    .sort((a, b) => (b.latest?.getTime() ?? 0) - (a.latest?.getTime() ?? 0));
}

async function getAdminUserId(client: pg.PoolClient) {
  const result = await client.query<{ id: number }>(
    "select id from users where role = 'admin' order by id asc limit 1",
  );
  if (result.rows[0]?.id) return result.rows[0].id;

  const fallback = await client.query<{ id: number }>(
    "select id from users order by id asc limit 1",
  );
  if (fallback.rows[0]?.id) return fallback.rows[0].id;

  throw new Error("No users found. Create an admin user before running recovery.");
}

async function existingAssetIdFor(client: pg.PoolClient, group: AssetGroup) {
  const prefix = `assets/${group.assetId}/%`;
  const result = await client.query<{ id: number }>(
    `select id
       from assets
      where name = $1
         or photo_key like $2
         or video_key like $2
         or music_key like $2
      order by id asc
      limit 1`,
    [`Recovered Asset ${group.assetId}`, prefix],
  );
  return result.rows[0]?.id ?? null;
}

async function recover() {
  const groups = await listR2AssetGroups();
  const client = await pool.connect();

  try {
    const adminUserId = await getAdminUserId(client);
    const planned: AssetGroup[] = [];
    const skipped: Array<{ group: AssetGroup; existingId: number }> = [];

    for (const group of groups) {
      const existingId = await existingAssetIdFor(client, group);
      if (existingId) {
        skipped.push({ group, existingId });
      } else {
        planned.push(group);
      }
    }

    console.log(`R2 asset folders found: ${groups.length}`);
    console.log(`Already represented in DB: ${skipped.length}`);
    console.log(`${dryRun ? "Would recover" : "Recovering"}: ${planned.length}`);

    for (const group of planned) {
      console.log(
        [
          `- Recovered Asset ${group.assetId}`,
          `photo=${group.photoKey || "(none)"}`,
          `video=${group.videoKey || "(none)"}`,
          `music=${group.musicKey || "(none)"}`,
        ].join(" | "),
      );
    }

    if (dryRun) {
      console.log("\nDry run only. Re-run with --confirm to insert recovered assets.");
      return;
    }

    await client.query("begin");
    try {
      for (const group of planned) {
        await client.query(
          `insert into assets (
             name,
             photo_key,
             video_key,
             video_source,
             persona_prompt,
             voice_id,
             voice_name,
             openai_model,
             elevenlabs_model,
             use_enhance,
             threshold_db,
             remove_silences_longer_than,
             ignore_detections_shorter_than,
             music_key,
             voice_volume,
             music_volume,
             auto_captions,
             hook_headline,
             caption_enabled,
             seo_enabled,
             user_id,
             created_at
           ) values (
             $1, $2, $3, $4, $5,
             null, null,
             'gpt-4.1',
             'eleven_turbo_v2_5',
             true,
             -35,
             0.2,
             0.75,
             $6,
             1.0,
             0.3,
             false,
             false,
             false,
             false,
             $7,
             coalesce($8::timestamp, CURRENT_TIMESTAMP)
           )`,
          [
            `Recovered Asset ${group.assetId}`,
            group.photoKey,
            group.videoKey,
            "builder",
            safeDefaultPrompt,
            group.musicKey,
            adminUserId,
            group.latest?.toISOString() ?? null,
          ],
        );
      }
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }

    console.log(`\nRecovered ${planned.length} assets into the current database.`);
  } finally {
    client.release();
    await pool.end();
  }
}

recover().catch((error) => {
  console.error(error);
  process.exit(1);
});
