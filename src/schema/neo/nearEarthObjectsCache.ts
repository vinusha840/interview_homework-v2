import { NearEarthObjectFeed } from './types';

const cacheTtlMs = 5 * 60 * 1000;
const cache = new Map<string, { value: NearEarthObjectFeed; expiresAt: number }>();

const getCacheKey = (startDate: string, endDate: string): string => `${startDate}:${endDate}`;

export const getCachedNearEarthObjects = (
  startDate: string,
  endDate: string,
): NearEarthObjectFeed | undefined => {
  const key = getCacheKey(startDate, endDate);
  const entry = cache.get(key);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }

  return entry.value;
};

export const cacheNearEarthObjects = (
  startDate: string,
  endDate: string,
  value: NearEarthObjectFeed,
): void => {
  cache.set(getCacheKey(startDate, endDate), {
    value,
    expiresAt: Date.now() + cacheTtlMs,
  });
};