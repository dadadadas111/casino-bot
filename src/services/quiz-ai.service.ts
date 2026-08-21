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
    '- Chỉ dùng sự thật khách quan, ổn định, kiểm chứng được (ngày tháng, thủ đô, tác giả, số lượng, định nghĩa). KHÔNG dùng số liệu thay đổi theo thời gian hay tin thời sự.',
    '',
    'QUAN TRỌNG NHẤT — chỉ được có ĐÚNG MỘT đáp án đúng:',
    '- Ba đáp án sai phải THỰC SỰ SAI, không được có đáp án nào khác cũng đúng.',
    '- Với câu phân loại kiểu "X nào thuộc nhóm Y", chỉ được đúng một lựa chọn thuộc nhóm đó. VÍ DỤ SAI: "Con nào là bò sát? rùa / thằn lằn / ..." vì cả rùa lẫn thằn lằn đều là bò sát.',
    '',
    'CẤM tuyệt đối các loại câu sau vì không có đáp án duy nhất:',
    '- Câu chủ quan, dựa vào ý kiến, sở thích, hay cảm nhận.',
    '- Câu về "biểu tượng", "tượng trưng cho", "đại diện cho" (vd con vật may mắn, hoa biểu tượng).',
    '- Câu "phổ biến nhất", "nổi tiếng nhất", "được yêu thích nhất" nếu không có nguồn chính thức.',
    '- Câu về thứ CHƯA được công nhận chính thức. VÍ DỤ SAI: "Quốc hoa Việt Nam là gì?" vì Việt Nam chưa có văn bản pháp luật công nhận quốc hoa.',
    '',
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

const JUDGE_URL = API_URL;

export interface JudgedQuestion {
  question: RawQuestion & { tier?: string };
  ok: boolean;
  reason: string;
}

function judgePrompt(questions: Array<RawQuestion>): string {
  const listed = questions
    .map((q, i) => {
      const opts = q.answers.map((a, j) => `${j}) ${a}${j === q.correct ? ' [đánh dấu đúng]' : ''}`).join(' ');
      return `${i}. ${q.question} — ${opts}`;
    })
    .join('\n');
  return [
    'Bạn là giám khảo kiểm định câu hỏi trắc nghiệm tiếng Việt. Với mỗi câu dưới đây, quyết định câu đó ĐẠT hay KHÔNG.',
    'Câu ĐẠT khi thỏa CẢ BA:',
    '1) Chỉ có ĐÚNG MỘT đáp án đúng. Nếu có từ hai lựa chọn trở lên cùng đúng thì KHÔNG đạt (vd "con nào là bò sát" mà có cả rùa lẫn thằn lằn).',
    '2) Đáp án được [đánh dấu đúng] phải thực sự đúng.',
    '3) Câu khách quan, kiểm chứng được. KHÔNG đạt nếu chủ quan, dựa vào ý kiến, về biểu tượng/tượng trưng, "phổ biến nhất", hay về thứ chưa được công nhận chính thức (vd quốc hoa Việt Nam chưa có luật công nhận).',
    'Nghiêm khắc: chỉ cần nghi ngờ một tiêu chí là cho KHÔNG đạt.',
    '',
    'Danh sách câu (theo chỉ số):',
    listed,
    '',
    'Trả về JSON đúng mẫu: {"verdicts":[{"i":0,"ok":true,"ly_do":"..."}]} — mỗi câu một mục, ly_do ngắn gọn.',
  ].join('\n');
}

/**
 * Ask the model to flag ambiguous, subjective or wrong questions. Fail-open:
 * on any error every question is treated as acceptable, so the judge can only
 * remove questions, never block generation entirely.
 */
export async function judgeQuestions<T extends RawQuestion>(
  apiKey: string,
  questions: T[],
): Promise<Array<{ question: T; ok: boolean; reason: string }>> {
  if (questions.length === 0) return [];
  try {
    const res = await fetch(JUDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: judgePrompt(questions) }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.warn(`[quiz-judge] HTTP ${res.status}, giữ nguyên toàn bộ`);
      return questions.map((q) => ({ question: q, ok: true, reason: 'judge-unavailable' }));
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    const parsed = content ? (JSON.parse(content) as { verdicts?: unknown }) : {};
    const verdicts = Array.isArray(parsed.verdicts) ? parsed.verdicts : [];
    const byIndex = new Map<number, { ok: boolean; reason: string }>();
    for (const v of verdicts) {
      if (typeof v !== 'object' || v === null) continue;
      const { i, ok, ly_do } = v as { i?: unknown; ok?: unknown; ly_do?: unknown };
      if (typeof i === 'number') {
        byIndex.set(i, { ok: ok !== false, reason: typeof ly_do === 'string' ? ly_do : '' });
      }
    }
    // A question the judge forgot to rate is kept (fail-open per item).
    return questions.map((q, idx) => {
      const v = byIndex.get(idx);
      return { question: q, ok: v ? v.ok : true, reason: v?.reason ?? 'not-rated' };
    });
  } catch (error) {
    console.warn(`[quiz-judge] ${String(error)}, giữ nguyên toàn bộ`);
    return questions.map((q) => ({ question: q, ok: true, reason: 'judge-error' }));
  }
}
