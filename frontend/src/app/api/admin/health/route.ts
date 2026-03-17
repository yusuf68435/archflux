import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

interface ServiceStatus {
  name: string;
  status: "healthy" | "unhealthy" | "unknown";
  latencyMs?: number;
  detail?: string;
}

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as Record<string, unknown>).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const services: ServiceStatus[] = [];

  // Check database
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    services.push({ name: "database", status: "healthy", latencyMs: Date.now() - dbStart });
  } catch {
    services.push({ name: "database", status: "unhealthy", latencyMs: Date.now() - dbStart });
  }

  // Check backend API
  const backendStart = Date.now();
  try {
    const res = await fetch(`${AI_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    services.push({
      name: "backend",
      status: res.ok ? "healthy" : "unhealthy",
      latencyMs: Date.now() - backendStart,
    });
  } catch {
    services.push({ name: "backend", status: "unhealthy", latencyMs: Date.now() - backendStart });
  }

  // Check Celery via backend
  const celeryStart = Date.now();
  try {
    const res = await fetch(`${AI_SERVICE_URL}/health/celery`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      services.push({
        name: "celery",
        status: data.status === "ok" ? "healthy" : "unhealthy",
        latencyMs: Date.now() - celeryStart,
        detail: data.workers ? `${data.workers} worker(s)` : undefined,
      });
    } else {
      services.push({ name: "celery", status: "unhealthy", latencyMs: Date.now() - celeryStart });
    }
  } catch {
    services.push({ name: "celery", status: "unknown", latencyMs: Date.now() - celeryStart });
  }

  // Check MinIO via backend
  const minioStart = Date.now();
  try {
    const res = await fetch(`${AI_SERVICE_URL}/health/minio`, {
      signal: AbortSignal.timeout(5000),
    });
    services.push({
      name: "minio",
      status: res.ok ? "healthy" : "unhealthy",
      latencyMs: Date.now() - minioStart,
    });
  } catch {
    services.push({ name: "minio", status: "unknown", latencyMs: Date.now() - minioStart });
  }

  return NextResponse.json({
    services,
    checkedAt: new Date().toISOString(),
  });
}
