import { describe, expect, it } from 'vitest';
import { closestCommand, editDistance } from '../src/services/suggest.service.js';

const KNOWN = ['sodu', 'daily', 'work', 'top', 'help', 'taixiu', 'baucua', 'slots', 'mua', 'tui'];

describe('editDistance', () => {
  it('is zero for identical words', () => {
    expect(editDistance('sodu', 'sodu')).toBe(0);
  });

  it('counts single edits', () => {
    expect(editDistance('sodo', 'sodu')).toBe(1);
    expect(editDistance('sdu', 'sodu')).toBe(1);
    expect(editDistance('sodua', 'sodu')).toBe(1);
  });

  it('bails out instead of measuring hopeless pairs', () => {
    expect(editDistance('hoàntoànkhaclạ', 'top', 3)).toBeGreaterThan(3);
  });
});

describe('closestCommand', () => {
  it('catches a near miss', () => {
    expect(closestCommand('dail', KNOWN)).toBe('daily');
    expect(closestCommand('taixui', KNOWN)).toBe('taixiu');
    expect(closestCommand('slot', KNOWN)).toBe('slots');
  });

  it('says nothing when the word is already a command', () => {
    expect(closestCommand('daily', KNOWN)).toBeNull();
  });

  it('stays quiet for words that are nowhere near', () => {
    // The bot shares "!" with other apps; a stray word must not draw a reply.
    for (const noise of ['ping', 'play', 'kick', 'ban', 'chào', 'xin', 'hôm']) {
      expect(closestCommand(noise, KNOWN)).toBeNull();
    }
  });

  it('ignores one-character input', () => {
    expect(closestCommand('t', KNOWN)).toBeNull();
    expect(closestCommand('', KNOWN)).toBeNull();
  });

  it('holds short commands to a tighter standard than long ones', () => {
    expect(closestCommand('tops', KNOWN)).toBe('top');
    expect(closestCommand('taxiuu', KNOWN)).toBe('taixiu');
    // Two edits away from a four-letter command is too loose to guess at.
    expect(closestCommand('muaa', ['mua'])).toBe('mua');
    expect(closestCommand('muaaa', ['mua'])).toBeNull();
  });

  it('refuses to guess when two commands are equally close', () => {
    // "tup" sits one edit from both "top" and "tui".
    expect(closestCommand('tup', KNOWN)).toBeNull();
  });

  it('is case insensitive', () => {
    expect(closestCommand('DAIL', KNOWN)).toBe('daily');
  });
});
