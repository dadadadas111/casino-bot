/**
 * Witty per-player one-liners for the daily newsletter, written by DeepSeek
 * from rule-computed player facts. Fail-open: callers fall back to the raw
 * facts when generation fails.
 */

export interface CommentaryInput {
  facts: string[];
}

const API_URL = 'https://api.deepseek.com/chat/completions';
const MAX_COMMENT_LENGTH = 120;

export function buildCommentaryPrompt(players: CommentaryInput[]): string {
  const blocks = players
    .map((p, i) => `Người chơi ${i + 1}:\n${p.facts.map((f) => `- ${f}`).join('\n')}`)
    .join('\n\n');
  return [
    'Bạn là MC của một sòng bạc Discord vui tính (tiền ảo, chơi cho vui).',
    `Dưới đây là thống kê của ${players.length} người chơi theo thứ tự trên bảng xếp hạng.`,
    'Với MỖI người, viết đúng MỘT câu nhận xét bằng tiếng Việt, tối đa 90 ký tự.',
    '',
    'Yêu cầu về nội dung:',
    '- Mỗi người chọn MỘT góc khác nhau để nói, xoay vòng giữa: tiền bạc, số ván đã chơi, trò họ hay chơi, chuỗi điểm danh, cú thắng đậm nhất. KHÔNG được câu nào cũng nói về tiền.',
    '- Trộn cả KHEN và khịa: ai có điểm sáng thật (lời ròng, chăm điểm danh, thắng đậm, chơi đều) thì khen chân thành; ai thua lỗ hay liều lĩnh thì trêu nhẹ nhàng. Đại khái nửa khen nửa khịa, không được chỉ toàn khịa.',
    '- Giọng thân thiện như bạn bè trong server, không xúc phạm, không gọi tên riêng.',
    '- Không dùng dấu gạch ngang dài, tối đa 1 emoji mỗi câu.',
    '',
    'Trả về JSON đúng mẫu: {"comments":["câu 1","câu 2",...]} với đúng số câu và đúng thứ tự.',
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
