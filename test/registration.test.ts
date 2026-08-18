import { describe, expect, it } from 'vitest';
import { commandsForGuild } from '../src/services/registration.service.js';

const ALL = [{ name: 'help' }, { name: 'vi' }, { name: 'chubot' }];
const OWNER_ONLY = new Set(['chubot']);
const HOME = '1396049689714888724';

describe('commandsForGuild', () => {
  it('gives the home guild everything, owner tooling included', () => {
    expect(commandsForGuild(ALL, HOME, HOME, OWNER_ONLY).map((c) => c.name)).toEqual([
      'help',
      'vi',
      'chubot',
    ]);
  });

  it('hides owner tooling from every other guild', () => {
    expect(commandsForGuild(ALL, '999', HOME, OWNER_ONLY).map((c) => c.name)).toEqual([
      'help',
      'vi',
    ]);
  });

  it('hides nothing when no home guild is configured', () => {
    expect(commandsForGuild(ALL, '999', undefined, OWNER_ONLY)).toHaveLength(3);
  });

  it('never mutates the list it was given', () => {
    const copy = [...ALL];
    commandsForGuild(ALL, '999', HOME, OWNER_ONLY);
    expect(ALL).toEqual(copy);
  });
});
