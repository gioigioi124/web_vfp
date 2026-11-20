import base64
import io
import zipfile
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.repositories.cash_voucher_repo import (
    _parse_amount,
    _parse_excel_date,
    cash_voucher_repository,
    parse_xlsx_rows,
)
from app.schemas.cash_voucher import (
    BaoCoImportCommitRequest,
    BaoCoImportRowInput,
    CashVoucherCreateRequest,
    CashVoucherDetailSchema,
)

client = TestClient(app)


def _make_minimal_xlsx(rows):
    """Build a minimal valid .xlsx byte buffer in memory for testing stdlib parser."""
    sheet_rows = []
    for r_idx, row in enumerate(rows, start=1):
        cells = []
        for c_idx, val in enumerate(row):
            col_letter = chr(ord("A") + c_idx)
            ref = f"{col_letter}{r_idx}"
            if isinstance(val, (int, float)):
                cells.append(f'<c r="{ref}"><v>{val}</v></c>')
            else:
                esc = (
                    str(val)
                    .replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                )
                cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{esc}</t></is></c>')
        sheet_rows.append(f'<row r="{r_idx}">{"".join(cells)}</row>')

    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(sheet_rows)}</sheetData>'
        "</worksheet>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    return buf.getvalue()


def test_parse_excel_date_and_amount():
    assert _parse_excel_date("20/11/2026") == "2026-11-20"
    assert _parse_excel_date("2026-11-20") == "2026-11-20"
    assert _parse_excel_date(46346) == "2026-11-20"
    assert _parse_amount("100,000,000") == 100000000.0
    assert _parse_amount("100.000.000") == 100000000.0
    assert _parse_amount("1500000.50") == 1500000.5


def test_parse_xlsx_and_preview_baoco():
    xlsx_bytes = _make_minimal_xlsx([
        ["Tên TK", "Số TK", "Nội dung", "Số tiền", "Ngày", "Mã KH"],
        ["VCB", "001100", "Thu tiền hàng T11", 50000000, "19/11/2026", "KH001"],
        ["VCB", "001100", "Dòng lỗi tiền", 0, "19/11/2026", "KH001"],
    ])
    parsed = parse_xlsx_rows(xlsx_bytes)
    assert len(parsed) == 3

    mock_cur = MagicMock()
    mock_cur.fetchall.return_value = [("KH001", "Công ty A", "Hà Nội")]
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = mock_cur
    mock_ctx.__exit__.return_value = False

    with patch("app.repositories.cash_voucher_repo.get_db_cursor", return_value=mock_ctx):
        b64 = base64.b64encode(xlsx_bytes).decode("ascii")
        resp = client.post(
            "/api/cash-vouchers/import-baoco/preview",
            json={"filename": "baoco.xlsx", "content_base64": b64},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        data = body["data"]
        assert data["total_rows"] == 2
        assert data["valid_rows"] == 1
        assert data["invalid_rows"] == 1
        assert data["rows"][0]["ma_dt"] == "KH001"
        assert data["rows"][0]["ten_dt"] == "Công ty A"
        assert data["rows"][0]["ngay_ct"] == "2026-11-19"


def test_save_cash_voucher_computes_totals_and_calls_ctt_post():
    mock_cur = MagicMock()
    mock_cur.fetchone.return_value = (1,)  # DmDt exists
    mock_conn = MagicMock()
    mock_tx = MagicMock()
    mock_tx.__enter__.return_value = (mock_conn, mock_cur)
    mock_tx.__exit__.return_value = False

    req = CashVoucherCreateRequest(
        ma_ct="C3",
        ngay_ct="2026-11-20",
        ma_dt0="KH001",
        dien_giai0="Thu chuyển khoản",
        items=[
            CashVoucherDetailSchema(
                tk_no="11212",
                tk_co="1311",
                tien_nt=25000000,
                dien_giai="Thu tiền hàng",
            )
        ],
    )

    with (
        patch("app.repositories.cash_voucher_repo.get_db_transaction", return_value=mock_tx),
        patch.object(cash_voucher_repository, "_check_duplicate_number", return_value=(False, "000001")),
        patch("app.repositories.cash_voucher_repo.voucher_repository.get_closing_date", return_value=""),
        patch("app.repositories.cash_voucher_repo.voucher_repository.generate_stt", return_value="S1000000000000000001"),
        patch("app.repositories.cash_voucher_repo.voucher_repository.generate_stts_batch", return_value=["S1000000000000000002"]),
    ):
        res = cash_voucher_repository.save_cash_voucher(req, mode="M", user_name="KTTH")
        assert res.stt == "S1000000000000000001"
        assert res.so_ct == "000001"
        sql_calls = [str(c.args[0]) for c in mock_cur.execute.call_args_list if c.args]
        assert any("INSERT INTO" in s and "dbo.CtT " in s for s in sql_calls)
        assert any("INSERT INTO" in s and "dbo.CtT0 " in s for s in sql_calls)
        assert any("CtT_Post" in s for s in sql_calls)


def test_commit_baoco_import_single_transaction_sequential_numbers():
    mock_cur = MagicMock()
    mock_cur.fetchall.return_value = [("KH001", "Công ty A", "Hà Nội")]
    mock_conn = MagicMock()
    mock_tx = MagicMock()
    mock_tx.__enter__.return_value = (mock_conn, mock_cur)
    mock_tx.__exit__.return_value = False

    commit_req = BaoCoImportCommitRequest(
        ma_dvcs="S1",
        ma_ct="C3",
        tk_no="11212",
        tk_co="1311",
        user_name="KTTH",
        rows=[
            BaoCoImportRowInput(noi_dung="Thu 2", so_tien=200000, ngay_ct="2026-11-20", ma_dt="KH001"),
            BaoCoImportRowInput(noi_dung="Thu 1", so_tien=100000, ngay_ct="2026-11-18", ma_dt="KH001"),
        ],
    )

    dup_returns = [(False, "000129"), (False, "000130")]

    with (
        patch("app.repositories.cash_voucher_repo.get_db_transaction", return_value=mock_tx),
        patch.object(cash_voucher_repository, "_check_duplicate_number", side_effect=dup_returns),
        patch("app.repositories.cash_voucher_repo.voucher_repository.get_closing_date", return_value=""),
        patch("app.repositories.cash_voucher_repo.voucher_repository.generate_stt", side_effect=["S101", "S102"]),
        patch("app.repositories.cash_voucher_repo.voucher_repository.generate_stts_batch", side_effect=[["S101A"], ["S102A"]]),
    ):
        res = cash_voucher_repository.commit_baoco_import(commit_req)
        assert res.created_count == 2
        assert [v.so_ct for v in res.created_vouchers] == ["000129", "000130"]


def test_list_cash_vouchers_and_ledger_endpoints():
    from datetime import datetime

    mock_cur = MagicMock()
    mock_cur.fetchone.side_effect = [
        (1, 5000000.0, 5000000.0, 0.0, 0.0, 5000000.0, 5000000.0),
    ]
    mock_cur.fetchall.return_value = [
        (
            "S1000001", "S1", "C1", " ", "1",
            datetime(2026, 11, 20), "000001", "", "VND", 1.0,
            "KH001", "Nguyễn Văn A", "Hà Nội", "Thu tiền", "",
            5000000.0, 5000000.0, 0.0, 0.0, 5000000.0, 5000000.0,
            0, "", "", None, "KTCN3", True, True, False,
            "1111", "1311", "Công ty A",
        )
    ]
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = mock_cur
    mock_ctx.__exit__.return_value = False

    with patch("app.repositories.cash_voucher_repo.get_db_cursor", return_value=mock_ctx):
        resp = client.get("/api/cash-vouchers?ma_ct=C1")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["pagination"]["total_records"] == 1
        assert data["items"][0]["tk_chinh"] == "1111"
        assert data["items"][0]["tk_doi_ung"] == "1311"

    # Ledger test
    ledger_cur = MagicMock()
    ledger_cur.fetchone.side_effect = [
        ("Tiền gửi NH",),
        (10000000.0,),  # Opening balance
    ]
    ledger_cur.fetchall.return_value = [
        ("S1000002", "C3", datetime(2026, 11, 19), "000129", "KH001", "Công ty A", "Thu CK", "1311", 5000000.0, 0.0),
        ("S1000003", "C4", datetime(2026, 11, 20), "000010", "NCC01", "Nhà CC B", "Chi CK", "3311", 0.0, 2000000.0),
    ]
    ledger_ctx = MagicMock()
    ledger_ctx.__enter__.return_value = ledger_cur
    ledger_ctx.__exit__.return_value = False

    with patch("app.repositories.cash_voucher_repo.get_db_cursor", return_value=ledger_ctx):
        resp = client.get("/api/cash-vouchers/ledger?tk=11212&ngay_bd=2026-11-01&ngay_kt=2026-11-30")
        assert resp.status_code == 200
        led = resp.json()["data"]
        assert led["du_dau"] == 10000000.0
        assert led["tong_thu"] == 5000000.0
        assert led["tong_chi"] == 2000000.0
        assert led["du_cuoi"] == 13000000.0
        assert led["entries"][0]["luy_ke"] == 15000000.0
        assert led["entries"][1]["luy_ke"] == 13000000.0


def test_new_catalog_lookups_khoan_muc_and_san_pham():
    from app.repositories.lookup_repo import lookup_repository

    lookup_repository.invalidate_cache()
    km_cur = MagicMock()
    km_cur.fetchall.return_value = [("KM01", "Chi phí vận chuyển")]
    km_ctx = MagicMock()
    km_ctx.__enter__.return_value = km_cur
    km_ctx.__exit__.return_value = False

    with patch("app.repositories.lookup_repo.get_db_cursor", return_value=km_ctx):
        resp = client.get("/api/lookups/khoan-muc")
        assert resp.status_code == 200
        assert resp.json()["data"] == [{"ma_km": "KM01", "ten_km": "Chi phí vận chuyển"}]

    sp_cur = MagicMock()
    sp_cur.fetchall.return_value = [("SP01", "Đệm cao cấp", "Tấm", "1")]
    sp_ctx = MagicMock()
    sp_ctx.__enter__.return_value = sp_cur
    sp_ctx.__exit__.return_value = False

    with patch("app.repositories.lookup_repo.get_db_cursor", return_value=sp_ctx):
        resp = client.get("/api/lookups/san-pham")
        assert resp.status_code == 200
        assert resp.json()["data"] == [{"ma_sp": "SP01", "ten_sp": "Đệm cao cấp", "dvt": "Tấm", "loai_sp": "1"}]


