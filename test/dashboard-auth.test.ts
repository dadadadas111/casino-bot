import { describe, expect, it } from 'vitest';
import {
  LoginThrottle,
  SESSION_TTL_MS,
  createSession,
  hashPassword,
  parseCookies,
  safeEqual,
  verifyPassword,
  verifySession,
} from '../src/web/auth';

describe('password hashing', () => {
  it('verifies the right password and rejects everything else', () => {
    const stored = hashPassword('correct horse battery');
    expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(verifyPassword('correct horse battery', stored)).toBe(true);
    expect(verifyPassword('wrong', stored)).toBe(false);
    expect(verifyPassword('', stored)).toBe(false);
  });

  it('salts each hash so identical passwords differ on disk', () => {
    expect(hashPassword('same')).not.toBe(hashPassword('same'));
  });

  it('rejects malformed stored values instead of throwing', () => {
    expect(verifyPassword('x', 'garbage')).toBe(false);
    expect(verifyPassword('x', '')).toBe(false);
  });
});

describe('sessions', () => {
  const secret = 'test-secret';

  it('round-trips the signed email', () => {
    const token = createSession('admin@dash.id.vn', secret);
    expect(verifySession(token, secret)).toBe('admin@dash.id.vn');
  });

  it('rejects tampering, a wrong secret, and expiry', () => {
    const token = createSession('admin@dash.id.vn', secret);
    expect(verifySession(token, 'other-secret')).toBeNull();
    const [payload, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ email: 'evil@x.com', exp: Date.now() + 1000 })).toString('base64url');
    expect(verifySession(`${forged}.${sig}`, secret)).toBeNull();
    expect(verifySession(`${payload}.deadbeef`, secret)).toBeNull();
    expect(verifySession(token, secret, Date.now() + SESSION_TTL_MS + 1000)).toBeNull();
    expect(verifySession('nonsense', secret)).toBeNull();
  });
});

describe('safeEqual', () => {
  it('compares without leaking length mismatches as errors', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcdef')).toBe(false);
  });
});

describe('parseCookies', () => {
  it('reads cookie pairs and tolerates junk', () => {
    expect(parseCookies('a=1; b=hello%20world')).toEqual({ a: '1', b: 'hello world' });
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('novalue')).toEqual({});
  });
});

describe('LoginThrottle', () => {
  it('locks out after repeated failures and clears on success', () => {
    const throttle = new LoginThrottle(3, 60_000);
    const now = 1_000_000;
    expect(throttle.lockedFor('1.2.3.4', now)).toBe(0);
    throttle.recordFailure('1.2.3.4', now);
    throttle.recordFailure('1.2.3.4', now);
    expect(throttle.lockedFor('1.2.3.4', now)).toBe(0);
    throttle.recordFailure('1.2.3.4', now);
    expect(throttle.lockedFor('1.2.3.4', now)).toBeGreaterThan(0);
    expect(throttle.lockedFor('1.2.3.4', now + 61_000)).toBe(0);
    throttle.reset('1.2.3.4');
    expect(throttle.lockedFor('1.2.3.4', now)).toBe(0);
  });

  it('tracks addresses independently', () => {
    const throttle = new LoginThrottle(1, 60_000);
    throttle.recordFailure('1.1.1.1');
    expect(throttle.lockedFor('1.1.1.1')).toBeGreaterThan(0);
    expect(throttle.lockedFor('2.2.2.2')).toBe(0);
  });
});
