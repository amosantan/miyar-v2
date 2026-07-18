import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
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
): Promise<{ key: string; url: string; persistent: boolean }> {
  const { client, bucketName } = getS3Client();
  const key = normalizeKey(relKey);

  if (!bucketName) {
    // No S3 bucket configured — return base64 data URL (works on serverless)
    const b64 = Buffer.isBuffer(data) ? data.toString("base64")
      : typeof data === "string" ? Buffer.from(data, "utf-8").toString("base64")
        : Buffer.from(data).toString("base64");
    const dataUrl = `data:${contentType};base64,${b64}`;
    return { key, url: dataUrl, persistent: false };
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

  return { key, url, persistent: true };
}

/**
 * Creates a short-lived, write-only URL for a browser upload. The object is not
 * trusted until the server reads and validates it during finalization.
 */
export async function storageCreatePresignedPut(
  relKey: string,
  contentType: string,
  expiresIn = 15 * 60,
): Promise<{ key: string; uploadUrl: string }> {
  const { client, bucketName } = getS3Client();
  const key = normalizeKey(relKey);

  if (!bucketName) {
    throw new Error("Object storage is not configured for direct uploads");
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn });
  return { key, uploadUrl };
}

export async function storageRead(
  relKey: string,
  maxBytes: number,
): Promise<{ key: string; contentType?: string; sizeBytes: number; buffer: Buffer }> {
  const { client, bucketName } = getS3Client();
  const key = normalizeKey(relKey);

  if (!bucketName) {
    throw new Error("Object storage is not configured for server-side validation");
  }

  const head = await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
  const sizeBytes = head.ContentLength ?? 0;
  if (sizeBytes <= 0 || sizeBytes > maxBytes) {
    return { key, contentType: head.ContentType, sizeBytes, buffer: Buffer.alloc(0) };
  }

  const object = await client.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
  if (!object.Body) throw new Error("Object storage returned no body");
  const data = await object.Body.transformToByteArray();
  const buffer = Buffer.from(data);
  if (buffer.length !== sizeBytes || buffer.length > maxBytes) {
    throw new Error("Object storage size changed during validation");
  }

  return { key, contentType: head.ContentType, sizeBytes, buffer };
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

export async function storageDelete(relKey: string): Promise<void> {
  const { client, bucketName } = getS3Client();
  const key = normalizeKey(relKey);

  if (!bucketName) {
    return;
  }

  await (client as any).send(new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  }));
}
