from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.mark.parametrize(
    "module_key,expected_prefix",
    [
        ("purchase", "MH"),
        ("inv-io", "NX"),
        ("inv-transfer", "CK"),
        ("gl-voucher", "PK"),
    ],
)
def test_module_vouchers_crud_mock_fallback(client: TestClient, module_key: str, expected_prefix: str):
    # List initial mock rows when SQL Server is offline
    res = client.get(f"/api/modules/{module_key}/vouchers")
    assert res.status_code == 200
    data = res.json()
    assert data["is_mock"] is True
    assert len(data["items"]) >= 1

    first_stt = data["items"][0]["stt"]
    detail_res = client.get(f"/api/modules/{module_key}/vouchers/{first_stt}")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["stt"] == first_stt
    assert isinstance(detail["items"], list)

    # Create a new voucher
    payload = {
        "ma_ct": expected_prefix,
        "ngay_ct": "2026-11-20",
        "so_ct": f"{expected_prefix}-TEST-001",
        "ma_dt": "KH001",
        "ten_dt": "Khach hang test",
        "dien_giai0": f"Chung tu test {module_key}",
        "tk": "331" if module_key == "purchase" else "1561",
        "ma_tte": "VND",
        "ty_gia": 1,
        "items": [
            {
                "stt0": "1",
                "ma_kho": "KHO1",
                "ma_kho_n": "KHO2" if module_key == "inv-transfer" else "",
                "ma_vt": "VT001" if module_key != "gl-voucher" else "",
                "ten_vt": "Vat tu test",
                "dvt": "Cai",
                "so_luong": 2 if module_key != "gl-voucher" else 0,
                "gia_nt": 150000 if module_key != "gl-voucher" else 0,
                "tien_nt": 300000,
                "tk": "1561",
                "tk_du": "331",
                "dien_giai": "Dong chi tiet test",
            }
        ],
    }
    create_res = client.post(f"/api/modules/{module_key}/vouchers", json=payload)
    assert create_res.status_code == 200
    created = create_res.json()
    new_stt = created["stt"]
    assert created["so_ct"] == f"{expected_prefix}-TEST-001"
    assert created["ttien_nt"] == 300000

    # Update voucher
    payload["dien_giai0"] = f"Updated {module_key}"
    payload["items"][0]["tien_nt"] = 450000
    update_res = client.put(f"/api/modules/{module_key}/vouchers/{new_stt}", json=payload)
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["dien_giai0"] == f"Updated {module_key}"
    assert updated["ttien_nt"] == 450000

    # Delete voucher
    del_res = client.delete(f"/api/modules/{module_key}/vouchers/{new_stt}")
    assert del_res.status_code == 200
    assert isinstance(del_res.json(), dict)

    # Confirm deleted
    after_del = client.get(f"/api/modules/{module_key}/vouchers/{new_stt}")
    assert after_del.status_code == 404


def test_unknown_module_returns_404(client: TestClient):
    res = client.get("/api/modules/unknown-mod/vouchers")
    assert res.status_code == 404


@pytest.mark.parametrize("tk_prefix", ["131", "331"])
def test_partner_balances_and_ledger_mock_fallback(client: TestClient, tk_prefix: str):
    res = client.get(f"/api/accounting/partner-balances?tk_prefix={tk_prefix}")
    assert res.status_code == 200
    body = res.json()
    assert body["tk_prefix"] == tk_prefix
    assert body["is_mock"] is True
    assert len(body["items"]) >= 1

    ma_dt = body["items"][0]["ma_dt"]
    ledger_res = client.get(
        f"/api/accounting/partner-ledger?tk_prefix={tk_prefix}&ma_dt={ma_dt}"
    )
    assert ledger_res.status_code == 200
    ledger = ledger_res.json()
    assert ledger["tk_prefix"] == tk_prefix
    assert ledger["ma_dt"] == ma_dt
    assert ledger["is_mock"] is True
    assert isinstance(ledger["entries"], list)


def test_trial_balance_and_gl_ledger_mock_fallback(client: TestClient):
    tb_res = client.get("/api/accounting/trial-balance")
    assert tb_res.status_code == 200
    tb = tb_res.json()
    assert tb["is_mock"] is True
    assert len(tb["items"]) >= 1
    assert tb["sum_ps_no"] > 0
    assert tb["sum_ps_co"] > 0

    first_tk = tb["items"][0]["tk"]
    gl_res = client.get(f"/api/accounting/gl-ledger?tk={first_tk}")
    assert gl_res.status_code == 200
    gl = gl_res.json()
    assert gl["tk"] == first_tk
    assert gl["is_mock"] is True
    assert isinstance(gl["entries"], list)
