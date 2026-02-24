import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Buffer } from "node:buffer";
import process from "node:process";
import fs from "node:fs/promises";
import path from "node:path";

function getS3Client() {
  const region = process.env.AWS_REGION || "us-east-1";
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucketName = process.env.AWS_S3_BUCKET;

  if (!accessKeyId || !secretAccessKey || !bucketName) {
    if (process.env.NODE_ENV === "production") {
      console.warn("Missing AWS S3 credentials");
    }
  }

  const client = new S3Client({
    region,
    credentials:
      accessKeyId && secretAccessKey
        ? {
          accessKeyId,
          secretAccessKey,
        }
        : undefined,
  });

  return { client, bucketName };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { client, bucketName } = getS3Client();
  const key = normalizeKey(relKey);

  if (!bucketName) {
    // No S3 bucket configured — return base64 data URL (works on serverless)
    const b64 = Buffer.isBuffer(data) ? data.toString("base64")
      : typeof data === "string" ? Buffer.from(data, "utf-8").toString("base64")
        : Buffer.from(data).toString("base64");
    const dataUrl = `data:${contentType};base64,${b64}`;
    return { key, url: dataUrl };
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body:
      typeof data === "string"
        ? Buffer.from(data, "utf-8")
        : data,
    ContentType: contentType,
  });

  await (client as any).send(command);

  // Return the signed URL to read back
  const getCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const url = await getSignedUrl(client as any, getCommand as any, { expiresIn: 3600 * 24 * 7 });

  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const { client, bucketName } = getS3Client();
  const key = normalizeKey(relKey);

  if (!bucketName) {
    return { key, url: `/uploads/${key}` };
  }

  const getCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const url = await getSignedUrl(client as any, getCommand as any, { expiresIn: 3600 * 24 * 7 });

  return { key, url };
}
