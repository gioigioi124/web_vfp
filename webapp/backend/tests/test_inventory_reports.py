from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock, patch

import pyodbc
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _ctx_for_cursor(cur: MagicMock):
    ctx = MagicMock()
    ctx.__enter__.return_value = cur
    ctx.__exit__.return_value = False
    return ctx


def test_inventory_summary_and_stock_card_sql(client: TestClient):
    cur_sum = MagicMock()
    cur_sum.fetchall.return_value = [
        ("K1", "Kho Tổng", "VT01", "Tôn cuộn 0.45mm", "Kg", 100.0, 3000000.0, 50.0, 1500000.0, 30.0, 900000.0),
    ]
    with patch("app.repositories.inventory_report_repo.get_db_cursor", return_value=_ctx_for_cursor(cur_sum)):
        res = client.get("/api/inventory/reports/summary?from_date=2026-11-01&to_date=2026-11-30")
        assert res.status_code == 200
        body = res.json()
        assert body["total_records"] == 1
        assert body["items"][0]["ton_cuoi"] == 120.0
        assert body["items"][0]["tien_cuoi"] == 3600000.0
        assert body["sum_ton_cuoi"] == 120.0

    cur_card = MagicMock()
    cur_card.fetchone.side_effect = [
        ("Tôn cuộn 0.45mm", "Kg"),
        ("Kho Tổng",),
        (100.0, 3000000.0),
    ]
    cur_card.fetchall.return_value = [
        ("S1_N1", "S1_N1_1", datetime(2026, 11, 5), "N1", "PN001", "1", "NCC01", "Hòa Phát", "Nhập mua", "K1", "", 50.0, 30000.0, 1500000.0),
        ("S1_CK", "S1_CK_1", datetime(2026, 11, 10), "CK", "CK001", "2", "NB", "Nội bộ", "Chuyển sang K2", "K1", "K2", 30.0, 30000.0, 900000.0),
    ]
    with patch("app.repositories.inventory_report_repo.get_db_cursor", return_value=_ctx_for_cursor(cur_card)):
        res_card = client.get("/api/inventory/reports/card?ma_vt=VT01&ma_kho=K1&from_date=2026-11-01&to_date=2026-11-30")
        assert res_card.status_code == 200
        card = res_card.json()
        assert card["ton_dau"] == 100.0
        assert card["sum_sl_nhap"] == 50.0
        assert card["sum_sl_xuat"] == 30.0
        assert card["ton_cuoi"] == 120.0
        assert card["entries"][0]["ton_luy_ke"] == 150.0
        assert card["entries"][1]["ton_luy_ke"] == 120.0


def test_inventory_reports_offline_returns_503(client: TestClient):
    op_err = pyodbc.OperationalError("08001", "[08001] Could not open a connection to SQL Server")
    with patch("app.repositories.inventory_report_repo.get_db_cursor", side_effect=op_err):
        res1 = client.get("/api/inventory/reports/summary")
        res2 = client.get("/api/inventory/reports/card?ma_vt=VT01")
        assert res1.status_code == 503
        assert res2.status_code == 503
        assert res1.json()["detail"]["code"] == "SQL_UNAVAILABLE"
