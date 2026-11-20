import { AutocompleteOption } from "../components/ui/Autocomplete";

/**
 * Cầu nối tới Web Worker giữ index danh mục vật tư.
 * - `init()` nạp IndexedDB + đồng bộ delta lần đầu.
 * - `search(q)` trả về tối đa 30 gợi ý (chỉ nhận kết quả của request mới nhất).
 * - `getProductByCode(ma)` tra chính xác trong RAM (tức thì) — dùng để enrich dòng.
 * - `refresh()` ép đồng bộ lại (nút "Làm mới danh mục").
 */

export interface ProductInfo {
  id: number;
  ma: string;
  ten: string;
  dvt: string;
  dvt_ban: string;
  loai_vt: string;
  tk_gv: string;
  tk_vt: string;
  tk_dt: string;
  tk_ck: string;
  tk_hbtl: string;
  he_so0: number;
  ma_kho?: string;
  k: string;
}

let worker: Worker | null = null;
let readyPromise: Promise<void> | null = null;
let ready = false;
let reqSeq = 0;
let latestSearchSeq = 0;
const pendingSearch = new Map<
  number,
  { resolve: (items: ProductInfo[]) => void; timer: number }
>();
const pendingItem = new Map<
  number,
  { resolve: (item: ProductInfo | null) => void; timer: number }
>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(
    new URL("../workers/productSearch.worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.onmessage = (e: MessageEvent) => {
    const data = e.data;
    if (!data) return;
    if (data.type === "ready" || data.type === "synced") {
      ready = true;
      return;
    }
    if (data.type === "result") {
      const entry = pendingSearch.get(data.id);
      if (entry) {
        window.clearTimeout(entry.timer);
        pendingSearch.delete(data.id);
        entry.resolve(data.items || []);
      }
      return;
    }
    if (data.type === "item") {
      const entry = pendingItem.get(data.id);
      if (entry) {
        window.clearTimeout(entry.timer);
        pendingItem.delete(data.id);
        entry.resolve(data.item ?? null);
      }
    }
  };
  return worker;
}

export function initProductIndex(): Promise<void> {
  if (readyPromise) return readyPromise;
  const w = ensureWorker();
  readyPromise = new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallbackTimer);
      w.removeEventListener("message", onReady);
      resolve();
    };
    const onReady = (e: MessageEvent) => {
      if (e.data?.type === "ready") {
        finish();
      }
    };
    const fallbackTimer = window.setTimeout(finish, 8000);
    w.addEventListener("message", onReady);
    w.postMessage({ type: "init" });
  });
  return readyPromise;
}

export function isProductIndexReady(): boolean {
  return ready;
}

export function refreshProductIndex(): void {
  ensureWorker().postMessage({ type: "sync" });
}

export function searchProducts(q: string): Promise<AutocompleteOption[]> {
  const query = (q || "").trim();
  if (!query) return Promise.resolve([]);
  if (!readyPromise) void initProductIndex();
  const w = ensureWorker();
  const id = ++reqSeq;
  latestSearchSeq = id;

  // Hủy ngay các search cũ hơn đang treo để không tốn callback & bộ nhớ
  for (const [oldId, oldEntry] of Array.from(pendingSearch.entries())) {
    if (oldId < id) {
      window.clearTimeout(oldEntry.timer);
      pendingSearch.delete(oldId);
      oldEntry.resolve([]);
    }
  }

  return new Promise<AutocompleteOption[]>((resolve) => {
    const timer = window.setTimeout(() => {
      if (pendingSearch.has(id)) {
        pendingSearch.delete(id);
        resolve([]);
      }
    }, 3000);

    pendingSearch.set(id, {
      timer,
      resolve: (items) => {
        if (id < latestSearchSeq) {
          resolve([]);
          return;
        }
        resolve(
          items.map((it) => ({
            value: it.ma,
            label: it.ma,
            hint: it.ten || "",
          })),
        );
      },
    });
    w.postMessage({ type: "search", id, q: query });
  });
}

/** Tra chính xác một mã vật tư trong RAM (tức thì). Trả null nếu không có. */
export function getProductByCode(ma: string): Promise<ProductInfo | null> {
  const code = (ma || "").trim().toUpperCase();
  if (!code) return Promise.resolve(null);
  if (!readyPromise) void initProductIndex();
  const w = ensureWorker();
  const id = ++reqSeq;
  return new Promise<ProductInfo | null>((resolve) => {
    const timer = window.setTimeout(() => {
      if (pendingItem.has(id)) {
        pendingItem.delete(id);
        resolve(null);
      }
    }, 2000);
    pendingItem.set(id, { timer, resolve });
    w.postMessage({ type: "getByCode", id, ma: code });
  });
}
