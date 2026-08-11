import { describe, expect, it } from 'vitest';
import { formatWhen, historyTable, typeLabel } from '../src/embeds/history-table';
import type { HistoryEntry } from '../src/services/economy.service';

const entry = (overrides: Partial<HistoryEntry>): HistoryEntry => ({
  amount: 100,
  type: 'bet',
  meta: 'taixiu',
  createdAt: '2026-08-11 07:30:00',
  balanceAfter: 1_000,
  ...overrides,
});

const stripAnsi = (s: string): string => s.replace(/\[[0-9;]*m/g, '');

describe('formatWhen', () => {
  it('converts UTC storage time to Vietnam time', () => {
    expect(formatWhen('2026-08-11 07:30:00')).toBe('14:30 11/08');
    expect(formatWhen('2026-08-11 18:00:00')).toBe('01:00 12/08'); // crosses midnight VN
  });
});

describe('typeLabel', () => {
  it('names games and transaction types', () => {
    expect(typeLabel(entry({ type: 'bet', meta: 'taixiu' }))).toBe('Cược Tài xỉu');
    expect(typeLabel(entry({ type: 'payout', meta: 'blackjack' }))).toBe('Thưởng Blackjack');
    expect(typeLabel(entry({ type: 'refund', meta: 'keo' }))).toBe('Hoàn cược');
    expect(typeLabel(entry({ type: 'daily', meta: null }))).toBe('Điểm danh');
    expect(typeLabel(entry({ type: 'unknown_type', meta: null }))).toBe('unknown_type');
  });
});

describe('historyTable', () => {
  it('aligns every row to the same width once colors are stripped', () => {
    const rows = [
      entry({ amount: -100, balanceAfter: 900 }),
      entry({ amount: 25_000, type: 'payout', meta: 'slots', balanceAfter: 25_900 }),
      entry({ amount: 500, type: 'daily', meta: null, balanceAfter: 1_400 }),
      entry({ amount: 1_000, type: 'welcome', meta: null, balanceAfter: 1_000 }),
    ];
    const lines = historyTable(rows).split('\n').slice(1, -1).map(stripAnsi);
    const widths = new Set(lines.map((l) => l.length));
    expect(widths.size).toBe(1);
  });

  it('colors positive amounts green and negative red', () => {
    const table = historyTable([
      entry({ amount: -100 }),
      entry({ amount: 200, type: 'payout' }),
    ]);
    expect(table).toContain('[31m    -100[0m');
    expect(table).toContain('[32m    +200[0m');
  });

  it('clips over-long labels instead of breaking alignment', () => {
    const long = entry({ type: 'some_extremely_long_unknown_type' });
    const [, row] = historyTable([long]).split('\n').slice(1, -1).map(stripAnsi);
    expect(row).toContain('…');
    const normal = stripAnsi(historyTable([entry({})]).split('\n')[2]);
    expect(row.length).toBe(normal.length);
  });
});
