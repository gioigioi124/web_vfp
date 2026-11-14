from typing import Optional
from app.repositories.debt_repo import debt_repository
from app.schemas.debt import CustomerDebtSummary, DebtDetailResponse, DebtLedgerResponse

class DebtService:
    def __init__(self):
        self.repo = debt_repository

    def get_customer_debt(self, ma_dt: str, tk: str = "131", stt: str = "") -> CustomerDebtSummary:
        return self.repo.get_customer_debt_summary(ma_dt=ma_dt, tk=tk, stt=stt)

    def get_voucher_debt_detail(self, stt: str) -> DebtDetailResponse:
        return self.repo.get_voucher_debt_detail(stt=stt)

    def get_customer_debt_ledger(
        self,
        ma_dt: str = "",
        ngay_bd: Optional[str] = None,
        ngay_kt: Optional[str] = None,
        tk: str = "131",
    ) -> DebtLedgerResponse:
        return self.repo.get_customer_debt_ledger(
            ma_dt=ma_dt, ngay_bd=ngay_bd, ngay_kt=ngay_kt, tk=tk
        )

debt_service = DebtService()
