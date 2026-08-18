import { describe, expect, it } from 'vitest';
import {
  classify,
  contentTokens,
  fingerprint,
  isNearDuplicate,
  jaccard,
  normalizeText,
  rejectDuplicates,
} from '../src/services/similarity.service';

const q = (question: string, answer: string) => ({
  question,
  answers: [answer, 'sai 1', 'sai 2', 'sai 3'],
  correct: 0,
});
const dup = (a: ReturnType<typeof q>, b: ReturnType<typeof q>) =>
  isNearDuplicate(fingerprint(a), fingerprint(b));

describe('normalizeText', () => {
  it('strips Vietnamese diacritics and punctuation', () => {
    expect(normalizeText('Quốc hoa của Việt Nam là gì?')).toBe('quoc hoa cua viet nam la gi');
    expect(normalizeText('Đường Trường Sơn')).toBe('duong truong son');
  });
});

describe('contentTokens', () => {
  it('keeps topic words and drops function words', () => {
    const tokens = contentTokens('Thủ đô của Việt Nam là thành phố nào?');
    expect([...tokens]).toEqual(expect.arrayContaining(['thu', 'do', 'viet', 'nam', 'thanh', 'pho']));
    // 'đô' must survive: stripping diacritics collides it with the filler 'do'.
    expect(tokens.has('cua')).toBe(false);
    expect(tokens.has('la')).toBe(false);
    expect(tokens.has('nao')).toBe(false);
  });
});

describe('jaccard', () => {
  it('scores identical sets 1 and disjoint sets 0', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
    expect(jaccard(new Set(['a']), new Set(['b']))).toBe(0);
    expect(jaccard(new Set(), new Set(['a']))).toBe(0);
  });
});

describe('isNearDuplicate: cặp trùng thật lấy từ kho production', () => {
  it('catches pure word reordering', () => {
    expect(
      dup(
        q('Loài hoa nào là quốc hoa của Việt Nam?', 'Hoa sen'),
        q('Quốc hoa của Việt Nam là loài hoa nào?', 'Hoa sen'),
      ),
    ).toBe(true);
  });

  it('catches a question that merely adds a qualifier', () => {
    expect(
      dup(
        q('Vịnh nào được UNESCO công nhận là di sản thiên nhiên thế giới?', 'Vịnh Hạ Long'),
        q('Vịnh nào ở Việt Nam được UNESCO công nhận là di sản thiên nhiên thế giới?', 'Vịnh Hạ Long'),
      ),
    ).toBe(true);
  });

  it('catches a synonym swap when the answer matches', () => {
    expect(
      dup(
        q('Đội tuyển bóng đá quốc gia nào đã vô địch World Cup 2018?', 'Pháp'),
        q('Đội tuyển bóng đá quốc gia nào vô địch World Cup 2018?', 'Pháp'),
      ),
    ).toBe(true);
  });
});

describe('isNearDuplicate: câu khác nhau thật phải được giữ', () => {
  it('keeps different facts that share a topic', () => {
    expect(
      dup(
        q('Thủ đô của Việt Nam là thành phố nào?', 'Hà Nội'),
        q('Thành phố nào của Việt Nam đông dân nhất?', 'TP. Hồ Chí Minh'),
      ),
    ).toBe(false);
  });

  it('keeps different questions that happen to share an answer', () => {
    expect(
      dup(
        q('Thủ đô của Việt Nam là thành phố nào?', 'Hà Nội'),
        q('Văn Miếu Quốc Tử Giám nằm ở tỉnh thành nào?', 'Hà Nội'),
      ),
    ).toBe(false);
  });

  it('keeps look-alike questions whose answers differ', () => {
    // Both dry-run false positives: heavy word overlap, different subject.
    expect(
      dup(
        q('Cao nguyên nào cao nhất ở Việt Nam?', 'Cao nguyên Lâm Viên'),
        q('Núi nào cao nhất Việt Nam?', 'Fansipan'),
      ),
    ).toBe(false);
    expect(
      dup(
        q('Hệ Mặt Trời có bao nhiêu hành tinh?', '8'),
        q('Hành tinh nào đứng thứ hai trong hệ Mặt Trời?', 'Sao Kim'),
      ),
    ).toBe(false);
  });

  it('keeps questions about neighbouring but distinct subjects', () => {
    expect(
      dup(
        q('Sông nào dài nhất Việt Nam?', 'Sông Đồng Nai'),
        q('Sông nào chảy qua thủ đô Hà Nội?', 'Sông Hồng'),
      ),
    ).toBe(false);
  });
});

describe('rejectDuplicates', () => {
  it('drops candidates matching the pool and reports what they clashed with', () => {
    const existing = [q('Quốc hoa của Việt Nam là loài hoa nào?', 'Hoa sen')];
    const result = rejectDuplicates(
      [
        q('Loài hoa nào là quốc hoa của Việt Nam?', 'Hoa sen'),
        q('Loài chim nào chạy nhanh nhất hành tinh?', 'Đà điểu'),
      ],
      existing,
    );
    expect(result.kept).toHaveLength(1);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0].matched).toContain('Quốc hoa');
  });

  it('also removes repeats inside a single batch', () => {
    const result = rejectDuplicates(
      [
        q('Nước nào có diện tích lớn nhất thế giới?', 'Nga'),
        q('Quốc gia nào có diện tích lớn nhất thế giới?', 'Nga'),
      ],
      [],
    );
    expect(result.kept).toHaveLength(1);
    expect(result.dropped).toHaveLength(1);
  });
});

describe('classify: ba mức phán quyết', () => {
  // Synthetic tokens keep the overlap exact, so the test pins the thresholds
  // themselves rather than the quirks of one Vietnamese sentence.
  const print = (words: string, answer: string) =>
    fingerprint({ question: words, answers: [answer, 'x', 'y', 'z'], correct: 0 });

  it('same answer with light overlap goes to review, not the bin', () => {
    // 2 shared of 8 distinct = 0.25, inside the 0.20 to 0.35 review band.
    const a = print('alpha beta gamma delta epsilon', 'Sao Mộc');
    const b = print('alpha beta zeta eta theta', 'Sao Mộc');
    expect(jaccard(a.tokens, b.tokens)).toBeCloseTo(0.25, 2);
    expect(classify(a, b)).toBe('borderline');
  });

  it('same answer with heavy overlap is a duplicate', () => {
    // 3 shared of 7 distinct = 0.43, past the 0.35 same-answer threshold.
    const a = print('alpha beta gamma delta', 'Hoa sen');
    const b = print('alpha beta gamma zeta eta', 'Hoa sen');
    expect(classify(a, b)).toBe('duplicate');
  });

  it('different answers need near-verbatim wording to count as duplicate', () => {
    const a = print('alpha beta gamma delta', 'Đáp án A');
    const b = print('alpha beta gamma zeta', 'Đáp án B');
    expect(classify(a, b)).toBe('borderline');
    expect(classify(print('alpha beta gamma delta', 'A'), print('alpha beta gamma delta', 'B'))).toBe(
      'duplicate',
    );
  });

  it('leaves unrelated questions alone', () => {
    expect(
      classify(
        print('Ai là tác giả Truyện Kiều?', 'Nguyễn Du'),
        print('Sông nào dài nhất thế giới?', 'Sông Nin'),
      ),
    ).toBe('distinct');
  });
});

describe('rejectDuplicates triage', () => {
  const q = (question: string, answer: string) => ({
    question,
    answers: [answer, 'a', 'b', 'c'],
    correct: 0,
  });

  it('splits candidates into kept, dropped and queued for review', () => {
    const existing = [q('alpha beta gamma delta epsilon', 'Hoa sen')];
    const result = rejectDuplicates(
      [
        q('alpha beta gamma delta zeta', 'Hoa sen'), // heavy overlap -> duplicate
        q('alpha beta zeta eta theta', 'Hoa sen'), // light overlap -> review
        q('Thành phố nào đông dân nhất Việt Nam?', 'TP. Hồ Chí Minh'), // unrelated
      ],
      existing,
    );
    expect(result.dropped).toHaveLength(1);
    expect(result.borderline).toHaveLength(1);
    expect(result.kept).toHaveLength(1);
    expect(result.borderline[0].score).toBeGreaterThan(0);
  });
});
