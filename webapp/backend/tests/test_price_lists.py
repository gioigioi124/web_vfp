import base64
import io
import zipfile
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.repositories.price_list_repo import price_list_repository

client = TestClient(app)


def _make_xlsx(rows):
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


def test_import_new_preview_rules_mutual_exclusion_and_dedup():
    xlsx = _make_xlsx([
        ["Ngày", "Số CT", "Khách hàng", "Khu vực", "Mã hàng", "Giá", "CK"],
        ["20/11/2026", "BG01", "KH001", "KV01", "VT001", 100000, 5],  # cả KH & KV -> xóa KV
        ["20/11/2026", "BG01", "KH001", "", "VT001", 120000, 10],     # trùng VT001 -> giữ dòng cuối
        ["20/11/2026", "BG02", "", "KV02", "VT002", 80000, 0],
        ["20/11/2026", "BG03", "", "", "VT003", 50000, 0],            # thiếu cả KH & KV -> skip
    ])

    with (
        patch.object(price_list_repository, "_lookup_vt_meta", return_value={"VT001": ("Vật tư 1", "Tấm"), "VT002": ("Vật tư 2", "Tấm")}),
        patch.object(price_list_repository, "_lookup_dt_names", return_value={"KH001": "Công ty A"}),
    ):
        b64 = base64.b64encode(xlsx).decode("ascii")
        resp = client.post(
            "/api/price-lists/import-new/preview",
            json={"filename": "bg_moi.xlsx", "content_base64": b64},
        )
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["skipped_rows"] == 1
        assert data["duplicate_rows"] == 1
        assert data["groups_count"] == 2
        assert data["details_count"] == 2
        g1 = next(g for g in data["groups"] if g["so_ct"] == "BG01")
        assert g1["ma_dt"] == "KH001"
        assert g1["ma_vm"] == ""
        assert g1["items"][0]["gia"] == 120000.0
        assert g1["items"][0]["ck"] == 10.0


def test_import_update_3col_and_commit_split_update_insert():
    xlsx = _make_xlsx([
        ["Mã hàng", "Giá", "CK"],
        ["VT001", 150000, 5],
        ["VT001", 155000, 8],  # keep last
        ["VT999", 99000, 0],
    ])
    mock_cur = MagicMock()
    mock_cur.fetchall.return_value = [("VT001",)]
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = mock_cur
    mock_ctx.__exit__.return_value = False

    with (
        patch("app.repositories.price_list_repo.get_db_cursor", return_value=mock_ctx),
        patch.object(price_list_repository, "_lookup_vt_meta", return_value={"VT001": ("SP1", "Cái"), "VT999": ("SP9", "Cái")}),
    ):
        b64 = base64.b64encode(xlsx).decode("ascii")
        resp = client.post(
            "/api/price-lists/import-update/preview",
            json={"filename": "update.xlsx", "content_base64": b64, "stt_list": ["S1_BG_1"]},
        )
        assert resp.status_code == 200
        pv = resp.json()["data"]
        assert pv["duplicate_rows"] == 1
        assert pv["unique_items"] == 2
        assert pv["existing_updates_estimate"] == 1
        assert pv["new_inserts_estimate"] == 1

    # Commit test
    tx_cur = MagicMock()
    tx_cur.fetchone.return_value = ("S1",)
    tx_cur.fetchall.return_value = [("VT001",)]
    tx_conn = MagicMock()
    tx_ctx = MagicMock()
    tx_ctx.__enter__.return_value = (tx_conn, tx_cur)
    tx_ctx.__exit__.return_value = False

    with (
        patch("app.repositories.price_list_repo.get_db_transaction", return_value=tx_ctx),
        patch("app.repositories.price_list_repo.voucher_repository.generate_stts_batch", return_value=["S1_ST0_1"]),
        patch("app.repositories.price_list_repo.price_repository.clear_cache") as mock_clear,
    ):
        resp = client.post(
            "/api/price-lists/import-update/commit",
            json={
                "stt_list": ["S1_BG_1"],
                "items": [
                    {"ma_vt": "VT001", "gia": 155000, "ck": 8},
                    {"ma_vt": "VT999", "gia": 99000, "ck": 0},
                ],
            },
        )
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert d["updates_count"] == 1
        assert d["inserts_count"] == 1
        assert mock_clear.called


def test_delete_items_and_bulk_date_copy():
    xlsx_1col = _make_xlsx([
        ["Ma_Vt"],
        ["VT001"],
        ["VT002"],
        ["VT001"],
    ])
    mock_cur = MagicMock()
    mock_cur.fetchone.return_value = (2,)
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = mock_cur
    mock_ctx.__exit__.return_value = False

    with patch("app.repositories.price_list_repo.get_db_cursor", return_value=mock_ctx):
        b64 = base64.b64encode(xlsx_1col).decode("ascii")
        resp = client.post(
            "/api/price-lists/delete-items/preview",
            json={"filename": "del.xlsx", "content_base64": b64, "stt_list": ["S1_BG_1"]},
        )
        assert resp.status_code == 200
        assert resp.json()["data"]["ma_vt_count"] == 2
        assert resp.json()["data"]["affected_rows_estimate"] == 2

    # Bulk copy test
    tx_cur = MagicMock()
    tx_cur.fetchone.return_value = ("S1",)
    tx_cur.fetchall.return_value = [("VT001", 100000, 5)]
    tx_conn = MagicMock()
    tx_ctx = MagicMock()
    tx_ctx.__enter__.return_value = (tx_conn, tx_cur)
    tx_ctx.__exit__.return_value = False

    with (
        patch("app.repositories.price_list_repo.get_db_transaction", return_value=tx_ctx),
        patch("app.repositories.price_list_repo.voucher_repository.generate_stt", return_value="S1_BG_NEW"),
        patch("app.repositories.price_list_repo.voucher_repository.generate_stts_batch", return_value=["S1_001"]),
        patch("app.repositories.price_list_repo.price_repository.clear_cache"),
    ):
        resp = client.post(
            "/api/price-lists/bulk-copy",
            json={"stt_list": ["S1_BG_1"], "ngay_ct": "2026-12-01", "user_name": "ADMIN"},
        )
        assert resp.status_code == 201
        assert resp.json()["data"]["copied_count"] == 1
        assert resp.json()["data"]["copied_items"] == 1


def test_list_price_lists_paged_and_items_paged():
    from datetime import date

    mock_cur = MagicMock()
    mock_cur.fetchone.return_value = (150,)
    mock_cur.fetchall.side_effect = [
        [
            (
                "S1_BG_1",
                "S1",
                date(2026, 11, 20),
                "BG01",
                "KH001",
                "Khach A",
                "",
                "",
                "VND",
                1.0,
                date(2026, 11, 20),
                None,
                "ADMIN",
                True,
                "0",
            )
        ],
        [("S1_BG_1", 1250)],
    ]
    mock_ctx = MagicMock()
    mock_ctx.__enter__.return_value = mock_cur
    mock_ctx.__exit__.return_value = False

    with patch("app.repositories.price_list_repo.get_db_cursor", return_value=mock_ctx):
        resp = client.get("/api/price-lists?page=2&page_size=50&so_ct=BG")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert d["total_records"] == 150
        assert d["page"] == 2
        assert d["page_size"] == 50
        assert d["total_pages"] == 3
        assert len(d["items"]) == 1
        assert d["items"][0]["item_count"] == 1250

    # BG0 paginated items endpoint
    items_cur = MagicMock()
    items_cur.fetchone.side_effect = [(1200,), (1200,)]
    items_cur.fetchall.return_value = [
        ("ST0_1", "S1_BG_1", "VT001", "Ton lanh", "Tam", 125000.0, 5.0),
        ("ST0_2", "S1_BG_1", "VT002", "Ton mau", "Tam", 145000.0, 0.0),
    ]
    items_ctx = MagicMock()
    items_ctx.__enter__.return_value = items_cur
    items_ctx.__exit__.return_value = False

    with patch("app.repositories.price_list_repo.get_db_cursor", return_value=items_ctx):
        resp = client.get("/api/price-lists/S1_BG_1/items?q=Ton&offset=0&limit=2")
        assert resp.status_code == 200
        d = resp.json()["data"]
        assert d["total_count"] == 1200
        assert d["filtered_count"] == 1200
        assert d["has_more"] is True
        assert len(d["items"]) == 2
        assert d["items"][0]["ma_vt"] == "VT001"

