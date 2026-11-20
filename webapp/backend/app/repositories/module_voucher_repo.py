"""Repository for remaining VP_2014 accounting modules (CtMH, CtNX, CtCK, CtK, AR/AP 131/331, GL Reports)
with real SQL Server queries and automatic in-memory mockup fallback when SQL Server is offline.
"""

from datetime import date
import logging
import threading
import uuid
from typing import Any, Dict, List, Optional, Tuple

from app.config import settings
from app.database import get_db_cursor, get_db_transaction
from app.repositories.voucher_repo import voucher_repository
from app.schemas.module_voucher import (
    GlLedgerResponse,
    GlLedgerRow,
    ModuleVoucherDetailResponse,
    ModuleVoucherDetailSchema,
    ModuleVoucherHeaderSchema,
    ModuleVoucherPageResponse,
    ModuleVoucherSaveRequest,
    PartnerBalancePageResponse,
    PartnerBalanceRow,
    PartnerLedgerResponse,
    PartnerLedgerRow,
    TrialBalanceResponse,
    TrialBalanceRow,
)

logger = logging.getLogger("app.repositories.module_voucher")

_DOC_SPECS: Dict[str, Dict[str, Any]] = {
    "purchase": {
        "header_table": "CtMH",
        "detail_table": "CtMH0",
        "default_ma_ct": "MH",
        "default_nh_ct": "1",
        "has_ngay_ps": True,
        "has_tax": True,
        "has_ma_nx": True,
        "has_posted": True,
        "detail_kind": "inventory",
    },
    "inv-io": {
        "header_table": "CtNX",
        "detail_table": "CtNX0",
        "default_ma_ct": "NX",
        "default_nh_ct": "1",
        "has_ngay_ps": True,
        "has_tax": False,
        "has_ma_nx": True,
        "has_posted": True,
        "detail_kind": "inventory",
    },
    "inv-transfer": {
        "header_table": "CtCK",
        "detail_table": "CtCK0",
        "default_ma_ct": "CK",
        "default_nh_ct": "1",
        "has_ngay_ps": True,
        "has_tax": False,
        "has_ma_nx": True,
        "has_posted": True,
        "detail_kind": "transfer",
    },
    "gl-voucher": {
        "header_table": "CtK",
        "detail_table": "CtK0",
        "default_ma_ct": "PK",
        "default_nh_ct": "1",
        "has_ngay_ps": False,
        "has_tax": False,
        "has_ma_nx": False,
        "has_posted": False,
        "detail_kind": "gl",
    },
}


def _escape_like(val: str) -> str:
    return (
        str(val)
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
        .replace("[", "\\[")
    )


def _seed_mock_vouchers() -> Dict[str, List[ModuleVoucherDetailResponse]]:
    today_s = date.today().isoformat()
    ym = today_s[:7]
    return {
        "purchase": [
            ModuleVoucherDetailResponse(
                stt="MOCK_MH_001",
                ma_ct="MH",
                ngay_ct=f"{ym}-05",
                so_ct="PN001",
                ma_dt="NCC001",
                ten_dt="Công ty Thép Hòa Phát (Mẫu)",
                dien_giai0="Nhập mua tôn cuộn lạnh đợt 1",
                tk="3311",
                ma_tte="VND",
                ty_gia=1.0,
                ttien_nt0=150000000,
                ttien_nt3=15000000,
                ttien_nt=165000000,
                thue_gtgt=10,
                ma_thue="10",
                so_ct0="0004512",
                so_seri0="1C26THP",
                ngay_ct0=f"{ym}-05",
                user_name="ADMIN",
                item_count=2,
                is_mock=True,
                items=[
                    ModuleVoucherDetailSchema(
                        stt0="MOCK_MH_001_1",
                        stt="MOCK_MH_001",
                        ma_kho="K1",
                        ma_vt="TL045",
                        ten_vt="Tôn lạnh cuộn 0.45mm",
                        dvt="Kg",
                        so_luong=3000,
                        gia_nt=30000,
                        tien_nt=90000000,
                        tien_nt3=9000000,
                        tk="1561",
                        tk_du="3311",
                    ),
                    ModuleVoucherDetailSchema(
                        stt0="MOCK_MH_001_2",
                        stt="MOCK_MH_001",
                        ma_kho="K1",
                        ma_vt="TM040",
                        ten_vt="Tôn màu xanh ngọc 0.40mm",
                        dvt="Kg",
                        so_luong=2000,
                        gia_nt=30000,
                        tien_nt=60000000,
                        tien_nt3=6000000,
                        tk="1561",
                        tk_du="3311",
                    ),
                ],
            ),
            ModuleVoucherDetailResponse(
                stt="MOCK_MH_002",
                ma_ct="MH",
                ngay_ct=f"{ym}-12",
                so_ct="PN002",
                ma_dt="NCC002",
                ten_dt="Công ty Vận tải Minh Anh (Mẫu)",
                dien_giai0="Nhập phụ kiện & vật tư tiêu hao",
                tk="3311",
                ma_tte="VND",
                ty_gia=1.0,
                ttien_nt0=22000000,
                ttien_nt3=1760000,
                ttien_nt=23760000,
                thue_gtgt=8,
                ma_thue="08",
                user_name="KTTH",
                item_count=1,
                is_mock=True,
                items=[
                    ModuleVoucherDetailSchema(
                        stt0="MOCK_MH_002_1",
                        stt="MOCK_MH_002",
                        ma_kho="K2",
                        ma_vt="VIT01",
                        ten_vt="Vít bắn tôn 5cm",
                        dvt="Hộp",
                        so_luong=200,
                        gia_nt=110000,
                        tien_nt=22000000,
                        tien_nt3=1760000,
                        tk="152",
                        tk_du="3311",
                    )
                ],
            ),
        ],
        "inv-io": [
            ModuleVoucherDetailResponse(
                stt="MOCK_NX_001",
                ma_ct="NX",
                nh_ct="1",
                ngay_ct=f"{ym}-08",
                so_ct="NK001",
                ma_dt="KH001",
                ten_dt="Kho Sản Xuất Gia Công (Mẫu)",
                ma_nx="NSX",
                dien_giai0="Nhập kho thành phẩm gia công tôn xốp",
                tk="155",
                ttien_nt=48000000,
                user_name="THUKHO",
                item_count=1,
                is_mock=True,
                items=[
                    ModuleVoucherDetailSchema(
                        stt0="MOCK_NX_001_1",
                        stt="MOCK_NX_001",
                        ma_kho="K1",
                        ma_vt="TX050",
                        ten_vt="Tôn xốp PU 3 lớp 0.50mm",
                        dvt="Mét",
                        so_luong=400,
                        gia_nt=120000,
                        tien_nt=48000000,
                        tk="155",
                        tk_du="154",
                    )
                ],
            ),
            ModuleVoucherDetailResponse(
                stt="MOCK_NX_002",
                ma_ct="NX",
                nh_ct="2",
                ngay_ct=f"{ym}-15",
                so_ct="XK001",
                ma_dt="BP_SX",
                ten_dt="Phân xưởng cán sóng (Mẫu)",
                ma_nx="XSX",
                dien_giai0="Xuất cuộn nguyên liệu cho xưởng",
                tk="154",
                ttien_nt=64000000,
                user_name="THUKHO",
                item_count=1,
                is_mock=True,
                items=[
                    ModuleVoucherDetailSchema(
                        stt0="MOCK_NX_002_1",
                        stt="MOCK_NX_002",
                        ma_kho="K1",
                        ma_vt="TL045",
                        ten_vt="Tôn lạnh cuộn 0.45mm",
                        dvt="Kg",
                        so_luong=2000,
                        gia_nt=32000,
                        tien_nt=64000000,
                        tk="154",
                        tk_du="1561",
                    )
                ],
            ),
        ],
        "inv-transfer": [
            ModuleVoucherDetailResponse(
                stt="MOCK_CK_001",
                ma_ct="CK",
                ngay_ct=f"{ym}-10",
                so_ct="CK001",
                ma_dt="NB",
                ten_dt="Điều chuyển nội bộ (Mẫu)",
                dien_giai0="Chuyển hàng từ Kho Tổng K1 sang Kho Chi Nhánh K2",
                tk="1561",
                ttien_nt=36000000,
                user_name="THUKHO",
                item_count=1,
                is_mock=True,
                items=[
                    ModuleVoucherDetailSchema(
                        stt0="MOCK_CK_001_1",
                        stt="MOCK_CK_001",
                        ma_kho="K1",
                        ma_kho_n="K2",
                        ma_vt="TM040",
                        ten_vt="Tôn màu xanh ngọc 0.40mm",
                        dvt="Kg",
                        so_luong=1200,
                        gia_nt=30000,
                        tien_nt=36000000,
                        tk="1561",
                        tk_du="1561",
                    )
                ],
            )
        ],
        "gl-voucher": [
            ModuleVoucherDetailResponse(
                stt="MOCK_PK_001",
                ma_ct="PK",
                ngay_ct=f"{ym}-18",
                so_ct="PK001",
                ma_dt="KH002",
                ten_dt="Khách hàng / Nội bộ (Mẫu)",
                dien_giai0="Bút toán phân bổ chi phí & kết chuyển cuối kỳ",
                ttien_nt=12500000,
                user_name="KTTH",
                item_count=2,
                is_mock=True,
                items=[
                    ModuleVoucherDetailSchema(
                        stt0="MOCK_PK_001_1",
                        stt="MOCK_PK_001",
                        no_co="N",
                        tk="6427",
                        tien_nt=12500000,
                        dien_giai="Phân bổ chi phí dịch vụ mua ngoài",
                        ma_bp="VP",
                        ma_km="DV01",
                    ),
                    ModuleVoucherDetailSchema(
                        stt0="MOCK_PK_001_2",
                        stt="MOCK_PK_001",
                        no_co="C",
                        tk="242",
                        tien_nt=12500000,
                        dien_giai="Kết chuyển chi phí trả trước tháng này",
                        ma_bp="VP",
                        ma_km="DV01",
                    ),
                ],
            )
        ],
    }


class ModuleVoucherRepository:
    def __init__(self):
        self.vp_db = settings.DB_VP
        self.sys_db = settings.DB_SYS
        self.fn_uni = f"{self.vp_db}.dbo.fn_TCVNToUnicode"
        self.fn_tcvn = f"{self.vp_db}.dbo.fn_UnicodeToTCVN"
        self._mock_lock = threading.Lock()
        self._mock_docs = _seed_mock_vouchers()

    def _validate_module(self, module_key: str) -> Dict[str, Any]:
        spec = _DOC_SPECS.get(module_key)
        if not spec:
            raise ValueError(f"Phân hệ không hợp lệ: {module_key}")
        return spec

    def list_vouchers(
        self,
        module_key: str,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        q: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> ModuleVoucherPageResponse:
        spec = self._validate_module(module_key)
        safe_page = max(1, int(page))
        safe_size = max(1, min(500, int(page_size)))
        clean_q = (q or "").strip()

        hdr = spec["header_table"]
        dtl = spec["detail_table"]
        offset = (safe_page - 1) * safe_size

        where_parts: List[str] = []
        params: List[Any] = []
        if from_date and from_date.strip():
            where_parts.append("h.Ngay_Ct >= ?")
            params.append(from_date.strip()[:10])
        if to_date and to_date.strip():
            where_parts.append("h.Ngay_Ct <= ?")
            params.append(to_date.strip()[:10])
        if clean_q:
            esc = f"%{_escape_like(clean_q.upper())}%"
            esc_uni = f"%{_escape_like(clean_q)}%"
            where_parts.append(
                f"(UPPER(RTRIM(ISNULL(h.So_Ct,''))) LIKE ? ESCAPE '\\' "
                f"OR UPPER(RTRIM(ISNULL(h.Ma_Dt,''))) LIKE ? ESCAPE '\\' "
                f"OR {self.fn_uni}(ISNULL(h.Dien_Giai0,'')) LIKE ? ESCAPE '\\')"
            )
            params.extend([esc, esc, esc_uni])

        where_sql = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
        posted_col = "ISNULL(h.Posted, 1)" if spec["has_posted"] else "ISNULL(h.Confirmed, 1)"
        tk_col = "RTRIM(ISNULL(h.Tk, ''))" if module_key != "gl-voucher" else "''"
        ma_nx_col = "RTRIM(ISNULL(h.Ma_Nx, ''))" if spec["has_ma_nx"] else "''"
        tax_cols = (
            "ISNULL(h.TTien_Nt0, 0), ISNULL(h.TTien_Nt3, 0), RTRIM(ISNULL(h.So_Ct0, '')), h.Ngay_Ct0, RTRIM(ISNULL(h.So_Seri0, '')), RTRIM(ISNULL(h.Ma_Thue, '')), ISNULL(h.Thue_GTGT, 0)"
            if spec["has_tax"]
            else "ISNULL(h.TTien_Nt, 0), 0, '', NULL, '', '', 0"
        )

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(
                    f"SELECT COUNT(1), ISNULL(SUM(ISNULL(h.TTien_Nt, 0)), 0) "
                    f"FROM {self.vp_db}.dbo.{hdr} h WITH (NOLOCK) {where_sql}",
                    params,
                )
                agg = cur.fetchone()
                total_records = int(agg[0] or 0) if agg else 0
                total_amount = float(agg[1] or 0.0) if agg else 0.0

                items: List[ModuleVoucherHeaderSchema] = []
                if total_records > 0 and offset < total_records:
                    sql = f"""
                        ;WITH PageCTE AS (
                            SELECT h.Stt
                            FROM {self.vp_db}.dbo.{hdr} h WITH (NOLOCK)
                            {where_sql}
                            ORDER BY h.Ngay_Ct DESC, h.So_Ct DESC, h.Stt DESC
                            OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
                        )
                        SELECT
                            RTRIM(h.Stt),
                            RTRIM(ISNULL(h.Ma_DvCs, 'S1')),
                            RTRIM(ISNULL(h.Ma_Ct, '')),
                            RTRIM(ISNULL(h.Nh_Ct, '1')),
                            h.Ngay_Ct,
                            LTRIM(RTRIM(ISNULL(h.So_Ct, ''))),
                            LTRIM(RTRIM(ISNULL(h.Ma_Dt, ''))),
                            {self.fn_uni}(ISNULL(d.Ten_Dt, '')),
                            {self.fn_uni}(ISNULL(h.Ong_Ba, '')),
                            {self.fn_uni}(ISNULL(h.Dia_Chi, '')),
                            {self.fn_uni}(ISNULL(h.Dien_Giai0, '')),
                            {ma_nx_col},
                            {tk_col},
                            RTRIM(ISNULL(h.Ma_Tte, 'VND')),
                            ISNULL(h.Ty_Gia, 1),
                            {tax_cols},
                            ISNULL(h.TTien_Nt, 0),
                            {posted_col},
                            ISNULL(h.Confirmed, 1),
                            LTRIM(RTRIM(ISNULL(h.UserName, '')))
                        FROM PageCTE p
                        JOIN {self.vp_db}.dbo.{hdr} h WITH (NOLOCK) ON h.Stt = p.Stt
                        LEFT JOIN {self.sys_db}.dbo.DmDt d WITH (NOLOCK) ON d.Ma_Dt = h.Ma_Dt
                        ORDER BY h.Ngay_Ct DESC, h.So_Ct DESC, h.Stt DESC
                    """
                    cur.execute(sql, [*params, offset, safe_size])
                    rows = cur.fetchall()

                    stts = [(r[0] or "").strip() for r in rows if r[0]]
                    counts: Dict[str, int] = {}
                    if stts:
                        ph = ",".join(["?"] * len(stts))
                        cur.execute(
                            f"SELECT RTRIM(Stt), COUNT(1) FROM {self.vp_db}.dbo.{dtl} WITH (NOLOCK) "
                            f"WHERE Stt IN ({ph}) GROUP BY Stt",
                            stts,
                        )
                        for cr in cur.fetchall():
                            counts[(cr[0] or "").strip()] = int(cr[1] or 0)

                    for r in rows:
                        stt_val = (r[0] or "").strip()
                        items.append(
                            ModuleVoucherHeaderSchema(
                                stt=stt_val,
                                ma_dvcs=(r[1] or "S1").strip(),
                                ma_ct=(r[2] or "").strip(),
                                nh_ct=(r[3] or "1").strip(),
                                ngay_ct=r[4].strftime("%Y-%m-%d") if r[4] else "",
                                so_ct=(r[5] or "").strip(),
                                ma_dt=(r[6] or "").strip(),
                                ten_dt=(r[7] or "").strip(),
                                ong_ba=(r[8] or "").strip(),
                                dia_chi=(r[9] or "").strip(),
                                dien_giai0=(r[10] or "").strip(),
                                ma_nx=(r[11] or "").strip(),
                                tk=(r[12] or "").strip(),
                                ma_tte=(r[13] or "VND").strip(),
                                ty_gia=float(r[14] or 1.0),
                                ttien_nt0=float(r[15] or 0.0),
                                ttien_nt3=float(r[16] or 0.0),
                                so_ct0=(r[17] or "").strip(),
                                ngay_ct0=r[18].strftime("%Y-%m-%d") if r[18] else None,
                                so_seri0=(r[19] or "").strip(),
                                ma_thue=(r[20] or "").strip(),
                                thue_gtgt=float(r[21] or 0.0),
                                ttien_nt=float(r[22] or 0.0),
                                posted=bool(r[23]),
                                confirmed=bool(r[24]),
                                user_name=(r[25] or "").strip(),
                                item_count=counts.get(stt_val, 0),
                            )
                        )

                total_pages = max(1, (total_records + safe_size - 1) // safe_size)
                return ModuleVoucherPageResponse(
                    items=items,
                    total_records=total_records,
                    page=safe_page,
                    page_size=safe_size,
                    total_pages=total_pages,
                    total_amount=total_amount,
                    is_mock=False,
                )
        except Exception as exc:
            logger.info(f"SQL offline fallback for module {module_key} list: {exc}")
            with self._mock_lock:
                docs = list(self._mock_docs.get(module_key, []))
            filtered = []
            ql = clean_q.lower()
            for d in docs:
                if from_date and d.ngay_ct and d.ngay_ct < from_date[:10]:
                    continue
                if to_date and d.ngay_ct and d.ngay_ct > to_date[:10]:
                    continue
                if ql and (
                    ql not in d.so_ct.lower()
                    and ql not in d.ma_dt.lower()
                    and ql not in d.ten_dt.lower()
                    and ql not in d.dien_giai0.lower()
                ):
                    continue
                filtered.append(d)
            filtered.sort(key=lambda x: (x.ngay_ct, x.so_ct), reverse=True)
            total_records = len(filtered)
            total_amount = sum(d.ttien_nt for d in filtered)
            slice_docs = filtered[offset : offset + safe_size]
            return ModuleVoucherPageResponse(
                items=[
                    ModuleVoucherHeaderSchema(**d.model_dump(exclude={"items"}))
                    for d in slice_docs
                ],
                total_records=total_records,
                page=safe_page,
                page_size=safe_size,
                total_pages=max(1, (total_records + safe_size - 1) // safe_size),
                total_amount=total_amount,
                is_mock=True,
            )

    def get_voucher(self, module_key: str, stt: str) -> Optional[ModuleVoucherDetailResponse]:
        spec = self._validate_module(module_key)
        clean_stt = (stt or "").strip()
        if not clean_stt:
            return None

        hdr = spec["header_table"]
        dtl = spec["detail_table"]
        kind = spec["detail_kind"]
        posted_col = "ISNULL(h.Posted, 1)" if spec["has_posted"] else "ISNULL(h.Confirmed, 1)"
        tk_col = "RTRIM(ISNULL(h.Tk, ''))" if module_key != "gl-voucher" else "''"
        ma_nx_col = "RTRIM(ISNULL(h.Ma_Nx, ''))" if spec["has_ma_nx"] else "''"
        tax_cols = (
            "ISNULL(h.TTien_Nt0, 0), ISNULL(h.TTien_Nt3, 0), RTRIM(ISNULL(h.So_Ct0, '')), h.Ngay_Ct0, RTRIM(ISNULL(h.So_Seri0, '')), RTRIM(ISNULL(h.Ma_Thue, '')), ISNULL(h.Thue_GTGT, 0)"
            if spec["has_tax"]
            else "ISNULL(h.TTien_Nt, 0), 0, '', NULL, '', '', 0"
        )

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(
                    f"""
                    SELECT
                        RTRIM(h.Stt),
                        RTRIM(ISNULL(h.Ma_DvCs, 'S1')),
                        RTRIM(ISNULL(h.Ma_Ct, '')),
                        RTRIM(ISNULL(h.Nh_Ct, '1')),
                        h.Ngay_Ct,
                        LTRIM(RTRIM(ISNULL(h.So_Ct, ''))),
                        LTRIM(RTRIM(ISNULL(h.Ma_Dt, ''))),
                        {self.fn_uni}(ISNULL(d.Ten_Dt, '')),
                        {self.fn_uni}(ISNULL(h.Ong_Ba, '')),
                        {self.fn_uni}(ISNULL(h.Dia_Chi, '')),
                        {self.fn_uni}(ISNULL(h.Dien_Giai0, '')),
                        {ma_nx_col},
                        {tk_col},
                        RTRIM(ISNULL(h.Ma_Tte, 'VND')),
                        ISNULL(h.Ty_Gia, 1),
                        {tax_cols},
                        ISNULL(h.TTien_Nt, 0),
                        {posted_col},
                        ISNULL(h.Confirmed, 1),
                        LTRIM(RTRIM(ISNULL(h.UserName, '')))
                    FROM {self.vp_db}.dbo.{hdr} h WITH (NOLOCK)
                    LEFT JOIN {self.sys_db}.dbo.DmDt d WITH (NOLOCK) ON d.Ma_Dt = h.Ma_Dt
                    WHERE h.Stt = ?
                    """,
                    [clean_stt],
                )
                hr = cur.fetchone()
                if not hr:
                    return None

                if kind == "gl":
                    cur.execute(
                        f"""
                        SELECT
                            RTRIM(b.Stt0), RTRIM(b.Stt),
                            RTRIM(ISNULL(b.No_Co, 'N')), RTRIM(ISNULL(b.Tk, '')),
                            ISNULL(b.Tien_Nt, 0), {self.fn_uni}(ISNULL(b.Dien_Giai, '')),
                            RTRIM(ISNULL(b.Ma_Dt, '')), RTRIM(ISNULL(b.Ma_Bp, '')),
                            RTRIM(ISNULL(b.Ma_Km, '')), RTRIM(ISNULL(b.Ma_Sp, '')),
                            RTRIM(ISNULL(b.Ma_Hd, ''))
                        FROM {self.vp_db}.dbo.{dtl} b WITH (NOLOCK)
                        WHERE b.Stt = ? ORDER BY ISNULL(b.Stt_NV, 0), b.Stt0
                        """,
                        [clean_stt],
                    )
                    items = [
                        ModuleVoucherDetailSchema(
                            stt0=(r[0] or "").strip(),
                            stt=(r[1] or "").strip(),
                            no_co=(r[2] or "N").strip(),
                            tk=(r[3] or "").strip(),
                            tien_nt=float(r[4] or 0.0),
                            dien_giai=(r[5] or "").strip(),
                            ma_dt=(r[6] or "").strip(),
                            ma_bp=(r[7] or "").strip(),
                            ma_km=(r[8] or "").strip(),
                            ma_sp=(r[9] or "").strip(),
                            ma_hd=(r[10] or "").strip(),
                        )
                        for r in cur.fetchall()
                    ]
                else:
                    kho_n_col = (
                        "RTRIM(ISNULL(b.Ma_KhoN, ''))" if kind == "transfer" else "''"
                    )
                    tien3_col = (
                        "ISNULL(b.Tien_Nt3, 0)" if spec["has_tax"] else "0"
                    )
                    cur.execute(
                        f"""
                        SELECT
                            RTRIM(b.Stt0), RTRIM(b.Stt),
                            RTRIM(ISNULL(b.Ma_Kho, '')), {kho_n_col},
                            RTRIM(ISNULL(b.Ma_Vt, '')), {self.fn_uni}(ISNULL(v.Ten_Vt, '')),
                            {self.fn_uni}(ISNULL(b.Dvt, '')),
                            ISNULL(b.So_Luong, 0), ISNULL(b.Gia_Nt, 0),
                            ISNULL(b.Tien_Nt, 0), {tien3_col},
                            RTRIM(ISNULL(b.Tk, '')), RTRIM(ISNULL(b.Tk_Du, ''))
                        FROM {self.vp_db}.dbo.{dtl} b WITH (NOLOCK)
                        LEFT JOIN {self.sys_db}.dbo.DmVt v WITH (NOLOCK) ON v.Ma_Vt = b.Ma_Vt
                        WHERE b.Stt = ? ORDER BY b.Stt0
                        """,
                        [clean_stt],
                    )
                    items = [
                        ModuleVoucherDetailSchema(
                            stt0=(r[0] or "").strip(),
                            stt=(r[1] or "").strip(),
                            ma_kho=(r[2] or "").strip(),
                            ma_kho_n=(r[3] or "").strip(),
                            ma_vt=(r[4] or "").strip(),
                            ten_vt=(r[5] or "").strip(),
                            dvt=(r[6] or "").strip(),
                            so_luong=float(r[7] or 0.0),
                            gia_nt=float(r[8] or 0.0),
                            tien_nt=float(r[9] or 0.0),
                            tien_nt3=float(r[10] or 0.0),
                            tk=(r[11] or "").strip(),
                            tk_du=(r[12] or "").strip(),
                        )
                        for r in cur.fetchall()
                    ]

                return ModuleVoucherDetailResponse(
                    stt=(hr[0] or "").strip(),
                    ma_dvcs=(hr[1] or "S1").strip(),
                    ma_ct=(hr[2] or "").strip(),
                    nh_ct=(hr[3] or "1").strip(),
                    ngay_ct=hr[4].strftime("%Y-%m-%d") if hr[4] else "",
                    so_ct=(hr[5] or "").strip(),
                    ma_dt=(hr[6] or "").strip(),
                    ten_dt=(hr[7] or "").strip(),
                    ong_ba=(hr[8] or "").strip(),
                    dia_chi=(hr[9] or "").strip(),
                    dien_giai0=(hr[10] or "").strip(),
                    ma_nx=(hr[11] or "").strip(),
                    tk=(hr[12] or "").strip(),
                    ma_tte=(hr[13] or "VND").strip(),
                    ty_gia=float(hr[14] or 1.0),
                    ttien_nt0=float(hr[15] or 0.0),
                    ttien_nt3=float(hr[16] or 0.0),
                    so_ct0=(hr[17] or "").strip(),
                    ngay_ct0=hr[18].strftime("%Y-%m-%d") if hr[18] else None,
                    so_seri0=(hr[19] or "").strip(),
                    ma_thue=(hr[20] or "").strip(),
                    thue_gtgt=float(hr[21] or 0.0),
                    ttien_nt=float(hr[22] or 0.0),
                    posted=bool(hr[23]),
                    confirmed=bool(hr[24]),
                    user_name=(hr[25] or "").strip(),
                    item_count=len(items),
                    items=items,
                    is_mock=False,
                )
        except Exception as exc:
            logger.info(f"SQL offline fallback for module {module_key} detail {clean_stt}: {exc}")
            with self._mock_lock:
                for doc in self._mock_docs.get(module_key, []):
                    if doc.stt == clean_stt:
                        return doc
            return None

    def save_voucher(
        self,
        module_key: str,
        req: ModuleVoucherSaveRequest,
        stt_override: Optional[str] = None,
    ) -> ModuleVoucherDetailResponse:
        spec = self._validate_module(module_key)
        if not req.ngay_ct or not req.so_ct or not req.so_ct.strip():
            raise ValueError("Ngày chứng từ và Số chứng từ là bắt buộc.")
        if not req.items:
            raise ValueError("Chứng từ phải có ít nhất 1 dòng chi tiết.")

        hdr = spec["header_table"]
        dtl = spec["detail_table"]
        kind = spec["detail_kind"]
        ma_ct = (req.ma_ct or spec["default_ma_ct"]).strip().upper()
        nh_ct = (req.nh_ct or spec["default_nh_ct"]).strip() or "1"

        total_goods = sum(float(it.tien_nt or 0.0) for it in req.items)
        if kind == "gl":
            total_goods = sum(
                float(it.tien_nt or 0.0)
                for it in req.items
                if (it.no_co or "N").upper() == "N"
            ) or sum(float(it.tien_nt or 0.0) for it in req.items)
        total_tax = (
            sum(float(it.tien_nt3 or 0.0) for it in req.items)
            if spec["has_tax"]
            else 0.0
        )
        total_all = total_goods + total_tax

        try:
            with get_db_transaction(self.vp_db) as (_, cur):
                ma_dvcs = (req.ma_dvcs or "S1").strip() or "S1"
                is_create = not stt_override
                stt = (
                    voucher_repository.generate_stt(ma_dvcs, cur)
                    if is_create
                    else stt_override.strip()
                )

                if module_key == "gl-voucher":
                    if is_create:
                        cur.execute(
                            f"""
                            INSERT INTO {self.vp_db}.dbo.{hdr}
                            (Stt, Ma_DvCs, Ma_Ct, Nh_Ct, So_Ct, Ngay_Ct, Ma_Dt, Ong_Ba, Dia_Chi, Dien_Giai0,
                             Ma_Tte, Ty_Gia, TTien_Nt, TTien, Confirmed, UserName)
                            VALUES (?, ?, ?, ?, ?, ?, ?, {self.fn_tcvn}(?), {self.fn_tcvn}(?), {self.fn_tcvn}(?), ?, ?, ?, ?, 1, ?)
                            """,
                            [
                                stt, ma_dvcs, ma_ct, nh_ct, req.so_ct.strip(), req.ngay_ct[:10],
                                (req.ma_dt or "").strip().upper(), req.ong_ba or "", req.dia_chi or "",
                                req.dien_giai0 or "", req.ma_tte or "VND", float(req.ty_gia or 1.0),
                                total_all, total_all, req.user_name or "ADMIN",
                            ],
                        )
                    else:
                        cur.execute(
                            f"""
                            UPDATE {self.vp_db}.dbo.{hdr} SET
                                Ma_Ct=?, Nh_Ct=?, So_Ct=?, Ngay_Ct=?, Ma_Dt=?, Ong_Ba={self.fn_tcvn}(?),
                                Dia_Chi={self.fn_tcvn}(?), Dien_Giai0={self.fn_tcvn}(?), TTien_Nt=?, TTien=?
                            WHERE Stt=?
                            """,
                            [
                                ma_ct, nh_ct, req.so_ct.strip(), req.ngay_ct[:10],
                                (req.ma_dt or "").strip().upper(), req.ong_ba or "", req.dia_chi or "",
                                req.dien_giai0 or "", total_all, total_all, stt,
                            ],
                        )
                elif module_key == "purchase":
                    if is_create:
                        cur.execute(
                            f"""
                            INSERT INTO {self.vp_db}.dbo.{hdr}
                            (Stt, Ma_DvCs, Ma_Ct, Nh_Ct, Ngay_Ct, Ngay_Ps, So_Ct, Ma_Dt, Ong_Ba, Dia_Chi,
                             Dien_Giai0, Ma_Nx, Tk, TTien_Nt0, TTien_Nt3, TTien_Nt, TTien0, TTien3, TTien,
                             Ma_Thue, Thue_GTGT, Ma_Tte, Ty_Gia, Posted, Confirmed, UserName, So_Ct0, So_Seri0, Ngay_Ct0)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, {self.fn_tcvn}(?), {self.fn_tcvn}(?), {self.fn_tcvn}(?), ?, ?,
                                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
                            """,
                            [
                                stt, ma_dvcs, ma_ct, nh_ct, req.ngay_ct[:10], req.ngay_ct[:10],
                                req.so_ct.strip(), (req.ma_dt or "").strip().upper(), req.ong_ba or "",
                                req.dia_chi or "", req.dien_giai0 or "", req.ma_nx or "", req.tk or "3311",
                                total_goods, total_tax, total_all, total_goods, total_tax, total_all,
                                req.ma_thue or "", float(req.thue_gtgt or 0.0), req.ma_tte or "VND",
                                float(req.ty_gia or 1.0), 1 if req.posted else 0, req.user_name or "ADMIN",
                                req.so_ct0 or "", req.so_seri0 or "", req.ngay_ct0 or None,
                            ],
                        )
                    else:
                        cur.execute(
                            f"""
                            UPDATE {self.vp_db}.dbo.{hdr} SET
                                Ngay_Ct=?, So_Ct=?, Ma_Dt=?, Dien_Giai0={self.fn_tcvn}(?), Tk=?,
                                TTien_Nt0=?, TTien_Nt3=?, TTien_Nt=?, TTien0=?, TTien3=?, TTien=?,
                                Ma_Thue=?, Thue_GTGT=?, So_Ct0=?, So_Seri0=?, Ngay_Ct0=?, Posted=?
                            WHERE Stt=?
                            """,
                            [
                                req.ngay_ct[:10], req.so_ct.strip(), (req.ma_dt or "").strip().upper(),
                                req.dien_giai0 or "", req.tk or "3311", total_goods, total_tax, total_all,
                                total_goods, total_tax, total_all, req.ma_thue or "",
                                float(req.thue_gtgt or 0.0), req.so_ct0 or "", req.so_seri0 or "",
                                req.ngay_ct0 or None, 1 if req.posted else 0, stt,
                            ],
                        )
                else:
                    if is_create:
                        cur.execute(
                            f"""
                            INSERT INTO {self.vp_db}.dbo.{hdr}
                            (Stt, Ma_DvCs, Ma_Ct, Nh_Ct, Ma_Tte, Ty_Gia, TTien_Nt, TTien, Ngay_Ps, Ngay_Ct,
                             So_Ct, Ma_Dt, Ong_Ba, Dia_Chi, Dien_Giai0, Ma_Nx, Tk, UserName, Posted, Confirmed)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, {self.fn_tcvn}(?), {self.fn_tcvn}(?), {self.fn_tcvn}(?), ?, ?, ?, ?, 1)
                            """,
                            [
                                stt, ma_dvcs, ma_ct, nh_ct, req.ma_tte or "VND", float(req.ty_gia or 1.0),
                                total_all, total_all, req.ngay_ct[:10], req.ngay_ct[:10], req.so_ct.strip(),
                                (req.ma_dt or "").strip().upper(), req.ong_ba or "", req.dia_chi or "",
                                req.dien_giai0 or "", req.ma_nx or "", req.tk or "", req.user_name or "ADMIN",
                                1 if req.posted else 0,
                            ],
                        )
                    else:
                        cur.execute(
                            f"""
                            UPDATE {self.vp_db}.dbo.{hdr} SET
                                Ngay_Ct=?, So_Ct=?, Ma_Dt=?, Dien_Giai0={self.fn_tcvn}(?), Ma_Nx=?, Tk=?,
                                TTien_Nt=?, TTien=?, Posted=?
                            WHERE Stt=?
                            """,
                            [
                                req.ngay_ct[:10], req.so_ct.strip(), (req.ma_dt or "").strip().upper(),
                                req.dien_giai0 or "", req.ma_nx or "", req.tk or "",
                                total_all, total_all, 1 if req.posted else 0, stt,
                            ],
                        )

                cur.execute(f"DELETE FROM {self.vp_db}.dbo.{dtl} WHERE Stt = ?", [stt])
                stt0_list = voucher_repository.generate_stts_batch(ma_dvcs, len(req.items), cur)
                for idx, (it, stt0) in enumerate(zip(req.items, stt0_list), start=1):
                    if kind == "gl":
                        cur.execute(
                            f"""
                            INSERT INTO {self.vp_db}.dbo.{dtl}
                            (Stt0, Stt, Stt_NV, Dien_Giai, No_Co, Tk, Tien_Nt, Tien, Ma_Dt, Ma_Bp, Ma_Km, Ma_Sp, Ma_Hd)
                            VALUES (?, ?, ?, {self.fn_tcvn}(?), ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            [
                                stt0, stt, idx, it.dien_giai or req.dien_giai0 or "",
                                (it.no_co or "N").upper()[:1], (it.tk or "").strip().upper(),
                                float(it.tien_nt or 0.0), float(it.tien_nt or 0.0),
                                (it.ma_dt or req.ma_dt or "").strip().upper(),
                                it.ma_bp or "", it.ma_km or "", it.ma_sp or "", it.ma_hd or "",
                            ],
                        )
                    elif kind == "transfer":
                        cur.execute(
                            f"""
                            INSERT INTO {self.vp_db}.dbo.{dtl}
                            (Stt0, Stt, Tk, Tk_Du, Ma_Kho, Ma_KhoN, Ma_Vt, Dvt, So_Luong, Gia_Nt, Gia, Tien_Nt, Tien)
                            VALUES (?, ?, ?, ?, ?, ?, ?, {self.fn_tcvn}(?), ?, ?, ?, ?, ?)
                            """,
                            [
                                stt0, stt, it.tk or "", it.tk_du or "",
                                (it.ma_kho or "").strip().upper(), (it.ma_kho_n or "").strip().upper(),
                                (it.ma_vt or "").strip().upper(), it.dvt or "",
                                float(it.so_luong or 0.0), float(it.gia_nt or 0.0), float(it.gia_nt or 0.0),
                                float(it.tien_nt or 0.0), float(it.tien_nt or 0.0),
                            ],
                        )
                    elif spec["has_tax"]:
                        cur.execute(
                            f"""
                            INSERT INTO {self.vp_db}.dbo.{dtl}
                            (Stt0, Stt, Tk, Tk_Du, Ma_Kho, Ma_Vt, Dvt, So_Luong, Gia_Nt, Gia, Tien_Nt, Tien, Tien_Nt3, Tien3)
                            VALUES (?, ?, ?, ?, ?, ?, {self.fn_tcvn}(?), ?, ?, ?, ?, ?, ?, ?)
                            """,
                            [
                                stt0, stt, it.tk or "", it.tk_du or "",
                                (it.ma_kho or "").strip().upper(), (it.ma_vt or "").strip().upper(),
                                it.dvt or "", float(it.so_luong or 0.0), float(it.gia_nt or 0.0),
                                float(it.gia_nt or 0.0), float(it.tien_nt or 0.0), float(it.tien_nt or 0.0),
                                float(it.tien_nt3 or 0.0), float(it.tien_nt3 or 0.0),
                            ],
                        )
                    else:
                        cur.execute(
                            f"""
                            INSERT INTO {self.vp_db}.dbo.{dtl}
                            (Stt0, Stt, Tk, Tk_Du, Ma_Kho, Ma_Vt, Dvt, So_Luong, Gia_Nt, Gia, Tien_Nt, Tien)
                            VALUES (?, ?, ?, ?, ?, ?, {self.fn_tcvn}(?), ?, ?, ?, ?, ?)
                            """,
                            [
                                stt0, stt, it.tk or "", it.tk_du or "",
                                (it.ma_kho or "").strip().upper(), (it.ma_vt or "").strip().upper(),
                                it.dvt or "", float(it.so_luong or 0.0), float(it.gia_nt or 0.0),
                                float(it.gia_nt or 0.0), float(it.tien_nt or 0.0), float(it.tien_nt or 0.0),
                            ],
                        )
            detail = self.get_voucher(module_key, stt)
            if detail:
                return detail
        except Exception as exc:
            logger.info(f"SQL offline fallback save for module {module_key}: {exc}")

        # Offline mock persistence
        new_stt = stt_override or f"MOCK_{ma_ct}_{uuid.uuid4().hex[:6].upper()}"
        mock_items = [
            it.model_copy(update={"stt0": f"{new_stt}_{i}", "stt": new_stt})
            for i, it in enumerate(req.items, start=1)
        ]
        saved_doc = ModuleVoucherDetailResponse(
            stt=new_stt,
            ma_dvcs=req.ma_dvcs or "S1",
            ma_ct=ma_ct,
            nh_ct=nh_ct,
            ngay_ct=req.ngay_ct[:10],
            so_ct=req.so_ct.strip(),
            ma_dt=(req.ma_dt or "").strip().upper(),
            ten_dt=req.ten_dt or "",
            ong_ba=req.ong_ba or "",
            dia_chi=req.dia_chi or "",
            dien_giai0=req.dien_giai0 or "",
            ma_nx=req.ma_nx or "",
            tk=req.tk or "",
            ma_tte=req.ma_tte or "VND",
            ty_gia=float(req.ty_gia or 1.0),
            ttien_nt0=total_goods,
            ttien_nt3=total_tax,
            ttien_nt=total_all,
            posted=bool(req.posted),
            confirmed=True,
            user_name=req.user_name or "ADMIN",
            so_ct0=req.so_ct0 or "",
            ngay_ct0=req.ngay_ct0,
            so_seri0=req.so_seri0 or "",
            ma_thue=req.ma_thue or "",
            thue_gtgt=float(req.thue_gtgt or 0.0),
            item_count=len(mock_items),
            items=mock_items,
            is_mock=True,
        )
        with self._mock_lock:
            lst = self._mock_docs.setdefault(module_key, [])
            idx = next((i for i, d in enumerate(lst) if d.stt == new_stt), -1)
            if idx >= 0:
                lst[idx] = saved_doc
            else:
                lst.insert(0, saved_doc)
        return saved_doc

    def delete_voucher(self, module_key: str, stt: str) -> dict:
        spec = self._validate_module(module_key)
        clean_stt = (stt or "").strip()
        if not clean_stt:
            raise ValueError("Thiếu Stt chứng từ cần xóa.")

        hdr = spec["header_table"]
        dtl = spec["detail_table"]
        try:
            with get_db_transaction(self.vp_db) as (_, cur):
                cur.execute(f"DELETE FROM {self.vp_db}.dbo.{dtl} WHERE Stt = ?", [clean_stt])
                cur.execute(f"DELETE FROM {self.vp_db}.dbo.{hdr} WHERE Stt = ?", [clean_stt])
                return {"stt": clean_stt, "is_mock": False}
        except Exception as exc:
            logger.info(f"SQL offline fallback delete for module {module_key}: {exc}")
            with self._mock_lock:
                lst = self._mock_docs.get(module_key, [])
                self._mock_docs[module_key] = [d for d in lst if d.stt != clean_stt]
            return {"stt": clean_stt, "is_mock": True}

    # =========================================================================
    # Công nợ Phải thu (131) & Phải trả (331) từ SoCai + CdK
    # =========================================================================
    def get_partner_balances(
        self,
        tk_prefix: str = "131",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        q: Optional[str] = None,
        page: int = 1,
        page_size: int = 100,
    ) -> PartnerBalancePageResponse:
        prefix = (tk_prefix or "131").strip()
        like_tk = f"{prefix}%"
        safe_page = max(1, int(page))
        safe_size = max(1, min(500, int(page_size)))
        d1 = (from_date or f"{date.today().isoformat()[:7]}-01")[:10]
        d2 = (to_date or date.today().isoformat())[:10]
        clean_q = (q or "").strip()

        try:
            with get_db_cursor(self.vp_db) as cur:
                q_filter = ""
                q_params: List[Any] = []
                if clean_q:
                    esc = f"%{_escape_like(clean_q.upper())}%"
                    esc_uni = f"%{_escape_like(clean_q)}%"
                    q_filter = (
                        f" AND (UPPER(RTRIM(d.Ma_Dt)) LIKE ? ESCAPE '\\' "
                        f"OR {self.fn_uni}(ISNULL(d.Ten_Dt, '')) LIKE ? ESCAPE '\\')"
                    )
                    q_params = [esc, esc_uni]

                sql = f"""
                    ;WITH Agg AS (
                        SELECT
                            RTRIM(Ma_Dt) AS Ma_Dt,
                            SUM(Du_No_Dau) AS Du_No_Dau,
                            SUM(Du_Co_Dau) AS Du_Co_Dau,
                            SUM(Ps_No) AS Ps_No,
                            SUM(Ps_Co) AS Ps_Co,
                            SUM(TxCount) AS TxCount
                        FROM (
                            SELECT Ma_Dt, ISNULL(Du_No, 0) AS Du_No_Dau, ISNULL(Du_Co, 0) AS Du_Co_Dau, 0 AS Ps_No, 0 AS Ps_Co, 0 AS TxCount
                            FROM {self.vp_db}.dbo.CdK WITH (NOLOCK)
                            WHERE Tk LIKE ? AND ISNULL(Ma_Dt, '') <> ''
                            UNION ALL
                            SELECT Ma_Dt_No AS Ma_Dt, ISNULL(Tien, 0), 0, 0, 0, 0
                            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
                            WHERE Tk_No LIKE ? AND ISNULL(Ma_Dt_No, '') <> '' AND Ngay_Ct < ?
                            UNION ALL
                            SELECT Ma_Dt_Co AS Ma_Dt, 0, ISNULL(Tien, 0), 0, 0, 0
                            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
                            WHERE Tk_Co LIKE ? AND ISNULL(Ma_Dt_Co, '') <> '' AND Ngay_Ct < ?
                            UNION ALL
                            SELECT Ma_Dt_No AS Ma_Dt, 0, 0, ISNULL(Tien, 0), 0, 1
                            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
                            WHERE Tk_No LIKE ? AND ISNULL(Ma_Dt_No, '') <> '' AND Ngay_Ct >= ? AND Ngay_Ct <= ?
                            UNION ALL
                            SELECT Ma_Dt_Co AS Ma_Dt, 0, 0, 0, ISNULL(Tien, 0), 1
                            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
                            WHERE Tk_Co LIKE ? AND ISNULL(Ma_Dt_Co, '') <> '' AND Ngay_Ct >= ? AND Ngay_Ct <= ?
                        ) raw_agg
                        GROUP BY RTRIM(Ma_Dt)
                    )
                    SELECT
                        a.Ma_Dt,
                        {self.fn_uni}(ISNULL(d.Ten_Dt, '')),
                        {self.fn_uni}(ISNULL(d.Dia_Chi, '')),
                        a.Du_No_Dau, a.Du_Co_Dau, a.Ps_No, a.Ps_Co, a.TxCount
                    FROM Agg a
                    LEFT JOIN {self.sys_db}.dbo.DmDt d WITH (NOLOCK) ON RTRIM(d.Ma_Dt) = a.Ma_Dt
                    WHERE (ABS(a.Du_No_Dau - a.Du_Co_Dau) > 0.01 OR ABS(a.Ps_No) > 0.01 OR ABS(a.Ps_Co) > 0.01)
                    {q_filter}
                    ORDER BY a.Ma_Dt ASC
                """
                cur.execute(
                    sql,
                    [
                        like_tk,
                        like_tk, d1,
                        like_tk, d1,
                        like_tk, d1, d2,
                        like_tk, d1, d2,
                        *q_params,
                    ],
                )
                all_rows: List[PartnerBalanceRow] = []
                s_nd = s_cd = s_pn = s_pc = s_nc = s_cc = 0.0
                for r in cur.fetchall():
                    open_net = float(r[3] or 0) - float(r[4] or 0)
                    du_no_dau = open_net if open_net > 0 else 0.0
                    du_co_dau = -open_net if open_net < 0 else 0.0
                    ps_no = float(r[5] or 0)
                    ps_co = float(r[6] or 0)
                    close_net = open_net + ps_no - ps_co
                    du_no_cuoi = close_net if close_net > 0 else 0.0
                    du_co_cuoi = -close_net if close_net < 0 else 0.0

                    s_nd += du_no_dau
                    s_cd += du_co_dau
                    s_pn += ps_no
                    s_pc += ps_co
                    s_nc += du_no_cuoi
                    s_cc += du_co_cuoi

                    all_rows.append(
                        PartnerBalanceRow(
                            ma_dt=(r[0] or "").strip(),
                            ten_dt=(r[1] or "").strip(),
                            dia_chi=(r[2] or "").strip(),
                            du_no_dau=du_no_dau,
                            du_co_dau=du_co_dau,
                            ps_no=ps_no,
                            ps_co=ps_co,
                            du_no_cuoi=du_no_cuoi,
                            du_co_cuoi=du_co_cuoi,
                            tx_count=int(r[7] or 0),
                        )
                    )

                total = len(all_rows)
                off = (safe_page - 1) * safe_size
                return PartnerBalancePageResponse(
                    tk_prefix=prefix,
                    items=all_rows[off : off + safe_size],
                    total_records=total,
                    page=safe_page,
                    page_size=safe_size,
                    total_pages=max(1, (total + safe_size - 1) // safe_size),
                    sum_du_no_dau=s_nd,
                    sum_du_co_dau=s_cd,
                    sum_ps_no=s_pn,
                    sum_ps_co=s_pc,
                    sum_du_no_cuoi=s_nc,
                    sum_du_co_cuoi=s_cc,
                    is_mock=False,
                )
        except Exception as exc:
            logger.info(f"SQL offline fallback for partner balances ({prefix}): {exc}")
            samples = (
                [
                    PartnerBalanceRow(
                        ma_dt="KH001", ten_dt="Công ty Xây Dựng Bình Minh (Mẫu)",
                        dia_chi="Bình Dương", du_no_dau=85000000, du_co_dau=0,
                        ps_no=120000000, ps_co=95000000, du_no_cuoi=110000000, du_co_cuoi=0, tx_count=4,
                    ),
                    PartnerBalanceRow(
                        ma_dt="KH002", ten_dt="Đại lý Tôn Thép An Phú (Mẫu)",
                        dia_chi="Đồng Nai", du_no_dau=42000000, du_co_dau=0,
                        ps_no=65000000, ps_co=65000000, du_no_cuoi=42000000, du_co_cuoi=0, tx_count=2,
                    ),
                    PartnerBalanceRow(
                        ma_dt="KH003", ten_dt="Công ty Cơ Khí Tân Tạo (Mẫu)",
                        dia_chi="TP. HCM", du_no_dau=0, du_co_dau=15000000,
                        ps_no=40000000, ps_co=25000000, du_no_cuoi=0, du_co_cuoi=0, tx_count=3,
                    ),
                ]
                if prefix.startswith("131")
                else [
                    PartnerBalanceRow(
                        ma_dt="NCC001", ten_dt="Công ty Thép Hòa Phát (Mẫu)",
                        dia_chi="KCN Phố Nối", du_no_dau=0, du_co_dau=210000000,
                        ps_no=150000000, ps_co=165000000, du_no_cuoi=0, du_co_cuoi=225000000, tx_count=3,
                    ),
                    PartnerBalanceRow(
                        ma_dt="NCC002", ten_dt="Công ty Vận Tải Minh Anh (Mẫu)",
                        dia_chi="TP. HCM", du_no_dau=0, du_co_dau=18000000,
                        ps_no=18000000, ps_co=23760000, du_no_cuoi=0, du_co_cuoi=23760000, tx_count=2,
                    ),
                ]
            )
            ql = clean_q.lower()
            filtered = [
                r for r in samples
                if not ql or ql in r.ma_dt.lower() or ql in r.ten_dt.lower()
            ]
            return PartnerBalancePageResponse(
                tk_prefix=prefix,
                items=filtered,
                total_records=len(filtered),
                page=1,
                page_size=safe_size,
                total_pages=1,
                sum_du_no_dau=sum(r.du_no_dau for r in filtered),
                sum_du_co_dau=sum(r.du_co_dau for r in filtered),
                sum_ps_no=sum(r.ps_no for r in filtered),
                sum_ps_co=sum(r.ps_co for r in filtered),
                sum_du_no_cuoi=sum(r.du_no_cuoi for r in filtered),
                sum_du_co_cuoi=sum(r.du_co_cuoi for r in filtered),
                is_mock=True,
            )

    def get_partner_ledger(
        self,
        tk_prefix: str,
        ma_dt: str,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
    ) -> PartnerLedgerResponse:
        prefix = (tk_prefix or "131").strip()
        like_tk = f"{prefix}%"
        clean_dt = (ma_dt or "").strip().upper()
        d1 = (from_date or f"{date.today().isoformat()[:7]}-01")[:10]
        d2 = (to_date or date.today().isoformat())[:10]

        if not clean_dt:
            return PartnerLedgerResponse(tk_prefix=prefix, ma_dt="", entries=[])

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(
                    f"SELECT {self.fn_uni}(ISNULL(Ten_Dt, '')) FROM {self.sys_db}.dbo.DmDt WITH (NOLOCK) WHERE Ma_Dt = ?",
                    [clean_dt],
                )
                r_dt = cur.fetchone()
                ten_dt = (r_dt[0] or "").strip() if r_dt else ""

                cur.execute(
                    f"""
                    SELECT
                        ISNULL((SELECT SUM(ISNULL(Du_No, 0) - ISNULL(Du_Co, 0)) FROM {self.vp_db}.dbo.CdK WITH (NOLOCK) WHERE Tk LIKE ? AND Ma_Dt = ?), 0)
                        + ISNULL((SELECT SUM(ISNULL(Tien, 0)) FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK) WHERE Tk_No LIKE ? AND Ma_Dt_No = ? AND Ngay_Ct < ?), 0)
                        - ISNULL((SELECT SUM(ISNULL(Tien, 0)) FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK) WHERE Tk_Co LIKE ? AND Ma_Dt_Co = ? AND Ngay_Ct < ?), 0)
                    """,
                    [like_tk, clean_dt, like_tk, clean_dt, d1, like_tk, clean_dt, d1],
                )
                du_dau = float(cur.fetchone()[0] or 0.0)

                cur.execute(
                    f"""
                    SELECT
                        RTRIM(Stt), Ngay_Ct, RTRIM(Ma_Ct), LTRIM(RTRIM(ISNULL(So_Ct, ''))),
                        {self.fn_uni}(ISNULL(Dien_Giai, '')),
                        RTRIM(Tk_No), RTRIM(Tk_Co), ISNULL(Tien, 0)
                    FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK)
                    WHERE Ngay_Ct >= ? AND Ngay_Ct <= ?
                      AND ((Tk_No LIKE ? AND Ma_Dt_No = ?) OR (Tk_Co LIKE ? AND Ma_Dt_Co = ?))
                    ORDER BY Ngay_Ct ASC, So_Ct ASC, SoCaiID ASC
                    """,
                    [d1, d2, like_tk, clean_dt, like_tk, clean_dt],
                )
                running = du_dau
                entries: List[PartnerLedgerRow] = []
                for r in cur.fetchall():
                    tk_no = (r[5] or "").strip()
                    tk_co = (r[6] or "").strip()
                    amt = float(r[7] or 0.0)
                    is_debit = tk_no.startswith(prefix)
                    ps_no = amt if is_debit else 0.0
                    ps_co = amt if not is_debit else 0.0
                    running += ps_no - ps_co
                    entries.append(
                        PartnerLedgerRow(
                            stt=(r[0] or "").strip(),
                            ngay_ct=r[1].strftime("%Y-%m-%d") if r[1] else "",
                            ma_ct=(r[2] or "").strip(),
                            so_ct=(r[3] or "").strip(),
                            dien_giai=(r[4] or "").strip(),
                            tk=tk_no if is_debit else tk_co,
                            tk_du=tk_co if is_debit else tk_no,
                            ps_no=ps_no,
                            ps_co=ps_co,
                            luy_ke=running,
                        )
                    )
                return PartnerLedgerResponse(
                    tk_prefix=prefix,
                    ma_dt=clean_dt,
                    ten_dt=ten_dt,
                    du_dau=du_dau,
                    du_cuoi=running,
                    entries=entries,
                    is_mock=False,
                )
        except Exception as exc:
            logger.info(f"SQL offline fallback for partner ledger ({clean_dt}): {exc}")
            is_ar = prefix.startswith("131")
            du_dau = 85000000.0 if is_ar else -210000000.0
            e1 = PartnerLedgerRow(
                stt="MOCK_1",
                ngay_ct=d1,
                ma_ct="X1" if is_ar else "MH",
                so_ct="HD0102" if is_ar else "PN001",
                dien_giai="Xuất bán tôn cuộn (Mẫu)" if is_ar else "Nhập mua thép cuộn (Mẫu)",
                tk=f"{prefix}1",
                tk_du="5111" if is_ar else "1561",
                ps_no=120000000.0 if is_ar else 0.0,
                ps_co=0.0 if is_ar else 165000000.0,
                luy_ke=du_dau + (120000000.0 if is_ar else -165000000.0),
            )
            e2 = PartnerLedgerRow(
                stt="MOCK_2",
                ngay_ct=d2,
                ma_ct="C3" if is_ar else "C4",
                so_ct="BC0045" if is_ar else "BN0018",
                dien_giai="Thanh toán chuyển khoản ngân hàng (Mẫu)",
                tk=f"{prefix}1",
                tk_du="11212",
                ps_no=0.0 if is_ar else 150000000.0,
                ps_co=95000000.0 if is_ar else 0.0,
                luy_ke=e1.luy_ke + (-95000000.0 if is_ar else 150000000.0),
            )
            return PartnerLedgerResponse(
                tk_prefix=prefix,
                ma_dt=clean_dt,
                ten_dt=f"Đối tượng {clean_dt} (Dữ liệu mẫu)",
                du_dau=du_dau,
                du_cuoi=e2.luy_ke,
                entries=[e1, e2],
                is_mock=True,
            )

    # =========================================================================
    # Kế toán Tổng hợp: Cân đối phát sinh (CĐPS) & Sổ cái tài khoản
    # =========================================================================
    def get_trial_balance(
        self,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        q: Optional[str] = None,
    ) -> TrialBalanceResponse:
        d1 = (from_date or f"{date.today().isoformat()[:7]}-01")[:10]
        d2 = (to_date or date.today().isoformat())[:10]
        clean_q = (q or "").strip()

        try:
            with get_db_cursor(self.vp_db) as cur:
                q_sql = ""
                q_params: List[Any] = []
                if clean_q:
                    esc = f"%{_escape_like(clean_q.upper())}%"
                    esc_uni = f"%{_escape_like(clean_q)}%"
                    q_sql = (
                        f" AND (UPPER(RTRIM(t.Tk)) LIKE ? ESCAPE '\\' "
                        f"OR {self.fn_uni}(ISNULL(t.Ten_Tk, '')) LIKE ? ESCAPE '\\')"
                    )
                    q_params = [esc, esc_uni]

                sql = f"""
                    ;WITH Agg AS (
                        SELECT
                            RTRIM(Tk) AS Tk,
                            SUM(Du_No_Dau) AS Du_No_Dau,
                            SUM(Du_Co_Dau) AS Du_Co_Dau,
                            SUM(Ps_No) AS Ps_No,
                            SUM(Ps_Co) AS Ps_Co
                        FROM (
                            SELECT Tk, ISNULL(Du_No, 0) AS Du_No_Dau, ISNULL(Du_Co, 0) AS Du_Co_Dau, 0 AS Ps_No, 0 AS Ps_Co
                            FROM {self.vp_db}.dbo.CdK WITH (NOLOCK)
                            UNION ALL
                            SELECT Tk_No AS Tk, ISNULL(Tien, 0), 0, 0, 0
                            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK) WHERE Ngay_Ct < ?
                            UNION ALL
                            SELECT Tk_Co AS Tk, 0, ISNULL(Tien, 0), 0, 0
                            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK) WHERE Ngay_Ct < ?
                            UNION ALL
                            SELECT Tk_No AS Tk, 0, 0, ISNULL(Tien, 0), 0
                            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK) WHERE Ngay_Ct >= ? AND Ngay_Ct <= ?
                            UNION ALL
                            SELECT Tk_Co AS Tk, 0, 0, 0, ISNULL(Tien, 0)
                            FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK) WHERE Ngay_Ct >= ? AND Ngay_Ct <= ?
                        ) x
                        GROUP BY RTRIM(Tk)
                    )
                    SELECT
                        a.Tk,
                        {self.fn_uni}(ISNULL(t.Ten_Tk, '')),
                        ISNULL(t.Bac_Tk, 1),
                        a.Du_No_Dau, a.Du_Co_Dau, a.Ps_No, a.Ps_Co
                    FROM Agg a
                    LEFT JOIN {self.sys_db}.dbo.DmTk t WITH (NOLOCK) ON RTRIM(t.Tk) = a.Tk
                    WHERE (ABS(a.Du_No_Dau - a.Du_Co_Dau) > 0.01 OR ABS(a.Ps_No) > 0.01 OR ABS(a.Ps_Co) > 0.01)
                    {q_sql}
                    ORDER BY a.Tk ASC
                """
                cur.execute(sql, [d1, d1, d1, d2, d1, d2, *q_params])
                items: List[TrialBalanceRow] = []
                s_nd = s_cd = s_pn = s_pc = s_nc = s_cc = 0.0
                for r in cur.fetchall():
                    open_net = float(r[3] or 0) - float(r[4] or 0)
                    nd = open_net if open_net > 0 else 0.0
                    cd = -open_net if open_net < 0 else 0.0
                    pn = float(r[5] or 0)
                    pc = float(r[6] or 0)
                    close_net = open_net + pn - pc
                    nc = close_net if close_net > 0 else 0.0
                    cc = -close_net if close_net < 0 else 0.0
                    s_nd += nd; s_cd += cd; s_pn += pn; s_pc += pc; s_nc += nc; s_cc += cc
                    items.append(
                        TrialBalanceRow(
                            tk=(r[0] or "").strip(),
                            ten_tk=(r[1] or "").strip(),
                            bac_tk=int(r[2] or 1),
                            du_no_dau=nd, du_co_dau=cd,
                            ps_no=pn, ps_co=pc,
                            du_no_cuoi=nc, du_co_cuoi=cc,
                        )
                    )
                return TrialBalanceResponse(
                    items=items,
                    sum_du_no_dau=s_nd, sum_du_co_dau=s_cd,
                    sum_ps_no=s_pn, sum_ps_co=s_pc,
                    sum_du_no_cuoi=s_nc, sum_du_co_cuoi=s_cc,
                    is_mock=False,
                )
        except Exception as exc:
            logger.info(f"SQL offline fallback for trial balance: {exc}")
            rows = [
                TrialBalanceRow(tk="1111", ten_tk="Tiền mặt Việt Nam (Mẫu)", bac_tk=2, du_no_dau=150000000, ps_no=85000000, ps_co=42000000, du_no_cuoi=193000000),
                TrialBalanceRow(tk="11212", ten_tk="Tiền gửi ngân hàng BIDV (Mẫu)", bac_tk=2, du_no_dau=420000000, ps_no=310000000, ps_co=225000000, du_no_cuoi=505000000),
                TrialBalanceRow(tk="1311", ten_tk="Phải thu của khách hàng (Mẫu)", bac_tk=2, du_no_dau=280000000, ps_no=350000000, ps_co=310000000, du_no_cuoi=320000000),
                TrialBalanceRow(tk="1561", ten_tk="Hàng hóa tôn thép (Mẫu)", bac_tk=2, du_no_dau=640000000, ps_no=172000000, ps_co=260000000, du_no_cuoi=552000000),
                TrialBalanceRow(tk="3311", ten_tk="Phải trả người bán (Mẫu)", bac_tk=2, du_co_dau=290000000, ps_no=225000000, ps_co=188760000, du_co_cuoi=253760000),
                TrialBalanceRow(tk="5111", ten_tk="Doanh thu bán hàng hóa (Mẫu)", bac_tk=2, ps_no=0, ps_co=350000000, du_co_cuoi=350000000),
                TrialBalanceRow(tk="632", ten_tk="Giá vốn hàng bán (Mẫu)", bac_tk=1, ps_no=260000000, ps_co=0, du_no_cuoi=260000000),
            ]
            ql = clean_q.lower()
            filtered = [r for r in rows if not ql or ql in r.tk.lower() or ql in r.ten_tk.lower()]
            return TrialBalanceResponse(
                items=filtered,
                sum_du_no_dau=sum(r.du_no_dau for r in filtered),
                sum_du_co_dau=sum(r.du_co_dau for r in filtered),
                sum_ps_no=sum(r.ps_no for r in filtered),
                sum_ps_co=sum(r.ps_co for r in filtered),
                sum_du_no_cuoi=sum(r.du_no_cuoi for r in filtered),
                sum_du_co_cuoi=sum(r.du_co_cuoi for r in filtered),
                is_mock=True,
            )

    def get_gl_ledger(
        self,
        tk: str = "1111",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        q: Optional[str] = None,
    ) -> GlLedgerResponse:
        clean_tk = (tk or "1111").strip().upper()
        like_tk = f"{clean_tk}%"
        d1 = (from_date or f"{date.today().isoformat()[:7]}-01")[:10]
        d2 = (to_date or date.today().isoformat())[:10]
        clean_q = (q or "").strip()

        try:
            with get_db_cursor(self.vp_db) as cur:
                cur.execute(
                    f"SELECT {self.fn_uni}(ISNULL(Ten_Tk, '')) FROM {self.sys_db}.dbo.DmTk WITH (NOLOCK) WHERE Tk = ?",
                    [clean_tk],
                )
                r_tk = cur.fetchone()
                ten_tk = (r_tk[0] or "").strip() if r_tk else ""

                cur.execute(
                    f"""
                    SELECT
                        ISNULL((SELECT SUM(ISNULL(Du_No, 0) - ISNULL(Du_Co, 0)) FROM {self.vp_db}.dbo.CdK WITH (NOLOCK) WHERE Tk LIKE ?), 0)
                        + ISNULL((SELECT SUM(ISNULL(Tien, 0)) FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK) WHERE Tk_No LIKE ? AND Ngay_Ct < ?), 0)
                        - ISNULL((SELECT SUM(ISNULL(Tien, 0)) FROM {self.vp_db}.dbo.SoCai WITH (NOLOCK) WHERE Tk_Co LIKE ? AND Ngay_Ct < ?), 0)
                    """,
                    [like_tk, like_tk, d1, like_tk, d1],
                )
                du_dau = float(cur.fetchone()[0] or 0.0)

                q_sql = ""
                q_params: List[Any] = []
                if clean_q:
                    esc = f"%{_escape_like(clean_q.upper())}%"
                    esc_uni = f"%{_escape_like(clean_q)}%"
                    q_sql = (
                        f" AND (UPPER(ISNULL(s.So_Ct,'')) LIKE ? ESCAPE '\\' "
                        f"OR {self.fn_uni}(ISNULL(s.Dien_Giai,'')) LIKE ? ESCAPE '\\')"
                    )
                    q_params = [esc, esc_uni]

                cur.execute(
                    f"""
                    SELECT
                        RTRIM(s.Stt), s.Ngay_Ct, RTRIM(s.Ma_Ct), LTRIM(RTRIM(ISNULL(s.So_Ct, ''))),
                        RTRIM(COALESCE(NULLIF(s.Ma_Dt_No,''), NULLIF(s.Ma_Dt_Co,''), s.Ma_Dt0, '')),
                        {self.fn_uni}(ISNULL(d.Ten_Dt, '')),
                        {self.fn_uni}(ISNULL(s.Dien_Giai, '')),
                        RTRIM(s.Tk_No), RTRIM(s.Tk_Co), ISNULL(s.Tien, 0)
                    FROM {self.vp_db}.dbo.SoCai s WITH (NOLOCK)
                    LEFT JOIN {self.sys_db}.dbo.DmDt d WITH (NOLOCK)
                      ON d.Ma_Dt = COALESCE(NULLIF(s.Ma_Dt_No,''), NULLIF(s.Ma_Dt_Co,''), s.Ma_Dt0)
                    WHERE s.Ngay_Ct >= ? AND s.Ngay_Ct <= ?
                      AND (s.Tk_No LIKE ? OR s.Tk_Co LIKE ?)
                      {q_sql}
                    ORDER BY s.Ngay_Ct ASC, s.So_Ct ASC, s.SoCaiID ASC
                    """,
                    [d1, d2, like_tk, like_tk, *q_params],
                )
                running = du_dau
                entries: List[GlLedgerRow] = []
                for r in cur.fetchall():
                    tk_no = (r[7] or "").strip()
                    tk_co = (r[8] or "").strip()
                    amt = float(r[9] or 0.0)
                    is_no = tk_no.startswith(clean_tk)
                    ps_no = amt if is_no else 0.0
                    ps_co = amt if not is_no else 0.0
                    running += ps_no - ps_co
                    entries.append(
                        GlLedgerRow(
                            stt=(r[0] or "").strip(),
                            ngay_ct=r[1].strftime("%Y-%m-%d") if r[1] else "",
                            ma_ct=(r[2] or "").strip(),
                            so_ct=(r[3] or "").strip(),
                            ma_dt=(r[4] or "").strip(),
                            ten_dt=(r[5] or "").strip(),
                            dien_giai=(r[6] or "").strip(),
                            tk_no=tk_no,
                            tk_co=tk_co,
                            ps_no=ps_no,
                            ps_co=ps_co,
                            luy_ke=running,
                        )
                    )
                return GlLedgerResponse(
                    tk=clean_tk,
                    ten_tk=ten_tk,
                    du_dau=du_dau,
                    du_cuoi=running,
                    entries=entries,
                    is_mock=False,
                )
        except Exception as exc:
            logger.info(f"SQL offline fallback for GL ledger ({clean_tk}): {exc}")
            du_dau = 150000000.0
            e1 = GlLedgerRow(
                stt="MOCK_GL_1", ngay_ct=d1, ma_ct="C1", so_ct="PT012",
                ma_dt="KH001", ten_dt="Công ty Xây Dựng Bình Minh (Mẫu)",
                dien_giai="Thu tiền hàng đợt 1 (Mẫu)",
                tk_no=clean_tk, tk_co="1311", ps_no=85000000, ps_co=0, luy_ke=235000000,
            )
            e2 = GlLedgerRow(
                stt="MOCK_GL_2", ngay_ct=d2, ma_ct="C2", so_ct="PC009",
                ma_dt="NCC001", ten_dt="Công ty Vận Tải Minh Anh (Mẫu)",
                dien_giai="Chi phí vận chuyển giao hàng (Mẫu)",
                tk_no="6417", tk_co=clean_tk, ps_no=0, ps_co=42000000, luy_ke=193000000,
            )
            return GlLedgerResponse(
                tk=clean_tk,
                ten_tk=f"Tài khoản {clean_tk} (Dữ liệu mẫu)",
                du_dau=du_dau,
                du_cuoi=193000000.0,
                entries=[e1, e2],
                is_mock=True,
            )


module_voucher_repository = ModuleVoucherRepository()
