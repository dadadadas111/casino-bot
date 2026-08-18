/**
 * AI-generated quiz questions via the DeepSeek API (OpenAI-compatible).
 * Fail-open: any error returns null and the caller uses the static bank.
 */

export interface RawQuestion {
  question: string;
  answers: string[];
  correct: number;
}

export interface TieredQuestion extends RawQuestion {
  tier: 'easy' | 'medium' | 'hard';
}

const API_URL = 'https://api.deepseek.com/chat/completions';
const QUESTION_COUNT = 15;

const TOPICS = [
  'lịch sử Việt Nam',
  'địa lý Việt Nam',
  'văn hóa và ẩm thực Việt Nam',
  'văn học Việt Nam',
  'khoa học tự nhiên',
  'toán học vui',
  'địa lý thế giới',
  'lịch sử thế giới',
  'thể thao',
  'âm nhạc và nghệ thuật',
  'động vật và thiên nhiên',
  'vũ trụ và thiên văn',
  'phát minh và công nghệ',
];

function pickTopics(count: number): string[] {
  const copy = [...TOPICS];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export function buildPrompt(recent: string[]): string {
  const avoid =
    recent.length > 0
      ? `\nTUYỆT ĐỐI tránh trùng hoặc gần giống các câu đã dùng gần đây:\n${recent.map((q) => `- ${q}`).join('\n')}`
      : '';
  return [
    'Bạn là biên tập viên câu hỏi cho gameshow "Ai Là Triệu Phú" tiếng Việt.',
    `Hãy tạo đúng ${QUESTION_COUNT} câu hỏi trắc nghiệm MỚI và trả về JSON đúng mẫu sau:`,
    '{"questions":[{"question":"...","answers":["...","...","...","..."],"correct":0}]}',
    '',
    'Yêu cầu bắt buộc:',
    '- Câu 1-5 dễ (kiến thức phổ thông), câu 6-10 trung bình, câu 11-15 khó, xếp đúng thứ tự đó.',
    '- "correct" là chỉ số (0-3) của đáp án đúng trong mảng "answers".',
    '- Chỉ dùng sự thật ổn định đã được kiểm chứng, KHÔNG dùng số liệu thay đổi theo thời gian hay tin thời sự.',
    '- Mỗi câu có đúng MỘT đáp án đúng; ba đáp án sai phải hợp lý nhưng sai rõ ràng.',
    '- Không đánh đố, không mơ hồ, không chơi chữ.',
    `- Chủ đề trải đều trong: ${pickTopics(6).join(', ')}.`,
    '- Toàn bộ nội dung bằng tiếng Việt.',
    avoid,
  ].join('\n');
}

/** Validate the model's payload; returns only structurally sound questions. */
export function parseGeneratedQuestions(payload: unknown): RawQuestion[] {
  if (typeof payload !== 'object' || payload === null) return [];
  const list = (payload as { questions?: unknown }).questions;
  if (!Array.isArray(list)) return [];
  const valid: RawQuestion[] = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const { question, answers, correct } = item as {
      question?: unknown;
      answers?: unknown;
      correct?: unknown;
    };
    if (typeof question !== 'string' || question.trim().length < 8) continue;
    if (!Array.isArray(answers) || answers.length !== 4) continue;
    if (!answers.every((a) => typeof a === 'string' && a.trim().length > 0)) continue;
    if (new Set(answers).size !== 4) continue;
    if (typeof correct !== 'number' || !Number.isInteger(correct) || correct < 0 || correct > 3)
      continue;
    valid.push({ question: question.trim(), answers: answers as string[], correct });
  }
  return valid;
}

export async function generateQuizQuestions(
  apiKey: string,
  recent: string[],
): Promise<RawQuestion[] | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: buildPrompt(recent) }],
        response_format: { type: 'json_object' },
        temperature: 0.8,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      console.warn(`[quiz-ai] HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const questions = parseGeneratedQuestions(JSON.parse(content));
    if (questions.length < QUESTION_COUNT) {
      console.warn(`[quiz-ai] only ${questions.length}/${QUESTION_COUNT} valid questions`);
      return null;
    }
    return questions.slice(0, QUESTION_COUNT);
  } catch (error) {
    console.warn(`[quiz-ai] ${String(error)}`);
    return null;
  }
}

/**
 * Build a batch for the shared pool. Batching is the whole point: one call
 * for fifty questions costs far less per question than one call per game.
 */
export function buildBatchPrompt(count: number, avoid: string[], focusTier?: 'easy' | 'medium' | 'hard'): string {
  const perTier = Math.round(count / 3);
  const avoidBlock =
    avoid.length > 0
      ? `\nTránh trùng hoặc gần giống các câu đã có:\n${avoid.map((q) => `- ${q}`).join('\n')}`
      : '';
  return [
    'Bạn là biên tập viên câu hỏi cho gameshow "Ai Là Triệu Phú" tiếng Việt.',
    `Hãy tạo đúng ${count} câu hỏi trắc nghiệm MỚI và trả về JSON đúng mẫu:`,
    '{"questions":[{"question":"...","answers":["...","...","...","..."],"correct":0,"tier":"easy"}]}',
    '',
    'Yêu cầu bắt buộc:',
    focusTier
      ? `- TOÀN BỘ ${count} câu phải ở mức "${focusTier}"${focusTier === 'easy' ? ' (phổ thông, ai cũng trả lời được)' : focusTier === 'hard' ? ' (đánh đố người am hiểu)' : ' (cần suy nghĩ một chút)'}, đặt "tier":"${focusTier}" cho mọi câu.`
      : `- Chia đều độ khó: khoảng ${perTier} câu "easy" (phổ thông ai cũng biết), ${perTier} câu "medium", còn lại "hard" (đánh đố người am hiểu).`,
    '- "correct" là chỉ số (0-3) của đáp án đúng trong mảng "answers".',
    '- Chỉ dùng sự thật ổn định đã được kiểm chứng, KHÔNG dùng số liệu thay đổi theo thời gian hay tin thời sự.',
    '- Mỗi câu đúng MỘT đáp án; ba đáp án sai phải hợp lý nhưng sai rõ ràng.',
    `- Trải đều chủ đề: ${TOPICS.join(', ')}.`,
    '- Toàn bộ bằng tiếng Việt. Không đánh đố chơi chữ, không mơ hồ.',
    avoidBlock,
  ].join('\n');
}

/** Validate a tiered batch; drops anything malformed rather than failing whole. */
export function parseTieredQuestions(payload: unknown): TieredQuestion[] {
  const base = parseGeneratedQuestions(payload);
  if (base.length === 0) return [];
  const list = (payload as { questions?: unknown[] }).questions ?? [];
  const tiers = new Map<string, 'easy' | 'medium' | 'hard'>();
  for (const item of list) {
    const { question, tier } = (item ?? {}) as { question?: unknown; tier?: unknown };
    if (typeof question === 'string' && (tier === 'easy' || tier === 'medium' || tier === 'hard')) {
      tiers.set(question.trim(), tier);
    }
  }
  return base.map((q) => ({ ...q, tier: tiers.get(q.question) ?? 'medium' }));
}

export async function generateQuestionBatch(
  apiKey: string,
  count: number,
  avoid: string[] = [],
  focusTier?: 'easy' | 'medium' | 'hard',
): Promise<TieredQuestion[] | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: buildBatchPrompt(count, avoid, focusTier) }],
        response_format: { type: 'json_object' },
        temperature: 0.9,
      }),
      // Fifty questions take noticeably longer to write than fifteen.
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      console.warn(`[quiz-ai] batch HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const questions = parseTieredQuestions(JSON.parse(content));
    // Trust the request over a mislabelled response when a tier was demanded.
    const tiered = focusTier ? questions.map((q) => ({ ...q, tier: focusTier })) : questions;
    return tiered.length > 0 ? tiered : null;
  } catch (error) {
    console.warn(`[quiz-ai] batch failed: ${String(error)}`);
    return null;
  }
}
