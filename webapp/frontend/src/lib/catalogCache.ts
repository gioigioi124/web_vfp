import { AutocompleteOption } from "../components/ui/Autocomplete";
import {
  KhoItem,
  XeItem,
  BoPhanItem,
  TaiKhoanItem,
  TienTeItem,
} from "../types/lookup";

/**
 * Cache RAM cho các danh mục NHỎ (kho, xe, bộ phận, tài khoản, tiền tệ).
 * Tải MỘT lần khi mở form -> gợi ý/tra cứu tức thì, không chờ mạng mỗi lần gõ.
 */

const chuan = (s: string | null | undefined): string =>
  (s || "").normalize("NFC").toLowerCase();

let kho: KhoItem[] = [];
let xe: XeItem[] = [];
let boPhan: BoPhanItem[] = [];
let taiKhoan: TaiKhoanItem[] = [];
let tienTe: TienTeItem[] = [];
let loaded = false;
let loadPromise: Promise<void> | null = null;

async function getJson<T>(url: string): Promise<T[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const body = await res.json();
    return (body?.data ?? []) as T[];
  } catch {
    return [];
  }
}

export function initCatalogCache(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const [k, x, b, t, tt] = await Promise.all([
      getJson<KhoItem>("/api/lookups/kho"),
      getJson<XeItem>("/api/lookups/xe"),
      getJson<BoPhanItem>("/api/lookups/bo-phan"),
      getJson<TaiKhoanItem>("/api/lookups/tai-khoan"),
      getJson<TienTeItem>("/api/lookups/tien-te"),
    ]);
    kho = k;
    xe = x;
    boPhan = b;
    taiKhoan = t;
    tienTe = tt;
    loaded = true;
  })();
  return loadPromise;
}

export function isCatalogReady(): boolean {
  return loaded;
}

function filterOptions<T>(
  items: T[],
  q: string,
  codeOf: (i: T) => string,
  nameOf: (i: T) => string,
  limit = 30,
): AutocompleteOption[] {
  const words = chuan(q).split(/\s+/).filter(Boolean);
  const out: AutocompleteOption[] = [];
  for (const it of items) {
    const hay = chuan(`${codeOf(it)} ${nameOf(it)}`);
    if (words.every((w) => hay.includes(w))) {
      out.push({ value: codeOf(it), label: codeOf(it), hint: nameOf(it) });
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function searchKho(q: string): AutocompleteOption[] {
  return filterOptions(
    kho,
    q,
    (i) => i.ma_kho,
    (i) => i.ten_kho || "",
  );
}

export function getKho(maKho: string): KhoItem | null {
  const clean = (maKho || "").trim().toUpperCase();
  if (!clean) return null;
  return (
    kho.find((i) => (i.ma_kho || "").trim().toUpperCase() === clean) || null
  );
}

export function searchXe(q: string): AutocompleteOption[] {
  return filterOptions(
    xe,
    q,
    (i) => i.ma_xe,
    (i) => i.ten_xe || "",
  );
}

export function searchBoPhan(q: string): AutocompleteOption[] {
  return filterOptions(
    boPhan,
    q,
    (i) => i.ma_bp,
    (i) => i.ten_bp || "",
  );
}

export function searchTaiKhoan(q: string): AutocompleteOption[] {
  return filterOptions(
    taiKhoan,
    q,
    (i) => i.tk,
    (i) => i.ten_tk || "",
  );
}

export function getXe(maXe: string): XeItem | null {
  const clean = (maXe || "").trim().toUpperCase();
  if (!clean) return null;
  return (
    xe.find(
      (i) =>
        (i.ma_xe || "").trim().toUpperCase() === clean ||
        (i.ten_xe || "").trim().toUpperCase() === clean,
    ) || null
  );
}

export function getBoPhan(maBp: string): BoPhanItem | null {
  const clean = (maBp || "").trim().toUpperCase();
  if (!clean) return null;
  return (
    boPhan.find((i) => (i.ma_bp || "").trim().toUpperCase() === clean) || null
  );
}

export function getTienTeList(): TienTeItem[] {
  return tienTe;
}
