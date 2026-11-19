/// <reference lib="webworker" />
import {
  collectRanked,
  normalizeSearchText,
  parseSearchQuery,
  rankByFields,
} from "../lib/searchMatch";

/**
 * Web Worker giữ index danh mục vật tư trong RAM và tìm kiếm tức thì.
 *
 * - Index: { id, ma (IN HOA, NFC), k (mã + tên, chữ thường, NFC) }, sắp theo `ma`.
 * - Gõ mã: tìm nhị phân (lower bound) rồi lấy tối đa LIMIT dòng liên tiếp khớp đầu mã.
 * - Gõ tên: ưu tiên khối liền nhau trong tên/mã trước từ rời, tới LIMIT kết quả.
 * - Đồng bộ delta qua `/api/products/changes`; lưu/đọc IndexedDB để khởi động nhanh.
 */

const LIMIT = 30;
const IDB_NAME = "voucher-product-index";
const IDB_STORE = "snapshot";

interface IndexItem {
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
  _ten?: string;
  _ma?: string;
  _k?: string;
}

let map = new Map<number, IndexItem>();
let byCode = new Map<string, number>();
let items: IndexItem[] = [];
let since = 0;
let epoch = 0;

const chuan = (s: string | null | undefined): string =>
  (s || "").normalize("NFC").toLowerCase();

function rebuild() {
  items = [...map.values()].sort((a, b) =>
    a.ma < b.ma ? -1 : a.ma > b.ma ? 1 : 0,
  );
  byCode = new Map();
  for (const it of items) {
    it._ten = normalizeSearchText(it.ten);
    it._ma = normalizeSearchText(it.ma);
    it._k = normalizeSearchText(it.k || `${it.ma} ${it.ten || ""}`);
    byCode.set(it.ma, it.id);
  }
}

function lowerBound(prefix: string): number {
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (items[mid].ma < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function search(q: string): IndexItem[] {
  const out: IndexItem[] = [];
  const seen = new Set<number>();
  const P = chuan(q).trim().toUpperCase();
  if (!P) return out;

  // 1) Khớp đầu mã (tìm nhị phân).
  for (
    let i = lowerBound(P);
    i < items.length && items[i].ma.startsWith(P) && out.length < LIMIT;
    i++
  ) {
    out.push(items[i]);
    seen.add(items[i].id);
  }

  // 2) Khớp ưu tiên khối liền nhau trong tên/mã -> đủ các từ rời.
  if (out.length < LIMIT) {
    const { phrase, words } = parseSearchQuery(q);
    const ranked = collectRanked(items, LIMIT - out.length, (it) => {
      if (seen.has(it.id)) return Infinity;
      return rankByFields(
        it._ten ?? normalizeSearchText(it.ten),
        it._ma ?? normalizeSearchText(it.ma),
        it._k ?? normalizeSearchText(it.k),
        phrase,
        words,
      );
    });
    out.push(...ranked);
  }
  return out;
}

// ---------------------------------------------------------------- IndexedDB
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });
  return dbPromise;
}

async function saveToIdb() {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, "readwrite");
    // Lưu trực tiếp `items` đã sắp xếp và đã có _ten/_ma/_k để lần mở sau không phải sort & normalize lại
    tx.objectStore(IDB_STORE).put(
      { items, since, epoch, preSorted: true },
      "state",
    );
  } catch {
    /* bỏ qua */
  }
}

async function loadFromIdb(): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get("state");
      req.onsuccess = () => {
        const state = req.result;
        if (state && Array.isArray(state.items)) {
          const loadedItems = state.items as IndexItem[];
          since = state.since || 0;
          epoch = state.epoch || 0;
          const first = loadedItems[0];
          const isPreNormalized =
            Boolean(state.preSorted) &&
            (!first ||
              (typeof first._ten === "string" &&
                typeof first._ma === "string" &&
                typeof first._k === "string"));

          if (isPreNormalized) {
            items = loadedItems;
            map = new Map();
            byCode = new Map();
            for (let i = 0; i < items.length; i++) {
              const it = items[i];
              map.set(it.id, it);
              byCode.set(it.ma, it.id);
            }
          } else {
            map = new Map(loadedItems.map((it) => [it.id, it]));
            rebuild();
          }
          resolve(true);
        } else {
          resolve(false);
        }
      };
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

// -------------------------------------------------------------------- sync
let syncPromise: Promise<boolean> | null = null;

async function sync(): Promise<boolean> {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    try {
      const res = await fetch(
        `/api/products/changes?since=${since}&epoch_c=${epoch}`,
      );
      if (!res.ok) return false;
      const body = await res.json();
      const data = body?.data;
      if (!data) return false;

      if (data.full) {
        map = new Map();
        byCode = new Map();
      }
      if (!data.full && (!data.items || data.items.length === 0)) {
        since = data.max_v ?? since;
        epoch = data.epoch ?? epoch;
        return false;
      }
      for (const it of data.items as Array<IndexItem & { del?: boolean }>) {
        if (it.del) map.delete(it.id);
        else map.set(it.id, it);
      }
      since = data.max_v ?? since;
      epoch = data.epoch ?? epoch;
      rebuild();
      void saveToIdb();
      return true;
    } finally {
      syncPromise = null;
    }
  })();
  return syncPromise;
}

// ---------------------------------------------------------------- messaging
const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent) => {
  const data = e.data;
  if (!data) return;

  if (data.type === "init") {
    const loaded = await loadFromIdb();
    const hasWarehouseField =
      items.length > 0 && Object.prototype.hasOwnProperty.call(items[0], "ma_kho");
    let notifiedReady = false;
    if (loaded && map.size > 0 && hasWarehouseField) {
      // Báo sẵn sàng ngay lập tức từ IndexedDB để người dùng tra cứu không cần chờ mạng.
      ctx.postMessage({ type: "ready", count: map.size });
      notifiedReady = true;
    }
    let changed = false;
    try {
      changed = await sync();
    } catch {
      /* offline: dùng dữ liệu IndexedDB nếu có */
    }
    if (!notifiedReady || changed) {
      ctx.postMessage({ type: "ready", count: map.size });
    }
    return;
  }

  if (data.type === "sync") {
    try {
      await sync();
    } catch {
      /* bỏ qua */
    }
    ctx.postMessage({ type: "synced", count: map.size });
    return;
  }

  if (data.type === "search") {
    ctx.postMessage({ type: "result", id: data.id, items: search(data.q) });
    return;
  }

  if (data.type === "getByCode") {
    const code = chuan(data.ma).trim().toUpperCase();
    const found = code ? map.get(byCode.get(code) ?? -1) : undefined;
    ctx.postMessage({ type: "item", id: data.id, item: found ?? null });
    return;
  }
};

export {};
