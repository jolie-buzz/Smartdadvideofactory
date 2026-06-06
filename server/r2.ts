import { S3Client, PutObjectCommand, GetObjectCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import fs from "fs";
import { createHash } from "crypto";
import { pipeline } from "stream/promises";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.R2_BUCKET!;
const R2_UPLOAD_QUEUE_SIZE = Math.max(1, parseInt(process.env.R2_UPLOAD_QUEUE_SIZE || "1", 10));
const R2_UPLOAD_PART_SIZE = Math.max(5, parseInt(process.env.R2_UPLOAD_PART_SIZE_MB || "8", 10)) * 1024 * 1024;

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function uploadToR2(key: string, body: Buffer | Readable, contentType?: string): Promise<void> {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    },
    queueSize: R2_UPLOAD_QUEUE_SIZE,
    partSize: R2_UPLOAD_PART_SIZE,
  });

  await upload.done();
}

export async function uploadFileToR2(key: string, filePath: string, contentType?: string): Promise<void> {
  const stream = fs.createReadStream(filePath);
  await uploadToR2(key, stream, contentType);
}

export async function downloadFileFromR2(key: string, filePath: string): Promise<void> {
  const result = await getR2ObjectStream(key);
  if (!result.Body) {
    throw new Error(`R2 object has no body: ${key}`);
  }
  await pipeline(result.Body as Readable, fs.createWriteStream(filePath));
}

export function hashFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export async function getSignedDownloadUrl(key: string, forceDownload?: string): Promise<string> {
  const ttl = parseInt(process.env.SIGNED_URL_TTL_SECONDS || "3600", 10);
  const params: any = {
    Bucket: R2_BUCKET,
    Key: key,
  };
  if (forceDownload) {
    params.ResponseContentDisposition = `attachment; filename="${forceDownload}"`;
  }
  const command = new GetObjectCommand(params);
  return getSignedUrl(s3, command, { expiresIn: ttl });
}

export async function getR2ObjectStream(key: string, range?: string) {
  return s3.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Range: range,
    })
  );
}

export function getR2ConfigStatus() {
  return {
    accountIdConfigured: Boolean(R2_ACCOUNT_ID),
    accessKeyIdConfigured: Boolean(R2_ACCESS_KEY_ID),
    secretAccessKeyConfigured: Boolean(R2_SECRET_ACCESS_KEY),
    bucketConfigured: Boolean(R2_BUCKET),
    bucket: R2_BUCKET || null,
  };
}

export async function getSignedUploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

export async function configureR2Cors(): Promise<void> {
  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket: R2_BUCKET,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: ["*"],
              AllowedMethods: ["PUT", "GET"],
              AllowedHeaders: ["*"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
    console.log("[r2] CORS configured for direct uploads");
  } catch (err: any) {
    console.warn("[r2] Could not set CORS (may already be configured):", err.message);
  }
}

export async function downloadFromR2(key: string): Promise<Buffer> {
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  );
  const stream = result.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
