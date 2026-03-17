import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "minioadmin",
    secretAccessKey: process.env.S3_SECRET_KEY || "minioadmin",
  },
  forcePathStyle: true,
});

export async function getPresignedUploadUrl(
  bucket: string,
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(s3Client, command, { expiresIn });

  // Rewrite internal MinIO URL to public URL for browser access
  const publicUrl = process.env.S3_PUBLIC_URL;
  const internalEndpoint = process.env.S3_ENDPOINT || "http://localhost:9000";
  if (publicUrl && url.startsWith(internalEndpoint)) {
    return url.replace(internalEndpoint, publicUrl);
  }
  return url;
}

export async function getPresignedDownloadUrl(
  bucket: string,
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

export { s3Client };
