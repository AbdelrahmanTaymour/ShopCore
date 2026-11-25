import { redis } from "../config/redis";

export async function cacheAside<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as T;

  const fresh = await loader();
  await redis.set(key, JSON.stringify(fresh), "EX", ttlSeconds);
  return fresh;
}

export async function invalidate(key: string) {
  await redis.del(key);
}

export async function invalidatePattern(pattern: string) {
  const keys = await redis.keys(pattern);
  if (keys.length) await redis.del(...keys);
}
