const rateMap = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count++;
  return true;
}

export function rateLimitByIp(
  ip: string,
  endpoint: string,
  limit = 30,
  windowMs = 60_000
): boolean {
  return rateLimit(`${ip}:${endpoint}`, limit, windowMs);
}
