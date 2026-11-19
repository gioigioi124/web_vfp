import { AutocompleteOption } from "../components/ui/Autocomplete";
import { KhachHangItem } from "../types/lookup";
import {
  collectRanked,
  normalizeSearchText,
  parseSearchQuery,
  rankByFields,
} from "./searchMatch";

/**
 * Index danh mục khách hàng (~5.199 dòng) trong RAM trình duyệt + cache IndexedDB.
 * Cơ chế SWR + đồng bộ delta tương tự Web Worker của hàng hóa:
 * - Bước 1 (0ms): đọc snapshot đã chuẩn hóa từ IndexedDB → `initCustomerIndex()` trả về ngay
 *   lập tức để người dùng gõ tìm kiếm tức thì mà không bị chặn bởi TTL 5 phút hay chờ mạng.
 * - Bước 2 (ngầm): gọi `/api/customers/changes?since=...&epoch_c=...`:
 *   + Không đổi → nhận 304 Not Modified hoặc delta rỗng (<1ms).
 *   + Có thêm/sửa/xóa → chỉ vá phần delta vào `map`, build lại `indexed` & `byCode`, lưu IndexedDB.
 * - Tra mã O(1) qua Map `byCode`.
 */

interface IndexedCustomer extends KhachHangItem {
  _name: string;
  _code: string;
  _all: string;
}

interface CustomerIdbState {
  items: IndexedCustomer[];
  since: number;
  epoch: number;
  preNormalized: boolean;
}

const IDB_NAME = "voucher-customer-index";
const IDB_STORE = "snapshot";

let customerMap = new Map<string, IndexedCustomer>();
let indexed: IndexedCustomer[] = [];
let byCode = new Map<string, KhachHangItem>();
let since = 0;
let epoch = 0;
let loadPromise: Promise<void> | null = null;
let syncPromise: Promise<boolean> | null = null;
let loaded = false;

function normalizeCustomer(c: KhachHangItem): IndexedCustomer {
  return {
    ...c,
    _name: normalizeSearchText(c.ten_dt),
    _code: normalizeSearchText(`${c.dia_chi || ""} ${c.ma_dt}`),
    _all: normalizeSearchText(`${c.ma_dt} ${c.ten_dt || ""} ${c.dia_chi || ""}`),
  };
}

function rebuildFromMap(): void {
  const nextList = Array.from(customerMap.values()).sort((a, b) =>
    a.ma_dt < b.ma_dt ? -1 : a.ma_dt > b.ma_dt ? 1 : 0,
  );
  const nextByCode = new Map<string, KhachHangItem>();
  for (let i = 0; i < nextList.length; i++) {
    const c = nextList[i];
    const key = (c.ma_dt || "").trim().toUpperCase();
    if (key) nextByCode.set(key, c);
  }
  indexed = nextList;
  byCode = nextByCode;
}

function hydrateFromPreNormalized(items: IndexedCustomer[]): void {
  const nextMap = new Map<string, IndexedCustomer>();
  const nextByCode = new Map<string, KhachHangItem>();
  for (let i = 0; i < items.length; i++) {
    const c = items[i];
    const key = (c.ma_dt || "").trim().toUpperCase();
    if (!key) continue;
    nextMap.set(key, c);
    nextByCode.set(key, c);
  }
  customerMap = nextMap;
  indexed = items;
  byCode = nextByCode;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openCustomerDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
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

async function readCustomerSnapshot(): Promise<CustomerIdbState | null> {
  const db = await openCustomerDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get("state");
      req.onsuccess = () => {
        const val = req.result;
        if (val && Array.isArray(val.items) && val.items.length > 0) {
          resolve({
            items: val.items as IndexedCustomer[],
            since: typeof val.since === "number" ? val.since : 0,
            epoch: typeof val.epoch === "number" ? val.epoch : 0,
            preNormalized: Boolean(val.preNormalized),
          });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeCustomerSnapshot(): Promise<void> {
  const db = await openCustomerDb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(
      { items: indexed, since, epoch, preNormalized: true },
      "state",
    );
  } catch {
    /* bỏ qua */
  }
}

async function syncCustomers(): Promise<boolean> {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    try {
      const res = await fetch(
        `/api/customers/changes?since=${since}&epoch_c=${epoch}`,
      );
      if (!res.ok) return false;
      const body = await res.json();
      const data = body?.data;
      if (!data) return false;

      if (data.full) {
        customerMap = new Map();
      }
      const rawItems = (data.items ?? []) as Array<
        KhachHangItem & { del?: boolean }
      >;
      if (!data.full && rawItems.length === 0) {
        since = data.max_v ?? since;
        epoch = data.epoch ?? epoch;
        return false;
      }

      for (let i = 0; i < rawItems.length; i++) {
        const it = rawItems[i];
        const key = (it.ma_dt || "").trim().toUpperCase();
        if (!key) continue;
        if (it.del) {
          customerMap.delete(key);
        } else {
          customerMap.set(key, normalizeCustomer(it));
        }
      }

      since = data.max_v ?? since;
      epoch = data.epoch ?? epoch;
      rebuildFromMap();
      loaded = true;
      void writeCustomerSnapshot();
      return true;
    } catch {
      return false;
    } finally {
      syncPromise = null;
    }
  })();
  return syncPromise;
}

export function isCustomerIndexReady(): boolean {
  return loaded;
}

export function refreshCustomerIndex(): Promise<boolean> {
  return syncCustomers();
}

export function initCustomerIndex(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    // 1) Ưu tiên nạp ngay từ IndexedDB (0ms, không chặn mạng dù mở lại sau nhiều giờ)
    const snap = await readCustomerSnapshot();
    if (snap && snap.items.length > 0) {
      const first = snap.items[0];
      const hasPreNormalized =
        snap.preNormalized &&
        typeof first._name === "string" &&
        typeof first._code === "string" &&
        typeof first._all === "string";

      since = snap.since;
      epoch = snap.epoch;

      if (hasPreNormalized) {
        hydrateFromPreNormalized(snap.items);
      } else {
        const nextMap = new Map<string, IndexedCustomer>();
        for (let i = 0; i < snap.items.length; i++) {
          const it = snap.items[i];
          const key = (it.ma_dt || "").trim().toUpperCase();
          if (!key) continue;
          nextMap.set(
            key,
            typeof it._name === "string" ? it : normalizeCustomer(it),
          );
        }
        customerMap = nextMap;
        rebuildFromMap();
      }
      loaded = true;
      // Đồng bộ delta âm thầm ở nền (không chặn người dùng tìm kiếm)
      void syncCustomers();
      return;
    }

    // 2) Chưa có dữ liệu IndexedDB (mở lần đầu): tải full gzip qua /api/customers/changes
    const ok = await syncCustomers();
    if (!ok && !loaded) {
      loadPromise = null;
    }
  })();
  return loadPromise;
}

export function searchCustomers(q: string, limit = 50): AutocompleteOption[] {
  const { phrase, words } = parseSearchQuery(q);
  if (!words.length) return [];
  return collectRanked(indexed, limit, (c) =>
    rankByFields(c._name, c._code, c._all, phrase, words),
  ).map((c) => ({
    value: c.ma_dt,
    label: c.ma_dt,
    hint: c.ten_dt,
    extra: c.dia_chi || "",
  }));
}

export function getCustomer(maDt: string): KhachHangItem | null {
  const clean = (maDt || "").trim().toUpperCase();
  if (!clean) return null;
  return byCode.get(clean) || null;
}
