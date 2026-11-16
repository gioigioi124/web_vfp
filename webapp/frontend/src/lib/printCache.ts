import { cachedFetch, invalidate, isFresh, peek } from "./apiCache";

export type PrintDbMode = "sales" | "warehouse";

/** TTL cache bản in (15s): đủ dài để F7 sau khi chọn dòng mở tức thì, đồng thời tự làm mới khi quá hạn. */
export const PRINT_CACHE_TTL = 15_000;

export function printCacheKey(
  dbMode: PrintDbMode,
  stt: string,
  inNoCk: "C" | "K" = "K",
): string {
  return `print:${dbMode}:${stt}:${inNoCk}`;
}

export function printApiUrl(
  dbMode: PrintDbMode,
  stt: string,
  inNoCk: "C" | "K" = "K",
  inGia: "1" | "0" = "1",
): string {
  return `/api/print/${encodeURIComponent(stt)}?loai=hd&in_gia=${inGia}&in_no_ck=${inNoCk}&db_mode=${encodeURIComponent(dbMode)}`;
}

export function peekPrintPayload(
  dbMode: PrintDbMode,
  stt: string,
  inNoCk: "C" | "K" = "K",
): any | undefined {
  const res = peek<{ success?: boolean; data?: any }>(
    printCacheKey(dbMode, stt, inNoCk),
  );
  return res?.success && res.data ? res.data : undefined;
}

export function isPrintPayloadFresh(
  dbMode: PrintDbMode,
  stt: string,
  inNoCk: "C" | "K" = "K",
): boolean {
  return isFresh(printCacheKey(dbMode, stt, inNoCk), PRINT_CACHE_TTL);
}

export async function fetchPrintPayload(
  dbMode: PrintDbMode,
  stt: string,
  inNoCk: "C" | "K" = "K",
  inGia: "1" | "0" = "1",
  force = false,
): Promise<any | null> {
  const json = await cachedFetch<{ success?: boolean; data?: any }>(
    printCacheKey(dbMode, stt, inNoCk),
    printApiUrl(dbMode, stt, inNoCk, inGia),
    { force, ttl: PRINT_CACHE_TTL },
  );
  return json?.success && json.data ? json.data : null;
}

export function prefetchPrintPayload(
  dbMode: PrintDbMode,
  stt: string,
  force = false,
): void {
  if (!stt) return;
  void fetchPrintPayload(dbMode, stt, "K", "1", force).catch(() => {});
}

export function invalidatePrintCache(stt?: string): void {
  if (!stt) {
    invalidate("print:");
    return;
  }
  invalidate(`print:sales:${stt}:`);
  invalidate(`print:warehouse:${stt}:`);
}

let logoPreloadStarted = false;

/** Nạp trước và giải mã sẵn ảnh logo bản in vào RAM trình duyệt. */
export function preloadPrintLogo(): void {
  if (logoPreloadStarted || typeof window === "undefined") return;
  logoPreloadStarted = true;
  const img = new Image();
  img.src = "/logo-elan.png";
  if (typeof img.decode === "function") {
    void img.decode().catch(() => {});
  }
}
