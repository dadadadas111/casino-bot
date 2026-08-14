import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import { FigurineService, sanitizeName } from '../src/services/figurine.service';
import { ItemsService } from '../src/services/items.service';

let db: Db;
let figurines: FigurineService;
let items: ItemsService;

beforeEach(() => {
  db = createDb(':memory:');
  figurines = new FigurineService(db);
  items = new ItemsService(db);
});

describe('sanitizeName', () => {
  it('strips markdown and mention characters', () => {
    expect(sanitizeName('  **Mai** Anh  ')).toBe('Mai Anh');
    expect(sanitizeName('@everyone')).toBe('everyone');
    expect(sanitizeName('dòng\nhai')).toBe('dòng hai');
  });

  it('rejects empty and overlong names', () => {
    expect(sanitizeName('   ')).toBeNull();
    expect(sanitizeName('*'.repeat(10))).toBeNull();
    expect(sanitizeName('x'.repeat(33))).toBeNull();
  });
});

describe('FigurineService', () => {
  it('creates one figurine per player', () => {
    expect(figurines.create('u1', 'Mai', '🧸')).toBe(true);
    expect(figurines.create('u1', 'Lan', '🎎')).toBe(false);
    expect(figurines.get('u1')).toMatchObject({ name: 'Mai', emoji: '🧸', married: false });
  });

  it('renames, restyles and marries', () => {
    figurines.create('u1', 'Mai', '🧸');
    expect(figurines.rename('u1', 'Mai Anh')).toBe(true);
    expect(figurines.setEmoji('u1', '🪆')).toBe(true);
    expect(figurines.spouse('u1')).toBeNull();
    figurines.setMarried('u1', true);
    expect(figurines.spouse('u1')).toMatchObject({ name: 'Mai Anh', emoji: '🪆' });
    figurines.setMarried('u1', false);
    expect(figurines.spouse('u1')).toBeNull();
  });

  it('discards cleanly', () => {
    figurines.create('u1', 'Mai', '🎎');
    expect(figurines.discard('u1')).toBe(true);
    expect(figurines.get('u1')).toBeNull();
    expect(figurines.discard('u1')).toBe(false);
  });
});

describe('gifting items', () => {
  it('moves items between bags and refuses what you do not have', () => {
    items.add('giver', 'khien', 2);
    expect(items.transfer('giver', 'taker', 'khien', 2)).toBe(true);
    expect(items.count('giver', 'khien')).toBe(0);
    expect(items.count('taker', 'khien')).toBe(2);
    expect(items.transfer('giver', 'taker', 'khien', 1)).toBe(false);
    expect(items.transfer('taker', 'giver', 'khien', 0)).toBe(false);
  });

  it('leaves both bags untouched when the giver is short', () => {
    items.add('giver', 'caphe', 1);
    expect(items.transfer('giver', 'taker', 'caphe', 5)).toBe(false);
    expect(items.count('giver', 'caphe')).toBe(1);
    expect(items.count('taker', 'caphe')).toBe(0);
  });
});
