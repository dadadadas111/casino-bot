/**
 * Witty per-player one-liners for the daily newsletter, written by DeepSeek
 * from rule-computed player facts. Fail-open: callers fall back to the raw
 * facts when generation fails.
 */

export interface CommentaryInput {
  facts: string[];
}

const API_URL = 'https://api.deepseek.com/chat/completions';
const MAX_COMMENT_LENGTH = 160;

export function buildCommentaryPrompt(players: CommentaryInput[]): string {
  const blocks = players
    .map((p, i) => `Người chơi ${i + 1}:\n${p.facts.map((f) => `- ${f}`).join('\n')}`)
    .join('\n\n');
  return [
    'Bạn là biên tập viên bản tin của một sòng bạc Discord (tiền ảo, chơi cho vui).',
    `Dưới đây là hồ sơ của ${players.length} người chơi theo thứ tự trên bảng xếp hạng.`,
    'Với MỖI người, viết đúng MỘT dòng "nét đáng chú ý" bằng tiếng Việt, tối đa 140 ký tự.',
    '',
    'Phong cách bắt buộc, học theo các ví dụ sau (dữ liệu khác, chỉ học giọng):',
    '- "Được admin bơm: 2 lần cộng 1,1 triệu + 1 lần set thẳng ~9 triệu"',
    '- "Chăm nhất server: streak điểm danh 3 ngày, trúng Triệu phú 15.000"',
    '- "Chơi nhiều nhất; thần tài xỉu: cược 22.200 thắng về 42.400"',
    '- "Kiếp đỏ đen: trúng Triệu phú 15.000 xong nướng sạch vào đua ngựa, giờ còn 437"',
    '- "Vốn chủ yếu do <@123456> chuyển cho 50.000"',
    '- "Mới vào, chơi đúng 1 ván Triệu phú và thua trắng"',
    '',
    'Quy tắc:',
    '- Dòng nào cũng phải KỂ BẰNG SỐ LIỆU CỤ THỂ lấy từ hồ sơ, tuyệt đối không bịa số, không nói chung chung.',
    '- Chọn chi tiết ĐẮT NHẤT của mỗi người: dòng tiền admin, hành trình thắng rồi thua, trò tủ, chuỗi điểm danh, số ván. Mỗi người một góc khác nhau.',
    '- Có nhãn "nhất server" trong hồ sơ thì tận dụng ("Chơi nhiều nhất server", "Chăm nhất server").',
    '- Khen người có thành tích thật, khịa nhẹ người nướng tiền; tự nhiên như ví dụ, không được chỉ toàn khịa.',
    '- Gặp token dạng <@số> trong hồ sơ thì giữ nguyên y hệt khi dùng (đó là tên người được nhắc đến).',
    '- Không gọi tên riêng khác, không dùng dấu gạch ngang dài, hạn chế emoji.',
    '',
    'Trả về JSON đúng mẫu: {"comments":["dòng 1","dòng 2",...]} với đúng số dòng và đúng thứ tự.',
    '',
    blocks,
  ].join('\n');
}

/** Validate the model's payload; returns null unless every comment is usable. */
export function parseComments(payload: unknown, expected: number): string[] | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const list = (payload as { comments?: unknown }).comments;
  if (!Array.isArray(list) || list.length !== expected) return null;
  const comments = list.map((c) => (typeof c === 'string' ? c.trim() : ''));
  if (comments.some((c) => c.length === 0 || c.length > MAX_COMMENT_LENGTH)) return null;
  return comments;
}

export async function generateComments(
  apiKey: string,
  players: CommentaryInput[],
): Promise<string[] | null> {
  if (players.length === 0) return [];
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: buildCommentaryPrompt(players) }],
        response_format: { type: 'json_object' },
        temperature: 1.0,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`[commentary] HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return parseComments(JSON.parse(content), players.length);
  } catch (error) {
    console.warn(`[commentary] ${String(error)}`);
    return null;
  }
}
