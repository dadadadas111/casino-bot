import type { Db } from '../db/database.js';
import type { CashService } from './cash.service.js';

export const CODE_PREFIX = 'CASINO';
// MB Bank rejects transfers under 10.000đ.
export const MIN_TOPUP = 10_000;
export const MAX_TOPUP = 500_000;
export const REQUEST_TTL_HOURS = 24;

// No 0/O/1/I: bank memos get retyped by humans often enough to matter.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_BODY_LENGTH = 5;

export interface TopupRequest {
  code: string;
  userId: string;
  amount: number;
  status: 'pending' | 'paid' | 'expired';
}

export type WebhookResult =
  | { action: 'ignored'; reason: 'not_incoming' | 'duplicate' }
  | { action: 'credited'; userId: string; amount: number; code: string }
  | { action: 'unmatched'; amount: number; content: string };

export interface SepayPayload {
  id?: number | string;
  transferType?: string;
  transferAmount?: number;
  content?: string;
  code?: string | null;
  description?: string;
}

/** Bank memos arrive with odd spacing/case; compare on A-Z0-9 only. */
export function normalizeContent(content: string): string {
  return content.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Pull our payment code out of a bank memo, if present. */
export function extractCode(content: string): string | null {
  const match = normalizeContent(content).match(
    new RegExp(`${CODE_PREFIX}[${ALPHABET}]{${CODE_BODY_LENGTH}}`),
  );
  return match ? match[0] : null;
}

export class TopupService {
  constructor(
    private db: Db,
    private cash: CashService,
  ) {}

  private generateCode(): string {
    for (let attempt = 0; attempt < 20; attempt++) {
      let body = '';
      for (let i = 0; i < CODE_BODY_LENGTH; i++) {
        body += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
      }
      const code = `${CODE_PREFIX}${body}`;
      const exists = this.db
        .prepare('SELECT 1 FROM topup_requests WHERE code = ?')
        .get(code);
      if (!exists) return code;
    }
    throw new Error('Could not allocate a unique topup code');
  }

  createRequest(userId: string, amount: number): TopupRequest {
    const code = this.generateCode();
    this.db
      .prepare('INSERT INTO topup_requests (code, user_id, amount) VALUES (?, ?, ?)')
      .run(code, userId, amount);
    return { code, userId, amount, status: 'pending' };
  }

  pendingFor(userId: string): TopupRequest[] {
    const rows = this.db
      .prepare(
        `SELECT code, user_id, amount, status FROM topup_requests
         WHERE user_id = ? AND status = 'pending'
           AND created_at >= datetime('now', ?)
         ORDER BY created_at DESC`,
      )
      .all(userId, `-${REQUEST_TTL_HOURS} hours`) as Array<{
      code: string;
      user_id: string;
      amount: number;
      status: TopupRequest['status'];
    }>;
    return rows.map((r) => ({
      code: r.code,
      userId: r.user_id,
      amount: r.amount,
      status: r.status,
    }));
  }

  /**
   * Apply one SePay webhook payload. Idempotent on the SePay transaction id
   * because SePay retries a failed delivery up to seven times.
   */
  handleWebhook(payload: SepayPayload): WebhookResult {
    if (payload.transferType !== 'in') return { action: 'ignored', reason: 'not_incoming' };

    const sepayId = String(payload.id ?? '');
    if (sepayId) {
      const seen = this.db.prepare('SELECT 1 FROM sepay_transactions WHERE id = ?').get(sepayId);
      if (seen) return { action: 'ignored', reason: 'duplicate' };
    }

    const amount = Math.floor(Number(payload.transferAmount ?? 0));
    const content = payload.content ?? payload.description ?? '';
    // SePay may pre-parse the code; fall back to scanning the raw memo.
    const code = (payload.code && extractCode(payload.code)) || extractCode(content);

    const request = code
      ? (this.db
          .prepare("SELECT code, user_id, amount, status FROM topup_requests WHERE code = ?")
          .get(code) as
          | { code: string; user_id: string; amount: number; status: string }
          | undefined)
      : undefined;

    if (!request || request.status === 'paid' || amount <= 0) {
      this.db
        .prepare(
          'INSERT OR IGNORE INTO sepay_transactions (id, user_id, amount, content, matched_code) VALUES (?, NULL, ?, ?, NULL)',
        )
        .run(sepayId || `unmatched-${Date.now()}`, amount, content);
      return { action: 'unmatched', amount, content };
    }

    // Credit what actually arrived, not what was asked for.
    const run = this.db.transaction(() => {
      this.db
        .prepare("UPDATE topup_requests SET status = 'paid', paid_at = datetime('now') WHERE code = ?")
        .run(request.code);
      this.db
        .prepare(
          'INSERT OR IGNORE INTO sepay_transactions (id, user_id, amount, content, matched_code) VALUES (?, ?, ?, ?, ?)',
        )
        .run(sepayId || `matched-${request.code}`, request.user_id, amount, content, request.code);
    });
    run();
    this.cash.credit(request.user_id, amount, `sepay:${request.code}`);

    return { action: 'credited', userId: request.user_id, amount, code: request.code };
  }
}
