export interface VatTuItem {
  ma_vt: string;
  ten_vt: string;
  dvt?: string;
  dvt_ban?: string;
  loai_vt?: string;
  tk_gv?: string;
  tk_vt?: string;
  tk_dt?: string;
  tk_ck?: string;
  he_so0?: number;
  he_so1?: number;
  he_so2?: number;
  dvt0?: string;
  dvt1?: string;
  dvt2?: string;
}

export interface KhachHangItem {
  ma_dt: string;
  ten_dt: string;
  dia_chi?: string;
  ong_ba?: string;
  ms_thue?: string;
  han_tt?: number;
  gioi_han?: number;
  toi_han?: number;
  doi_tac?: string;
  ma_bp?: string;
  ten_bp?: string;
  ma_xe?: string;
  ma_vm?: string;
}

export interface PriceItem {
  ma_vt: string;
  gia: number;
  chiet_khau: number;
  expired: boolean;
  source?: string | null;
  ngay_ct?: string | null;
  ngay_ct2?: string | null;
}

export interface KhoItem {
  ma_kho: string;
  ten_kho: string;
}

export interface ThueItem {
  ma_thue: string;
  ten_thue?: string;
  thue_gtgt: number;
  tk?: string;
}

export interface TaiKhoanItem {
  tk: string;
  ten_tk: string;
  tk_dt?: string;
}

export interface NhapXuatItem {
  ma_nx: string;
  ten_nx: string;
  dinh_khoan?: string;
  ct_nx?: string;
  tk?: string;
}

export interface ChungTuItem {
  ct_id: number;
  ma_ct: string;
  ten_ct: string;
  ma_nvu: string;
  nh_ct: string;
  ct_hd: string;
  ct_cp: string;
  no_co: string;
  tk: string;
  report: string;
  hd_ck: string;
  bp_ck: string;
  thue: string;
  module_key: string;
}

export interface XeItem {
  ma_xe: string;
  ten_xe: string;
}

export interface BoPhanItem {
  ma_bp: string;
  ten_bp: string;
}

export interface HopDongItem {
  ma_hd: string;
  ten_hd: string;
}

export interface TienTeItem {
  ma_tte: string;
  ten_tte?: string;
  ty_gia: number;
}

export interface KhoanMucItem {
  ma_km: string;
  ten_km: string;
}

export interface SanPhamItem {
  ma_sp: string;
  ten_sp: string;
  dvt?: string;
  loai_sp?: string;
}

