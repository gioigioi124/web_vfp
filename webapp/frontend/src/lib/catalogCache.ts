import { AutocompleteOption } from "../components/ui/Autocomplete";
import {
  BoPhanItem,
  ChungTuItem,
  KhoanMucItem,
  KhoItem,
  NhapXuatItem,
  SanPhamItem,
  TaiKhoanItem,
  ThueItem,
  TienTeItem,
  XeItem,
} from "../types/lookup";

import {
  collectRanked,
  normalizeSearchText,
  parseSearchQuery,
  rankByFields,
} from "./searchMatch";

/**
 * Cache RAM cho các danh mục nhỏ (kho, xe, bộ phận, tài khoản, tiền tệ,
 * chứng từ Document, nhập xuất DmNx, thuế DmThue, khoản mục, sản phẩm).
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
let nhapXuat: IndexedEntry<NhapXuatItem>[] = [];
let khoanMuc: IndexedEntry<KhoanMucItem>[] = [];
let sanPham: IndexedEntry<SanPhamItem>[] = [];
let tienTe: TienTeItem[] = [];
let thueList: ThueItem[] = [];
let chungTu: ChungTuItem[] = [];

let khoByCode = new Map<string, KhoItem>();
let xeByCode = new Map<string, XeItem>();
let xeByName = new Map<string, XeItem>();
let boPhanByCode = new Map<string, BoPhanItem>();
let taiKhoanByCode = new Map<string, TaiKhoanItem>();
let nhapXuatByCode = new Map<string, NhapXuatItem>();

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
    const [k, x, b, t, tt, nx, th, ct, km, sp] = await Promise.all([
      getJson<KhoItem>("/api/lookups/kho"),
      getJson<XeItem>("/api/lookups/xe"),
      getJson<BoPhanItem>("/api/lookups/bo-phan"),
      getJson<TaiKhoanItem>("/api/lookups/tai-khoan"),
      getJson<TienTeItem>("/api/lookups/tien-te"),
      getJson<NhapXuatItem>("/api/lookups/nhap-xuat"),
      getJson<ThueItem>("/api/lookups/thue"),
      getJson<ChungTuItem>("/api/lookups/chung-tu"),
      getJson<KhoanMucItem>("/api/lookups/khoan-muc"),
      getJson<SanPhamItem>("/api/lookups/san-pham"),
    ]);

    if (!k && !x && !b && !t && !tt && !nx && !ct) {
      loadPromise = null;
      return;
    }

    const kList = k ?? [];
    const xList = x ?? [];
    const bList = b ?? [];
    const tList = t ?? [];
    const nxList = nx ?? [];
    const kmList = km ?? [];
    const spList = sp ?? [];

    kho = buildIndexed(kList, (i) => i.ma_kho, (i) => i.ten_kho || "");
    xe = buildIndexed(xList, (i) => i.ma_xe, (i) => i.ten_xe || "");
    boPhan = buildIndexed(bList, (i) => i.ma_bp, (i) => i.ten_bp || "");
    taiKhoan = buildIndexed(tList, (i) => i.tk, (i) => i.ten_tk || "");
    nhapXuat = buildIndexed(nxList, (i) => i.ma_nx, (i) => i.ten_nx || "");
    khoanMuc = buildIndexed(kmList, (i) => i.ma_km, (i) => i.ten_km || "");
    sanPham = buildIndexed(spList, (i) => i.ma_sp, (i) => i.ten_sp || "");
    tienTe = tt ?? [];
    thueList = th ?? [];
    chungTu = ct ?? [];

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

    nhapXuatByCode = new Map();
    for (const i of nxList) {
      const key = (i.ma_nx || "").trim().toUpperCase();
      if (key) nhapXuatByCode.set(key, i);
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

export function searchKhoanMuc(q: string): AutocompleteOption[] {
  return filterIndexed(khoanMuc, q);
}

export function searchSanPham(q: string): AutocompleteOption[] {
  return filterIndexed(sanPham, q);
}

export function searchNhapXuat(q: string, maCt?: string): AutocompleteOption[] {
  const cleanCt = (maCt || "").trim().toUpperCase();
  const scoped = cleanCt
    ? nhapXuat.filter((e) => {
        const allow = (e.item.ct_nx || "").toUpperCase();
        return !allow || allow.includes(cleanCt);
      })
    : nhapXuat;
  return filterIndexed(scoped, q);
}

export function getNhapXuat(maNx: string): NhapXuatItem | null {
  const clean = (maNx || "").trim().toUpperCase();
  if (!clean) return null;
  return nhapXuatByCode.get(clean) || null;
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

export function getThueList(): ThueItem[] {
  return thueList;
}

export function getDocumentsByModule(moduleKey?: string): ChungTuItem[] {
  if (!moduleKey) return chungTu;
  return chungTu.filter((d) => d.module_key === moduleKey);
}
