import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import {
  DEFAULT_PREFIX,
  PrefixStore,
  isValidPrefix,
  parseTextCommand,
} from '../src/services/prefix.service';

describe('isValidPrefix', () => {
  it('accepts short symbol prefixes', () => {
    for (const p of ['!', '?', '$', '.', 'c!', 's?', '>>']) {
      expect(isValidPrefix(p)).toBe(true);
    }
  });

  it('rejects invalid prefixes', () => {
    expect(isValidPrefix('')).toBe(false);
    expect(isValidPrefix('toolong')).toBe(false);
    expect(isValidPrefix('a b')).toBe(false);
    expect(isValidPrefix('/x')).toBe(false);
    expect(isValidPrefix('@a')).toBe(false);
    expect(isValidPrefix('#a')).toBe(false);
  });
});

describe('PrefixStore', () => {
  let db: Db;

  beforeEach(() => {
    db = createDb(':memory:');
  });

  it('falls back to the default prefix', () => {
    const store = new PrefixStore(db);
    expect(store.get('g1')).toBe(DEFAULT_PREFIX);
  });

  it('persists per-guild prefixes across store instances', () => {
    new PrefixStore(db).set('g1', '?');
    const fresh = new PrefixStore(db);
    expect(fresh.get('g1')).toBe('?');
    expect(fresh.get('g2')).toBe(DEFAULT_PREFIX);
  });

  it('overwrites an existing prefix', () => {
    const store = new PrefixStore(db);
    store.set('g1', '?');
    store.set('g1', '$');
    expect(store.get('g1')).toBe('$');
  });
});

describe('parseTextCommand', () => {
  it('parses name and args', () => {
    expect(parseTextCommand('!tx 100 tai', '!')).toEqual({ name: 'tx', args: ['100', 'tai'] });
    expect(parseTextCommand('c!slots  50', 'c!')).toEqual({ name: 'slots', args: ['50'] });
  });

  it('lowercases the command name only', () => {
    expect(parseTextCommand('!TX 100 TAI', '!')).toEqual({ name: 'tx', args: ['100', 'TAI'] });
  });

  it('ignores non-command messages', () => {
    expect(parseTextCommand('hello', '!')).toBeNull();
    expect(parseTextCommand('! ', '!')).toBeNull();
    expect(parseTextCommand('?tx 100', '!')).toBeNull();
  });
});
