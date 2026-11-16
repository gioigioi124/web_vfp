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
  he_so0: number;
  ma_kho?: string;
  k: string;
}

let worker: Worker | null = null;
let readyPromise: Promise<void> | null = null;
let ready = false;
let reqSeq = 0;
const pendingSearch = new Map<number, (items: ProductInfo[]) => void>();
const pendingItem = new Map<number, (item: ProductInfo | null) => void>();

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
      const cb = pendingSearch.get(data.id);
      if (cb) {
        pendingSearch.delete(data.id);
        cb(data.items || []);
      }
      return;
    }
    if (data.type === "item") {
      const cb = pendingItem.get(data.id);
      if (cb) {
        pendingItem.delete(data.id);
        cb(data.item ?? null);
      }
    }
  };
  return worker;
}

export function initProductIndex(): Promise<void> {
  if (readyPromise) return readyPromise;
  const w = ensureWorker();
  readyPromise = new Promise<void>((resolve) => {
    const onReady = (e: MessageEvent) => {
      if (e.data?.type === "ready") {
        w.removeEventListener("message", onReady);
        resolve();
      }
    };
    w.addEventListener("message", onReady);
    w.postMessage({ type: "init" });
    // An toàn: không chờ vô hạn nếu worker lỗi.
    setTimeout(resolve, 8000);
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
  const w = ensureWorker();
  const id = ++reqSeq;
  return new Promise<AutocompleteOption[]>((resolve) => {
    pendingSearch.set(id, (items) => {
      resolve(
        items.map((it) => ({ value: it.ma, label: it.ma, hint: it.ten || "" })),
      );
    });
    w.postMessage({ type: "search", id, q: query });
    // Nếu worker chưa sẵn sàng, trả rỗng để component dùng fallback server.
    setTimeout(() => {
      if (pendingSearch.has(id)) {
        pendingSearch.delete(id);
        resolve([]);
      }
    }, 3000);
  });
}

/** Tra chính xác một mã vật tư trong RAM (tức thì). Trả null nếu không có. */
export function getProductByCode(ma: string): Promise<ProductInfo | null> {
  const code = (ma || "").trim().toUpperCase();
  if (!code) return Promise.resolve(null);
  const w = ensureWorker();
  const id = ++reqSeq;
  return new Promise<ProductInfo | null>((resolve) => {
    pendingItem.set(id, resolve);
    w.postMessage({ type: "getByCode", id, ma: code });
    setTimeout(() => {
      if (pendingItem.has(id)) {
        pendingItem.delete(id);
        resolve(null);
      }
    }, 2000);
  });
}
