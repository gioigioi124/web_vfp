"""Comprehensive unit & API tests for Truck Batch Export (Xuất nhanh cả xe hàng)."""

from contextlib import contextmanager
from typing import Any, List
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.repositories.truck_source.sql_adapter import make_source_order_key
from app.repositories.voucher.mutations import BatchVoucherError
from app.repositories.voucher_repo import VoucherRepository
from app.schemas.debt import CustomerDebtSummary
from app.schemas.voucher import VoucherCreateRequest, VoucherDetailSchema
from app.services.truck_batch_service import TruckBatchService, normalize_group_note


client = TestClient(app)


def _make_voucher(
    ma_dt: str = "KH001",
    stt_px: str = "MK_XE01_0001",
    gia_nt9: float = 1_000_000.0,
    so_luong9: float = 2.0,
    ma_kho: str = "K01",
    ngay_ct: str = "2026-11-24",
    skip_debt_check: bool = False,
    dien_giai0: str = "Giao CH1",
) -> VoucherCreateRequest:
    return VoucherCreateRequest(
        ma_dvcs="S1",
        ma_ct="X1",
        ngay_ct=ngay_ct,
        ma_dt=ma_dt,
        ma_xe="29C12345",
        dien_giai0=dien_giai0,
        skip_debt_check=skip_debt_check,
        items=[
            VoucherDetailSchema(
                stt_px=stt_px,
                ma_kho=ma_kho,
                ma_vt="800116020025",
                dvt="Cái",
                dvt_ban="Cái",
                so_tam=so_luong9,
                he_so8=1.0,
                so_luong9=so_luong9,
                gia_nt9=gia_nt9,
                chiet_khau=0.0,
                loai_vt="1",
                tk_du2="5112",
            )
        ],
    )


class FakeBatchCursor:
    """Fake pyodbc cursor simulating SQL Server calls in save_vouchers_batch."""

    def __init__(
        self,
        valid_customers=None,
        existing_stt_px=None,
        max_so_ct="HD0010",
        taken_so_cts=None,
        fail_on_sp_call=None,
        integrity_override=None,
    ):
        self.valid_customers = set(valid_customers or ["KH001", "KH002", "KH003"])
        self.existing_stt_px = set(existing_stt_px or [])
        self.max_so_ct = max_so_ct
        self.taken_so_cts = set(taken_so_cts or [])
        self.fail_on_sp_call = fail_on_sp_call  # tuple (substring, 1-based occurrence)
        self.integrity_override = integrity_override

        self.executed: List[tuple] = []
        self.ctbh0_inserts: List[tuple] = []
        self._last_rows: List[tuple] = []
        self._stt_counter = 100
        self._sp_counts: dict = {}
        self._inserted_by_stt: dict = {}

    def execute(self, sql: str, params: Any = None):
        params = list(params) if params is not None else []
        self.executed.append((sql, params))
        sql_up = sql.upper()

        if self.fail_on_sp_call:
            needle, target_occ = self.fail_on_sp_call
            if needle.upper() in sql_up:
                self._sp_counts[needle] = self._sp_counts.get(needle, 0) + 1
                if self._sp_counts[needle] == target_occ:
                    raise RuntimeError(f"Simulated SQL SP failure on {needle} #{target_occ}")

        if "FROM VTSYS.DBO.DMDT" in sql_up and "IN (" in sql_up:
            matched = [p for p in params if str(p).strip().upper() in self.valid_customers]
            self._last_rows = [(m,) for m in matched]
            return

        if "FROM VP_2014.DBO.CTBH0 WITH (UPDLOCK, HOLDLOCK)" in sql_up:
            matched = [p for p in params if str(p).strip() in self.existing_stt_px]
            self._last_rows = [(m,) for m in matched]
            return

        if "ST_INCREASE_KEYINDEX" in sql_up:
            if "WHILE @I < ?" in sql_up:
                count = int(params[0])
                dvcs = str(params[1])
                rows = []
                for _ in range(count):
                    self._stt_counter += 1
                    rows.append((f"{dvcs}{self._stt_counter:018d}",))
                self._last_rows = rows
            else:
                self._stt_counter += 1
                dvcs = str(params[0])
                self._last_rows = [(f"{dvcs}{self._stt_counter:018d}",)]
            return

        if "SELECT TOP 1 RTRIM(SO_CT)" in sql_up:
            self._last_rows = [(self.max_so_ct,)] if self.max_so_ct else []
            return

        if "ST_CHECK_NUMBER" in sql_up:
            so_ct = str(params[5]).strip().upper()
            self._last_rows = [(1 if so_ct in self.taken_so_cts else 0,)]
            return

        if "INSERT INTO VP_2014.DBO.CTBH0" in sql_up:
            self.ctbh0_inserts.append((sql, params))
            # Each row has 35 params: index 2 = Stt, index 27 = Tien_Nt2
            for row_start in range(0, len(params), 35):
                row_slice = params[row_start:row_start + 35]
                stt = str(row_slice[2]).strip()
                tien_nt2 = float(row_slice[27] or 0.0)
                prev_sum, prev_cnt = self._inserted_by_stt.get(stt, (0.0, 0))
                self._inserted_by_stt[stt] = (prev_sum + tien_nt2, prev_cnt + 1)
            self._last_rows = []
            return

        if "SELECT RTRIM(STT), ISNULL(SUM(TIEN_NT2), 0), COUNT(1)" in sql_up:
            if self.integrity_override is not None:
                self._last_rows = self.integrity_override
            else:
                self._last_rows = [
                    (stt, vals[0], vals[1])
                    for stt, vals in self._inserted_by_stt.items()
                    if stt in params
                ]
            return

        self._last_rows = []

    def fetchall(self):
        return list(self._last_rows)

    def fetchone(self):
        return self._last_rows[0] if self._last_rows else None


def _make_fake_tx(cur: FakeBatchCursor):
    tx_state = {"committed": False, "rolled_back": False}

    @contextmanager
    def _fake_get_db_transaction(_db_name: str):
        try:
            yield MagicMock(), cur
            tx_state["committed"] = True
        except Exception:
            tx_state["rolled_back"] = True
            raise

    return _fake_get_db_transaction, tx_state


# ---------------------------------------------------------------------------
# 1. Normalization & Data Contract helpers
# ---------------------------------------------------------------------------

def test_normalize_group_note_whitespace_case_and_diacritics():
    assert normalize_group_note("  Giao   CH1 - Cầu Giấy ") == normalize_group_note("giao ch1 - cầu giấy")
    assert normalize_group_note("Giao kho 1") != normalize_group_note("Giao kho 2")
    assert normalize_group_note("Nhà xe A") != normalize_group_note("Nha xe A")
    assert normalize_group_note(None) == ""
    assert normalize_group_note("   ") == ""


def test_make_source_order_key_fits_char20_and_avoids_s1_prefix():
    key_num = make_source_order_key(12345)
    assert len(key_num) <= 20
    assert key_num.startswith("XE")
    assert not key_num.startswith("S1")

    key_long = make_source_order_key("ORDER_VERY_LONG_IDENTIFIER_999999999", prefix="DH")
    assert len(key_long) == 20
    assert key_long.startswith("DH")


# ---------------------------------------------------------------------------
# 2. Auto-Grouping (6 orders / 1 customer / 3 warehouses / 2 destinations) & Idempotency
# ---------------------------------------------------------------------------

def test_stage_trip_auto_groups_6_orders_into_2_vouchers_for_same_customer():
    svc = TruckBatchService()
    with (
        patch.object(svc, "_fetch_exported_stt_px", return_value=set()),
        patch.object(svc, "_batch_fetch_customers", return_value={}),
        patch.object(svc, "_batch_fetch_products", return_value={}),
        patch.object(svc.price_repo, "get_prices_batch", return_value={}),
        patch.object(
            svc.debt_repo,
            "get_customer_debt_summary",
            side_effect=lambda ma_dt, **_: CustomerDebtSummary(ma_dt=ma_dt),
        ),
    ):
        staged = svc.stage_trip("XE-DEMO-01", adapter_name="mock")

    assert staged is not None
    assert staged.total_pending_orders == 10
    assert staged.total_exported_orders == 0

    kh001_vouchers = [v for v in staged.vouchers if v.ma_dt == "KH001"]
    assert len(kh001_vouchers) == 2, "6 đơn của KH001 đi 2 nơi khác nhau phải gom đúng thành 2 phiếu bán"

    # Phiếu 1 (CH1 - Cầu Giấy): 4 đơn từ 3 kho K01, K02, K03 (bao gồm đơn gõ lệch khoảng trắng/hoa thường)
    v_ch1 = kh001_vouchers[0]
    assert len(v_ch1.source_orders) == 4
    assert {it.ma_kho for it in v_ch1.items} == {"K01", "K02", "K03"}
    assert {it.stt_px for it in v_ch1.items} == {
        "MK_XE01_0001", "MK_XE01_0002", "MK_XE01_0003", "MK_XE01_0004"
    }

    # Phiếu 2 (CH2 - Hà Đông): 2 đơn từ K01, K03
    v_ch2 = kh001_vouchers[1]
    assert len(v_ch2.source_orders) == 2
    assert {it.ma_kho for it in v_ch2.items} == {"K01", "K03"}
    assert {it.stt_px for it in v_ch2.items} == {"MK_XE01_0005", "MK_XE01_0006"}

    # KH003 mô phỏng quá nợ
    assert staged.customer_debts["KH003"].is_over_limit is True

    # KH004 hàng Mút Loai_Vt='2' tính đúng So_Tam * He_So8 = 20 * 0.16 = 3.2 và chấp nhận dòng giá 0₫
    kh004_v = next(v for v in staged.vouchers if v.ma_dt == "KH004")
    mut_row = next(it for it in kh004_v.items if it.ma_vt == "MUT_T25_160")
    assert mut_row.so_luong8 == 3.2
    assert mut_row.so_luong9 == 3.2
    assert mut_row.so_luong == 3.2
    zero_row = next(it for it in kh004_v.items if it.ma_vt == "MAU_VAI_01")
    assert zero_row.gia_nt9 == 0.0


def test_stage_trip_filters_out_already_exported_stt_px():
    svc = TruckBatchService()
    already_exported = {"MK_XE01_0001", "MK_XE01_0002", "MK_XE01_0009"}
    with (
        patch.object(svc, "_fetch_exported_stt_px", return_value=already_exported),
        patch.object(svc, "_batch_fetch_customers", return_value={}),
        patch.object(svc, "_batch_fetch_products", return_value={}),
        patch.object(svc.price_repo, "get_prices_batch", return_value={}),
        patch.object(
            svc.debt_repo,
            "get_customer_debt_summary",
            side_effect=lambda ma_dt, **_: CustomerDebtSummary(ma_dt=ma_dt),
        ),
    ):
        staged = svc.stage_trip("XE-DEMO-01", adapter_name="mock")

    assert staged is not None
    assert staged.total_exported_orders == 3
    assert staged.total_pending_orders == 7
    returned_keys = {o.source_order_key for v in staged.vouchers for o in v.source_orders}
    assert returned_keys.isdisjoint(already_exported)


# ---------------------------------------------------------------------------
# 3. Atomic Batch Save (Single Transaction All-or-Nothing, Numbering, Debt, Cost Guard)
# ---------------------------------------------------------------------------

def test_save_vouchers_batch_success_sequential_numbers_and_null_cost_columns():
    repo = VoucherRepository()
    cur = FakeBatchCursor(
        valid_customers={"KH001", "KH002"},
        max_so_ct="HD0010",
        # Giả lập VFP vừa lấy mất HD0012 -> hệ thống phải tự nhảy sang HD0013!
        taken_so_cts={"HD0012"},
    )
    fake_tx, tx_state = _make_fake_tx(cur)

    v1 = _make_voucher(ma_dt="KH001", stt_px="MK_001", gia_nt9=500_000, so_luong9=2)
    v2 = _make_voucher(ma_dt="KH001", stt_px="MK_002", gia_nt9=0.0, so_luong9=5)  # giá 0₫ hợp lệ
    v3 = _make_voucher(ma_dt="KH002", stt_px="MK_003", gia_nt9=1_200_000, so_luong9=1)

    with (
        patch.object(repo, "get_closing_date", return_value="2026-10-31"),
        patch.object(repo, "_get_db_transaction", side_effect=fake_tx),
        patch.object(
            repo,
            "_get_debt_repository",
            return_value=MagicMock(
                get_customer_debt_summary=MagicMock(
                    return_value=CustomerDebtSummary(ma_dt="KH001", du_cuoi=10_000, du_cuoi_kiem_tra=10_000, gioi_han=500_000_000)
                )
            ),
        ),
    ):
        res = repo.save_vouchers_batch([v1, v2, v3], user_name="KTCN3", draft_ids=["D1", "D2", "D3"])

    assert tx_state["committed"] is True
    assert tx_state["rolled_back"] is False
    assert [r.so_ct for r in res] == ["HD0011", "HD0013", "HD0014"]
    assert len({r.stt for r in res}) == 3

    # Verify 4 cột giá vốn (index 21..24 trong 35 cột CtBH0) LUÔN là None (NULL)
    assert len(cur.ctbh0_inserts) == 3
    for _sql, params in cur.ctbh0_inserts:
        assert params[21] is None  # Gia_Nt
        assert params[22] is None  # Gia
        assert params[23] is None  # Tien_Nt
        assert params[24] is None  # Tien

    # Verify sp_getapplock & ST_Increase_KeyIndex batch (1 lần duy nhất cho 3 header + 3 item = 6 khóa)
    key_calls = [p for sql, p in cur.executed if "ST_INCREASE_KEYINDEX" in sql.upper()]
    assert len(key_calls) == 1
    assert key_calls[0][0] == 6


def test_save_vouchers_batch_cumulative_debt_blocks_second_voucher_unless_bypassed():
    repo = VoucherRepository()
    # Dư nợ hiện tại = 120tr, Giới hạn = 150tr.
    # Phiếu 1 = 40tr -> trước phiếu 1 nợ = 120tr (< 150tr OK), sau phiếu 1 nợ = 160tr.
    # Phiếu 2 = 20tr -> trước phiếu 2 nợ cộng dồn = 160tr (>= 150tr -> CHẶN!).
    debt_mock = MagicMock(
        get_customer_debt_summary=MagicMock(
            return_value=CustomerDebtSummary(
                ma_dt="KH001",
                du_cuoi=120_000_000.0,
                du_cuoi_kiem_tra=120_000_000.0,
                gioi_han=150_000_000.0,
                is_over_limit=False,
            )
        )
    )

    v1 = _make_voucher(ma_dt="KH001", stt_px="MK_001", gia_nt9=40_000_000, so_luong9=1)
    v2 = _make_voucher(ma_dt="KH001", stt_px="MK_002", gia_nt9=20_000_000, so_luong9=1, skip_debt_check=False)

    with (
        patch.object(repo, "get_closing_date", return_value="2026-10-31"),
        patch.object(repo, "_get_debt_repository", return_value=debt_mock),
        patch.object(repo, "_get_db_transaction") as tx_spy,
    ):
        with pytest.raises(BatchVoucherError) as exc_info:
            repo.save_vouchers_batch([v1, v2], draft_ids=["D1", "D2"])

    assert exc_info.value.code == "DEBT_OVER_LIMIT"
    assert exc_info.value.voucher_index == 1
    assert exc_info.value.draft_id == "D2"
    # Pre-validation chặn trước khi mở DB transaction (0 lock!)
    tx_spy.assert_not_called()

    # Khi bấm Shift+Enter bypass trên phiếu 2 (skip_debt_check=True) -> cho lưu cả 2 phiếu!
    v2_bypass = _make_voucher(ma_dt="KH001", stt_px="MK_002", gia_nt9=20_000_000, so_luong9=1, skip_debt_check=True)
    cur = FakeBatchCursor(valid_customers={"KH001"}, max_so_ct="HD0020")
    fake_tx, tx_state = _make_fake_tx(cur)
    with (
        patch.object(repo, "get_closing_date", return_value="2026-10-31"),
        patch.object(repo, "_get_debt_repository", return_value=debt_mock),
        patch.object(repo, "_get_db_transaction", side_effect=fake_tx),
    ):
        res = repo.save_vouchers_batch([v1, v2_bypass], draft_ids=["D1", "D2"])
    assert tx_state["committed"] is True
    assert len(res) == 2


def test_save_vouchers_batch_rolls_back_all_on_sp_error_in_middle_voucher():
    repo = VoucherRepository()
    cur = FakeBatchCursor(
        valid_customers={"KH001", "KH002"},
        max_so_ct="HD0050",
        fail_on_sp_call=("CtBH_SoCai", 2),  # Lỗi ở phiếu thứ 2
    )
    fake_tx, tx_state = _make_fake_tx(cur)

    v1 = _make_voucher(ma_dt="KH001", stt_px="MK_001", gia_nt9=500_000)
    v2 = _make_voucher(ma_dt="KH002", stt_px="MK_002", gia_nt9=600_000)
    v3 = _make_voucher(ma_dt="KH001", stt_px="MK_003", gia_nt9=700_000)

    with (
        patch.object(repo, "get_closing_date", return_value="2026-10-31"),
        patch.object(repo, "_get_db_transaction", side_effect=fake_tx),
        patch.object(
            repo,
            "_get_debt_repository",
            return_value=MagicMock(
                get_customer_debt_summary=MagicMock(return_value=CustomerDebtSummary(ma_dt="KH001", gioi_han=0))
            ),
        ),
    ):
        with pytest.raises(RuntimeError, match="Simulated SQL SP failure"):
            repo.save_vouchers_batch([v1, v2, v3])

    assert tx_state["committed"] is False
    assert tx_state["rolled_back"] is True


def test_save_vouchers_batch_blocks_concurrent_duplicate_stt_px():
    repo = VoucherRepository()
    cur = FakeBatchCursor(
        valid_customers={"KH001"},
        existing_stt_px={"MK_002"},
    )
    fake_tx, tx_state = _make_fake_tx(cur)

    v1 = _make_voucher(ma_dt="KH001", stt_px="MK_001")
    v2 = _make_voucher(ma_dt="KH001", stt_px="MK_002")

    with (
        patch.object(repo, "get_closing_date", return_value="2026-10-31"),
        patch.object(repo, "_get_db_transaction", side_effect=fake_tx),
        patch.object(
            repo,
            "_get_debt_repository",
            return_value=MagicMock(
                get_customer_debt_summary=MagicMock(return_value=CustomerDebtSummary(ma_dt="KH001", gioi_han=0))
            ),
        ),
    ):
        with pytest.raises(BatchVoucherError) as exc_info:
            repo.save_vouchers_batch([v1, v2], draft_ids=["D1", "D2"])

    assert exc_info.value.code == "DUPLICATE_STT_PX"
    assert exc_info.value.conflict_order_keys == ["MK_002"]
    assert tx_state["rolled_back"] is True
    assert tx_state["committed"] is False


def test_save_vouchers_batch_rolls_back_on_integrity_assertion_mismatch():
    repo = VoucherRepository()
    cur = FakeBatchCursor(
        valid_customers={"KH001"},
        integrity_override=[],  # Không trả dòng nào -> lệch integrity
    )
    fake_tx, tx_state = _make_fake_tx(cur)

    v1 = _make_voucher(ma_dt="KH001", stt_px="MK_001", gia_nt9=1_000_000)

    with (
        patch.object(repo, "get_closing_date", return_value="2026-10-31"),
        patch.object(repo, "_get_db_transaction", side_effect=fake_tx),
        patch.object(
            repo,
            "_get_debt_repository",
            return_value=MagicMock(
                get_customer_debt_summary=MagicMock(return_value=CustomerDebtSummary(ma_dt="KH001", gioi_han=0))
            ),
        ),
    ):
        with pytest.raises(AssertionError):
            repo.save_vouchers_batch([v1])

    assert tx_state["rolled_back"] is True
    assert tx_state["committed"] is False


# ---------------------------------------------------------------------------
# 4. API Router Tests
# ---------------------------------------------------------------------------

def test_api_truck_batch_list_and_stage_mock():
    with (
        patch("app.services.truck_batch_service.truck_batch_service._fetch_exported_stt_px", return_value=set()),
        patch("app.services.truck_batch_service.truck_batch_service._batch_fetch_customers", return_value={}),
        patch("app.services.truck_batch_service.truck_batch_service._batch_fetch_products", return_value={}),
        patch("app.services.truck_batch_service.truck_batch_service.price_repo.get_prices_batch", return_value={}),
        patch(
            "app.services.truck_batch_service.truck_batch_service.debt_repo.get_customer_debt_summary",
            side_effect=lambda ma_dt, **_: CustomerDebtSummary(ma_dt=ma_dt),
        ),
    ):
        r_trips = client.get("/api/truck-batch/trips?adapter=mock")
        assert r_trips.status_code == 200
        body = r_trips.json()
        assert body["success"] is True
        assert len(body["data"]["trips"]) >= 2

        r_stage = client.get("/api/truck-batch/trips/XE-DEMO-01/stage?adapter=mock")
        assert r_stage.status_code == 200
        sbody = r_stage.json()["data"]
        assert sbody["trip"]["trip_id"] == "XE-DEMO-01"
        assert len(sbody["vouchers"]) == 6  # KH001 (2) + KH002 (2) + KH003 (1) + KH004 (1)


def test_api_truck_batch_sql_adapter_returns_501_until_schema_wired():
    r = client.get("/api/truck-batch/trips?adapter=sql")
    assert r.status_code == 501
    assert r.json()["detail"]["code"] == "ADAPTER_NOT_CONFIGURED"


def test_api_truck_batch_commit_returns_409_on_duplicate_stt_px():
    with patch(
        "app.services.truck_batch_service.truck_batch_service.commit_batch",
        side_effect=BatchVoucherError(
            "Trùng Stt_PX",
            code="DUPLICATE_STT_PX",
            voucher_index=0,
            draft_id="DRAFT-001",
            conflict_order_keys=["MK_XE01_0001"],
        ),
    ):
        r = client.post(
            "/api/truck-batch/commit",
            json={
                "trip_id": "XE-DEMO-01",
                "user_name": "KTCN3",
                "vouchers": [
                    {
                        "draft_id": "DRAFT-001",
                        "ma_dt": "KH001",
                        "ngay_ct": "2026-11-24",
                        "source_order_keys": ["MK_XE01_0001"],
                        "items": [
                            {
                                "stt_px": "MK_XE01_0001",
                                "ma_vt": "800116020025",
                                "ma_kho": "K01",
                                "so_luong9": 2,
                                "gia_nt9": 1000000,
                            }
                        ],
                    }
                ],
            },
        )
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "DUPLICATE_STT_PX"
    assert r.json()["detail"]["conflict_order_keys"] == ["MK_XE01_0001"]
