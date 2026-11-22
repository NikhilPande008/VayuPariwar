/**
 * In-memory sliding-window IP rate limiter with bounded key eviction for API routes.
 */
import type { NextRequest } from "next/server";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
}

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_AI_REQUESTS = 20; // 20 AI requests/min per IP
const DEFAULT_MAX_AQI_REQUESTS = 60; // 60 AQI requests/min per IP
const DEFAULT_MAX_TRACKED_IPS = 1000;

/**
 * In-memory sliding-window IP rate limiter with bounded memory growth.
 */
export class IpRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly maxTrackedIps: number;

  constructor(
    maxRequests = DEFAULT_MAX_AI_REQUESTS,
    windowMs = DEFAULT_WINDOW_MS,
    maxTrackedIps = DEFAULT_MAX_TRACKED_IPS
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.maxTrackedIps = maxTrackedIps;
  }

  private pruneExpired(windowStart: number): void {
    for (const [key, timestamps] of this.hits.entries()) {
      const latest = timestamps[timestamps.length - 1];
      if (latest === undefined || latest <= windowStart) {
        this.hits.delete(key);
      }
    }
  }

  /** Evaluates and records a request from an IP address. */
  check(ip: string, now = Date.now()): RateLimitResult {
    const windowStart = now - this.windowMs;
    const existing = this.hits.get(ip) ?? [];
    const recent = existing.filter((ts) => ts > windowStart);

    if (recent.length >= this.maxRequests) {
      const oldest = recent[0] ?? now;
      const resetInMs = Math.max(1000, oldest + this.windowMs - now);
      this.hits.set(ip, recent);
      return {
        allowed: false,
        remaining: 0,
        resetInMs,
      };
    }

    if (!this.hits.has(ip) && this.hits.size >= this.maxTrackedIps) {
      this.pruneExpired(windowStart);
      if (this.hits.size >= this.maxTrackedIps) {
        const oldestKey = this.hits.keys().next().value;
        if (oldestKey !== undefined) {
          this.hits.delete(oldestKey);
        }
      }
    }

    recent.push(now);
    this.hits.set(ip, recent);

    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - recent.length),
      resetInMs: this.windowMs,
    };
  }

  /** Returns the current number of tracked IP keys. */
  size(): number {
    return this.hits.size;
  }

  /** Clears all tracked IP timestamps. */
  clear(): void {
    this.hits.clear();
  }
}

export const aiRateLimiter = new IpRateLimiter(
  DEFAULT_MAX_AI_REQUESTS,
  DEFAULT_WINDOW_MS
);

export const aqiRateLimiter = new IpRateLimiter(
  DEFAULT_MAX_AQI_REQUESTS,
  DEFAULT_WINDOW_MS
);

/**
 * Extracts client IP from standard reverse-proxy headers.
 */
export function getClientIp(request: NextRequest | Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "local";
}
