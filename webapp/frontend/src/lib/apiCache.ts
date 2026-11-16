/**
 * apiCache.ts — Cache nhẹ cho `fetch` theo key.
 *
 * Mục tiêu tối ưu hiệu năng (Giai đoạn 1, READ-ONLY):
 *  1. SWR (Stale-While-Revalidate): trả dữ liệu đã cache NGAY LẬP TỨC,
 *     sau đó fetch ngầm để làm mới. Người dùng không thấy spinner cho
 *     những phiếu đã xem trước đó.
 *  2. Dedupe request in-flight: cùng key → chỉ 1 request mạng dù nhiều
 *     nơi gọi (effect + handler) cùng lúc.
 *  3. TTL ngắn: tránh gọi lại liên tục khi click qua lại giữa các dòng.
 *  4. Cho phép invalidate theo prefix khi cần làm mới có chủ đích.
 *
 * KHÔNG ghi dữ liệu — chỉ đọc.
 */

interface CacheEntry<T> {
  data?: T;
  ts: number;
  promise?: Promise<T>;
}

const store = new Map<string, CacheEntry<unknown>>();

/** TTL mặc định (ms): dữ liệu coi là "tươi" trong 5s, không gọi lại mạng. */
export const DEFAULT_TTL = 5_000;

/** Đọc dữ liệu đã cache (nếu có). Trả về undefined nếu chưa từng tải. */
export function peek<T>(key: string): T | undefined {
  return store.get(key)?.data as T | undefined;
}

/** Kiểm tra cache còn "tươi" trong khoảng ttl hay không. */
export function isFresh(key: string, ttl = DEFAULT_TTL): boolean {
  const e = store.get(key);
  return !!e && e.data !== undefined && Date.now() - e.ts < ttl;
}

/** Xóa cache. Không truyền tham số → xóa tất cả. */
export function invalidate(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export interface CachedFetchOptions {
  /** Bỏ qua cache "tươi", buộc gọi mạng (vẫn dedupe request in-flight). */
  force?: boolean;
  /** TTL riêng cho key này (ms). */
  ttl?: number;
  /** Hủy request mạng. */
  signal?: AbortSignal;
}

/**
 * Fetch có cache theo key.
 * - Nếu cache tươi và !force → trả cache, không gọi mạng.
 * - Nếu đang có request in-flight cho cùng key → dùng chung promise (dedupe).
 * - Ngược lại → gọi mạng, lưu cache.
 */
export async function cachedFetch<T = unknown>(
  key: string,
  url: string,
  opts: CachedFetchOptions = {},
): Promise<T> {
  const { force = false, ttl = DEFAULT_TTL, signal } = opts;
  const existing = store.get(key) as CacheEntry<T> | undefined;

  // 1) Cache tươi → trả luôn.
  if (
    !force &&
    existing?.data !== undefined &&
    Date.now() - existing.ts < ttl
  ) {
    return existing.data;
  }

  // 2) Đang có request chạy cho cùng key → dùng chung (dedupe).
  if (existing?.promise) return existing.promise;

  // 3) Gọi mạng.
  const promise = (async () => {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} for ${url}`) as Error & {
        status?: number;
      };
      err.status = res.status;
      throw err;
    }
    const json = (await res.json()) as T;
    store.set(key, { data: json, ts: Date.now() });
    return json;
  })().catch((err) => {
    // Thất bại: xóa promise để lần sau thử lại. Giữ data cũ CHỈ khi lỗi mạng
    // (không giữ khi 404 — phiếu đã bị xóa, cache cũ không còn đúng).
    const status = (err as { status?: number })?.status;
    const cur = store.get(key) as CacheEntry<T> | undefined;
    if (status === 404) store.delete(key);
    else if (cur) store.set(key, { data: cur.data, ts: cur.ts });
    else store.delete(key);
    throw err;
  });

  store.set(key, { data: existing?.data, ts: existing?.ts ?? 0, promise });
  return promise;
}

/**
 * Fetch nền để làm mới nhưng KHÔNG ghi đè cache nếu đã có request mới hơn.
 * Dùng cho SWR: hiển thị cache trước, làm mới ngầm.
 */
export async function revalidate<T = unknown>(
  key: string,
  url: string,
  opts: Omit<CachedFetchOptions, "force"> = {},
): Promise<T> {
  return cachedFetch<T>(key, url, { ...opts, force: true });
}
