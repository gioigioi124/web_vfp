"""VoucherRepository facade composing modular query, numbering, and mutation mixins.

All public symbols (`VoucherRepository`, `voucher_repository`, `increment_voucher_number`)
and patchable module attributes (`get_db_cursor`, `get_db_transaction`, `debt_repository`)
are re-exported here to preserve 100% backward compatibility.
"""

import logging

from app.config import settings
from app.database import get_db_cursor, get_db_transaction
from app.repositories.debt_repo import debt_repository
from app.repositories.voucher import (
    VoucherHelpersMixin,
    VoucherMutationMixin,
    VoucherNumberingMixin,
    VoucherQueryMixin,
    _CLOSING_DATE_SENTINEL,
    _DETAIL_INSERT_BATCH_SIZE,
    increment_voucher_number,
)
from app.utils.ttl_cache import TTLCache

logger = logging.getLogger("app.repositories.voucher")


class VoucherRepository(
    VoucherQueryMixin,
    VoucherNumberingMixin,
    VoucherMutationMixin,
    VoucherHelpersMixin,
):
    def __init__(self):
        self.vp_db = settings.DB_VP
        self.kh_db = settings.DB_KH
        self.sys_db = settings.DB_SYS
        self.fn_uni = f"{self.vp_db}.dbo.fn_TCVNToUnicode"
        self.fn_tcvn = f"{self.vp_db}.dbo.fn_UnicodeToTCVN"
        self._closing_date_cache = TTLCache(max_size=32, default_ttl=60.0)


voucher_repository = VoucherRepository()

__all__ = [
    "VoucherRepository",
    "voucher_repository",
    "increment_voucher_number",
    "get_db_cursor",
    "get_db_transaction",
    "debt_repository",
    "_DETAIL_INSERT_BATCH_SIZE",
    "_CLOSING_DATE_SENTINEL",
]
