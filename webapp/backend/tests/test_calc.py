import pytest
from app.services.calc_service import calc_service
from app.schemas.calc import CalcRequest, CalcItemInput

def test_calc_loai2_mut_xop():
    # Hàng mút: So_Tam = 20, He_So8 = 1.5 -> So_Luong8 = So_Luong9 = 30
    req = CalcRequest(
        ma_tte="VND",
        ty_gia=1.0,
        thue_gtgt=10.0,
        loai_ck="1",
        items=[
            CalcItemInput(
                loai_vt="2",
                so_tam=20.0,
                he_so8=1.5,
                gia_nt9=100000.0,
                chiet_khau=5.0
            )
        ]
    )
    res = calc_service.calculate_voucher(req)
    item = res.items[0]

    # Verify Calc_Loai2 rules
    assert item.so_luong8 == 30.0
    assert item.so_luong9 == 30.0
    assert item.so_luong == 30.0
    assert item.tien_nt9 == 3000000.0

    # Discount 5% of 3,000,000 = 150,000
    assert item.tien_nt4 == 150000.0
    # Amount after discount: 3,000,000 - 150,000 = 2,850,000
    assert item.tien_nt2 == 2850000.0
    assert item.gia_nt2 == 95000.0

    # VAT 10% on 2,850,000 = 285,000
    assert res.header.ttien_nt3 == 285000.0

    # Invariant: TTien_Nt0 = TTien_Nt2 + TTien_Nt3 = 2,850,000 + 285,000 = 3,135,000
    assert res.header.ttien_nt0 == 3135000.0
    assert res.header.ttien_nt0 == res.header.ttien_nt2 + res.header.ttien_nt3

def test_no_double_discount_invariant():
    # Test that TTien_Nt0 is strictly TTien_Nt2 + TTien_Nt3 and NOT TTien_Nt2 + TTien_Nt3 - TTien_Nt4
    req = CalcRequest(
        ma_tte="VND",
        ty_gia=1.0,
        thue_gtgt=10.0,
        loai_ck="1",
        items=[
            CalcItemInput(
                loai_vt="1",
                so_luong9=10.0,
                gia_nt9=50000.0,
                chiet_khau=10.0
            )
        ]
    )
    res = calc_service.calculate_voucher(req)
    # Total before discount: 500,000
    # Discount: 50,000
    # After discount: 450,000
    # Tax: 45,000
    # Total payable must be 495,000
    assert res.header.ttien_nt == 500000.0
    assert res.header.ttien_nt4 == 50000.0
    assert res.header.ttien_nt2 == 450000.0
    assert res.header.ttien_nt3 == 45000.0
    assert res.header.ttien_nt0 == 495000.0
    assert res.header.ttien_nt0 == res.header.ttien_nt2 + res.header.ttien_nt3

def test_penny_remainder_adjustment():
    # Test manual header discount allocation
    req = CalcRequest(
        ma_tte="VND",
        ty_gia=1.0,
        thue_gtgt=0.0,
        loai_ck="1",
        ttien_nt4_manual=100.0,
        items=[
            CalcItemInput(loai_vt="1", so_luong9=1.0, gia_nt9=333.33),
            CalcItemInput(loai_vt="1", so_luong9=1.0, gia_nt9=333.33),
            CalcItemInput(loai_vt="1", so_luong9=1.0, gia_nt9=333.34),
        ]
    )
    res = calc_service.calculate_voucher(req)
    # Sum of line discounts must equal exactly 100.0
    assert sum(it.tien_nt4 for it in res.items) == 100.0
    assert res.header.ttien_nt4 == 100.0
