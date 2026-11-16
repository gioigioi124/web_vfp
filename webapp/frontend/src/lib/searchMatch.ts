/**
 * Chuẩn hóa chuỗi tìm kiếm: Unicode NFC, chữ thường, gộp khoảng trắng thừa.
 */
export function normalizeSearchText(s: string | null | undefined): string {
  return (s || "").normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

const WORD_CHAR_RE = /[a-z0-9à-ỹ]/i;

/**
 * Kiểm tra cụm `phrase` xuất hiện liền nhau trong `hay`:
 * - `2`: khớp tại đầu từ / sau dấu phân cách (VD: `"80 q"` trong `"showroom 80 quang trung"`)
 * - `1`: khớp liền nhau bên trong từ/số (VD: `"80 q"` trong `"180 quang"`)
 * - `0`: không khớp liền nhau
 */
export function matchPhraseRank(hay: string, phrase: string): 0 | 1 | 2 {
  if (!phrase || !hay) return 0;
  let pos = hay.indexOf(phrase);
  if (pos < 0) return 0;
  while (pos >= 0) {
    if (pos === 0 || !WORD_CHAR_RE.test(hay[pos - 1])) {
      return 2;
    }
    pos = hay.indexOf(phrase, pos + 1);
  }
  return 1;
}

export function parseSearchQuery(q: string): {
  phrase: string;
  words: string[];
} {
  const phrase = normalizeSearchText(q);
  const words = phrase ? phrase.split(" ") : [];
  return { phrase, words };
}

/**
 * Xếp hạng kết quả tìm kiếm theo thứ tự ưu tiên khối liền nhau -> từ rời:
 * 0: Cụm liền nhau ở đầu từ trong tên chính
 * 1: Cụm liền nhau ở đầu từ trong trường phụ (địa chỉ / mã)
 * 2: Cụm liền nhau (bên trong từ) trong tên chính
 * 3: Cụm liền nhau (bên trong từ) trong trường phụ
 * 4: Cụm liền nhau bắc cầu trong chuỗi gộp
 * 5: Đủ các từ rời trong tên chính
 * 6: Đủ các từ rời trong trường phụ
 * 7: Đủ các từ rời trong chuỗi gộp
 */
export function rankByFields(
  primary: string,
  secondary: string,
  all: string,
  phrase: string,
  words: string[],
): number {
  const pRank = matchPhraseRank(primary, phrase);
  if (pRank === 2) return 0;
  const sRank = matchPhraseRank(secondary, phrase);
  if (sRank === 2) return 1;
  if (pRank === 1) return 2;
  if (sRank === 1) return 3;
  if (words.length > 1 && matchPhraseRank(all, phrase) > 0) return 4;
  if (words.every((w) => primary.includes(w))) return 5;
  if (words.every((w) => secondary.includes(w))) return 6;
  if (words.every((w) => all.includes(w))) return 7;
  return Infinity;
}

/**
 * Duyệt 1 lượt qua danh sách và gom kết quả theo 8 bậc ưu tiên (0..7) tới `limit`.
 */
export function collectRanked<T>(
  items: readonly T[],
  limit: number,
  getRank: (item: T) => number,
): T[] {
  if (limit <= 0) return [];
  const buckets: T[][] = [[], [], [], [], [], [], [], []];
  for (const it of items) {
    const r = getRank(it);
    if (r >= 0 && r < buckets.length && buckets[r].length < limit) {
      buckets[r].push(it);
      if (r === 0 && buckets[0].length >= limit) break;
    }
  }
  const out: T[] = [];
  for (const b of buckets) {
    for (const it of b) {
      out.push(it);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
