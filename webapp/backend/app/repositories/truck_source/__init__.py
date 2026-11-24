"""Adapter registry for Truck Batch Export data sources."""

from typing import Optional

from app.config import settings
from app.repositories.truck_source.base import TruckSourceAdapter
from app.repositories.truck_source.kh2014_adapter import Kh2014TruckAdapter
from app.repositories.truck_source.mock_adapter import MockTruckAdapter
from app.repositories.truck_source.sql_adapter import SqlTruckAdapter, make_source_order_key

_ADAPTERS = {
    "mock": MockTruckAdapter(),
    "kh2014": Kh2014TruckAdapter(),
    "sql": SqlTruckAdapter(),
}


def get_truck_source_adapter(adapter_name: Optional[str] = None) -> TruckSourceAdapter:
    name = (adapter_name or settings.TRUCK_SOURCE_ADAPTER or "mock").strip().lower()
    adapter = _ADAPTERS.get(name)
    if adapter is None:
        raise ValueError(
            f"Adapter nguồn xe hàng '{name}' không hợp lệ. Chỉ hỗ trợ: {', '.join(_ADAPTERS.keys())}."
        )
    return adapter


__all__ = [
    "TruckSourceAdapter",
    "MockTruckAdapter",
    "Kh2014TruckAdapter",
    "SqlTruckAdapter",
    "get_truck_source_adapter",
    "make_source_order_key",
]
