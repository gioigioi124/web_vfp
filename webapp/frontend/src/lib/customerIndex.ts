import { AutocompleteOption } from "../components/ui/Autocomplete";
import { KhachHangItem } from "../types/lookup";

/**
 * Index danh mục khách hàng (5.199 dòng) trong RAM trình duyệt.
 * Tải MỘT lần khi app khởi động, lọc bằng `includes` (NFC, không bỏ dấu) -> tức thì.
 */

const chuan = (s: string | null | undefined): string =>
  (s || "").normalize("NFC").toLowerCase();

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
        _name: chuan(c.ten_dt || ""),
        _code: chuan(`${c.ma_dt} ${c.dia_chi || ""}`),
        _all: chuan(`${c.ma_dt} ${c.ten_dt || ""} ${c.dia_chi || ""}`),
      }));
      loaded = true;
    } catch {
      /* offline: giữ rỗng, component sẽ fallback server */
    }
  })();
  return loadPromise;
}

export function searchCustomers(q: string, limit = 50): AutocompleteOption[] {
  const words = chuan(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  // Ưu tiên khớp hết trong TÊN -> khớp trong MÃ/ĐỊA CHỈ -> khớp kết hợp cả tên + mã + địa chỉ.
  const nameHits: IndexedCustomer[] = [];
  const codeHits: IndexedCustomer[] = [];
  const crossHits: IndexedCustomer[] = [];
  for (const c of indexed) {
    if (words.every((w) => c._name.includes(w))) {
      nameHits.push(c);
    } else if (words.every((w) => c._code.includes(w))) {
      codeHits.push(c);
    } else if (words.every((w) => c._all.includes(w))) {
      crossHits.push(c);
    }
  }
  return [...nameHits, ...codeHits, ...crossHits].slice(0, limit).map((c) => ({
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
