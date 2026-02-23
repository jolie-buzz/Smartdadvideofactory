import { S3Client, PutObjectCommand, GetObjectCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import fs from "fs";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.R2_BUCKET!;

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
    queueSize: 4,
    partSize: 10 * 1024 * 1024,
  });

  await upload.done();
}

export async function uploadFileToR2(key: string, filePath: string, contentType?: string): Promise<void> {
  const stream = fs.createReadStream(filePath);
  await uploadToR2(key, stream, contentType);
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
