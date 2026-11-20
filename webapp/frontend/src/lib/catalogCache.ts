import { AutocompleteOption } from "../components/ui/Autocomplete";
import {
  KhoItem,
  XeItem,
  BoPhanItem,
  TaiKhoanItem,
  TienTeItem,
} from "../types/lookup";

import {
  collectRanked,
  normalizeSearchText,
  parseSearchQuery,
  rankByFields,
} from "./searchMatch";

/**
 * Cache RAM cho các danh mục NHỎ (kho, xe, bộ phận, tài khoản, tiền tệ).
 * Tải MỘT lần khi mở form -> gợi ý/tra cứu tức thì, không chờ mạng mỗi lần gõ.
 */

interface IndexedEntry<T> {
  item: T;
  code: string;
  name: string;
  _code: string;
  _name: string;
  _all: string;
}

let kho: IndexedEntry<KhoItem>[] = [];
let xe: IndexedEntry<XeItem>[] = [];
let boPhan: IndexedEntry<BoPhanItem>[] = [];
let taiKhoan: IndexedEntry<TaiKhoanItem>[] = [];
let tienTe: TienTeItem[] = [];

let khoByCode = new Map<string, KhoItem>();
let xeByCode = new Map<string, XeItem>();
let xeByName = new Map<string, XeItem>();
let boPhanByCode = new Map<string, BoPhanItem>();
let taiKhoanByCode = new Map<string, TaiKhoanItem>();

let loaded = false;
let loadPromise: Promise<void> | null = null;

function buildIndexed<T>(
  items: T[],
  codeOf: (i: T) => string,
  nameOf: (i: T) => string,
): IndexedEntry<T>[] {
  return items.map((item) => {
    const code = codeOf(item) || "";
    const name = nameOf(item) || "";
    const _code = normalizeSearchText(code);
    const _name = normalizeSearchText(name);
    return {
      item,
      code,
      name,
      _code,
      _name,
      _all: `${_code} ${_name}`.trim(),
    };
  });
}

async function getJson<T>(url: string): Promise<T[] | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const body = await res.json();
    return (body?.data ?? []) as T[];
  } catch {
    return null;
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

    if (!k && !x && !b && !t && !tt) {
      // Mất mạng hoàn toàn -> reset để lần gọi sau thử lại
      loadPromise = null;
      return;
    }

    const kList = k ?? [];
    const xList = x ?? [];
    const bList = b ?? [];
    const tList = t ?? [];
    const ttList = tt ?? [];

    kho = buildIndexed(kList, (i) => i.ma_kho, (i) => i.ten_kho || "");
    xe = buildIndexed(xList, (i) => i.ma_xe, (i) => i.ten_xe || "");
    boPhan = buildIndexed(bList, (i) => i.ma_bp, (i) => i.ten_bp || "");
    taiKhoan = buildIndexed(tList, (i) => i.tk, (i) => i.ten_tk || "");
    tienTe = ttList;

    khoByCode = new Map();
    for (const i of kList) {
      const key = (i.ma_kho || "").trim().toUpperCase();
      if (key) khoByCode.set(key, i);
    }

    xeByCode = new Map();
    xeByName = new Map();
    for (const i of xList) {
      const cKey = (i.ma_xe || "").trim().toUpperCase();
      const nKey = (i.ten_xe || "").trim().toUpperCase();
      if (cKey) xeByCode.set(cKey, i);
      if (nKey) xeByName.set(nKey, i);
    }

    boPhanByCode = new Map();
    for (const i of bList) {
      const key = (i.ma_bp || "").trim().toUpperCase();
      if (key) boPhanByCode.set(key, i);
    }

    taiKhoanByCode = new Map();
    for (const i of tList) {
      const key = (i.tk || "").trim().toUpperCase();
      if (key) taiKhoanByCode.set(key, i);
    }

    loaded = true;
  })();
  return loadPromise;
}

export function isCatalogReady(): boolean {
  return loaded;
}

function filterIndexed<T>(
  entries: IndexedEntry<T>[],
  q: string,
  limit = 30,
): AutocompleteOption[] {
  const { phrase, words } = parseSearchQuery(q);
  if (!words.length) {
    return entries.slice(0, limit).map((e) => ({
      value: e.code,
      label: e.code,
      hint: e.name,
    }));
  }
  return collectRanked(entries, limit, (e) =>
    rankByFields(e._name, e._code, e._all, phrase, words),
  ).map((e) => ({
    value: e.code,
    label: e.code,
    hint: e.name,
  }));
}

export function searchKho(q: string): AutocompleteOption[] {
  return filterIndexed(kho, q);
}

export function getKho(maKho: string): KhoItem | null {
  const clean = (maKho || "").trim().toUpperCase();
  if (!clean) return null;
  return khoByCode.get(clean) || null;
}

export function searchXe(q: string): AutocompleteOption[] {
  return filterIndexed(xe, q);
}

export function searchBoPhan(q: string): AutocompleteOption[] {
  return filterIndexed(boPhan, q);
}

export function searchTaiKhoan(q: string): AutocompleteOption[] {
  return filterIndexed(taiKhoan, q);
}

export function getTaiKhoan(tk: string): TaiKhoanItem | null {
  const clean = (tk || "").trim().toUpperCase();
  if (!clean) return null;
  return taiKhoanByCode.get(clean) || null;
}

export function getXe(maXe: string): XeItem | null {
  const clean = (maXe || "").trim().toUpperCase();
  if (!clean) return null;
  return xeByCode.get(clean) || xeByName.get(clean) || null;
}

export function getBoPhan(maBp: string): BoPhanItem | null {
  const clean = (maBp || "").trim().toUpperCase();
  if (!clean) return null;
  return boPhanByCode.get(clean) || null;
}

export function getTienTeList(): TienTeItem[] {
  return tienTe;
}
