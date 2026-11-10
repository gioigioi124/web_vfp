# MEMORY — Webapp: lỗi đã gặp, cách sửa, và những điều PHẢI TRÁNH

> **Phạm vi:** CHỈ webapp (`e:\1S2024\html\webapp\`) — FastAPI + React + SQL Server.
> Không bao gồm nội dung form VFP (form VFP xem `All_fix.md`).
> **Cập nhật:** 2026-10-24
> **Đọc kèm:** `html/plan.md` (kế hoạch), `html/vp2014_schema.md` (schema DB),
> `html/phase2_report_and_test_guide.md` (báo cáo GĐ2).

---

## 0. NGUYÊN TẮC BẤT DI BẤT DỊCH

1. **KHÔNG sửa/thêm/xóa bất cứ thứ gì trong SQL Server** khi chưa được phép (không thêm cột, index, trigger, view).
   Mọi script soi DB phải **READ-ONLY** (`SELECT ... WITH (NOLOCK)`).
2. **File tạm → thư mục `scratch/`**; xong nhiệm vụ thì **xóa sạch**.
3. **Không vá dữ liệu cũ** trong DB. Chỉ sửa code để lần sau đúng; dữ liệu cũ người dùng tự xử lý.
4. **Đối chiếu chuẩn VFP** (dữ liệu do VFP ghi là golden reference) trước khi kết luận đúng/sai.
5. **Validate ở backend**, không tin dữ liệu từ frontend (mã khách, mã hàng, tổng tiền…).
6. **Mọi ghi DB phải trong transaction ACID** (`get_db_transaction`) + có **integrity assertion** trước commit.
7. **Sau khi sửa phải verify**: `python -m pytest` · `npx tsc --noEmit` · `npm run build`.

---

## 1. BẢN ĐỒ NHANH — CÁI GÌ NẰM Ở ĐÂU

| Database  | Chứa gì                                                                                                        | Quyền của webapp |
| --------- | -------------------------------------------------------------------------------------------------------------- | ---------------- |
| `VP_2014` | Chứng từ `CtBH`/`CtBH0`, sổ cái `SoCai`/`SoCaiVT`, hàm `fn_TCVNToUnicode`/`fn_UnicodeToTCVN`, các SP nghiệp vụ | ✅ **ghi**       |
| `VTSYS`   | **Danh mục**: `DmDt`, `DmVt`, `DmKho`, `DmBp`, `DmNhDt`, `DmXe`, counter `DmStt`                               | ❌ chỉ SELECT    |
| `KH_2014` | Kho: `CtBH`/`CtBH0` (phiếu xuất), SP giá                                                                       | ❌ chỉ SELECT    |

⚠️ **Sai lầm kinh điển:** `SELECT ... FROM VP_2014.dbo.DmDt` → **`Invalid object name`**.
Danh mục nằm ở **`VTSYS`**. Ngược lại, hàm chuyển mã định nghĩa ở **`VP_2014`** → phải gọi
`VP_2014.dbo.fn_TCVNToUnicode(...)` kể cả khi đã kết nối vào `VTSYS`.

| Kết nối                                              | Cấu hình                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| `backend/app/config.py` (`DB_VP`, `DB_SYS`, `DB_KH`) | Driver `{ODBC Driver 17 for SQL Server}`, server `192.168.10.8,14333` |

| Đối tượng                     | Số dòng    | PK     |
| ----------------------------- | ---------- | ------ |
| `VTSYS.dbo.DmDt` (khách hàng) | **5.199**  | `DTID` |
| `VTSYS.dbo.DmVt` (hàng hóa)   | **36.995** | `VTID` |

---

## 2. BẢNG TỔNG HỢP LỖI (triệu chứng → nguyên nhân gốc → cách sửa)

| #   | Triệu chứng                                                                             | Nguyên nhân gốc                                                                                                                                               | Cách sửa đúng                                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `Stt` sinh ra khác hoàn toàn VFP: `S1147227872032005424` thay vì `S1000000000014766996` | `EXEC ST_Increase_KeyIndex` **thiếu `SET NOCOUNT ON`** → pyodbc ném `ProgrammingError: No results` → rơi vào nhánh **fallback Python** (`time.time_ns()`)     | Thêm `SET NOCOUNT ON;` + `SELECT @p_Stt AS Stt;`. **Chỉ `ST_Increase_KeyIndex` bị lỗi này** (các SP khác OK cả 2 cách)                                                    |
| A2  | `Ma_Dt` ghi thành **TÊN khách** → `Ten_Dt` NULL khi đọc                                 | FE `handleSelectCustomer` luôn `setMaDt(text)` kể cả khi gõ tên; không kiểm tra tồn tại trong `DmDt`                                                          | FE dùng `cust.ma_dt` (mã thật); **BE validate** `UPPER(RTRIM(Ma_Dt))` ∈ `DmDt` trong transaction, sai thì `raise` → rollback                                              |
| A3  | Phiếu đã lưu **không vào công nợ khách hàng**                                           | SP ghi `dbo.SoCai` là **`VP_2014.dbo.CtBH_SoCai`** (26 params). **`CtBH_Post` KHÔNG ghi `SoCai`**. Webapp bỏ qua `CtBH_SoCai` nên không có bút toán doanh thu | Gọi `CtBH_SoCai`: Nợ `Tk2` (1311) / Có `Tk_Du2` (5112), `Tien = TTien_Nt2`, `Ma_Dt_No = Ma_Dt`, `Ma_Dt_Co = ''`, `Tien_Nt = NULL` (VND), `Stt_Bt = '2'`, `Stt0 = Stt`     |
| A4  | Sửa phiếu → **nhân đôi** sổ cái                                                         | `CtBH_SoCai` **không tự dedup**; gọi lần 2 = thêm dòng mới                                                                                                    | Chế độ Sửa `'S'`: `DELETE dbo.SoCai/SoCaiVT WHERE Stt=?` **TRƯỚC** khi post lại, trong cùng transaction                                                                   |
| A5  | `SELECT ... FROM VP_2014.dbo.DmDt` → `Invalid object name`                              | Danh mục ở `VTSYS`, không ở `VP_2014`                                                                                                                         | Dùng `VTSYS.dbo.DmDt`                                                                                                                                                     |
| A6  | Hàm chuyển mã báo không tồn tại khi đọc `VTSYS`                                         | `fn_TCVNToUnicode` định nghĩa ở `VP_2014`                                                                                                                     | Ghi đủ `VP_2014.dbo.fn_TCVNToUnicode(...)`                                                                                                                                |
| A7  | **Đơn giá tự về 0** sau khi bấm ra ngoài ô                                              | `DetailGrid.enrichVatTuRow` là **async**: dùng snapshot cũ (lúc `gia_nt9` còn 0) ghi đè ô user đã nhập khi promise resolve                                    | Thêm `itemsRef` (luôn = items mới nhất); enrich chỉ hợp nhất **trường danh mục** (ten_vt/dvt/tk*/he_so*/loai_vt), **KHÔNG ghi đè** ô đã nhập; bỏ kết quả nếu mã VT đã đổi |
| A8  | JSON trả về dính khoảng trắng / so khớp sai                                             | Cột mã `char(16)` có **khoảng trắng đuôi** (`'00000001        '`, DATALENGTH=16)                                                                              | `RTRIM()` trong SQL hoặc `.strip()` khi map                                                                                                                               |
| A9  | Gõ **không dấu** không ra kết quả                                                       | Collation `SQL_Latin1_General_CP1_CI_AS` **không bỏ dấu** (`LIKE '%nguyen%'` = 0 dòng)                                                                        | Ghi rõ hành vi; nếu cần bỏ dấu thì thêm hàm phía app, **không đụng DB**                                                                                                   |
| A10 | Tổng header lệch detail                                                                 | Ghi `''`/`0` thay vì `NULL`; integrity check so sai cột (`SUM(Tien_Nt9)` trong khi `TTien_Nt`/`TTien` là **giá vốn** = NULL)                                  | Áp NULL-policy: rỗng → NULL; integrity assert **chỉ so `SUM(Tien_Nt2)`** + COUNT                                                                                          |
| A11 | Cột **giá vốn** (`Gia_Nt/Gia/Tien_Nt/Tien`) bị ghi bằng giá bán                         | Gán `Gia_Nt = Gia_Nt9`                                                                                                                                        | **4 cột này LUÔN để `NULL`** khi webapp lưu phiếu bán — sổ giá vốn cuối tháng tự tính                                                                                     |
| A12 | Tổng tiền sai khi hàng Mút (`Loai_Vt='2'`/`'4'`)                                        | Tính nhầm công thức / bỏ hệ số                                                                                                                                | `Loai_Vt in ('2','4')`: `So_Luong = So_Luong8 = So_Luong9 = round(So_Tam * He_So8)`                                                                                       |
| A13 | `pickup_repo` crash: `self.vp_db` không tồn tại                                         | Copy nhầm tên thuộc tính repo                                                                                                                                 | Dùng `self.fn_uni`                                                                                                                                                        |
| A14 | `debt_repo` truy vấn sai cột (`Ps_No`/`Ps_Co`)                                          | Suy đoán tên cột thay vì soi schema `SoCai`                                                                                                                   | `SoCai` dùng `Tk_No`/`Ma_Dt_No`, `Tk_Co`/`Ma_Dt_Co`, tiền ở `Tien`/`Tien_Nt`                                                                                              |
| A15 | CORS lỗi, request bị chặn                                                               | `allow_credentials=True` + `["*"]` = cấu hình không hợp lệ                                                                                                    | Bỏ wildcard khi có credentials                                                                                                                                            |
| A16 | Mật khẩu DB bị hardcode trong source                                                    | `DB_PASS="sql2008@"` trong `config.py`                                                                                                                        | Để `""`, bắt buộc đọc từ `backend/.env`                                                                                                                                   |
| A17 | Test/script ghi thật vào DB rồi để lại rác                                              | Script E2E không rollback                                                                                                                                     | Chạy test E2E trong transaction + `ROLLBACK`; nếu lỡ commit thì **xóa dữ liệu test** ngay                                                                                 |
| A18 | Đọc danh mục bị chậm / khóa bảng                                                        | Không có `NOLOCK`, `SELECT *`, không `TOP`                                                                                                                    | `WITH (NOLOCK)` + chỉ lấy cột cần + `TOP (limit)`                                                                                                                         |

---

## 3. QUY TRÌNH KỸ THUẬT CHUẨN (copy-paste được)

### 3.1 Gọi Stored Procedure qua pyodbc — chống lỗi "No results"

SQL Server trả nhiều token `DONE_IN_PROC` cho mỗi SP → **mọi `EXEC` PHẢI có `SET NOCOUNT ON;`**:

```python
# SP thường
cur.execute(f"SET NOCOUNT ON; EXEC {self.vp_db}.dbo.CtBH_Post @p_Kieu=?, @p_Stt=?, @p_UserName=?",
            [kieu, stt, user_name])

# SP có tham số OUTPUT + SELECT kết quả → DECLARE biến, SELECT ở cuối batch
cur.execute(
    "SET NOCOUNT ON; DECLARE @p_Stt char(20) = ''; "
    "EXEC VTSYS.dbo.ST_Increase_KeyIndex @p_Ma_DvCs=?, @p_Stt=@p_Stt OUTPUT; "
    "SELECT @p_Stt AS Stt;", [ma_dvcs])
stt = cur.fetchone()[0]
```

### 3.2 Ghi/đọc văn bản tiếng Việt (TCVN3)

```python
# ĐỌC: bọc hàm chuyển mã của DB (hàm định nghĩa ở VP_2014)
"SELECT Ma_Dt, VP_2014.dbo.fn_TCVNToUnicode(Ten_Dt) AS Ten_Dt FROM VTSYS.dbo.DmDt"

# GHI: văn bản Unicode phải chuyển sang TCVN3 NGAY TRONG SQL (SP không tự đổi mã)
#   Bọc dbo.fn_UnicodeToTCVN(?) cho: Ong_Ba, Dia_Chi, Dien_Giai0, Desc_EN0, Ten_DtGtGt,
#                                    Dvt, Dvt_Ban
```

- `Ten_Dt`, `Ten_Vt`, `Dia_Chi`, `Dvt`… là `nvarchar`/`varchar` nhưng **nội dung lưu ở TCVN3** —
  đọc thô bằng pyodbc sẽ ra mojibake (`'Kh¸ch s¹n H¶i Phßng'`).
- `fn_TCVNToUnicode` trả về **Unicode NFC** → FE chỉ cần `normalize("NFC")` cho chắc.
- `fn_UnicodeToTCVN(NULL)` và `fn_UnicodeToTCVN('')` đều trả **NULL** (rỗng → NULL, không phải `''`).
- Collation `SQL_Latin1_General_CP1_CI_AS` → chỉ bỏ hoa/thường, **không bỏ dấu**.

### 3.3 Chuỗi ghi chứng từ chuẩn — thứ tự bắt buộc

```
1. validate (khóa sổ, mã khách tồn tại, hạn mức nợ) + chuẩn hóa dòng hàng
2. INSERT/UPDATE CtBH            (header)
3. INSERT CtBH0                  (detail — sinh Stt0 cho từng dòng)
4. DELETE SoCai/SoCaiVT          (CHỈ chế độ Sửa 'S', TRƯỚC khi post lại)
5. EXEC CtBH_Post
6. EXEC CtBH_SoCai               <-- BẮT BUỘC: ghi doanh thu vào SoCai (nguồn công nợ).
                                     CtBH_Post KHÔNG làm việc này!
7. EXEC CtBH_SoCaiVT_Save
8. EXEC ST_Save_Number
9. Integrity assertion: SUM(Tien_Nt2) + COUNT khớp header/detail
10. COMMIT
```

Ghi chú quan trọng:

- `Stt` (header) và `Stt0` (detail) **dùng chung** bộ đếm `VTSYS.dbo.DmStt` → `'S1'` + 18 chữ số.
- `CtBH_SoCai` **không tự dedup** → chế độ Sửa phải `DELETE` trước (bước 4).
- Bút toán **giá vốn** (Nợ 632x / Có 155) **KHÔNG ghi** khi lưu phiếu — sổ giá vốn chạy cuối tháng.
- Nếu post sổ cái lỗi ở chế độ Sửa → `raise` để rollback, bảo toàn sổ cái gốc.

---

## 4. CHECKLIST

### 4.1 Trước khi ghi code truy vấn

- [ ] Đã xác định bảng thuộc `VP_2014` / `VTSYS` / `KH_2014` chưa?
- [ ] Đã qualify đủ `db.schema.table` và `db.schema.function` chưa?
- [ ] Cột `char(n)` đã `RTRIM`/`.strip()` chưa?
- [ ] Cột text tiếng Việt đã bọc `VP_2014.dbo.fn_TCVNToUnicode(...)` chưa?
- [ ] Mọi `EXEC` SP đã có `SET NOCOUNT ON;` chưa?
- [ ] SELECT đã có `WITH (NOLOCK)` + `TOP`/`LIMIT` (≤ 200 cho lookup) chưa?

### 4.2 Trước khi ghi code ghi dữ liệu

- [ ] Đang dùng `get_db_transaction` (ACID) chứ không phải autocommit?
- [ ] Có validate dữ liệu đầu vào ở BE (mã khách/hàng tồn tại, số dương…) chưa?
- [ ] Văn bản Unicode đã chuyển TCVN3 tại chỗ ghi chưa?
- [ ] Có vô tình ghi vào 4 cột **giá vốn** (`Gia_Nt/Gia/Tien_Nt/Tien`) không? → phải là `NULL`.
- [ ] Có gọi `CtBH_SoCai` để ghi công nợ chưa?
- [ ] Có integrity assertion trước commit chưa?

### 4.3 Sau khi sửa (bắt buộc verify)

- [ ] `python -m pytest` → tất cả PASS
- [ ] `npx tsc --noEmit` → EXIT 0
- [ ] `npm run build` → OK
- [ ] Nếu test E2E trên DB thật: **transaction + ROLLBACK**, xóa dữ liệu test nếu lỡ commit
- [ ] **Dọn sạch `scratch/`**

---

## 5. LỖI ĐÃ TỪNG TÁI PHÁT (cần đặc biệt cảnh giác)

1. **Thiếu `SET NOCOUNT ON`** → gây sai `Stt` hoàn toàn (A1). Đây là lỗi pyodbc kinh điển, dễ tái phát ở mọi SP mới.
2. **Ghi đè cột giá vốn** → xảy ra nhiều lần (A11). Quy tắc: `Gia_Nt/Gia/Tien_Nt/Tien` **KHÔNG BAO GIỜ** ghi từ webapp lưu phiếu bán.
3. **`CtBH_Post` ≠ ghi sổ cái** → phải gọi thêm `CtBH_SoCai` (A3). Nếu thiếu, phiếu "đúng dữ liệu" nhưng **không vào công nợ** — lỗi rất khó nhận ra.
4. **`CtBH_SoCai` không dedup** → chế độ Sửa bắt buộc `DELETE` trước (A4).
5. **Nhầm 2 chiều DB↔hàm** → danh mục ở `VTSYS` nhưng hàm chuyển mã ở `VP_2014` (A5, A6).
6. **Async enrich ghi đè input** → nếu thêm field async enrich mới, luôn dùng `itemsRef` và chỉ merge trường danh mục (A7).
7. **Test/E2E để lại rác trong DB** → luôn rollback hoặc dọn ngay (A17).

---

## 6. SỰ THẬT SCHEMA CẦN NHỚ (đã verify read-only 2026-10-24)

| Bảng (DB)                                      | Số dòng    | PK     | Ghi chú                                                                                                                   |
| ---------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| `VTSYS.dbo.DmDt`                               | **5.199**  | `DTID` | `Ma_Dt char(16)`; `Ten_Dt/Dia_Chi/Doi_Tac` = **TCVN3**; `Ms_Thue`, `Gioi_Han`, `Toi_Han`, `Han_Tt`, `Kieu_Cn`, `Ma_Nh_Dt` |
| `VTSYS.dbo.DmVt`                               | **36.995** | `VTID` | `Ma_Vt char(16)`; `Ten_Vt/Dvt/Dvt_Ban` = **TCVN3**; `Loai_Vt`, `He_So0/1/2`, `Tk_Vt/Tk_Gv/Tk_Dt/Tk_Ck`                    |
| `VTSYS.dbo.DmKho` / `DmBp` / `DmNhDt` / `DmXe` | —          | —      | Danh mục kho / bộ phận / nhóm KH / xe                                                                                     |
| `VP_2014.dbo.CtBH`                             | 46 cột     | `Stt`  | Header chứng từ (Ma_Ct = `'X1'` phổ biến nhất)                                                                            |
| `VP_2014.dbo.CtBH0`                            | 35 cột     | `Stt0` | Detail (Tk=6321/6322, Tk_Du=155, Tk_Du2=5111/5112)                                                                        |
| `VP_2014.dbo.SoCai`                            | —          | —      | **Nguồn công nợ** (`Tk_No`/`Ma_Dt_No`, `Tk_Co`/`Ma_Dt_Co`, `Tien`/`Tien_Nt`)                                              |

- **BẢNG GIÁ THẬT = `VP_2014.dbo.BG` (header) + `BG0` (detail)** (xác minh lại 2026-10-26).
  `BG`: `Stt` PK, `Ma_DvCs`, `Ngay_Ct`, `So_Ct`, `Ma_Dt` char(16) NULL, `Ma_Vm` char(8) NULL
  (`Ma_Dt` XOR `Ma_Vm`), `Ma_Tte`, `Ty_Gia`, `Ngay_Ct1/2` NULL, `UserName`, `Confirmed`, `Closed`.
  `BG0`: `Stt0` PK, `Stt` FK, `Ma_Vt` char(16), `Dvt` varchar(8), `Gia` numeric, `CK` numeric.
  Liên kết khách↔khu vực: `VTSYS.dbo.DmDt.Ma_Vm` ↔ `BG.Ma_Vm` (danh mục `VTSYS.dbo.DmVm`).
  Webapp **đọc trực tiếp `BG`/`BG0`** (không dùng SP). SP `SO_Get_Price`/`SO_Get_Discount`
  (mã hóa `WITH ENCRYPTION`) chỉ là lớp đọc `BG`/`BG0` bên trong; giá vốn:
  `IN_Calculate_FIFOPrice`, `IN_Calculate_MonthAveragePrice`, `IN_Calculate_MovementAveragePrice`.
- Số bảng: `VP_2014` = 41, `VTSYS` = 67, `KH_2014` = 41.
- Counter cấp `Stt`: `VTSYS.dbo.ST_Increase_KeyIndex` + bảng `VTSYS.dbo.DmStt` → `'S1'` + 18 chữ số.
- Khóa sổ: `VTSYS.dbo.DmDvCs.Ngay_Kt_Ht` (mọi `Ngay_Ct <= Ngay_Kt_Ht` bị chặn).
- Hạn mức nợ: SP `VP_2014.dbo.GL_Alert_ClosingAccount4Customer`.

---

## 7. VỊ TRÍ FILE CODE

Base: `e:\1S2024\html\webapp\`

**Backend**

- `backend/app/config.py` — cấu hình kết nối 3 DB (`DB_VP`, `DB_SYS`, `DB_KH`), `.env` cho `DB_PASS`
- `backend/app/database.py` — `get_db_cursor` (read-only, autocommit) · `get_db_transaction` (ACID)
- `backend/app/utils/unicode.py` — chuyển mã TCVN3 ↔ Unicode
- `backend/app/utils/money.py` — `round_amount`, `round_vnd`
- `backend/app/repositories/voucher_repo.py` — ghi chứng từ (7 CHỐT + `CtBH_SoCai` + integrity assert)
- `backend/app/repositories/lookup_repo.py` — danh mục (DmVt/DmDt/DmKho…)
- `backend/app/repositories/debt_repo.py` — công nợ (đọc `dbo.SoCai`)
- `backend/app/repositories/pickup_repo.py` — phiếu xuất kho (`KH_2014`)
- `backend/app/services/{calc_service,pickup_service}.py`
- `backend/app/schemas/{voucher,lookup,pickup,debt}.py`
- `backend/tests/test_phase2_backend.py` — bộ test hồi quy

**Frontend**

- `frontend/src/components/VoucherForm.tsx` — form chứng từ (header + chọn khách)
- `frontend/src/components/DetailGrid.tsx` — lưới chi tiết (enrich async + `itemsRef`)
- `frontend/src/components/PrintPreview.tsx`, `DebtPanel.tsx`, `PickupDialog.tsx`, `FilterDialog.tsx`
- `frontend/src/lib/lookups.ts`, `frontend/src/lib/calc.ts`, `frontend/src/lib/apiCache.ts`
- `frontend/src/hooks/useVouchers.ts`, `frontend/src/hooks/useHotkeys.ts`

---

## 8. BÀI HỌC XƯƠNG MÁU (tóm tắt)

1. **pyodbc + SP luôn cần `SET NOCOUNT ON`** — nếu không sẽ rơi vào nhánh fallback sai và sinh dữ liệu rác.
2. **`CtBH_Post` không ghi sổ cái** — phải gọi `CtBH_SoCai`, nếu thiếu thì phiếu không vào công nợ (lỗi âm thầm).
3. **4 cột giá vốn không bao giờ ghi từ webapp** — để `NULL`, sổ giá vốn cuối tháng tự tính.
4. **Danh mục ở `VTSYS`, hàm chuyển mã ở `VP_2014`** — nhầm là `Invalid object name` ngay.
5. **Văn bản tiếng Việt là TCVN3, không phải Unicode** — phải chuyển mã ở cả đọc và ghi.
6. **`char(n)` luôn dính khoảng trắng đuôi** — `RTRIM`/`.strip()` trước mọi so khớp/trả JSON.
7. **Validate ở backend, không tin frontend** — FE bug rất dễ ghi rác FK (`Ma_Dt` = tên khách).
8. **Dữ liệu sai âm thầm nguy hiểm hơn lỗi runtime** — luôn có integrity assertion trước commit.
9. **Async làm mới dữ liệu dễ ghi đè input người dùng** — dùng ref đọc bản mới nhất, chỉ merge trường danh mục.
10. **Verify sau, dọn `scratch` cuối cùng** — không bỏ bước nào.
