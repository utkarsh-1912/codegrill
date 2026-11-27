const memoryLogs = new Map();

function pruneMemory(now) {
  if (memoryLogs.size < 2000) return;
  for (const [k, entry] of memoryLogs.entries()) {
    if (entry.expiresAt <= now) memoryLogs.delete(k);
  }
}

/**
 * True sliding-window rate limiter using Redis sorted sets (ZREMRANGEBYSCORE + ZADD + ZCARD)
 * when Upstash Redis REST is configured, with a timestamp-log sliding-window memory fallback.
 */
async function checkUpstashSlidingWindow(key, limit, windowSec) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const now = Date.now();
  const windowStart = now - windowSec * 1000;
  const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const endpoint = `${url.replace(/\/+$/, '')}/pipeline`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['ZREMRANGEBYSCORE', key, '0', String(windowStart)],
        ['ZADD', key, String(now), member],
        ['ZCARD', key],
        ['PEXPIRE', key, String(windowSec * 1000)],
      ]),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const count = Number(data?.[2]?.result || 1);
    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetSec: windowSec,
    };
  } catch {
    return null;
  }
}

export function getClientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'] || req?.headers?.['X-Forwarded-For'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  const realIp = req?.headers?.['x-real-ip'];
  if (realIp) return String(realIp).trim();
  return req?.socket?.remoteAddress || '127.0.0.1';
}

export async function checkRateLimit({ key, limit, windowSec }) {
  const upstash = await checkUpstashSlidingWindow(`cg:rl:${key}`, limit, windowSec);
  if (upstash) return upstash;

  const now = Date.now();
  const windowMs = windowSec * 1000;
  const cutoff = now - windowMs;
  pruneMemory(now);

  let entry = memoryLogs.get(key);
  if (!entry) {
    entry = { timestamps: [], expiresAt: now + windowMs };
    memoryLogs.set(key, entry);
  }

  // Drop timestamps outside the sliding window
  entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);
  entry.expiresAt = now + windowMs;

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0] || now;
    const resetSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetSec,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - entry.timestamps.length),
    resetSec: windowSec,
  };
}

export function clearRateLimitMemory() {
  memoryLogs.clear();
}
