import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Dashboard credentials: only a scrypt hash of the password is ever stored,
 * and sessions are stateless signed cookies so a restart does not log you out.
 */
const SCRYPT_KEYLEN = 64;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'casino_dash';

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')): string {
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN);
  const expectedBuf = Buffer.from(expected, 'hex');
  if (expectedBuf.length !== derived.length) return false;
  return timingSafeEqual(derived, expectedBuf);
}

/** Constant-time string compare that tolerates differing lengths. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function createSession(email: string, secret: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ email, exp: now + SESSION_TTL_MS })).toString(
    'base64url',
  );
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySession(token: string, secret: string, now = Date.now()): string | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      email?: string;
      exp?: number;
    };
    if (!data.email || !data.exp || data.exp < now) return null;
    return data.email;
  } catch {
    return null;
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim().split('='))
      .filter((pair) => pair.length === 2)
      .map(([k, v]) => [k, decodeURIComponent(v)]),
  );
}

/** Simple per-IP throttle so the login form cannot be brute forced. */
export class LoginThrottle {
  private attempts = new Map<string, { count: number; until: number }>();

  constructor(
    private maxAttempts = 5,
    private lockoutMs = 10 * 60 * 1000,
  ) {}

  lockedFor(ip: string, now = Date.now()): number {
    const entry = this.attempts.get(ip);
    if (!entry || entry.until <= now) return 0;
    return entry.count >= this.maxAttempts ? entry.until - now : 0;
  }

  recordFailure(ip: string, now = Date.now()): void {
    const entry = this.attempts.get(ip);
    const count = entry && entry.until > now ? entry.count + 1 : 1;
    this.attempts.set(ip, { count, until: now + this.lockoutMs });
  }

  reset(ip: string): void {
    this.attempts.delete(ip);
  }
}
