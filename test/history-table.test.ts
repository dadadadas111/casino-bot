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

describe('formatWhen', () => {
  it('converts UTC storage time to Vietnam time', () => {
    expect(formatWhen('2026-08-11 07:30:00')).toBe('14:30 11/08');
    expect(formatWhen('2026-08-11 18:00:00')).toBe('01:00 12/08'); // crosses midnight VN
  });
});

describe('typeLabel', () => {
  it('names games and transaction types', () => {
    expect(typeLabel(entry({ type: 'bet', meta: 'taixiu' }))).toBe('Cược Tài xỉu');
    expect(typeLabel(entry({ type: 'payout', meta: 'trieuphu' }))).toBe('Thưởng Triệu phú');
    expect(typeLabel(entry({ type: 'refund', meta: 'keo' }))).toBe('Hoàn cược');
    expect(typeLabel(entry({ type: 'work', meta: null }))).toBe('Làm việc');
    expect(typeLabel(entry({ type: 'transfer_out', meta: '123' }))).toBe('Chuyển cho <@123>');
    expect(typeLabel(entry({ type: 'unknown_type', meta: null }))).toBe('unknown_type');
  });
});

describe('historyTable', () => {
  it('groups entries under one header per Vietnam-timezone day', () => {
    const lines = historyTable([
      entry({ createdAt: '2026-08-11 08:00:00' }), // 15:00 11/08 VN
      entry({ createdAt: '2026-08-11 02:00:00' }), // 09:00 11/08 VN
      entry({ createdAt: '2026-08-10 08:00:00' }), // 15:00 10/08 VN
    ]).split('\n');
    expect(lines.filter((l) => l.startsWith('📅'))).toEqual(['📅 **11/08**', '📅 **10/08**']);
    expect(lines).toHaveLength(5);
  });

  it('starts a new day when VN midnight is crossed even on the same UTC day', () => {
    const lines = historyTable([
      entry({ createdAt: '2026-08-11 18:30:00' }), // 01:30 12/08 VN
      entry({ createdAt: '2026-08-11 08:00:00' }), // 15:00 11/08 VN
    ]).split('\n');
    expect(lines.filter((l) => l.startsWith('📅'))).toEqual(['📅 **12/08**', '📅 **11/08**']);
  });

  it('marks positive amounts green and negative red with emoji squares', () => {
    const output = historyTable([
      entry({ amount: -100, balanceAfter: 900 }),
      entry({ amount: 200, type: 'payout', balanceAfter: 1_100 }),
    ]);
    expect(output).toContain('🟥 **-100** → 900');
    expect(output).toContain('🟩 **+200** → 1.100');
  });

  it('shows only the time on entry lines, not the full date', () => {
    const [, line] = historyTable([entry({ createdAt: '2026-08-11 07:30:00' })]).split('\n');
    expect(line).toContain('· 14:30');
    expect(line).not.toContain('11/08');
  });
});
