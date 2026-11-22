import type { AqiApiResponse, FamilyPlanResponse } from "@/types";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Lightweight in-memory TTL cache with bounded size to prevent unbounded memory growth.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;

  constructor(defaultTtlMs: number, maxEntries = 200) {
    this.defaultTtlMs = defaultTtlMs;
    this.maxEntries = maxEntries;
  }

  /** Returns a cached value if present and not expired, otherwise undefined. */
  get(key: string, now = Date.now()): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (now >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /** Stores a value with a TTL, evicting the oldest key when at capacity. */
  set(key: string, value: T, ttlMs = this.defaultTtlMs, now = Date.now()): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      value,
      expiresAt: now + ttlMs,
    });
  }

  /** Removes all cached entries. */
  clear(): void {
    this.store.clear();
  }

  /** Returns the current number of stored entries. */
  size(): number {
    return this.store.size;
  }
}

export const AQI_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const PLAN_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const aqiCache = new TtlCache<AqiApiResponse>(AQI_CACHE_TTL_MS);
export const planCache = new TtlCache<FamilyPlanResponse>(PLAN_CACHE_TTL_MS);
