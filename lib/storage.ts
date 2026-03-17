import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function boolFromEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }

  return value === "1" || value.toLowerCase() === "true";
}

let cachedClient: S3Client | null = null;

export function getStorageClient(): S3Client {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = new S3Client({
    region: process.env.S3_REGION?.trim() || "us-east-1",
    endpoint: required("S3_ENDPOINT"),
    forcePathStyle: boolFromEnv("S3_FORCE_PATH_STYLE", true),
    credentials: {
      accessKeyId: required("S3_ACCESS_KEY_ID"),
      secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    },
  });

  return cachedClient;
}

export function getStorageBucket(): string {
  return required("S3_BUCKET");
}

export async function putObject(input: {
  key: string;
  body: PutObjectCommandInput["Body"];
  contentType?: string;
}): Promise<void> {
  await getStorageClient().send(new PutObjectCommand({
    Bucket: getStorageBucket(),
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
  }));
}

export async function getObjectBuffer(key: string): Promise<Buffer | null> {
  try {
    const response = await getStorageClient().send(new GetObjectCommand({
      Bucket: getStorageBucket(),
      Key: key,
    }));
    if (!response.Body) {
      return null;
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (error) {
    if (error instanceof NoSuchKey) {
      return null;
    }

    throw error;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await getStorageClient().send(new DeleteObjectCommand({
    Bucket: getStorageBucket(),
    Key: key,
  }));
}
