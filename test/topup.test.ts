import { beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '../src/db/database';
import { CashService, XU_PER_VND } from '../src/services/cash.service';
import { EconomyService, STARTING_BALANCE } from '../src/services/economy.service';
import { MIN_TOPUP, TopupService, extractCode, normalizeContent } from '../src/services/topup.service';

let db: Db;
let cash: CashService;
let topups: TopupService;

beforeEach(() => {
  db = createDb(':memory:');
  cash = new CashService(db);
  topups = new TopupService(db, cash);
});

const webhook = (over: Record<string, unknown> = {}) => ({
  id: 1001,
  transferType: 'in',
  transferAmount: 20_000,
  content: 'CASINOABCDE',
  ...over,
});

describe('memo parsing', () => {
  it('strips bank formatting before matching', () => {
    expect(normalizeContent('ct dt casino abcde - mb')).toBe('CTDTCASINOABCDEMB');
    expect(extractCode('CT DT casino-ABCDE tu MB Bank')).toBe('CASINOABCDE');
    expect(extractCode('chuyen tien an trua')).toBeNull();
  });
});

describe('handleWebhook', () => {
  it('credits the requesting user and closes the request', () => {
    const req = topups.createRequest('u1', 20_000);
    const result = topups.handleWebhook(webhook({ content: `CT DT ${req.code}` }));
    expect(result).toMatchObject({ action: 'credited', userId: 'u1', amount: 20_000 });
    expect(cash.get('u1')).toBe(20_000);
    expect(topups.pendingFor('u1')).toHaveLength(0);
  });

  it('reports the channel the request came from so the receipt is visible', () => {
    const req = topups.createRequest('u1', 20_000, 'g1', 'c1');
    const result = topups.handleWebhook(webhook({ content: req.code }));
    expect(result).toMatchObject({ action: 'credited', channelId: 'c1' });
  });

  it('handles a real MoMo-style memo', () => {
    const req = topups.createRequest('u1', 10_000);
    const result = topups.handleWebhook(
      webhook({
        transferAmount: 10_000,
        content: `142035901733-${req.code}-CHUYEN TIEN-OQCH000Hk0hi-MOMO142035901733MOMO`,
      }),
    );
    expect(result).toMatchObject({ action: 'credited', amount: 10_000 });
  });

  it('is idempotent across SePay retries', () => {
    const req = topups.createRequest('u1', 20_000);
    const payload = webhook({ content: req.code });
    expect(topups.handleWebhook(payload).action).toBe('credited');
    expect(topups.handleWebhook(payload)).toMatchObject({
      action: 'ignored',
      reason: 'duplicate',
    });
    expect(cash.get('u1')).toBe(20_000);
  });

  it('credits the amount actually received, not the amount requested', () => {
    const req = topups.createRequest('u1', 50_000);
    topups.handleWebhook(webhook({ content: req.code, transferAmount: 30_000 }));
    expect(cash.get('u1')).toBe(30_000);
  });

  it('ignores outgoing transfers', () => {
    expect(topups.handleWebhook(webhook({ transferType: 'out' }))).toMatchObject({
      action: 'ignored',
      reason: 'not_incoming',
    });
  });

  it('records transfers whose memo matches nothing', () => {
    const result = topups.handleWebhook(webhook({ content: 'chuyen tien mua ca phe' }));
    expect(result.action).toBe('unmatched');
    const row = db.prepare('SELECT user_id, matched_code FROM sepay_transactions').get() as {
      user_id: string | null;
      matched_code: string | null;
    };
    expect(row).toMatchObject({ user_id: null, matched_code: null });
  });

  it('uses SePay pre-parsed code when the memo is noisy', () => {
    const req = topups.createRequest('u1', 20_000);
    const result = topups.handleWebhook(
      webhook({ code: req.code, content: 'noi dung bi cat mat' }),
    );
    expect(result).toMatchObject({ action: 'credited', code: req.code });
  });

  it('does not double-pay a code that was already settled', () => {
    const req = topups.createRequest('u1', 20_000);
    topups.handleWebhook(webhook({ id: 1, content: req.code }));
    const second = topups.handleWebhook(webhook({ id: 2, content: req.code }));
    expect(second.action).toBe('unmatched');
    expect(cash.get('u1')).toBe(20_000);
  });
});

describe('cash to xu exchange', () => {
  it('converts one-way at 1 VND to 20 xu', () => {
    const economy = new EconomyService(db);
    expect(XU_PER_VND).toBe(20);
    cash.credit('u1', 10_000, 'topup');
    expect(cash.spend('u1', 10_000, 'exchange_xu')).toBe(true);
    economy.credit('u1', 10_000 * XU_PER_VND, 'exchange');
    expect(economy.getBalance('u1')).toBe(STARTING_BALANCE + 200_000);
    expect(cash.get('u1')).toBe(0);
    // Nothing converts back: spending more cash than owned must fail.
    expect(cash.spend('u1', 1_000, 'exchange_xu')).toBe(false);
  });
});

describe('top-up limits', () => {
  it('requires at least the bank minimum', () => {
    expect(MIN_TOPUP).toBe(10_000);
  });
});

describe('createRequest', () => {
  it('issues unique unambiguous codes', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const { code } = topups.createRequest('u1', 5_000);
      expect(code).toMatch(/^CASINO[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
      codes.add(code);
    }
    expect(codes.size).toBe(50);
  });
});
