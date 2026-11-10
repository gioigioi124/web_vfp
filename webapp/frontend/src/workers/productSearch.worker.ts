/// <reference lib="webworker" />
/**
 * Web Worker giữ index danh mục vật tư trong RAM và tìm kiếm tức thì.
 *
 * - Index: { id, ma (IN HOA, NFC), k (mã + tên, chữ thường, NFC) }, sắp theo `ma`.
 * - Gõ mã: tìm nhị phân (lower bound) rồi lấy tối đa LIMIT dòng liên tiếp khớp đầu mã.
 * - Gõ tên: quét `includes` mọi từ, dừng ngay khi đủ LIMIT kết quả.
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
  k: string;
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
  for (const it of items) byCode.set(it.ma, it.id);
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

  // 2) Khớp mọi từ trong mã + tên.
  if (out.length < LIMIT) {
    const words = chuan(q).split(/\s+/).filter(Boolean);
    for (const it of items) {
      if (seen.has(it.id)) continue;
      if (words.every((w) => it.k.includes(w))) {
        out.push(it);
        if (out.length === LIMIT) break;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- IndexedDB
function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveToIdb() {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(
      { items: [...map.values()], since, epoch },
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
          map = new Map(state.items.map((it: IndexItem) => [it.id, it]));
          since = state.since || 0;
          epoch = state.epoch || 0;
          rebuild();
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
async function sync(): Promise<void> {
  const res = await fetch(
    `/api/products/changes?since=${since}&epoch_c=${epoch}`,
  );
  if (!res.ok) return;
  const body = await res.json();
  const data = body?.data;
  if (!data) return;

  if (data.full) {
    map = new Map();
    byCode = new Map();
  }
  if (!data.full && (!data.items || data.items.length === 0)) {
    since = data.max_v ?? since;
    epoch = data.epoch ?? epoch;
    return;
  }
  for (const it of data.items as Array<IndexItem & { del?: boolean }>) {
    if (it.del) map.delete(it.id);
    else map.set(it.id, it);
  }
  since = data.max_v ?? since;
  epoch = data.epoch ?? epoch;
  rebuild();
  void saveToIdb();
}

// ---------------------------------------------------------------- messaging
const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (e: MessageEvent) => {
  const data = e.data;
  if (!data) return;

  if (data.type === "init") {
    await loadFromIdb();
    try {
      await sync();
    } catch {
      /* offline: dùng dữ liệu IndexedDB nếu có */
    }
    ctx.postMessage({ type: "ready", count: map.size });
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
