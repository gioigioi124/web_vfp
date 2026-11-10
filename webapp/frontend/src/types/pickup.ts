export interface PickupItem {
  stt0: string;
  stt?: string;
  ma_vt: string;
  ten_vt?: string;
  dvt?: string;
  dvt_ban?: string;
  ma_kho?: string;
  so_tam?: number;
  he_so8?: number;
  so_luong8?: number;
  so_luong9?: number;
  loai_vt?: string;
}

export interface PickupSlip {
  stt: string;
  so_ct?: string;
  ngay_ct: string;
  ma_dt: string;
  ten_dt?: string;
  dia_chi?: string;
  ma_xe?: string;
  total_items: number;
  total_so_tam: number;
  total_so_luong9: number;
}
