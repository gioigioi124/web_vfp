import { AutocompleteOption } from "../components/ui/Autocomplete";
import { KhachHangItem } from "../types/lookup";
import {
  collectRanked,
  normalizeSearchText,
  parseSearchQuery,
  rankByFields,
} from "./searchMatch";

/**
 * Index danh mục khách hàng (5.199 dòng) trong RAM trình duyệt.
 * Tải MỘT lần khi app khởi động, ưu tiên khối liền nhau trong Tên/Địa chỉ trước từ rời.
 */

interface IndexedCustomer extends KhachHangItem {
  _name: string;
  _code: string;
  _all: string;
}

let indexed: IndexedCustomer[] = [];
let loadPromise: Promise<void> | null = null;
let loaded = false;

export function isCustomerIndexReady(): boolean {
  return loaded;
}

export function initCustomerIndex(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const res = await fetch("/api/lookups/khach-hang?limit=50000");
      if (!res.ok) return;
      const body = await res.json();
      const items = (body?.data ?? []) as KhachHangItem[];
      indexed = items.map((c) => ({
        ...c,
        _name: normalizeSearchText(c.ten_dt),
        _code: normalizeSearchText(`${c.dia_chi || ""} ${c.ma_dt}`),
        _all: normalizeSearchText(
          `${c.ma_dt} ${c.ten_dt || ""} ${c.dia_chi || ""}`,
        ),
      }));
      loaded = true;
    } catch {
      /* offline: giữ rỗng, component sẽ fallback server */
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
  return (
    indexed.find((c) => (c.ma_dt || "").trim().toUpperCase() === clean) || null
  );
}
