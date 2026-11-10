from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.services.voucher_service import voucher_service
from app.utils.money import number_to_words_vietnamese

router = APIRouter(prefix="/api/print", tags=["Print"])

@router.get("/{stt}", response_model=dict)
def get_print_payload(
    stt: str,
    loai: Optional[str] = Query("hd", description="'hd' (Hóa đơn GTGT) hoặc 'px' (Phiếu xuất kho)")
):
    """
    Chuẩn bị dữ liệu in phiếu đầy đủ cấu trúc: Header, Items, tiền bằng chữ, thuế GTGT.
    100% READ-ONLY.
    """
    voucher = voucher_service.get_voucher(stt)
    if not voucher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "VOUCHER_NOT_FOUND", "message": f"Không tìm thấy chứng từ {stt} để in."}
        )

    # Format date to Vietnamese formal style
    date_formatted = voucher.ngay_ct
    try:
        dt = datetime.strptime(voucher.ngay_ct, "%Y-%m-%d")
        formal_date = f"Ngày {dt.day:02d} tháng {dt.month:02d} năm {dt.year}"
    except Exception:
        formal_date = voucher.ngay_ct

    currency_suffix = "đồng" if voucher.ma_tte == "VND" else voucher.ma_tte
    total_val = voucher.ttien_nt0 if voucher.ma_tte != "VND" else (voucher.ttien0 or voucher.ttien_nt0)
    tien_chu = number_to_words_vietnamese(total_val, currency_suffix)

    # Items with sequential line numbers
    items_payload = []
    for i, it in enumerate(voucher.items, start=1):
        it_dict = it.model_dump()
        it_dict["line_no"] = i
        items_payload.append(it_dict)

    print_data = {
        "loai_in": loai,
        "title": "HÓA ĐƠN BÁN HÀNG KIÊM PHIẾU XUẤT KHO" if loai == "hd" else "PHIẾU XUẤT KHO KIÊM BIÊN BẢN GIAO HÀNG",
        "formal_date": formal_date,
        "tong_tien_chu": tien_chu,
        "header": voucher.model_dump(exclude={"items"}),
        "items": items_payload,
        "vat_breakdown": {
            "thue_suat": voucher.thue_gtgt,
            "ma_thue": voucher.ma_thue,
            "tien_truoc_thue": voucher.ttien_nt2,
            "tien_thue": voucher.ttien_nt3,
            "tong_thanh_toan": voucher.ttien_nt0
        },
        "printed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    return {
        "success": True,
        "data": print_data
    }
