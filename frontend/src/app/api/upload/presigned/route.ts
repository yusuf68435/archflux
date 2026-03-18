import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPresignedUploadUrl } from "@/lib/s3";
import { randomUUID } from "crypto";
import { rateLimitByIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimitByIp(ip, "upload", 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename, contentType } = await req.json();

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: "filename and contentType required" },
      { status: 400 }
    );
  }

  const ext = filename.split(".").pop() || "jpg";
  const key = `${session.user.id}/${randomUUID()}.${ext}`;
  const bucket = process.env.S3_BUCKET_UPLOADS || "uploads";

  const uploadUrl = await getPresignedUploadUrl(bucket, key, contentType);
  const fileUrl = `${process.env.S3_ENDPOINT || "http://localhost:9000"}/${bucket}/${key}`;

  return NextResponse.json({ uploadUrl, fileUrl, key });
}
