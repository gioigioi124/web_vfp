import { AutocompleteOption } from "../components/ui/Autocomplete";
import { KhachHangItem } from "../types/lookup";
import {
  collectRanked,
  normalizeSearchText,
  parseSearchQuery,
  rankByFields,
} from "./searchMatch";

/**
 * Index danh mục khách hàng (5.199 dòng) trong RAM trình duyệt + cache IndexedDB (TTL 5 phút).
 * - Tra mã O(1) qua Map `byCode`.
 * - Lưu sẵn bản đã normalize vào IndexedDB để F5 mở lại tức thì không chặn main thread.
 */

interface IndexedCustomer extends KhachHangItem {
  _name: string;
  _code: string;
  _all: string;
}

const IDB_NAME = "voucher-customer-index";
const IDB_STORE = "snapshot";
const IDB_TTL_MS = 5 * 60 * 1000;

let indexed: IndexedCustomer[] = [];
let byCode = new Map<string, KhachHangItem>();
let loadPromise: Promise<void> | null = null;
let loaded = false;

function rebuildCodeMap(list: IndexedCustomer[]): void {
  const nextMap = new Map<string, KhachHangItem>();
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const key = (c.ma_dt || "").trim().toUpperCase();
    if (key) nextMap.set(key, c);
  }
  byCode = nextMap;
}

function openCustomerDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
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

async function readCustomerSnapshot(): Promise<{
  items: IndexedCustomer[];
  ts: number;
} | null> {
  const db = await openCustomerDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get("state");
      req.onsuccess = () => {
        const val = req.result;
        if (val && Array.isArray(val.items) && typeof val.ts === "number") {
          resolve(val);
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

async function writeCustomerSnapshot(items: IndexedCustomer[]): Promise<void> {
  const db = await openCustomerDb();
  if (!db) return;
  try {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put({ items, ts: Date.now() }, "state");
  } catch {
    /* bỏ qua */
  }
}

export function isCustomerIndexReady(): boolean {
  return loaded;
}

export function initCustomerIndex(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    // 1) Ưu tiên nạp ngay từ IndexedDB nếu còn tươi (< 5 phút)
    const snap = await readCustomerSnapshot();
    if (snap && snap.items.length > 0) {
      indexed = snap.items;
      rebuildCodeMap(indexed);
      loaded = true;
      if (Date.now() - snap.ts < IDB_TTL_MS) {
        return;
      }
    }

    // 2) Tải từ API và lưu lại IndexedDB
    try {
      const res = await fetch("/api/lookups/khach-hang?limit=50000");
      if (!res.ok) {
        if (!loaded) loadPromise = null;
        return;
      }
      const body = await res.json();
      const items = (body?.data ?? []) as KhachHangItem[];
      const nextIndexed: IndexedCustomer[] = new Array(items.length);
      for (let i = 0; i < items.length; i++) {
        const c = items[i];
        nextIndexed[i] = {
          ...c,
          _name: normalizeSearchText(c.ten_dt),
          _code: normalizeSearchText(`${c.dia_chi || ""} ${c.ma_dt}`),
          _all: normalizeSearchText(
            `${c.ma_dt} ${c.ten_dt || ""} ${c.dia_chi || ""}`,
          ),
        };
      }
      indexed = nextIndexed;
      rebuildCodeMap(indexed);
      loaded = true;
      void writeCustomerSnapshot(indexed);
    } catch {
      if (!loaded) loadPromise = null;
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
