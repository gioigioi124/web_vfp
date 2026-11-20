from contextlib import contextmanager
from datetime import datetime
from unittest.mock import MagicMock, patch

from app.repositories.pickup_repo import pickup_repository
from app.repositories.voucher_repo import voucher_repository
from app.schemas.voucher import VoucherCreateRequest, VoucherDetailSchema
from app.services.pickup_service import pickup_service


def _fake_tx_factory(mock_conn, mock_cur):
    @contextmanager
    def _fake_tx(db_name=None):
        try:
            yield mock_conn, mock_cur
            mock_conn.commit()
        except Exception:
            mock_conn.rollback()
            raise

    return _fake_tx


def test_n5_save_voucher_sales_accounting_and_skip_debt_limit():
    """
    N5 (Hàng bán bị trả lại) trên VP_2014:
    - Nh_Ct = '1', Gia_Tb_TT = 'K' (kể cả client gửi 'C')
    - Tk = '1561', Tk_Du = '632', Tk_Du2 = '5212' (mặc định nếu trống)
    - 4 cột giá vốn (Gia_Nt, Gia, Tien_Nt, Tien) và Header TTien_Nt/TTien = None (NULL)
    - CtBH_SoCai ghi Nợ 5212 (Ma_Dt_No='') / Có 1311 (Ma_Dt_Co='KH001') để giảm công nợ
    - Bỏ qua CHỐT 3 kiểm tra vượt hạn mức công nợ
    """
    executed = []
    mock_conn = MagicMock()
    mock_cur = MagicMock()

    def cur_execute(query, params=None):
        executed.append((query, list(params) if params is not None else []))
        return None

    def cur_fetchone():
        last_q = executed[-1][0] if executed else ""
        if "FROM VTSYS.dbo.DmDt" in last_q or "DmDt" in last_q:
            return (1,)
        if "SUM(Tien_Nt2)" in last_q:
            return (500000.0, 1)
        if "ST_Check_Number" in last_q:
            return (0,)
        return None

    mock_cur.execute.side_effect = cur_execute
    mock_cur.fetchone.side_effect = cur_fetchone

    req = VoucherCreateRequest(
        ma_dvcs="S1",
        ma_ct="N5",
        nh_ct="2",  # cố tình gửi sai để backend ép lại '1'
        ma_tte="VND",
        ty_gia=1.0,
        ngay_ct="2026-10-23",
        so_ct="001",
        ma_dt="KH001",
        ma_nx="131",
        tk2="1311",
        tk3="33311",
        thue_gtgt=0.0,
        loai_ck="2",
        ong_ba="Nguyễn Văn A",
        dia_chi="Hà Nội",
        dien_giai0="Hàng bán bị trả lại",
        skip_debt_check=False,
        items=[
            VoucherDetailSchema(
                ma_vt="MUT_D25",
                loai_vt="2",
                so_tam=5.0,
                he_so8=1.0,
                gia_nt9=100000.0,
                chiet_khau=0.0,
                ma_kho="K0101",
                tk="",
                tk_du="",
                tk_du2="",
                gia_tb_tt="C",  # cố tình gửi 'C' để backend ép 'K'
                stt_px="S1000000000014763999",
            )
        ],
    )

    with (
        patch.object(voucher_repository, "get_closing_date", return_value="2026-03-31"),
        patch(
            "app.repositories.debt_repo.debt_repository.get_customer_debt_summary",
            side_effect=AssertionError("N5 không được kiểm tra vượt hạn mức công nợ!"),
        ),
        patch.object(voucher_repository, "check_duplicate_number", return_value=(False, "001")),
        patch.object(voucher_repository, "generate_stt", return_value="S1N5_0001"),
        patch.object(voucher_repository, "generate_stts_batch", return_value=["S1N5_0001_01"]),
        patch("app.repositories.voucher_repo.get_db_transaction", side_effect=_fake_tx_factory(mock_conn, mock_cur)),
    ):
        res = voucher_repository.save_voucher(req, mode="M", db_mode="sales")

    assert res.stt == "S1N5_0001"
    assert res.so_ct == "001"
    mock_conn.commit.assert_called_once()

    header_calls = [p for q, p in executed if "INSERT INTO" in q and "dbo.CtBH (" in q]
    assert len(header_calls) == 1
    hdr = header_calls[0]
    assert hdr[2] == "N5"  # Ma_Ct
    assert hdr[3] == "1"   # Nh_Ct
    assert hdr[22] is None  # TTien_Nt
    assert hdr[24] == 500000.0  # TTien_Nt2
    assert hdr[27] is None  # TTien
    assert hdr[30] == 500000.0  # TTien2

    detail_calls = [p for q, p in executed if "INSERT INTO" in q and "dbo.CtBH0 (" in q]
    assert len(detail_calls) == 1
    dtl = detail_calls[0]
    assert dtl[3] == "1561"  # Tk
    assert dtl[4] == "632"   # Tk_Du
    assert dtl[5] == "5212"  # Tk_Du2
    assert dtl[21] is None and dtl[22] is None and dtl[23] is None and dtl[24] is None  # COGS NULL
    assert dtl[34] == "K"    # Gia_Tb_TT

    socai_calls = [p for q, p in executed if "CtBH_SoCai" in q and "CtBH_SoCaiVT_Save" not in q]
    assert len(socai_calls) == 1
    sc = socai_calls[0]
    assert sc[7] == "N5"     # @p_Ma_Ct
    assert sc[8] == "1"      # @p_Nh_Ct
    assert sc[12] == "5212"  # @p_Tk_No
    assert sc[13] == ""      # @p_Ma_Dt_No
    assert sc[14] == "1311"  # @p_Tk_Co
    assert sc[15] == "KH001" # @p_Ma_Dt_Co


def test_n5_save_voucher_warehouse_skips_socai_and_sets_k():
    """
    N5 trên KH_2014 (warehouse overlay):
    - Nh_Ct = '1', Gia_Tb_TT = 'K', Tk='155', Tk_Du='6322', Tk_Du2='5212'
    - Giá/tiền đều None và không ghi SoCai
    """
    executed = []
    mock_conn = MagicMock()
    mock_cur = MagicMock()

    def cur_execute(query, params=None):
        executed.append((query, list(params) if params is not None else []))
        return None

    def cur_fetchone():
        last_q = executed[-1][0] if executed else ""
        if "DmDt" in last_q:
            return (1,)
        if "SUM(Tien_Nt2)" in last_q:
            return (0.0, 1)
        return None

    mock_cur.execute.side_effect = cur_execute
    mock_cur.fetchone.side_effect = cur_fetchone

    req = VoucherCreateRequest(
        ma_dvcs="S1",
        ma_ct="N5",
        nh_ct="1",
        ma_tte="VND",
        ty_gia=1.0,
        ngay_ct="2026-10-23",
        so_ct="002",
        ma_dt="KH001",
        dien_giai0="",
        items=[
            VoucherDetailSchema(
                ma_vt="MUT_D25",
                loai_vt="2",
                so_tam=3.0,
                he_so8=2.0,
                gia_nt9=100000.0,
                ma_kho="K0101",
            )
        ],
    )

    with (
        patch.object(voucher_repository, "get_closing_date", return_value="2026-03-31"),
        patch.object(voucher_repository, "check_duplicate_number", return_value=(False, "002")),
        patch.object(voucher_repository, "generate_stt", return_value="K1N5_0001"),
        patch.object(voucher_repository, "generate_stts_batch", return_value=["K1N5_0001_01"]),
        patch("app.repositories.voucher_repo.get_db_transaction", side_effect=_fake_tx_factory(mock_conn, mock_cur)),
    ):
        res = voucher_repository.save_voucher(req, mode="M", db_mode="warehouse")

    assert res.stt == "K1N5_0001"
    detail_calls = [p for q, p in executed if "INSERT INTO" in q and "dbo.CtBH0 (" in q]
    assert len(detail_calls) == 1
    dtl = detail_calls[0]
    assert dtl[0] is None  # Stt_PX on KH_2014
    assert dtl[3] == "155"
    assert dtl[4] == "6322"
    assert dtl[5] == "5212"
    assert dtl[34] == "K"

    socai_calls = [p for q, p in executed if "CtBH_SoCai" in q and "CtBH_SoCaiVT_Save" not in q]
    assert socai_calls == []


def test_n5_daily_numbering_resets_per_day():
    """
    N5 đánh số 001, 002, 003... và tự reset về 001 khi sang ngày mới (Ngay_Ct).
    """
    def make_cursor(existing_by_day):
        cur = MagicMock()
        last_bounds = []

        def _exec(sql, params=None):
            nonlocal last_bounds
            last_bounds = list(params or [])
            return None

        def _fetchall():
            if len(last_bounds) >= 2:
                day_key = str(last_bounds[1])[:10]
                return [(s,) for s in existing_by_day.get(day_key, [])]
            return []

        def _fetchone():
            # ST_Check_Number returns 0 (not duplicate)
            return (0,)

        cur.execute.side_effect = _exec
        cur.fetchall.side_effect = _fetchall
        cur.fetchone.side_effect = _fetchone
        return cur

    existing = {
        "2026-10-23": ["001", "002", "HD0009"],
        "2026-10-24": [],
    }
    cur1 = make_cursor(existing)
    next_day1 = voucher_repository.get_next_voucher_number(
        ma_ct="N5", ngay_ct="2026-10-23", cur=cur1, db_mode="sales"
    )
    assert next_day1 == "003"

    cur2 = make_cursor(existing)
    next_day2 = voucher_repository.get_next_voucher_number(
        ma_ct="N5", ngay_ct="2026-10-24", cur=cur2, db_mode="sales"
    )
    assert next_day2 == "001"

    cur3 = make_cursor(existing)
    next_wh = voucher_repository.get_next_voucher_number(
        ma_ct="N5", ngay_ct="2026-10-23", cur=cur3, db_mode="warehouse"
    )
    assert next_wh == "003"


def test_pickup_list_and_accept_n5_mapping():
    """
    PickupRepository.list_ready_to_pickup lọc theo h.Ma_Ct = 'N5',
    và PickupService.accept_pickup(ma_ct='N5') trả về Gia_Tb_TT='K', Tk=Tk_Vt, Tk_Du=Tk_Gv, Tk_Du2=Tk_HBTL/'5212'.
    """
    captured_sql = {}
    mock_cur = MagicMock()

    def _exec(sql, params=None):
        captured_sql["sql"] = sql
        captured_sql["params"] = list(params or [])
        return None

    mock_cur.execute.side_effect = _exec
    mock_cur.fetchall.return_value = [
        ("K1000001", "001", datetime(2026, 10, 23), "KH001", "Hà Nội", "29C-111", "Khách A", 1, 5.0, 10.0, "N5")
    ]

    @contextmanager
    def _fake_read_cur(db_name=None):
        yield mock_cur

    with patch("app.repositories.pickup_repo.get_db_cursor", side_effect=_fake_read_cur):
        slips = pickup_repository.list_ready_to_pickup(ma_ct="N5", ma_dt="KH001")

    assert len(slips) == 1
    assert slips[0].ma_ct == "N5"
    assert "h.Ma_Ct = ?" in captured_sql["sql"]
    assert captured_sql["params"][0] == "N5"

    mock_item_1 = MagicMock(
        stt0="K10000010001",
        ma_vt="MUT_D25",
        ten_vt="Mút D25",
        dvt="Tam",
        dvt_ban="Tam",
        ma_kho="K0101",
        so_tam=5.0,
        he_so8=2.0,
        so_luong8=10.0,
        so_luong9=10.0,
        loai_vt="2",
        tk_gv="632",
        tk_vt="1561",
        tk_dt="5111",
        tk_ck="521",
        tk_hbtl="531",
    )
    mock_item_2 = MagicMock(
        stt0="K10000010002",
        ma_vt="KEO_01",
        ten_vt="Keo dán",
        dvt="Thung",
        dvt_ban="Thung",
        ma_kho="K0101",
        so_tam=2.0,
        he_so8=1.0,
        so_luong8=2.0,
        so_luong9=2.0,
        loai_vt="1",
        tk_gv="632",
        tk_vt="1561",
        tk_dt="5111",
        tk_ck="521",
        tk_hbtl="",
    )

    with (
        patch.object(
            pickup_service.repo,
            "get_pickup_slips_batch",
            return_value=({"K1000001": {"stt": "K1000001", "ma_xe": "29C-111", "ma_ct": "N5"}}, {"K1000001": [mock_item_1, mock_item_2]}),
        ),
        patch.object(
            pickup_service.price_repo,
            "get_prices_batch",
            return_value={"MUT_D25": {"gia": 100000.0, "chiet_khau": 0.0}},
        ),
    ):
        acc = pickup_service.accept_pickup(
            stts=["K1000001"],
            ma_dt="KH001",
            ngay_ct="2026-10-23",
            ma_ct="N5",
        )

    assert acc.total_rows == 2
    r1, r2 = acc.rows[0], acc.rows[1]
    assert r1.gia_tb_tt == "K"
    assert r1.tk == "1561"
    assert r1.tk_du == "632"
    assert r1.tk_du2 == "531"
    assert r2.gia_tb_tt == "K"
    assert r2.tk_du2 == "5212"


def test_debt_ledger_running_balance_luy_ke():
    """
    Sổ chi tiết công nợ tính lũy kế (luy_ke) chính xác qua từng chứng từ
    (Dư đầu + Ps tăng - Ps giảm) và về 0 khi khách trả hết.
    """
    from app.repositories.debt_repo import debt_repository

    mock_cur = MagicMock()
    queries = []

    def _exec(sql, params=None):
        queries.append(sql)
        return None

    def _fetchone():
        q = queries[-1] if queries else ""
        if "FROM VTSYS.dbo.DmDt" in q or "DmDt" in q:
            return ("Khách Hàng A", 5000000.0)
        if "CdK" in q:
            return (1000000.0,)
        return None

    def _fetchall():
        return [
            ("S1", "X1", datetime(2026, 11, 2), "HD0001", "Bán hàng", 2000000.0, 0.0),
            ("S2", "N5", datetime(2026, 11, 3), "001", "Hàng trả lại", 0.0, 500000.0),
            ("S3", "PT", datetime(2026, 11, 4), "PT001", "Thu tiền mặt", 0.0, 2500000.0),
        ]

    mock_cur.execute.side_effect = _exec
    mock_cur.fetchone.side_effect = _fetchone
    mock_cur.fetchall.side_effect = _fetchall

    @contextmanager
    def _fake_cur(db_name=None):
        yield mock_cur

    with patch("app.repositories.debt_repo.get_db_cursor", side_effect=_fake_cur):
        ledger = debt_repository.get_customer_debt_ledger(
            ma_dt="KH001", ngay_bd="2026-11-01", ngay_kt="2026-11-30"
        )

    assert ledger.du_dau == 1000000.0
    assert [e.luy_ke for e in ledger.entries] == [3000000.0, 2500000.0, 0.0]
    assert ledger.du_cuoi == 0.0

