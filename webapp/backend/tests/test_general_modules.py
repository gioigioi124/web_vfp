from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock, patch

import pyodbc
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.repositories.lookup_repo import lookup_repository
from app.repositories.module_voucher_repo import module_voucher_repository


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _ctx_for_cursor(cur: MagicMock):
    ctx = MagicMock()
    ctx.__enter__.return_value = cur
    ctx.__exit__.return_value = False
    return ctx


def _tx_for_cursor(cur: MagicMock):
    conn = MagicMock()
    tx = MagicMock()
    tx.__enter__.return_value = (conn, cur)
    tx.__exit__.return_value = False
    return tx


def test_sql_offline_returns_503_no_mock_fallback(client: TestClient):
    op_err = pyodbc.OperationalError("08001", "[08001] Could not open a connection to SQL Server")
    with patch("app.repositories.module_voucher_repo.get_db_cursor", side_effect=op_err):
        for path in (
            "/api/modules/purchase/vouchers",
            "/api/modules/inv-io/vouchers",
            "/api/modules/inv-transfer/vouchers",
            "/api/modules/gl-voucher/vouchers",
            "/api/accounting/partner-balances?tk_prefix=131",
            "/api/accounting/partner-ledger?tk_prefix=131&ma_dt=KH001",
            "/api/accounting/trial-balance",
            "/api/accounting/gl-ledger?tk=1111",
        ):
            res = client.get(path)
            assert res.status_code == 503, f"Expected 503 for {path}, got {res.status_code}"
            assert res.json()["detail"]["code"] == "SQL_UNAVAILABLE"


def test_unknown_module_returns_404(client: TestClient):
    res = client.get("/api/modules/unknown-mod/vouchers")
    assert res.status_code == 404


def test_chung_tu_document_lookup_classification(client: TestClient):
    lookup_repository.invalidate_cache("chung_tu")
    cur = MagicMock()
    cur.fetchall.return_value = [
        (1, "N1", "Phiếu nhập mua hàng", "V", "1", "C", "K", "", "3311", "CTPN", "K", "K", ""),
        (2, "NX", "Phiếu nhập kho khác", "V", "1", "K", "K", "", "1561", "CTPN", "K", "K", ""),
        (3, "CK", "Phiếu chuyển kho", "V", "2", "K", "K", "", "1561", "CTCK", "K", "K", ""),
        (4, "PK", "Phiếu kế toán khác", "K", "1", "K", "K", "", "", "CTPK", "K", "K", ""),
        (5, "X1", "Hóa đơn bán hàng", "V", "2", "C", "K", "", "1311", "CTHD", "C", "C", ""),
    ]
    with patch("app.repositories.lookup_repo.get_db_cursor", return_value=_ctx_for_cursor(cur)):
        res = client.get("/api/lookups/chung-tu?module_key=purchase")
        assert res.status_code == 200
        rows = res.json()["data"]
        assert len(rows) == 1
        assert rows[0]["ma_ct"] == "N1"
        assert rows[0]["module_key"] == "purchase"

        res_ck = client.get("/api/lookups/chung-tu?module_key=inv-transfer")
        assert res_ck.status_code == 200
        assert res_ck.json()["data"][0]["ma_ct"] == "CK"


def test_purchase_save_writes_star9_socaivt_and_socai_with_vat(client: TestClient):
    cur = MagicMock()
    # 1. DmDt exists; 2. DmNx exists ('C'); 3. ST_Check_Number -> 0;
    # 4. Integrity COUNT/SUM check -> (1, 1000000.0)
    cur.fetchone.side_effect = [
        (1,),          # DmDt check
        ("C",),        # DmNx check
        (0,),          # ST_Check_Number
        (1, 1000000.0),  # Integrity assertion
    ]
    cur.fetchall.side_effect = [
        [("VT01",)],   # DmVt check
        [("K1",)],     # DmKho check
        [("3311",), ("1561",), ("1331",)],  # DmTk check
    ]

    mock_detail = {
        "stt": "S1000000000000000010",
        "ma_dvcs": "S1",
        "ma_ct": "N1",
        "nh_ct": "1",
        "ngay_ct": "2026-11-20",
        "so_ct": "N100001",
        "ma_dt": "NCC01",
        "ten_dt": "Nhà CC Hòa Phát",
        "ong_ba": "",
        "dia_chi": "",
        "dien_giai0": "Nhập tôn cuộn",
        "ma_nx": "NMUA",
        "tk": "3311",
        "ma_hd": "",
        "ma_bp": "",
        "ma_km": "",
        "ma_xe": "",
        "ma_tte": "VND",
        "ty_gia": 1.0,
        "ttien_nt0": 1000000.0,
        "ttien_nt3": 100000.0,
        "ttien_nt": 1100000.0,
        "posted": True,
        "confirmed": True,
        "user_name": "ADMIN",
        "so_ct0": "000123",
        "ngay_ct0": "2026-11-20",
        "so_seri0": "1C26THP",
        "ma_thue": "10",
        "thue_gtgt": 10.0,
        "tk3": "1331",
        "tk_du3": "3311",
        "ma_dtgtgt": "0101234567",
        "ten_dtgtgt": "Công ty Hòa Phát",
        "ct_di_kem": "",
        "item_count": 1,
        "items": [
            {
                "stt0": "S1000000000000000011",
                "stt": "S1000000000000000010",
                "ma_kho": "K1",
                "ma_vt": "VT01",
                "ten_vt": "Tôn cuộn",
                "dvt": "Cuộn",
                "he_so9": 10.0,
                "so_luong9": 2.0,
                "gia_nt9": 500000.0,
                "tien_nt9": 1000000.0,
                "so_luong": 20.0,
                "gia_nt": 50000.0,
                "tien_nt": 1000000.0,
                "tien_nt3": 100000.0,
                "tk": "3311",
                "tk_du": "1561",
            }
        ],
    }

    payload = {
        "ma_ct": "N1",
        "nh_ct": "1",
        "ngay_ct": "2026-11-20",
        "so_ct": "N100001",
        "ma_dt": "NCC01",
        "ma_nx": "NMUA",
        "tk": "3311",
        "tk3": "1331",
        "tk_du3": "3311",
        "ma_thue": "10",
        "thue_gtgt": 10.0,
        "so_ct0": "000123",
        "so_seri0": "1C26THP",
        "ngay_ct0": "2026-11-20",
        "dien_giai0": "Nhập tôn cuộn",
        "items": [
            {
                "ma_kho": "K1",
                "ma_vt": "VT01",
                "dvt": "Cuộn",
                "he_so9": 10.0,
                "so_luong9": 2.0,
                "gia_nt9": 500000.0,
                "tien_nt9": 1000000.0,
                "tk": "3311",
                "tk_du": "1561",
            }
        ],
    }

    with (
        patch("app.repositories.module_voucher_repo.get_db_transaction", return_value=_tx_for_cursor(cur)),
        patch("app.repositories.module_voucher_repo.voucher_repository.get_closing_date", return_value=""),
        patch("app.repositories.module_voucher_repo.voucher_repository.generate_stt", return_value="S1000000000000000010"),
        patch("app.repositories.module_voucher_repo.voucher_repository.generate_stts_batch", return_value=["S1000000000000000011"]),
        patch.object(module_voucher_repository, "get_voucher", return_value=mock_detail),
    ):
        res = client.post("/api/modules/purchase/vouchers", json=payload)
        assert res.status_code == 200
        sql_calls = [str(c.args[0]) for c in cur.execute.call_args_list if c.args]
        assert any("INSERT INTO" in s and "dbo.CtMH" in s for s in sql_calls)
        assert any("INSERT INTO" in s and "dbo.CtMH0" in s and "He_So9" in s for s in sql_calls)
        assert any("INSERT INTO" in s and "dbo.SoCaiVT" in s for s in sql_calls)
        socai_inserts = [c for c in cur.execute.call_args_list if c.args and "dbo.SoCai (" in str(c.args[0])]
        # 2 SoCai lines: goods (1561 / 3311) + VAT (1331 / 3311)
        assert len(socai_inserts) == 2


def test_inv_io_dinh_khoan_k_writes_socaivt_only(client: TestClient):
    cur = MagicMock()
    cur.fetchone.side_effect = [
        (1,),         # DmDt exists
        ("K",),       # DmNx Dinh_Khoan='K' -> skip SoCai
        (0,),         # ST_Check_Number
        (1, 500000.0),
    ]
    cur.fetchall.side_effect = [
        [("VT01",)],
        [("K1",)],
        [("1561",), ("711",)],
    ]

    payload = {
        "ma_ct": "NX",
        "nh_ct": "1",
        "ngay_ct": "2026-11-20",
        "so_ct": "NX0001",
        "ma_dt": "NB",
        "ma_nx": "NK_K",
        "tk": "711",
        "items": [
            {
                "ma_kho": "K1",
                "ma_vt": "VT01",
                "dvt": "Cái",
                "he_so9": 1.0,
                "so_luong9": 5.0,
                "gia_nt9": 100000.0,
                "tien_nt9": 500000.0,
                "tk": "711",
                "tk_du": "1561",
            }
        ],
    }

    with (
        patch("app.repositories.module_voucher_repo.get_db_transaction", return_value=_tx_for_cursor(cur)),
        patch("app.repositories.module_voucher_repo.voucher_repository.get_closing_date", return_value=""),
        patch("app.repositories.module_voucher_repo.voucher_repository.generate_stt", return_value="S1_NX_1"),
        patch("app.repositories.module_voucher_repo.voucher_repository.generate_stts_batch", return_value=["S1_NX_1A"]),
        patch.object(module_voucher_repository, "get_voucher", return_value={
            "stt": "S1_NX_1", "ma_ct": "NX", "nh_ct": "1", "ngay_ct": "2026-11-20",
            "so_ct": "NX0001", "ma_dt": "NB", "ttien_nt": 500000.0, "items": [],
        }),
    ):
        res = client.post("/api/modules/inv-io/vouchers", json=payload)
        assert res.status_code == 200
        sql_calls = [str(c.args[0]) for c in cur.execute.call_args_list if c.args]
        assert any("dbo.SoCaiVT" in s for s in sql_calls)
        assert not any("dbo.SoCai (" in s for s in sql_calls)


def test_inv_transfer_rejects_same_warehouse(client: TestClient):
    cur = MagicMock()
    cur.fetchone.side_effect = [(1,), ("C",)]
    cur.fetchall.side_effect = [[("VT01",)], [("K1",)], [("1561",)]]

    payload = {
        "ma_ct": "CK",
        "nh_ct": "2",
        "ngay_ct": "2026-11-20",
        "so_ct": "CK001",
        "ma_dt": "NB",
        "ma_nx": "CKNB",
        "tk": "1561",
        "items": [
            {
                "ma_kho": "K1",
                "ma_kho_n": "K1",
                "ma_vt": "VT01",
                "so_luong9": 10,
                "gia_nt9": 10000,
                "tien_nt9": 100000,
                "tk": "1561",
                "tk_du": "1561",
            }
        ],
    }

    with (
        patch("app.repositories.module_voucher_repo.get_db_transaction", return_value=_tx_for_cursor(cur)),
        patch("app.repositories.module_voucher_repo.voucher_repository.get_closing_date", return_value=""),
    ):
        res = client.post("/api/modules/inv-transfer/vouchers", json=payload)
        assert res.status_code == 400
        assert "Kho nhận" in res.json()["detail"]


def test_gl_voucher_rejects_unbalanced_and_posts_paired_socai_on_edit(client: TestClient):
    # 1. Unbalanced Nợ != Có -> 400
    cur_bad = MagicMock()
    cur_bad.fetchone.return_value = (1,)
    cur_bad.fetchall.side_effect = [[("6427",), ("242",)]]
    bad_payload = {
        "ma_ct": "PK",
        "ngay_ct": "2026-11-20",
        "so_ct": "PK001",
        "items": [
            {"stt_nv": 1, "no_co": "N", "tk": "6427", "tien_nt": 500000},
            {"stt_nv": 1, "no_co": "C", "tk": "242", "tien_nt": 300000},
        ],
    }
    with (
        patch("app.repositories.module_voucher_repo.get_db_transaction", return_value=_tx_for_cursor(cur_bad)),
        patch("app.repositories.module_voucher_repo.voucher_repository.get_closing_date", return_value=""),
    ):
        res = client.post("/api/modules/gl-voucher/vouchers", json=bad_payload)
        assert res.status_code == 400
        assert "chưa cân đối" in res.json()["detail"]

    # 2. Balanced edit (1 Debit -> 2 Credits) -> deletes SoCai first then inserts 2 SoCai lines
    cur_ok = MagicMock()
    cur_ok.fetchone.side_effect = [
        (0,),              # ST_Check_Number
        (3, 500000.0, 500000.0),  # Integrity check CtK0
    ]
    cur_ok.fetchall.side_effect = [[("6427",), ("242",), ("3388",)]]

    good_payload = {
        "ma_ct": "PK",
        "ngay_ct": "2026-11-20",
        "so_ct": "PK001",
        "dien_giai0": "Phân bổ CP",
        "items": [
            {"stt_nv": 1, "no_co": "N", "tk": "6427", "tien_nt": 500000},
            {"stt_nv": 1, "no_co": "C", "tk": "242", "tien_nt": 300000},
            {"stt_nv": 1, "no_co": "C", "tk": "3388", "tien_nt": 200000},
        ],
    }
    with (
        patch("app.repositories.module_voucher_repo.get_db_transaction", return_value=_tx_for_cursor(cur_ok)),
        patch("app.repositories.module_voucher_repo.voucher_repository.get_closing_date", return_value=""),
        patch("app.repositories.module_voucher_repo.voucher_repository.generate_stts_batch", return_value=["S1", "S2", "S3"]),
        patch.object(module_voucher_repository, "get_voucher", return_value={
            "stt": "S1_PK_1", "ma_ct": "PK", "nh_ct": "1", "ngay_ct": "2026-11-20",
            "so_ct": "PK001", "ttien_nt": 500000.0, "items": [],
        }),
    ):
        res = client.put("/api/modules/gl-voucher/vouchers/S1_PK_1", json=good_payload)
        assert res.status_code == 200
        sql_calls = [str(c.args[0]) for c in cur_ok.execute.call_args_list if c.args]
        del_idx = next(i for i, s in enumerate(sql_calls) if "DELETE FROM" in s and "dbo.SoCai " in s)
        ins_indices = [i for i, s in enumerate(sql_calls) if "INSERT INTO" in s and "dbo.SoCai (" in s]
        assert len(ins_indices) == 2
        assert all(i > del_idx for i in ins_indices)


def test_delete_voucher_checks_closing_date_and_calls_sp(client: TestClient):
    # Blocked when Ngay_Ct <= Ngay_Kt_Ht
    cur_locked = MagicMock()
    cur_locked.fetchone.return_value = (datetime(2026, 10, 31), "S1")
    with (
        patch("app.repositories.module_voucher_repo.get_db_transaction", return_value=_tx_for_cursor(cur_locked)),
        patch("app.repositories.module_voucher_repo.voucher_repository.get_closing_date", return_value="2026-10-31"),
    ):
        res = client.delete("/api/modules/purchase/vouchers/S1_MH_1")
        assert res.status_code == 400
        assert "khóa sổ" in res.json()["detail"]

    # Allowed when after closing date -> executes CtMH_Delete with SET NOCOUNT ON
    cur_ok = MagicMock()
    cur_ok.fetchone.return_value = (datetime(2026, 11, 20), "S1")
    with (
        patch("app.repositories.module_voucher_repo.get_db_transaction", return_value=_tx_for_cursor(cur_ok)),
        patch("app.repositories.module_voucher_repo.voucher_repository.get_closing_date", return_value="2026-10-31"),
    ):
        res = client.delete("/api/modules/purchase/vouchers/S1_MH_1?user_name=KTTH")
        assert res.status_code == 200
        sql_calls = [str(c.args[0]) for c in cur_ok.execute.call_args_list if c.args]
        assert any("SET NOCOUNT ON; EXEC" in s and "CtMH_Delete" in s for s in sql_calls)


def test_partner_balances_trial_balance_and_gl_ledger_sql(client: TestClient):
    cur = MagicMock()
    cur.fetchall.return_value = [
        ("KH001", "Công ty A", "HN", 10000000.0, 0.0, 5000000.0, 3000000.0, 2),
    ]
    with patch("app.repositories.module_voucher_repo.get_db_cursor", return_value=_ctx_for_cursor(cur)):
        res = client.get("/api/accounting/partner-balances?tk_prefix=131")
        assert res.status_code == 200
        body = res.json()
        assert body["items"][0]["du_no_cuoi"] == 12000000.0
        assert body["sum_du_no_cuoi"] == 12000000.0

    cur_tb = MagicMock()
    cur_tb.fetchall.return_value = [
        ("1111", "Tiền mặt", 2, 5000000.0, 0.0, 2000000.0, 1000000.0),
    ]
    with patch("app.repositories.module_voucher_repo.get_db_cursor", return_value=_ctx_for_cursor(cur_tb)):
        res_tb = client.get("/api/accounting/trial-balance")
        assert res_tb.status_code == 200
        tb = res_tb.json()
        assert tb["items"][0]["du_no_cuoi"] == 6000000.0
