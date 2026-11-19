import { AutocompleteOption } from "../components/ui/Autocomplete";
import {
  VatTuItem,
  KhachHangItem,
  KhoItem,
  ThueItem,
  TaiKhoanItem,
  NhapXuatItem,
  XeItem,
  BoPhanItem,
  HopDongItem,
  TienTeItem,
  PriceItem,
} from "../types/lookup";
import { ProductInfo } from "./productIndex";
import { cachedFetch } from "./apiCache";
import { isCatalogReady, searchKho } from "./catalogCache";

/**
 * Client cho các endpoint danh mục `/api/lookups/*` (plan §6.4).
 * Mọi hàm chỉ ĐỌC dữ liệu (GET), dùng cho autocomplete & dropdown.
 */

const LOOKUP_TTL_MS = 300_000;
const PRICE_TTL_MS = 60_000;

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T[]> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Lookup failed: ${res.status}`);
  const data = await res.json();
  return (data?.data ?? []) as T[];
}

/** Mã/tên vật tư → gợi ý autocomplete. */
export async function fetchVatTuOptions(
  query: string,
): Promise<AutocompleteOption[]> {
  const items = await getJson<VatTuItem>(
    `/api/lookups/vat-tu?q=${encodeURIComponent(query)}`,
  );
  return items.map((i) => ({
    value: i.ma_vt,
    label: i.ma_vt,
    hint: i.ten_vt,
  }));
}

/** Mã/tên khách hàng → gợi ý autocomplete. */
export async function fetchKhachHangOptions(
  query: string,
): Promise<AutocompleteOption[]> {
  const items = await getJson<KhachHangItem>(
    `/api/lookups/khach-hang?q=${encodeURIComponent(query)}`,
  );
  return items.map((i) => ({
    value: i.ma_dt,
    label: i.ma_dt,
    hint: i.ten_dt,
  }));
}

/** Mã/tên kho → gợi ý autocomplete (ưu tiên RAM catalogCache, tránh gọi mạng lặp lại). */
export async function fetchKhoOptions(
  query: string,
): Promise<AutocompleteOption[]> {
  if (isCatalogReady()) {
    return searchKho(query);
  }
  const body = await cachedFetch<{ data?: KhoItem[] }>(
    "lookup:kho",
    "/api/lookups/kho",
    { ttl: LOOKUP_TTL_MS },
  );
  const items = body?.data ?? [];
  const q = query.trim().toLowerCase();
  return items
    .filter(
      (i) =>
        !q ||
        i.ma_kho.toLowerCase().includes(q) ||
        (i.ten_kho || "").toLowerCase().includes(q),
    )
    .map((i) => ({ value: i.ma_kho, label: i.ma_kho, hint: i.ten_kho }));
}

/** Số/tên tài khoản → gợi ý autocomplete. */
export async function fetchTaiKhoanOptions(
  query: string,
): Promise<AutocompleteOption[]> {
  const items = await getJson<TaiKhoanItem>(
    `/api/lookups/tai-khoan?q=${encodeURIComponent(query)}`,
  );
  return items.map((i) => ({ value: i.tk, label: i.tk, hint: i.ten_tk }));
}

/** Mã/tên hợp đồng → gợi ý autocomplete. */
export async function fetchHopDongOptions(
  query: string,
): Promise<AutocompleteOption[]> {
  const items = await getJson<HopDongItem>(
    `/api/lookups/hop-dong?q=${encodeURIComponent(query)}`,
  );
  return items.map((i) => ({ value: i.ma_hd, label: i.ma_hd, hint: i.ten_hd }));
}

/** Mã xe / Biển số → gợi ý autocomplete. */
export async function fetchXeOptions(
  query: string,
): Promise<AutocompleteOption[]> {
  const items = await getJson<XeItem>(
    `/api/lookups/xe?q=${encodeURIComponent(query)}`,
  );
  const q = query.trim().toLowerCase();
  return items
    .filter(
      (i) =>
        !q ||
        i.ma_xe.toLowerCase().includes(q) ||
        (i.ten_xe || "").toLowerCase().includes(q),
    )
    .map((i) => ({ value: i.ma_xe, label: i.ma_xe, hint: i.ten_xe }));
}

/** Các danh mục dạng dropdown (tải 1 lần). */
export async function fetchKhoList(): Promise<KhoItem[]> {
  return getJson<KhoItem>("/api/lookups/kho");
}
export async function fetchThueList(): Promise<ThueItem[]> {
  return getJson<ThueItem>("/api/lookups/thue");
}
export async function fetchNhapXuatList(): Promise<NhapXuatItem[]> {
  return getJson<NhapXuatItem>("/api/lookups/nhap-xuat");
}
export async function fetchXeList(): Promise<XeItem[]> {
  return getJson<XeItem>("/api/lookups/xe");
}
export async function fetchBoPhanList(): Promise<BoPhanItem[]> {
  return getJson<BoPhanItem>("/api/lookups/bo-phan");
}
export async function fetchTienTeList(): Promise<TienTeItem[]> {
  return getJson<TienTeItem>("/api/lookups/tien-te");
}

export async function lookupKhachHang(
  maDt: string,
): Promise<KhachHangItem | null> {
  if (!maDt) return null;
  try {
    const clean = maDt.trim().toUpperCase();
    const items = await getJson<KhachHangItem>(
      `/api/lookups/khach-hang?q=${encodeURIComponent(clean)}`,
    );
    const found = items.find((i) => i.ma_dt.trim().toUpperCase() === clean);
    return found || (items.length === 1 ? items[0] : null);
  } catch {
    return null;
  }
}

export async function lookupVatTu(maVt: string): Promise<VatTuItem | null> {
  if (!maVt) return null;
  try {
    const clean = maVt.trim().toUpperCase();
    const items = await getJson<VatTuItem>(
      `/api/lookups/vat-tu?q=${encodeURIComponent(clean)}`,
    );
    const found = items.find((i) => i.ma_vt.trim().toUpperCase() === clean);
    return found || null;
  } catch {
    return null;
  }
}

export async function lookupBoPhan(maBp: string): Promise<BoPhanItem | null> {
  if (!maBp) return null;
  try {
    const clean = maBp.trim().toUpperCase();
    const items = await fetchBoPhanList();
    return items.find((i) => i.ma_bp.trim().toUpperCase() === clean) || null;
  } catch {
    return null;
  }
}

export async function lookupXe(maXe: string): Promise<XeItem | null> {
  if (!maXe) return null;
  try {
    const clean = maXe.trim().toUpperCase();
    const items = await getJson<XeItem>(
      `/api/lookups/xe?q=${encodeURIComponent(clean)}`,
    );
    return (
      items.find(
        (i) =>
          i.ma_xe.trim().toUpperCase() === clean ||
          (i.ten_xe || "").trim().toUpperCase() === clean,
      ) || null
    );
  } catch {
    return null;
  }
}

/** Tra đơn giá bán & chiết khấu từ bảng giá VP_2014 (BG/BG0) cho một mã vật tư. */
export async function fetchPrice(
  maVt: string,
  maDt: string,
  ngayCt: string,
): Promise<PriceItem | null> {
  const code = (maVt || "").trim().toUpperCase();
  if (!code || !ngayCt) return null;
  const dt = (maDt || "").trim().toUpperCase();
  try {
    const body = await cachedFetch<{ data?: PriceItem | null }>(
      `price:${dt}:${ngayCt}:${code}`,
      `/api/prices/${encodeURIComponent(code)}?ma_dt=${encodeURIComponent(
        dt,
      )}&ngay_ct=${encodeURIComponent(ngayCt)}`,
      { ttl: PRICE_TTL_MS },
    );
    return (body?.data ?? null) as PriceItem | null;
  } catch {
    return null;
  }
}

/** Tra giá cho nhiều mã vật tư trong một lượt (dùng khi đổ dòng từ phiếu xuất). */
export async function fetchPriceBatch(
  maDt: string,
  maVtList: string[],
  ngayCt: string,
): Promise<Record<string, PriceItem>> {
  const codes = (maVtList || [])
    .map((v) => (v || "").trim().toUpperCase())
    .filter(Boolean);
  if (!codes.length || !ngayCt) return {};
  try {
    const res = await fetch("/api/prices/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ma_dt: maDt || "",
        ngay_ct: ngayCt,
        ma_vt_list: codes,
      }),
    });
    if (!res.ok) return {};
    const body = await res.json();
    const items = (body?.data?.items ?? []) as PriceItem[];
    const map: Record<string, PriceItem> = {};
    for (const it of items) map[(it.ma_vt || "").toUpperCase()] = it;
    return map;
  } catch {
    return {};
  }
}

/** Tra chính xác một mã vật tư (hàng mới chưa kịp có trong index). */
export async function fetchProductByCode(
  maVt: string,
): Promise<ProductInfo | null> {
  const code = (maVt || "").trim().toUpperCase();
  if (!code) return null;
  try {
    const res = await fetch(
      `/api/products/by-code/${encodeURIComponent(code)}`,
    );
    if (!res.ok) return null;
    const body = await res.json();
    return (body?.data ?? null) as ProductInfo | null;
  } catch {
    return null;
  }
}

/** Tìm vật tư phía server (phương án dự phòng khi index client chưa sẵn sàng). */
export async function fetchVatTuServerSearch(
  query: string,
): Promise<AutocompleteOption[]> {
  const q = (query || "").trim();
  if (!q) return [];
  try {
    const res = await fetch(
      `/api/products/search?q=${encodeURIComponent(q)}&limit=30`,
    );
    if (!res.ok) return [];
    const body = await res.json();
    const items = (body?.data ?? []) as Array<{ ma: string; ten: string }>;
    return items.map((i) => ({ value: i.ma, label: i.ma, hint: i.ten }));
  } catch {
    return [];
  }
}
