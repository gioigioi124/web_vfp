"""Unit tests covering Phase 1 & Phase 3 backend optimizations."""

import gzip
import json
import time
from contextlib import contextmanager
from datetime import datetime
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import FastJSONResponse, app
from app.repositories.debt_repo import DebtRepository
from app.repositories.price_repo import PriceRepository
from app.repositories.voucher_repo import VoucherRepository
from app.schemas.voucher import VoucherCreateRequest, VoucherDetailSchema
from app.services.product_index_service import ProductIndexService
from app.utils.ttl_cache import TTLCache


def _mock_cursor_ctx(cur):
    @contextmanager
    def _ctx(_db_name=None):
        yield cur

    return _ctx


# ---------------------------------------------------------------------------
# 1. TTLCache
# ---------------------------------------------------------------------------
def test_ttl_cache_hit_miss_expiry_lru_and_prefix():
    cache = TTLCache[str](default_ttl=10.0, max_size=2)
    assert cache.get("missing") is None

    cache.set("a:1", "v1")
    cache.set("a:2", "v2")
    # Touch a:1 so a:2 becomes LRU
    assert cache.get("a:1") == "v1"
    cache.set("b:1", "v3")
    # a:2 should have been evicted
    assert cache.get("a:2") is None
    assert cache.get("a:1") == "v1"
    assert cache.get("b:1") == "v3"

    # Prefix invalidation
    cache.invalidate(prefix="a:")
    assert cache.get("a:1") is None
    assert cache.get("b:1") == "v3"

    # TTL expiration
    cache.set("short", "soon-gone", ttl=0.02)
    assert cache.get("short") == "soon-gone"
    time.sleep(0.04)
    assert cache.get("short") is None

    # get_or_set only calls loader once
    calls = {"n": 0}

    def loader():
        calls["n"] += 1
        return "computed"

    assert cache.get_or_set("k", loader) == "computed"
    assert cache.get_or_set("k", loader) == "computed"
    assert calls["n"] == 1


# ---------------------------------------------------------------------------
# 2. ProductIndexService (fingerprint skip, pre-gzipped payload, O(1) lookup)
# ---------------------------------------------------------------------------
def test_product_index_checksum_skip_pre_gzip_and_o1_lookup():
    svc = ProductIndexService()
    sample_row = {
        "ma": "VT001",
        "ten": "Mút xốp thử nghiệm",
        "dvt": "Tấm",
        "dvt_ban": "Tấm",
        "loai_vt": "2",
        "tk_gv": "632",
        "tk_vt": "1561",
        "tk_dt": "5111",
        "tk_ck": "5211",
        "he_so0": 1.0,
        "ma_kho": "K01",
    }

    with (
        patch.object(svc, "_compute_fingerprint", return_value=((1, 10, 999), (1, 888))) as mock_fp,
        patch.object(svc, "_read_all", return_value={10: sample_row}) as mock_read,
        patch.object(svc, "_save_disk_cache"),
    ):
        svc.refresh(force=True)
        assert mock_read.call_count == 1
        assert svc._loaded is True

        # Second refresh with identical fingerprint should skip _read_all entirely
        svc.refresh(force=False)
        assert mock_fp.call_count == 2
        assert mock_read.call_count == 1

    # O(1) RAM lookup does not touch SQL
    with patch("app.services.product_index_service.get_db_cursor") as mock_db:
        found = svc.get_by_code("vt001")
        assert found is not None
        assert found["ma"] == "VT001"
        assert found["ma_kho"] == "K01"
        assert mock_db.call_count == 0

    # Pre-gzipped full payload & ETag
    gz_body, is_gz, etag = svc.get_changes_response_bytes(since=0, epoch_c=0, accept_gzip=True)
    assert is_gz is True
    assert etag == svc.get_etag()
    decoded = json.loads(gzip.decompress(gz_body).decode("utf-8"))
    assert decoded["success"] is True
    assert decoded["data"]["full"] is True
    assert len(decoded["data"]["items"]) == 1
    assert decoded["data"]["items"][0]["ma"] == "VT001"

    raw_body, is_gz_raw, _ = svc.get_changes_response_bytes(since=0, epoch_c=0, accept_gzip=False)
    assert is_gz_raw is False
    assert json.loads(raw_body.decode("utf-8"))["data"]["items"][0]["ma"] == "VT001"


# ---------------------------------------------------------------------------
# 3. PriceRepository (TTL caching, _PRICE_MISS, SARGable ROW_NUMBER SQL)
# ---------------------------------------------------------------------------
def test_price_repo_caching_and_sargable_row_number():
    repo = PriceRepository()
    mock_cur = MagicMock()
    executed_sqls = []

    def fake_execute(sql, params=None):
        executed_sqls.append((sql, params))

    mock_cur.execute.side_effect = fake_execute
    mock_cur.fetchone.return_value = ("KV01",)
    mock_cur.fetchall.return_value = [
        ("VT001", 125000.0, 5.0, "KH01", "", datetime(2026, 1, 1), None, "BG001"),
    ]

    with patch("app.repositories.price_repo.get_db_cursor", side_effect=_mock_cursor_ctx(mock_cur)):
        res1 = repo.get_prices_batch("kh01", ["vt001", "vt_miss"], "2026-04-01")
        assert "VT001" in res1
        assert res1["VT001"]["gia"] == 125000.0
        assert res1["VT001"]["source"] == "customer"
        assert "VT_MISS" not in res1

        # Verify SARGable SQL + ROW_NUMBER window function
        bg_sql = executed_sqls[1][0]
        assert "ROW_NUMBER() OVER" in bg_sql
        assert "WHERE rn = 1" in bg_sql
        assert "UPPER(RTRIM(b0.Ma_Vt))" not in bg_sql

        # Second call for same customer/date/codes hits both positive and _PRICE_MISS caches -> 0 new SQL calls
        before_calls = len(executed_sqls)
        res2 = repo.get_prices_batch("KH01", ["VT001", "VT_MISS"], "2026-04-01")
        assert res2 == res1
        assert len(executed_sqls) == before_calls


# ---------------------------------------------------------------------------
# 4. DebtRepository (check_only=True single SP call, SARGable UNION ALL)
# ---------------------------------------------------------------------------
def test_debt_repo_check_only_skips_second_sp_and_sargable_union_all():
    repo = DebtRepository()
    mock_cur = MagicMock()
    mock_cur.fetchone.side_effect = [
        ("Khách hàng A", 10_000_000.0, 0.0),  # DmDt query (Ten_Dt, Gioi_Han, Toi_Han)
        (4_500_000.0, 0.0, "Khách hàng A"),  # Single SP balance query (Du_No, Du_Co, Ten_Dt)
    ]

    with patch("app.repositories.debt_repo.get_db_cursor", side_effect=_mock_cursor_ctx(mock_cur)):
        summary = repo.get_customer_debt_summary("KH01", "131", "STT001", check_only=True)

    assert summary.gioi_han == 10_000_000.0
    assert summary.du_cuoi == 4_500_000.0
    assert summary.du_cuoi_kiem_tra == 4_500_000.0
    # Only 2 SQL executes (DmDt + 1 SP), NOT 3 (2nd SP skipped in check_only mode)
    assert mock_cur.execute.call_count == 2
    assert "SET NOCOUNT ON;" in mock_cur.execute.call_args_list[1][0][0]

    # Verify SARGable UNION ALL in get_voucher_debt_detail (derived-table-wrapped ORDER BY)
    detail_cur = MagicMock()
    detail_cur.fetchone.return_value = ("KH01", "Khách hàng A", "HD01", datetime(2026, 4, 1), 1_000_000.0, 1_000_000.0)
    detail_cur.fetchall.return_value = []
    with patch("app.repositories.debt_repo.get_db_cursor", side_effect=_mock_cursor_ctx(detail_cur)):
        repo.get_voucher_debt_detail("STT001")
    socai_sql = detail_cur.execute.call_args_list[1][0][0]
    assert "UNION ALL" in socai_sql
    assert "d_leg" in socai_sql and "c_leg" in socai_sql
    assert "RTRIM(Stt) <> ?" not in socai_sql


# ---------------------------------------------------------------------------
# 5. VoucherRepository (CTE pagination, zero short-circuit, batch CtBH0, closing cache)
# ---------------------------------------------------------------------------
def test_voucher_repo_list_zero_short_circuit_and_cte_pagination():
    repo = VoucherRepository()

    # Zero-record short-circuit: only COUNT/SUM query executes, no page query
    cur_zero = MagicMock()
    cur_zero.fetchone.return_value = (0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
    with patch("app.repositories.voucher_repo.get_db_cursor", side_effect=_mock_cursor_ctx(cur_zero)):
        resp = repo.list_vouchers(ngay_ct1="2026-04-01", ngay_ct2="2026-04-30")
    assert resp.pagination.total_records == 0
    assert resp.items == []
    assert cur_zero.execute.call_count == 1

    # Non-zero page query uses CTE Page before JOINs
    cur_page = MagicMock()
    cur_page.fetchone.return_value = (1, 1000.0, 100.0, 0.0, 900.0, 2.0, 1000.0, 100.0, 0.0, 900.0, 2.0)
    cur_page.fetchall.return_value = []
    with patch("app.repositories.voucher_repo.get_db_cursor", side_effect=_mock_cursor_ctx(cur_page)):
        repo.list_vouchers(ngay_ct1="2026-04-01", ngay_ct2="2026-04-30", page=1, page_size=50)
    assert cur_page.execute.call_count == 2
    page_sql = cur_page.execute.call_args_list[1][0][0]
    assert "WITH Page AS" in page_sql
    assert "OFFSET ? ROWS FETCH NEXT ? ROWS ONLY" in page_sql


def test_voucher_repo_closing_date_cache_and_batch_ctbh0_insert():
    repo = VoucherRepository()

    # Closing date cached across calls
    cur_close = MagicMock()
    cur_close.fetchone.return_value = (datetime(2026, 3, 31),)
    with patch("app.repositories.voucher_repo.get_db_cursor", side_effect=_mock_cursor_ctx(cur_close)):
        d1 = repo.get_closing_date("S1")
        d2 = repo.get_closing_date("S1")
    assert d1 == "2026-03-31"
    assert d2 == "2026-03-31"
    assert cur_close.execute.call_count == 1

    # Batch multi-row INSERT INTO CtBH0 + generate_stts_batch for 3 items
    mock_cur = MagicMock()
    executed_sqls = []

    def track_exec(sql, params=None):
        executed_sqls.append((sql, params))

    mock_cur.execute.side_effect = track_exec
    mock_cur.fetchone.side_effect = [
        ("KH01",),  # 1. DmDt check
        (0,),  # 2. check_duplicate_number
        ("A0100001",),  # 3. sp_KeyIndex header Stt
        (300_000.0, 3),  # 4. Integrity check (SUM(Tien_Nt2), COUNT(1))
    ]
    # generate_stts_batch calls cur.fetchall() returning 3 allocated Stt0 keys
    mock_cur.fetchall.return_value = [("A0100002",), ("A0100003",), ("A0100004",)]

    items = [
        VoucherDetailSchema(
            ma_vt=f"VT00{i}",
            ten_vt=f"Vật tư {i}",
            dvt="Cái",
            ma_kho="K01",
            so_luong9=1.0,
            gia_nt9=100_000.0,
            gia9=100_000.0,
            tien_nt9=100_000.0,
            tien9=100_000.0,
            tk_no="131",
            tk_co="5111",
        )
        for i in (1, 2, 3)
    ]
    req = VoucherCreateRequest(
        ma_ct="X1",
        ngay_ct="2026-04-15",
        so_ct="HD9001",
        ma_dt="KH01",
        dien_giai="Test batch insert",
        items=items,
    )

    @contextmanager
    def _fake_tx(_db):
        yield (MagicMock(), mock_cur)

    with (
        patch("app.repositories.voucher_repo.get_db_transaction", side_effect=_fake_tx),
        patch.object(repo, "get_closing_date", return_value="2026-03-31"),
        patch(
            "app.repositories.voucher_repo.debt_repository.get_customer_debt_summary",
            return_value=MagicMock(is_over_limit=False, gioi_han=0.0, du_cuoi=0.0, du_cuoi_kiem_tra=0.0),
        ) as mock_debt,
    ):
        res = repo.save_voucher(req, mode="M")

    assert res.stt == "A0100001"
    assert res.message
    # Verify debt check used check_only=True
    assert mock_debt.call_args.kwargs.get("check_only") is True

    # Verify exactly ONE INSERT INTO CtBH0 executed with 3 * 35 = 105 params
    ctbh0_inserts = [(s, p) for s, p in executed_sqls if "INSERT INTO" in s and ".dbo.CtBH0" in s]
    assert len(ctbh0_inserts) == 1
    sql0, params0 = ctbh0_inserts[0]
    assert len(params0) == 105
    # Verify all 3 rows have COGS columns (indices 21..24 of each 35-param row) set to None
    for row_idx in range(3):
        base = row_idx * 35
        assert params0[base + 21 : base + 25] == [None, None, None, None]

    # Verify batch Stt0 allocation ran once using DECLARE @keys TABLE
    batch_stt_calls = [s for s, _ in executed_sqls if "DECLARE @keys TABLE" in s]
    assert len(batch_stt_calls) == 1


# ---------------------------------------------------------------------------
# 6. FastJSONResponse (orjson serialization without FastAPI deprecation warning)
# ---------------------------------------------------------------------------
def test_fast_json_response_utf8_vietnamese():
    resp = FastJSONResponse({"success": True, "msg": "Chứng từ bán hàng — Đã lưu"})
    assert resp.media_type == "application/json"
    parsed = json.loads(resp.body.decode("utf-8"))
    assert parsed["msg"] == "Chứng từ bán hàng — Đã lưu"

    client = TestClient(app)
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/json")
