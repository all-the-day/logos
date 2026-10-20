/**
 * 单进程内存限流：PM2 只有一个 logos 进程，够用；
 * 进程重启后清零，属于可接受的宽松降级。
 */

const buckets = new Map<number, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export function checkRateLimit(
  userId: number,
  now: number = Date.now(),
  max: number = 10,
  windowMs: number = 60_000
): RateLimitResult {
  const cutoff = now - windowMs;
  const timestamps = (buckets.get(userId) ?? []).filter((t) => t > cutoff);

  if (timestamps.length >= max) {
    const oldest = timestamps[0];
    buckets.set(userId, timestamps);
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    };
  }

  timestamps.push(now);
  buckets.set(userId, timestamps);
  return { allowed: true, retryAfterSec: 0 };
}

/** 测试用：清空所有用户的计数 */
export function resetRateLimits(): void {
  buckets.clear();
}
