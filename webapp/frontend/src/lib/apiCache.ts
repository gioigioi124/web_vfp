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
  gen: number;
}

const MAX_CACHE_ENTRIES = 200;
const store = new Map<string, CacheEntry<unknown>>();
let nextGen = 1;

function touchEntry<T>(key: string, entry: CacheEntry<T>): void {
  if (store.has(key)) {
    store.delete(key);
  }
  store.set(key, entry);
  while (store.size > MAX_CACHE_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey === undefined) break;
    store.delete(oldestKey);
  }
}

function withCallerSignal<T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(
      new DOMException("The operation was aborted.", "AbortError"),
    );
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (val) => {
        signal.removeEventListener("abort", onAbort);
        resolve(val);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
}

/** TTL mặc định (ms): dữ liệu coi là "tươi" trong 5s, không gọi lại mạng. */
export const DEFAULT_TTL = 5_000;

/** Đọc dữ liệu đã cache (nếu có). Trả về undefined nếu chưa từng tải. */
export function peek<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  touchEntry(key, entry);
  return entry.data;
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
  for (const key of Array.from(store.keys())) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export interface CachedFetchOptions {
  /** Bỏ qua cache "tươi", buộc gọi mạng mới nhất. */
  force?: boolean;
  /** TTL riêng cho key này (ms). */
  ttl?: number;
  /** Hủy promise phía caller (không hủy request chia sẻ của caller khác). */
  signal?: AbortSignal;
}

/**
 * Fetch có cache theo key (LRU <= 200 entries).
 * - Nếu cache tươi và !force → trả cache, không gọi mạng.
 * - Nếu đang có request in-flight và !force → dùng chung promise (dedupe).
 * - Nếu force → gửi request mới và đánh dấu generation để response cũ không ghi đè.
 */
export async function cachedFetch<T = unknown>(
  key: string,
  url: string,
  opts: CachedFetchOptions = {},
): Promise<T> {
  const { force = false, ttl = DEFAULT_TTL, signal } = opts;
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
  const existing = store.get(key) as CacheEntry<T> | undefined;

  // 1) Cache tươi → trả luôn.
  if (
    !force &&
    existing?.data !== undefined &&
    Date.now() - existing.ts < ttl
  ) {
    touchEntry(key, existing);
    return existing.data;
  }

  // 2) Đang có request chạy cho cùng key (và không force) → dùng chung (dedupe).
  if (!force && existing?.promise) {
    return withCallerSignal(existing.promise, signal);
  }

  // 3) Gọi mạng mới với generation counter để ngăn stale overwrite.
  const reqGen = nextGen++;
  const promise = (async () => {
    const res = await fetch(url);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} for ${url}`) as Error & {
        status?: number;
      };
      err.status = res.status;
      throw err;
    }
    const json = (await res.json()) as T;
    const cur = store.get(key) as CacheEntry<T> | undefined;
    // Chỉ ghi đè cache nếu không có request mới hơn đã bắt đầu hoặc hoàn tất
    if (!cur || cur.gen <= reqGen) {
      touchEntry(key, { data: json, ts: Date.now(), gen: reqGen });
    }
    return json;
  })().catch((err) => {
    const status = (err as { status?: number })?.status;
    const cur = store.get(key) as CacheEntry<T> | undefined;
    if (!cur || cur.gen <= reqGen) {
      if (status === 404) {
        store.delete(key);
      } else if (cur && cur.data !== undefined) {
        touchEntry(key, { data: cur.data, ts: cur.ts, gen: reqGen });
      } else {
        store.delete(key);
      }
    }
    throw err;
  });

  touchEntry(key, {
    data: existing?.data,
    ts: existing?.ts ?? 0,
    promise,
    gen: reqGen,
  });
  return withCallerSignal(promise, signal);
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
