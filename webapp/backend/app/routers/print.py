from datetime import datetime
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.config import settings
from app.database import get_db_cursor
from app.services.voucher_service import voucher_service
from app.utils.money import number_to_words_vietnamese

router = APIRouter(prefix="/api/print", tags=["Print"])


def _fetch_print_metadata(
    ma_dvcs: str,
    ma_ct: str,
    ma_dt: str,
    user_name: str,
    stt: str,
    ngay_ct: str,
    tk2: str,
    posted: bool,
    in_no_ck: str,
) -> Dict[str, Any]:
    """
    Truy vấn dữ liệu bổ sung cho mẫu in ctpxg.frx / ctpng.frx (100% READ-ONLY):
    - Thông tin đơn vị (VTSYS.dbo.DmDvCs)
    - Tiêu đề phiếu (VTSYS.dbo.DocumentNumber)
    - Địa chỉ & SĐT khách hàng từ DmDt (theo chuẩn In_Ct_Hd: không lấy CtBH.Dia_Chi)
    - Tên tài khoản người lập (UserName ngắn gọn, VD: KTCN3)
    - Thời gian SQL Server (GETDATE())
    - Nợ cũ _Du_Dau (GL_Alert_ClosingAccount4Customer khi in_no_ck='C' & Posted=1)
    """
    vp_db = settings.DB_VP
    sys_db = settings.DB_SYS
    fn_uni = f"{vp_db}.dbo.fn_TCVNToUnicode"

    company = {
        "ten_dvcs": "Công ty chăn ga gối đệm Elan",
        "dien_thoai": "",
        "fax": "",
    }
    doc_title = (
        "Phiếu nhập hàng trả lại"
        if (ma_ct or "").strip().upper() == "N5"
        else "Phiếu xuất bán"
    )
    customer_address = ""
    customer_phone = ""
    creator_name = (user_name or "").strip().upper()
    sql_time = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    du_dau = 0.0

    with get_db_cursor(vp_db) as cur:
        cur.execute(
            f"""
            SELECT TOP 1
                RTRIM(ISNULL(dien_thoai, '')) AS Dien_Thoai,
                RTRIM(ISNULL(fax, '')) AS Fax
            FROM {sys_db}.dbo.DmDvCs WITH (NOLOCK)
            WHERE Ma_DvCs = ?
            """,
            [(ma_dvcs or "S1").strip()],
        )
        r = cur.fetchone()
        if r:
            company = {
                "ten_dvcs": "Công ty chăn ga gối đệm Elan",
                "dien_thoai": (r[0] or "").strip(),
                "fax": (r[1] or "").strip(),
            }

        if ma_ct:
            cur.execute(
                f"""
                SELECT TOP 1 {fn_uni}(Tieu_De) AS Tieu_De
                FROM {sys_db}.dbo.DocumentNumber WITH (NOLOCK)
                WHERE Ma_Ct = ?
                """,
                [ma_ct.strip().upper()],
            )
            r = cur.fetchone()
            if r and r[0] and r[0].strip():
                doc_title = r[0].strip()

        if ma_dt:
            cur.execute(
                f"""
                SELECT TOP 1
                    {fn_uni}(Dia_Chi) AS Dia_Chi,
                    RTRIM(ISNULL(Phone, '')) AS Phone
                FROM {sys_db}.dbo.DmDt WITH (NOLOCK)
                WHERE Ma_Dt = ?
                """,
                [ma_dt.strip()],
            )
            r = cur.fetchone()
            if r:
                customer_address = (r[0] or "").strip()
                customer_phone = (r[1] or "").strip()

        cur.execute("SELECT GETDATE()")
        r = cur.fetchone()
        if r and r[0]:
            sql_time = r[0].strftime("%d/%m/%Y %H:%M:%S")

        if (in_no_ck or "K").strip().upper() == "C" and posted and ma_dt:
            try:
                tk_parent = (tk2 or "131").strip()[:3] or "131"
                cur.execute(
                    f"""
                    SET NOCOUNT ON;
                    DECLARE @p_Ten_Tk nvarchar(64),
                            @p_Ten_Tk_E nvarchar(64),
                            @p_Ten_Dt nvarchar(64),
                            @p_Du_No numeric(18,2),
                            @p_Du_Co numeric(18,2);
                    EXEC {vp_db}.dbo.GL_Alert_ClosingAccount4Customer
                        @p_Ma_Dvcs = ?,
                        @p_Stt = ?,
                        @p_Ngay_Ct = ?,
                        @p_Tk = ?,
                        @p_Ten_Tk = @p_Ten_Tk OUTPUT,
                        @p_Ten_Tk_E = @p_Ten_Tk_E OUTPUT,
                        @p_Ma_Dt = ?,
                        @p_Ten_Dt = @p_Ten_Dt OUTPUT,
                        @p_Du_No = @p_Du_No OUTPUT,
                        @p_Du_Co = @p_Du_Co OUTPUT;
                    SELECT ISNULL(@p_Du_No, 0) AS Du_No, ISNULL(@p_Du_Co, 0) AS Du_Co;
                    """,
                    [
                        (ma_dvcs or "S1").strip(),
                        stt.strip(),
                        ngay_ct,
                        tk_parent,
                        ma_dt.strip(),
                    ],
                )
                row = cur.fetchone()
                if row:
                    du_dau = float(row[0] or 0.0) - float(row[1] or 0.0)
            except Exception:
                du_dau = 0.0

    return {
        "company": company,
        "title": doc_title,
        "customer_address": customer_address,
        "customer_phone": customer_phone,
        "creator_name": creator_name,
        "sql_time": sql_time,
        "du_dau": du_dau,
    }


@router.get("/{stt}", response_model=dict)
def get_print_payload(
    stt: str,
    loai: Optional[str] = Query("hd", description="'hd' (ctpxg/ctpng) hoặc 'px'"),
    in_gia: str = Query("1", description="'1' In giá bán, '0' Không in giá"),
    in_no_ck: str = Query("K", description="'C' Có in nợ cũ, 'K' Không in nợ cũ"),
):
    """
    Chuẩn bị dữ liệu in phiếu theo đúng logic VFP In_Ct_Hd (RPT\\ctpxg.frx / RPT\\ctpng.frx).
    100% READ-ONLY.
    """
    voucher = voucher_service.get_voucher(stt)
    if not voucher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "VOUCHER_NOT_FOUND", "message": f"Không tìm thấy chứng từ {stt} để in."},
        )

    try:
        dt = datetime.strptime(voucher.ngay_ct, "%Y-%m-%d")
        formal_date = f"Ngày {dt.day:02d} tháng {dt.month:02d} năm {dt.year}"
    except Exception:
        formal_date = voucher.ngay_ct

    meta = _fetch_print_metadata(
        ma_dvcs=voucher.ma_dvcs or "S1",
        ma_ct=voucher.ma_ct or "X1",
        ma_dt=voucher.ma_dt or "",
        user_name=voucher.user_name or "",
        stt=voucher.stt,
        ngay_ct=voucher.ngay_ct,
        tk2=voucher.tk2 or "1311",
        posted=bool(voucher.posted),
        in_no_ck=in_no_ck,
    )

    # Biến đổi P_CtTemp giống In_Ct_Hd (§2.4):
    # Loai_Vt IN ('2','3') -> So_Luong_In = So_Tam và hiển thị Cm(Kg) = He_So8;
    # Loai_Vt IN ('1','4') -> So_Luong_In = So_Luong9 và ẩn Cm(Kg).
    items_payload = []
    tso_loai = 0.0
    for i, it in enumerate(voucher.items, start=1):
        it_dict = it.model_dump()
        loai_vt = (it.loai_vt or "").strip()
        is_mut = loai_vt in ("2", "3")
        he_so8 = float(it.he_so8 or 0.0)
        so_luong_in = float(it.so_tam or 0.0) if is_mut else float(it.so_luong9 or 0.0)
        he_so_in = he_so8 if (is_mut and he_so8 != 0) else 0.0

        tso_loai += so_luong_in
        it_dict["line_no"] = i
        it_dict["so_luong_in"] = so_luong_in
        it_dict["he_so_in"] = he_so_in
        items_payload.append(it_dict)

    currency_suffix = "đồng" if (voucher.ma_tte or "VND").upper() == "VND" else voucher.ma_tte
    tong_tien_val = float(
        voucher.ttien_nt2
        if (voucher.ma_tte or "VND").upper() != "VND"
        else (voucher.ttien2 or voucher.ttien_nt2 or 0.0)
    )
    tong_tien_chu = number_to_words_vietnamese(tong_tien_val, currency_suffix)
    du_dau = float(meta["du_dau"] or 0.0)
    tong_no = du_dau + tong_tien_val

    print_data = {
        "loai_in": loai,
        "in_gia": "0" if str(in_gia).strip() == "0" else "1",
        "in_no_ck": "C" if str(in_no_ck).strip().upper() == "C" else "K",
        "company": meta["company"],
        "title": meta["title"],
        "customer_address": meta["customer_address"],
        "customer_phone": meta["customer_phone"],
        "creator_name": meta["creator_name"],
        "sql_time": meta["sql_time"],
        "formal_date": formal_date,
        "tso_loai": round(tso_loai, 2),
        "du_dau": du_dau,
        "tong_no": tong_no,
        "tong_tien_chu": tong_tien_chu,
        "header": voucher.model_dump(exclude={"items"}),
        "items": items_payload,
        "vat_breakdown": {
            "thue_suat": voucher.thue_gtgt,
            "ma_thue": voucher.ma_thue,
            "tien_truoc_thue": voucher.ttien_nt2,
            "tien_thue": voucher.ttien_nt3,
            "tong_thanh_toan": voucher.ttien_nt0,
        },
        "printed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    return {
        "success": True,
        "data": print_data,
    }
