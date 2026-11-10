# TÀI LIỆU KỸ THUẬT TOÀN DIỆN: CƠ CHẾ ÁNH XẠ DỮ LIỆU TỪ FORM CTBHD SANG BẢNG CTBH & CTBH0
## PHÂN TÍCH CHUYÊN SÂU HỆ THỐNG QUY ĐỔI ĐVT, CHIẾT KHẤU, THUẾ SUẤT, ĐỐI SOÁT BASELINE & CẨM NANG KHẮC PHỤC DỮ LIỆU

**Tài liệu:** Master Architecture & Database Mapping Specification  
**Hệ thống áp dụng:** Kế toán Bán hàng 1S (Visual FoxPro 8.0 & Microsoft SQL Server 2014)  
**Phạm vi cơ sở dữ liệu:** `VP_2014` (Văn phòng) & `KH_2014` (Kho bãi)  
**Hồ sơ tham chiếu:** `vp2014_schema.md`, `SCT_OUTPUT\ctbhd.txt`, `All_fix.md`, `bang_gia_mut_fix_log.md`  
**Ngày cập nhật:** 02/10/2026  
**Trạng thái tài liệu:** Production-Grade Technical Standard (Đã thẩm định & gia cố toàn diện)

---

## MỤC LỤC TỔNG THỂ

1. [CHƯƠNG 1: TỔNG QUAN KIẾN TRÚC & VÒNG ĐỜI DỮ LIỆU FORM `ctbhd`](#chương-1-tổng-quan-kiến-trúc--vòng-đời-dữ-liệu-form-ctbhd)
   - 1.1. Kiến trúc Hai Lớp Cursor Trong Bộ Nhớ (`K_PhTemp1` & `K_CtTemp`)
   - 1.2. Hệ thống Cursor Lookup Danh mục (`M_Dm...`)
   - 1.3. Vòng đời dữ liệu Chứng từ (Init $\rightarrow$ Load $\rightarrow$ Edit $\rightarrow$ Validate $\rightarrow$ Save $\rightarrow$ Commit)
   - 1.4. Cơ chế đồng bộ liên Database: Luồng chuyển đơn từ Kho (`KH_2014`) sang Văn phòng (`VP_2014`) qua `ctbhch.scx`
2. [CHƯƠNG 2: MA TRẬN ÁNH XẠ TOÀN DIỆN 100% CỘT BẢNG HEADER `dbo.CtBH` (46 CỘT)](#chương-2-ma-trận-ánh-xạ-toàn-diện-100-cột-bảng-header-dboctbh-46-cột)
   - Bảng tra cứu 46 cột Header: Cột, Kiểu, Nullable, UI Control, ControlSource, Phương thức gán/tính toán & Vai trò kế toán
3. [CHƯƠNG 3: MA TRẬN ÁNH XẠ TOÀN DIỆN 100% CỘT BẢNG CHI TIẾT `dbo.CtBH0` (35 CỘT)](#chương-3-ma-trận-ánh-xạ-toàn-diện-100-cột-bảng-chi-tiết-dboctbh0-35-cột)
   - Bảng tra cứu 35 cột Detail: Cột, Kiểu, Nullable, Vị trí Grid2, ColumnOrder/Caption, Nguồn gán & Phân loại kế toán
   - Phân định ranh giới bất khả xâm phạm giữa Giá vốn (`Gia_Nt/Gia`) và Giá bán (`Gia_Nt9/Gia9`)
   - Cơ chế thiết lập các Tài khoản hạch toán ngầm (`Tk`, `Tk_Du`, `Tk_Du2`, `Tk_Du4`)
4. [CHƯƠNG 4: PHÂN TÍCH CHUYÊN SÂU QUY ĐỔI ĐƠN VỊ TÍNH, VẬT TƯ & GIẢI MÃ HIỆN TƯỢNG NHẢY SỐ LƯỢNG](#chương-4-phân-tích-chuyên-sâu-quy-đổi-đơn-vị-tính-vật-tư--giải-mã-hiện-tượng-nhảy-số-lượng)
   - 4.1. Hệ thống 1: Quy đổi ĐVT phụ thông thường (`Loai_Vt = '1'`: `He_So9`, `So_Luong9`, `So_Luong`) qua `dvt_get` / `dvt_set`
   - 4.2. Hệ thống 2: Quy cách kỹ thuật mặt hàng Mút xốp (`Loai_Vt = '2'`: `So_Tam * He_So8 = So_Luong8 = So_Luong9`)
   - 4.3. Phân loại và cơ chế xử lý 3 nhóm vật tư (`Loai_Vt = '1'`, `'2'`, `'3'`)
   - 4.4. Giải mã gốc rễ hiện tượng "Nhảy số lượng về bằng số tấm" & Nguyên nhân lỗi chập chờn (Intermittent Bug)
   - 4.5. Kiến trúc module giải pháp `Calc_Loai2()` và các điểm gia cố bắt buộc từ Adversarial Audit
5. [CHƯƠNG 5: PHÂN TÍCH CHUYÊN SÂU TIỀN TỆ, CHIẾT KHẤU, THUẾ VAT & CÁC BẪY NGOẠI LỆ](#chương-5-phân-tích-chuyên-sâu-tiền-tệ-chiết-khấu-thuế-vat--các-bẫy-ngoại-lệ)
   - 5.1. Cơ chế Song tệ: Ngoại tệ (`_Nt`) vs VND, Tỷ giá `Ty_Gia` và An toàn phép chia (Zero-division safeguards)
   - 5.2. Mối quan hệ Chiết khấu Dòng (`Chiet_Khau`), Chiết khấu Tổng (`TTien_Nt4`) và Cột Schema `TyLeCK`
   - 5.3. Xử lý triệt để Chiết khấu ẩn khi `Chiet_Khau = 0` và Bảo toàn giá vốn xuất kho (Tuân thủ Fix #21)
   - 5.4. Cơ chế tính toán, phân bổ Thuế GTGT (`Ma_Thue`, `Thue_GTGT`, `TTien_Nt3`, `Loai_Ck`) & Sửa lỗi sót tính lại thuế
   - 5.5. Đẳng thức tổng thanh toán tối hậu: `TTien_Nt0 = TTien_Nt2 + TTien_Nt3` (Triệt tiêu lỗi trừ kép chiết khấu)
   - 5.6. Bẫy hàng khuyến mại 1-10đ trên hóa đơn Ngoại tệ (USD) và giải pháp bọc kiểm tra `Ma_Tte = 'VND'`
6. [CHƯƠNG 6: ĐỐI SOÁT TOÀN DIỆN 108 BẢN GHI VS BASELINE (`SCT_OUTPUT\ctbhd.txt`) & TUÂN THỦ `All_fix.md`](#chương-6-đối-soát-toàn-diện-108-bản-ghi-vs-baseline-sct_outputctbhdtxt--tuân-thủ-all_fixmd)
   - 6.1. Bảng đối soát chi tiết 11 bản ghi có logic thay đổi (`Rec 3, 12, 22, 24, 30, 32, 34, 42, 44, 46, 59` & `Rec 57`)
   - 6.2. Kiểm tra tuân thủ các nguyên tắc kỹ thuật bắt buộc trong `All_fix.md`
7. [CHƯƠNG 7: MA TRẬN KIỂM THỬ QA, SCRIPT SQL ĐỐI SOÁT & KHẮC PHỤC DỮ LIỆU LỊCH SỬ](#chương-7-ma-trận-kiểm-thử-qa-script-sql-đối-soát--khắc-phục-dữ-liệu-lịch-sử)
   - 7.1. Ma trận kiểm thử QA toàn diện (Quality Assurance Test Matrix)
   - 7.2. Script SQL Chẩn đoán phát hiện chứng từ bị sai số lượng / thành tiền trên cả 2 database
   - 7.3. Script SQL Khắc phục số liệu lịch sử an toàn (Transaction Rollback/Commit Safety)
8. [CHƯƠNG 8: CẨM NANG VẬN HÀNH, BẢO TRÌ & QUY TRÌNH ĐÓNG GÓI CHUẨN VFP8](#chương-8-cẩm-nang-vận-hành-bảo-trì--quy-trình-đóng-gói-chuẩn-vfp8)
   - 8.1. Quy trình Patch Form an toàn qua thư mục `scratch/` (Rule 18)
   - 8.2. Quy trình Nén FPT và Biên dịch bằng Visual FoxPro 8.0 GUI
   - 8.3. Phương án sao lưu, quản lý phiên bản và quy trình Rollback khẩn cấp

---

## CHƯƠNG 1: TỔNG QUAN KIẾN TRÚC & VÒNG ĐỜI DỮ LIỆU FORM `ctbhd`

### 1.1. Kiến Trúc Hai Lớp Cursor Trong Bộ Nhớ (`K_PhTemp1` & `K_CtTemp`)
Form chứng từ bán hàng `FRM\ctbhd.scx` (kế thừa từ lớp cha `frmdocitemd` trong thư viện `..\fxp\ktv.vcx`) hoạt động theo mô hình **Disconnected Memory Dataset**. Mọi thao tác hiển thị, nhập liệu và tính toán tài chính trên giao diện người dùng không ghi trực tiếp vào SQL Server mà thông qua hai cursor nội bộ trên RAM của Visual FoxPro:

```
+-----------------------------------------------------------------------------------+
|                           VISUAL FOXPRO RUNTIME MEMORY                            |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   | CURSOR HEADER: K_PhTemp1 (1 Record per Voucher)                           |   |
|   | Ánh xạ cấu trúc: dbo.CtBH (46 Cột)                                        |   |
|   | Bindings: txtNgay_Ct, txtSo_Ct, txtMa_Dt, txtMa_Nx, txtTong_Tien...       |   |
|   +---------------------------------------------------------------------------+   |
|                                         │                                         |
|                                 1-n Relationship                                  |
|                                         ▼                                         |
|   +---------------------------------------------------------------------------+   |
|   | CURSOR DETAIL: K_CtTemp (n Records per Voucher)                           |   |
|   | Ánh xạ cấu trúc: dbo.CtBH0 (35 Cột)                                       |   |
|   | Bindings: Grid2 (RecordSource = "K_CtTemp", 14 Cột hiển thị)              |   |
|   +---------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------+
```

- **`K_PhTemp1` (Header Cursor):** Chứa đúng 1 dòng dữ liệu đại diện cho chứng từ bán hàng đang mở. Toàn bộ các textbox trên form (`txtMa_Dt`, `txtNgay_Ct`, `txtTy_gia`, `txtTong_Tien...`) đều có `ControlSource` trỏ trực tiếp vào các trường của cursor này.
- **`K_CtTemp` (Detail Cursor):** Chứa danh sách các mặt hàng xuất bán của chứng từ. Lưới nhập liệu `Grid2` trên form liên kết với cursor này thông qua thuộc tính `Grid2.RecordSource = "K_CtTemp"`.

### 1.2. Hệ Thống Cursor Lookup Danh Mục (`M_Dm...`)
Khi form khởi tạo, hệ thống nạp sẵn các cursor danh mục phục vụ tra cứu tức thời (autocomplete / lookup):
- `M_DmDt`: Danh mục Khách hàng / Nhà cung cấp (bảng `DmDt` trên SQL).
- `M_DmVt`: Danh mục Vật tư, hàng hóa (bảng `DmVt` trên SQL).
- `M_DmKho`: Danh mục Kho bãi (bảng `DmKho` trên SQL).
- `M_DmThue`: Danh mục Thuế suất GTGT (bảng `DmThue` trên SQL).
- `M_DmNx`: Danh mục Mã nhập xuất / Định khoản doanh thu (bảng `DmNx` trên SQL).
- `M_DmTk`: Danh mục Hệ thống tài khoản kế toán (bảng `DmTk` trên SQL).
- `M_DmCt`: Tham số cấu hình chứng từ hiện hành (bảng `DmCt` trên SQL).

### 1.3. Vòng Đời Dữ Liệu Chứng Từ (Voucher Life-Cycle)
Quy trình từ lúc khởi tạo đến khi dữ liệu được ghi bền vững vào cơ sở dữ liệu trải qua 6 giai đoạn nghiêm ngặt:

```
[ GIAI ĐOẠN 1: KHỞI TẠO (Init) ]
  ├─ frmdocitemd.Init nhận tham số (_Moi_Sua = 'M' hoặc 'S')
  ├─ Thêm mới ('M'): Gọi =Add_One_Voucher(THIS) -> Cấp Stt, nạp default K_PhTemp1
  │                  Nạp mặc định: Ma_Nx = '131', Tk2 = '1311', Ma_Bp, Ma_Xe (Fix #13, #14, #15)
  ├─ Sửa đơn ('S'):  Gọi =Edit_One_Voucher(THIS) -> Query SQL Server đổ vào K_PhTemp1 & K_CtTemp
  └─ Tạo dynamically 3 nhãn công nợ: lblGioiHan, lblCongNo, lblVm (Fix #16)
        │
[ GIAI ĐOẠN 2: NẠP DỮ LIỆU ĐƠN HÀNG (Data Loading) ]
  ├─ Nhập tay trực tiếp trên form
  └─ HOẶC Kế toán bấm "Chọn phiếu xuất" (cmdChonPhieuXuat -> ctbhch.scx)
        │
[ GIAI ĐOẠN 3: TƯƠNG TÁC LƯỚI & TÍNH TOÁN DÒNG (Grid Interaction & LostFocus) ]
  ├─ Người dùng nhập: Ma_Vt, So_Tam, He_So8, So_Luong9, Gia_Nt9, Chiet_Khau...
  ├─ Rời ô (LostFocus) kích hoạt phân luồng vật tư:
  │    ├─ Loai_Vt = '3' -> Gọi =So_Luong3(THISFORM) (Quy cách đặc thù)
  │    ├─ Loai_Vt = '2' -> Gọi THISFORM.Calc_Loai2() (Hàng Mút: So_Tam * He_So8)
  │    └─ Khác ('1')    -> Gọi =So_Luong2(THISFORM) (Hàng thường)
  └─ Tự động cập nhật các trường tiền dòng và cộng dồn Header K_PhTemp1
        │
[ GIAI ĐOẠN 4: HỢP THỨC HÓA & TIỀN KIỂM TRA (Pre-Save Validation) ]
  ├─ Người dùng bấm nút Lưu: Cmgnhan_huy1.Command1.Click
  ├─ 1. Kiểm tra ngày khóa sổ: K_PhTemp1.Ngay_Ct > M_Ngay_Kt_Ht
  ├─ 2. Kiểm tra trường bắt buộc: NOT EMPTY(Ma_Dt), NOT EMPTY(Ma_Nx)
  ├─ 3. Kiểm tra hạn mức công nợ realtime trên SQL Server tại DATE() (Fix #1, #2, #4)
  ├─ 4. Xả buffer lưới an toàn: THISFORM.txtNgay_Ct.SetFocus() (Tránh lỗi ActiveColumn)
  ├─ 5. Chuẩn hóa chiết khấu = 0 và hàng khuyến mại 1-10đ (Fix #5, #17, #21)
  ├─ 6. Tính lại toàn bộ tổng Header: TTien_Nt2, TTien_Nt4, TTien_Nt0 = TTien_Nt2 + TTien_Nt3
  └─ 7. Chống trùng số chứng từ: Vòng lặp ST_Check_Number (Fix #9)
        │
[ GIAI ĐOẠN 5: GHI BỀN VỮNG VÀO DATABASE (Persistence Execution) ]
  ├─ Gọi hàm lõi hệ thống: =Save_Ct(THISFORM._Moi_Sua)
  ├─ Quét K_CtTemp, tính Giá vốn xuất kho: Gia_Nt, Gia, Tien_Nt, Tien
  ├─ Ghi Header K_PhTemp1 vào SQL Server: dbo.CtBH (INSERT nếu 'M', UPDATE nếu 'S')
  ├─ Ghi Detail K_CtTemp vào SQL Server:  dbo.CtBH0 (DELETE cũ + INSERT mới theo Stt)
  └─ Ghi Sổ cái tài khoản: dbo.SoCai & dbo.SoCaiVT
        │
[ GIAI ĐOẠN 6: HẬU XỬ LÝ (Post-Save Finalization) ]
  ├─ In chứng từ nếu có cấu hình tự động in
  └─ Nếu M_Auto_Next = .T. -> Mở form thêm phiếu mới; ngược lại -> THISFORM.Release
```

### 1.4. Cơ Chế Chuyển Đơn Từ Kho (`KH_2014`) Sang Văn Phòng (`VP_2014`) Qua `ctbhch.scx`
Doanh nghiệp vận hành theo mô hình hai cơ sở dữ liệu riêng biệt:
- **Tại Kho (`KH_2014`):** Thủ kho nhập chứng từ xuất kho bán lẻ/bán buôn (`Ma_Ct = 'X1'`). Dữ liệu xuất kho được lưu vào `CtBH` và `CtBH0` thuộc database `KH_2014`.
- **Tại Văn phòng (`VP_2014`):** Kế toán bán hàng mở form `ctbhd.scx`. Để lấy đơn từ kho lên, kế toán bấm nút **"Chọn phiếu xuất"** (`cmdChonPhieuXuat`, Rec 90).

```
[ THỦ KHO - KH_2014 ]                               [ KẾ TOÁN VP - VP_2014 ]
  Thủ kho xuất hàng ctbhd                             Kế toán mở ctbhd.scx
  Ghi vào: CtBH & CtBH0 (Kho)                         Bấm nút "Chọn phiếu xuất"
            │                                                   │
            └────────────── Stored Procedure ───────────────────┘
                       ListReadyToPickup / ctbhch.scx
                                    │
                                    ▼
                      +---------------------------+
                      | Form ctbhch.scx           |
                      | Grid1: Danh sách phiếu PX |
                      | Grid2: Chi tiết K_CtPx    |
                      +---------------------------+
                                    │
                       Chọn đơn & Bấm "Chấp nhận"
                                    │
                                    ▼
                      Đổ toàn bộ dòng từ K_CtPx
                      vào Cursor K_CtTemp trên ctbhd
```

- **Quy trình nạp dữ liệu:**
  1. Thủ tục `ListReadyToPickup` kết nối sang `KH_2014` truy vấn các chứng từ xuất kho chưa lập hóa đơn, mở form trung gian `FRM\ctbhch.scx`.
  2. Lưới `Grid1` của `ctbhch` hiển thị danh sách phiếu xuất (`K_DsPx`), lưới `Grid2` hiển thị chi tiết dòng hàng (`K_CtPx`).
  3. Khi kế toán bấm "Chấp nhận", hệ thống đổ dữ liệu từ `K_CtPx` vào `K_CtTemp` trên form `ctbhd` phía VP.
  4. Cột `Stt_PX` trên `K_CtTemp` được ghi nhận bằng mã `Stt` của chứng từ xuất kho gốc dưới `KH_2014` để thiết lập mối liên kết truy vết.

---

## CHƯƠNG 2: MA TRẬN ÁNH XẠ TOÀN DIỆN 100% CỘT BẢNG HEADER `dbo.CtBH` (46 CỘT)

Căn cứ định nghĩa cấu trúc bảng tại `e:\1S2024\vp2014_schema.md` (mục `dbo.CtBH`), dưới đây là bảng kiểm kê và ánh xạ 100% các cột của bảng Header:

| STT | Tên Cột SQL | Kiểu & Độ Dài | Nullable | Phân Loại | Control UI (Nếu Có) | ControlSource | Cơ Chế Gán / Phương Thức Tính Toán & Vai Trò Kế Toán | Giá Trị Mặc Định |
|:---:|:---|:---|:---:|:---:|:---|:---|:---|:---|
| 1 | `Stt` | `char(20)` | NO (PK) | Hidden | *(Không có)* | `K_PhTemp1.Stt` | Khóa chính duy nhất của chứng từ. Được cấp phát tự động bởi hàm lõi `=Add_One_Voucher(THIS)` bằng hàm hệ thống `SYS(2015)` hoặc chuỗi phân giải ID. | Chuỗi ID hệ thống sinh |
| 2 | `Ma_DvCs` | `char(2)` | NO | Hidden | *(Không có)* | `K_PhTemp1.Ma_DvCs` | Mã đơn vị cơ sở (chi nhánh). Được nạp tự động từ biến toàn cục `M_Ma_DvCs` khi khởi tạo chứng từ trong `=Add_One_Voucher`. Phục vụ phân quyền và lập báo cáo theo chi nhánh. | `M_Ma_DvCs` (VD: `'01'`) |
| 3 | `Ma_Ct` | `char(2)` | NO | Hidden | *(Không có)* | `K_PhTemp1.Ma_Ct` | Mã loại chứng từ (`'BH'` = Hóa đơn bán hàng kiêm phiếu xuất, `'X1'` = Xuất bán). Nhận từ thuộc tính form `THISFORM._Ma_Ct`. | Thuộc tính `_Ma_Ct` |
| 4 | `Nh_Ct` | `char(1)` | NO | Hidden | *(Không có)* | `K_PhTemp1.Nh_Ct` | Nhóm chứng từ (`'1'` = Bán lẻ/Hàng bán trả lại, `'2'` = Bán buôn/Xuất bán). Nạp tự động từ danh mục loại chứng từ `M_DmCt.Nh_Ct`. | `M_DmCt.Nh_Ct` |
| 5 | `Ma_Tte` | `char(3)` | NO | Visible | `txtMa_Tte` (Rec 97) | `K_PhTemp1.Ma_Tte` | Mã đồng tiền thanh toán (`'VND'`, `'USD'`). Mặc định nạp từ `M_Ma_Tte0`. Khi đổi tiền tệ, kích hoạt tính toán lại tỷ giá `Ty_Gia`. | `M_Ma_Tte0` (`'VND'`) |
| 6 | `Ty_Gia` | `numeric(18,4)` | NO | Visible | `txtTy_gia` (Rec 9) | `K_PhTemp1.Ty_Gia` | Tỷ giá hối đoái quy đổi sang VND. Khi `Ma_Tte = 'VND'` thì `Ty_Gia = 1`. Nhập tay hoặc nạp từ danh mục ngoại tệ `M_DmTTe`. Luôn bảo đảm `Ty_Gia >= 1`. | `1` |
| 7 | `Ngay_Ps` | `datetime` | NO | Hidden | *(Không có)* | `K_PhTemp1.Ngay_Ps` | Ngày phát sinh nghiệp vụ kinh tế. Mặc định gán bằng ngày chứng từ `Ngay_Ct` hoặc ngày hệ thống `DATE()`. | Ngày chứng từ |
| 8 | `Ngay_Ct` | `datetime` | NO | Visible | `txtNgay_Ct` (Rec 58) | `K_PhTemp1.Ngay_Ct` | Ngày lập hóa đơn/chứng từ bán hàng. Người dùng nhập; hệ thống kiểm tra khóa sổ kỳ kế toán `Ngay_Ct > M_Ngay_Kt_Ht` khi bấm Lưu. | Ngày làm việc (`DATE()`) |
| 9 | `So_Ct` | `char(20)` | YES | Visible | `txtSo_Ct` (Rec 80) | `K_PhTemp1.So_Ct` | Số hiệu chứng từ (VD: `HD0110-1`). Hệ thống tự động cấp phát khi tạo mới và chạy vòng lặp chống trùng số qua `ADOCommand('ST_Check_Number')` tại nút Lưu (Rec 59). | Tự tăng theo quy tắc |
| 10 | `Ma_Xe` | `char(8)` | YES | Visible | `txtMa_Xe` (Rec 84) | `K_PhTemp1.Ma_Xe` | Mã xe vận chuyển giao hàng. Tên xe hiển thị tại `txtTen_Xe` (Rec 18). Khi bấm F2 thêm mới, tự nạp từ phiếu đang chọn hoặc truy vấn `SELECT Ma_Xe FROM CtBH` (Fix #14). | Rỗng hoặc từ phiếu F2 |
| 11 | `Ma_Bp` | `char(16)` | YES | Visible | `txtMa_Bp` (Rec 83) | `K_PhTemp1.Ma_Bp` | Mã bộ phận/phòng ban bán hàng. Tên hiển thị tại `txtTen_Bp` (Rec 17). Tự động nạp bộ phận mặc định của khách hàng qua `DmDt_Get_1Item` khi F2 hoặc chọn khách (Fix #13). | Nạp theo khách hàng |
| 12 | `Ma_HD` | `char(16)` | YES | Visible | `txtMa_HD` (Rec 11) | `K_PhTemp1.Ma_HD` | Mã hợp đồng kinh tế theo dõi công nợ/doanh thu. Tên hợp đồng hiển thị tại `txtTen_HD` (Rec 57). Tra cứu từ danh mục hợp đồng `M_DmHD`. | Rỗng |
| 13 | `Ma_Dt` | `char(16)` | NO | Visible | `txtMa_Dt` (Rec 12) | `K_PhTemp1.Ma_Dt` | Mã đối tượng khách hàng (Bắt buộc). Tra cứu từ `M_DmDt`. Tên khách hiển thị tại `txtTen_Dt` (Rec 51). Kích hoạt kiểm tra công nợ realtime và cập nhật nhãn `GH:`, `CN:` (Fix #1, #16). | Bắt buộc chọn |
| 14 | `Ma_Nx` | `char(16)` | YES | Visible | `txtMa_Nx` (Rec 88) | `K_PhTemp1.Ma_Nx` | Mã lý do nhập xuất. Tên hiển thị tại `txtTen_Nx` (Rec 6). Tự động điền mặc định `'131'` khi tạo mới (Fix #15); cập nhật cờ ghi sổ cái `Posted = IIF(M_DmNx.Dinh_Khoan = 'C', .T., .F.)`. | `'131'` |
| 15 | `Tk2` | `char(16)` | YES | Visible | `txtTk2` (Rec 76) | `K_PhTemp1.Tk2` | Tài khoản Nợ phải thu khách hàng (VD: `'1311'`). Tên tài khoản hiển thị tại `txtTen_Tk2` (Rec 19). Tự động điền mặc định `'1311'` khi tạo mới bằng F2 (Fix #15). | `'1311'` |
| 16 | `Tk3` | `char(16)` | YES | Visible | `txtTk3` (Rec 10) | `K_PhTemp1.Tk3` | Tài khoản thuế GTGT. Tự động gán tại `txtMa_Thue.LostFocus`: `Tk3 = M_DmThue.Tk` (VD: `'33311'`) nếu bán hàng (`Nh_Ct = '1'`), hoặc `Tk3 = Tk2` nếu trả lại hàng (`Nh_Ct <> '1'`). | Tra cứu theo biểu thuế |
| 17 | `Tk_Du3` | `char(16)` | YES | Visible | `txtTk_Du3` (Rec 69) | `K_PhTemp1.Tk_Du3` | Tài khoản đối ứng thuế GTGT. Tự động gán tại `txtMa_Thue.LostFocus`: `Tk_Du3 = Tk2` nếu bán hàng (`Nh_Ct = '1'`), hoặc `Tk_Du3 = M_DmThue.Tk` nếu trả lại hàng (`Nh_Ct <> '1'`). | Đối ứng theo `Tk2` |
| 18 | `Tk4` | `char(16)` | YES | Hidden | *(Không có)* | `K_PhTemp1.Tk4` | Tài khoản chiết khấu/chi phí khác cấp hóa đơn. Được gán mặc định theo tham số cấu hình chứng từ hoặc loại chiết khấu. | Tra cứu cấu hình |
| 19 | `Ong_Ba` | `nvarchar(64)` | YES | Visible | `txtOng_Ba` (Rec 13) | `K_PhTemp1.Ong_Ba` | Tên người mua hàng / đại diện giao dịch. Tự động lấy từ `M_DmDt.Ong_Ba` khi chọn khách, người dùng có thể sửa đổi tự do. | Nạp theo `DmDt` |
| 20 | `Dia_Chi` | `nvarchar(64)` | YES | Visible | `txtDia_Chi` (Rec 14) | `K_PhTemp1.Dia_Chi` | Địa chỉ giao hàng / thanh toán của khách hàng. Nạp từ `M_DmDt.Dia_Chi`. | Nạp theo `DmDt` |
| 21 | `Dien_Giai0` | `nvarchar(128)` | YES | Visible | `txtDien_Giai0` (Rec 15) | `K_PhTemp1.Dien_Giai0` | Diễn giải nghiệp vụ bằng tiếng Việt hiển thị trên sổ sách và phiếu in. | Người dùng nhập |
| 22 | `Desc_EN0` | `nvarchar(128)` | YES | Visible | `txtDesc_EN0` (Rec 16) | `K_PhTemp1.Desc_EN0` | Diễn giải nghiệp vụ bằng tiếng Anh dùng cho báo cáo song ngữ. | Rỗng / Nhập tay |
| 23 | `TTien_Nt` | `numeric(18,2)` | YES | Visible | `txtTong_Tien0` (Rec 102) | `K_PhTemp1.TTien_Nt` | Tổng tiền hàng trước chiết khấu (Ngoại tệ). Công thức: `TTien_Nt = SUM(K_CtTemp.Tien_Nt9)`. | `0` |
| 24 | `TTien_Nt0` | `numeric(18,2)` | YES | Visible | `txtTong_Tien` (Rec 106) | `K_PhTemp1.TTien_Nt0` | **Tổng thanh toán hóa đơn (Ngoại tệ)**. Công thức kế toán chuẩn: `TTien_Nt0 = TTien_Nt2 + TTien_Nt3` (Tiền hàng sau CK + Tiền thuế). | `0` |
| 25 | `TTien_Nt2` | `numeric(18,2)` | YES | Calculated | *(Không bind trực tiếp)* | `K_PhTemp1.TTien_Nt2` | **Tổng tiền hàng sau chiết khấu (Ngoại tệ)**. Công thức: `TTien_Nt2 = SUM(K_CtTemp.Tien_Nt2)`. Dùng làm căn cứ in dòng tổng tiền trên mẫu in `cthd.frx`, `ctpxg.frx` (Fix #10). | `0` |
| 26 | `TTien_Nt3` | `numeric(18,2)` | YES | Visible | `txtTong_Tien3` (Rec 64) | `K_PhTemp1.TTien_Nt3` | Tổng tiền thuế GTGT (Ngoại tệ). Tính tự động qua hàm `=Thue_GTGT(THISFORM)` theo tỷ lệ `Thue_GTGT` nhân với giá trị tính thuế. | `0` |
| 27 | `TTien_Nt4` | `numeric(18,2)` | YES | Visible | `txtTong_Tien4` (Rec 107) | `K_PhTemp1.TTien_Nt4` | Tổng tiền chiết khấu thương mại cấp hóa đơn (Ngoại tệ). Bằng tổng chiết khấu các dòng: `TTien_Nt4 = SUM(K_CtTemp.Tien_Nt4)` hoặc nhập tổng để phân bổ. | `0` |
| 28 | `TTien` | `numeric(18,0)` | YES | Visible | `txtTong_TienV0` (Rec 91) | `K_PhTemp1.TTien` | Tổng tiền hàng trước chiết khấu (VND). Công thức: `TTien = SUM(K_CtTemp.Tien9)`. Khi tiền tệ là VND thì `TTien = TTien_Nt`. | `0` |
| 29 | `TTien0` | `numeric(18,0)` | YES | Visible | `txtTong_TienV` (Rec 101) | `K_PhTemp1.TTien0` | **Tổng thanh toán hóa đơn (VND)**. Công thức chuẩn: `TTien0 = TTien2 + TTien3`. | `0` |
| 30 | `TTien3` | `numeric(18,0)` | YES | Visible | `txtTong_TienV3` (Rec 103) | `K_PhTemp1.TTien3` | Tổng tiền thuế GTGT (VND). Tính qua `=Thue_GTGT(THISFORM)`. Chỉ cho phép sửa khi `Ma_Tte <> 'VND'` (`When: RETURN K_PhTemp1.Ma_Tte <> M_Ma_Tte0`). | `0` |
| 31 | `TTien2` | `numeric(18,0)` | YES | Calculated | *(Không bind trực tiếp)* | `K_PhTemp1.TTien2` | **Tổng tiền hàng sau chiết khấu (VND)**. Công thức: `TTien2 = SUM(K_CtTemp.Tien2)`. | `0` |
| 32 | `TTien4` | `numeric(18,0)` | YES | Calculated | *(Không bind trực tiếp)* | `K_PhTemp1.TTien4` | Tổng tiền chiết khấu hóa đơn (VND). Công thức: `TTien4 = SUM(K_CtTemp.Tien4)`. | `0` |
| 33 | `Loai_Ck` | `char(1)` | YES | Hidden | *(Không có)* | `K_PhTemp1.Loai_Ck` | Cơ chế tính thuế đối với chiết khấu: `'1'` = Chiết khấu trước thuế (thuế tính trên `TTien_Nt2`); `'0'` hoặc khác = Chiết khấu sau thuế (thuế tính trên `TTien_Nt`). | Tra cứu cấu hình |
| 34 | `TyLeCK` | `numeric(18,2)` | YES | Hidden | *(Không có)* | *(Không bind)* | Tỷ lệ chiết khấu tổng cấp hóa đơn trong thiết kế bảng SQL. Form `ctbhd` thực tế không dùng tỷ lệ tổng mà dùng chiết khấu dòng `Chiet_Khau` và tổng số tiền `TTien_Nt4`. | `0` |
| 35 | `Han_Tt` | `int` | YES | Visible | `txtHan_Tt` (Rec 67) | `K_PhTemp1.Han_Tt` | Hạn thanh toán công nợ (số ngày nợ cho phép). Nạp mặc định từ `M_DmDt.Han_Tt`, người dùng có thể điều chỉnh tùy theo chính sách khách hàng. | Nạp theo `DmDt` |
| 36 | `Ma_Thue` | `char(4)` | YES | Visible | `txtMa_Thue` (Rec 7) | `K_PhTemp1.Ma_Thue` | Mã biểu thuế GTGT (VD: `'V00'`, `'V05'`, `'V08'`, `'V10'`). Tra cứu từ `M_DmThue`. Khi chọn, tự động nạp `Thue_GTGT = M_DmThue.Thue_GTGT`. | Rỗng |
| 37 | `Thue_GTGT` | `numeric(18,2)` | YES | Calculated | *(Không bind trực tiếp)* | `K_PhTemp1.Thue_GTGT` | Thuế suất % GTGT (VD: 0, 5, 8, 10). Tự động gán tại `txtMa_Thue.LostFocus`: `REPLACE Thue_GTGT WITH IIF(!EMPTY(M.Ma_Thue), M_DmThue.Thue_GTGT, 0)`. | `0` |
| 38 | `Ma_DtGtGt` | `char(20)` | YES | Visible | `txtMa_DtGtGt` (Rec 75) | `K_PhTemp1.Ma_DtGtGt` | Mã số thuế (MST) của người mua. Tự động nạp từ `M_DmDt.MS_Thue` trong method `Update_Ten_DtGTGT` của form. | Nạp theo `DmDt` |
| 39 | `Ten_DtGtGt` | `nvarchar(128)` | YES | Visible | `txtTen_DtGtGt` (Rec 60) | `K_PhTemp1.Ten_DtGtGt` | Tên công ty / khách hàng in trên hóa đơn tài chính VAT. Mặc định bằng `K_PhTemp1.Ten_Dt`, người dùng có thể sửa đổi theo đăng ký thuế. | Nạp theo `DmDt` |
| 40 | `So_Ct0` | `char(20)` | YES | Visible | `txtSo_Ct0` (Rec 78) | `K_PhTemp1.So_Ct0` | Số chứng từ gốc đi kèm (hóa đơn vận chuyển, phiếu giao hàng đối tác, số phiếu cân...). | Người dùng nhập |
| 41 | `Ngay_Ct0` | `datetime` | YES | Visible | `txtNgay_Ct0` (Rec 61) | `K_PhTemp1.Ngay_Ct0` | Ngày của chứng từ gốc đi kèm. | Người dùng nhập |
| 42 | `Stt_HBTL` | `char(20)` | YES | Hidden | *(Không có)* | `K_PhTemp1.Stt_HBTL` | Khóa liên kết đến phiếu bán hàng gốc trong trường hợp lập chứng từ Hàng bán trả lại (`Nh_Ct = '1'`). | Rỗng |
| 43 | `Confirmed` | `bit` | YES | Hidden | *(Không có)* | `K_PhTemp1.Confirmed` | Cờ trạng thái duyệt chứng từ (0 = Chưa duyệt, 1 = Đã duyệt). Mặc định là 0 khi tạo mới. | `0` |
| 44 | `Posted` | `bit` | YES | Hidden | *(Không có)* | `K_PhTemp1.Posted` | Cờ ghi sổ cái kế toán (0 = Không ghi, 1 = Đã ghi sổ). Tự động gán theo cấu hình mã nhập xuất `M_DmNx.Dinh_Khoan = 'C'` tại `Init` và `txtMa_Nx.LostFocus`. | `1` (khi Nx='131') |
| 45 | `Printed` | `bit` | YES | Hidden | *(Không có)* | `K_PhTemp1.Printed` | Cờ theo dõi in chứng từ (0 = Chưa in, 1 = Đã in). Tự động bật lên 1 sau khi thực hiện lệnh in thành công qua `In_Ct_Kh` / `In_Ct_Hd`. | `0` |
| 46 | `UserName` | `char(16)` | YES | Visible | `txtUserName` (Rec 73) | `K_PhTemp1.UserName` | Tên tài khoản người dùng đăng nhập hệ thống tạo/sửa chứng từ (`M_Name`). Bị khóa ReadOnly trên giao diện. | Biến toàn cục `M_Name` |

---

## CHƯƠNG 3: MA TRẬN ÁNH XẠ TOÀN DIỆN 100% CỘT BẢNG CHI TIẾT `dbo.CtBH0` (35 CỘT)

Căn cứ định nghĩa cấu trúc bảng tại `e:\1S2024\vp2014_schema.md` (mục `dbo.CtBH0`), dưới đây là bảng kiểm kê và ánh xạ 100% các cột của bảng Chi tiết dòng hàng:

| STT | Tên Cột SQL | Kiểu & Độ Dài | Nullable | Phân Loại | Vị Trí Grid2 | ColumnOrder & Caption | ControlSource | Cơ Chế Gán / Phương Thức Tính Toán & Phân Loại Kế Toán |
|:---:|:---|:---|:---:|:---:|:---|:---:|:---|:---|
| 1 | `Stt_PX` | `char(20)` | YES | Hidden | *(Không có trên lưới)* | — | `K_CtTemp.Stt_PX` | Số thứ tự phiếu xuất kho liên kết. Khi bấm `cmdChonPhieuXuat` (Rec 90) chọn đơn từ kho, trường này lưu `Stt` của phiếu xuất kho trong database `KH_2014`. |
| 2 | `Stt0` | `char(20)` | NO (PK) | Hidden | *(Không có trên lưới)* | — | `K_CtTemp.Stt0` | Khóa chính của dòng chi tiết. Do hàm thư viện hệ thống `=Add_Row(THIS)` tự động sinh chuỗi nhận dạng duy nhất bằng `SYS(2015)` khi thêm dòng mới. |
| 3 | `Stt` | `char(20)` | NO | Hidden | *(Không có trên lưới)* | — | `K_CtTemp.Stt` | Khóa ngoại trỏ về `CtBH.Stt` của Header. Tự động gán đồng bộ với `K_PhTemp1.Stt`. |
| 4 | `Tk` | `char(16)` | YES | Hidden | *(Không có trên lưới)* | — | `K_CtTemp.Tk` | **Tài khoản Nợ Giá vốn** (VD: `'632'`). Gán ngầm tại `Ma_Vt.LostFocus` (Rec 22) và `Ten_Vt.LostFocus` (Rec 24): `REPLACE Tk WITH M_DmVt.Tk_Gv IN K_CtTemp`. |
| 5 | `Tk_Du` | `char(16)` | YES | Hidden | *(Không có trên lưới)* | — | `K_CtTemp.Tk_Du` | **Tài khoản Có Kho/Vật tư** (VD: `'1561'`). Gán ngầm tại Rec 22 & 24: `REPLACE Tk_Du WITH M_DmVt.Tk_Vt IN K_CtTemp`. |
| 6 | `Tk_Du2` | `char(16)` | YES | Visible | `Column11.Text1` (Rec 36) | Order 6 (`Tk Cã`, W: 37) | `K_CtTemp.Tk_Du2` | **Tài khoản Có Doanh thu** (VD: `'5111'`). Nạp ngầm tại Rec 22 & 24 từ `M_DmVt.Tk_Dt` (nếu `Nh_Ct = '2'`) hoặc `M_DmVt.Tk_HBTL` (nếu `Nh_Ct <> '2'`). Người dùng có thể sửa trực tiếp trên cột này. |
| 7 | `Tk_Du4` | `char(16)` | YES | Hidden | *(Không có trên lưới)* | — | `K_CtTemp.Tk_Du4` | **Tài khoản Nợ Chiết khấu** (VD: `'521'`). Gán ngầm tại Rec 22 & 24: `REPLACE Tk_Du4 WITH M_DmVt.Tk_Ck IN K_CtTemp`. |
| 8 | `Ma_Kho` | `char(16)` | YES | Visible | `Column4.Text1` (Rec 28) | Order 7 (`Kho`, W: 47) | `K_CtTemp.Ma_Kho` | Mã kho xuất hàng. Người dùng nhập mã hoặc chọn từ `M_DmKho`. Mặc định nạp từ kho của dòng xuất hàng. |
| 9 | `Ma_Vt` | `char(16)` | YES | Visible | `Column1.Text1` (Rec 22) | Order 1 (`VËt t­`, W: 97) | `K_CtTemp.Ma_Vt` | Mã vật tư/sản phẩm. Nhập liệu chính; kích hoạt lookup `M_DmVt`, nạp tên, ĐVT, loại vật tư `Loai_Vt`, tài khoản hạch toán, đơn giá và chiết khấu mặc định. |
| 10 | `Dvt` | `varchar(8)` | YES | Visible | `Column3.Text1` (Rec 26) | Order 3 (`§vt`, W: 35) | `K_CtTemp.Dvt` | Đơn vị tính gốc/chuẩn trong kho (VD: `'kg'`, `'m'`, `'tam'`). Nạp từ `M_DmVt.Dvt`. Nếu có nhiều ĐVT phụ, method `dvt_get` cho phép chọn. |
| 11 | `Dvt_Ban` | `varchar(8)` | YES | Visible | `Column8.Text1` (Rec 38) | Order 4 (`§vt b¸n`, W: 38) | `K_CtTemp.Dvt_Ban` | Đơn vị tính khi xuất bán. Nạp từ `M_DmVt.Dvt_Ban`. Đối với hàng mút thường là ĐVT bán lẻ quy đổi. |
| 12 | `So_Tam` | `numeric(18,2)` | YES | Visible | `ColSo_Tam.Text1` (Rec 44) | Order 8 (`Sè tÊm`, W: 51) | `K_CtTemp.So_Tam` | Số tấm đối với mặt hàng Mút (`Loai_Vt = '2'`). Người dùng nhập trực tiếp; là thừa số gốc để tính số lượng bán: `So_Luong_Ban = So_Tam * He_So8`. |
| 13 | `He_So8` | `numeric(18,2)` | YES | Visible | `Column10.Text1` (Rec 42) | Order 9 (`HÖ sè`, W: 40) | `K_CtTemp.He_So8` | **Hệ số quy đổi / Độ dày** của mặt hàng Mút. Caption trên lưới là `HÖ sè`. Dùng để nhân với số tấm tính ra số lượng bán. |
| 14 | `So_Luong8` | `numeric(18,2)` | YES | Visible | `Column9.Text1` (Rec 40) | Order 10 (`SL b¸n`, W: 54) | `K_CtTemp.So_Luong8` | **Số lượng bán quy đổi** của mặt hàng Mút. Caption trên lưới là `SL b¸n`. Công thức: `So_Luong8 = ROUND(So_Tam * He_So8, 2)`. |
| 15 | `He_So9` | `numeric(18,2)` | YES | Hidden | *(Không có trên lưới)* | — | `K_CtTemp.He_So9` | Hệ số quy đổi từ ĐVT phụ sang ĐVT gốc của hàng hóa thông thường (`Loai_Vt = '1'`). Nạp trong method `dvt_set`: `REPLACE He_So9 WITH M_DmVt.He_So0`. Mặc định = 1. |
| 16 | `So_Luong9` | `numeric(18,2)` | YES | Visible | `Column5.Text1` (Rec 30) | Order 5 (`Sè l­îng`, W: 57) | `K_CtTemp.So_Luong9` | **Số lượng bán thực tế** hiển thị trên cột Số lượng. Đối với hàng thường: người dùng nhập trực tiếp; đối với hàng mút: tự động đồng bộ `So_Luong9 = So_Luong8`. |
| 17 | `Gia_Nt9` | `numeric(18,2)` | YES | Visible | `Column6.Text1` (Rec 32) | Order 11 (`§¬n gi¸`, W: 61) | `K_CtTemp.Gia_Nt9` | **Đơn giá bán trước chiết khấu** (Ngoại tệ). Tự động lấy giá theo khách qua `ADOCommand('SO_Get_Price')` hoặc người dùng gõ tay. |
| 18 | `Gia9` | `numeric(18,0)` | YES | Calculated | *(Không bind trực tiếp)* | — | `K_CtTemp.Gia9` | Đơn giá bán trước chiết khấu (VND). Công thức: `Gia9 = ROUND(Gia_Nt9 * Ty_Gia, 0)`. |
| 19 | `Tien_Nt9` | `numeric(18,2)` | YES | Visible | `Column7.Text1` (Rec 34) | Order 12 (`Thµnh tiÒn`, W: 80) | `K_CtTemp.Tien_Nt9` | **Thành tiền trước chiết khấu** (Ngoại tệ). Công thức: `Tien_Nt9 = ROUND(So_Luong9 * Gia_Nt9, 2)`. Nếu người dùng gõ trực tiếp vào ô này (`_VARREAD2 = 'TIEN_NT9'`), đơn giá sẽ được tính ngược: `Gia_Nt9 = Tien_Nt9 / So_Luong9`. |
| 20 | `Tien9` | `numeric(18,0)` | YES | Calculated | *(Không bind trực tiếp)* | — | `K_CtTemp.Tien9` | Thành tiền trước chiết khấu (VND). Công thức: `Tien9 = ROUND(Tien_Nt9 * Ty_Gia, 0)`. |
| 21 | `So_Luong` | `numeric(18,2)` | YES | Calculated | *(Không bind trực tiếp)* | — | `K_CtTemp.So_Luong` | **Số lượng theo ĐVT gốc/chuẩn để trừ tồn kho**. Với hàng thường: `So_Luong = So_Luong9 * He_So9`. Với hàng mút: `So_Luong = So_Luong8`. |
| 22 | `Gia_Nt` | `numeric(18,2)` | YES | Hidden | *(Không có trên lưới)* | — | `K_CtTemp.Gia_Nt` | **Đơn giá vốn xuất kho (Ngoại tệ)**. Do hàm lõi `Save_Ct` tự động tính theo phương pháp tính giá vốn (FIFO, Bình quân...). TUYỆT ĐỐI không ghi đè bằng đơn giá bán (Fix #21). |
| 23 | `Gia` | `numeric(18,0)` | YES | Hidden | *(Không có trên lưới)* | — | `K_CtTemp.Gia` | **Đơn giá vốn xuất kho (VND)**. Do hàm `Save_Ct` tính toán. |
| 24 | `Tien_Nt` | `numeric(18,2)` | YES | Hidden | *(Không có trên lưới)* | — | `K_CtTemp.Tien_Nt` | **Tiền vốn xuất kho (Ngoại tệ)**. Do hàm `Save_Ct` tính toán: `Tien_Nt = So_Luong * Gia_Nt`. |
| 25 | `Tien` | `numeric(18,0)` | YES | Hidden | *(Không có trên lưới)* | — | `K_CtTemp.Tien` | **Tiền vốn xuất kho (VND)**. Do hàm `Save_Ct` tính toán: `Tien = So_Luong * Gia`. |
| 26 | `Gia_Nt2` | `numeric(18,2)` | YES | Calculated | *(Không bind trực tiếp)* | — | `K_CtTemp.Gia_Nt2` | **Đơn giá bán sau chiết khấu (Ngoại tệ)**. Công thức: `Gia_Nt2 = ROUND(Gia_Nt9 * (100 - Chiet_Khau) / 100, 2)`. Khi `Chiet_Khau = 0` thì `Gia_Nt2 = Gia_Nt9` (Fix #17, #21). |
| 27 | `Gia2` | `numeric(18,0)` | YES | Calculated | *(Không bind trực tiếp)* | — | `K_CtTemp.Gia2` | Đơn giá bán sau chiết khấu (VND). Công thức: `Gia2 = ROUND(Gia9 * (100 - Chiet_Khau) / 100, 0)`. |
| 28 | `Tien_Nt2` | `numeric(18,2)` | YES | Calculated | *(Không bind trực tiếp)* | — | `K_CtTemp.Tien_Nt2` | **Thành tiền thanh toán sau chiết khấu (Ngoại tệ)**. Công thức: `Tien_Nt2 = Tien_Nt9 - Tien_Nt4`. Khi `Chiet_Khau = 0` thì `Tien_Nt2 = Tien_Nt9`. |
| 29 | `Tien2` | `numeric(18,0)` | YES | Calculated | *(Không bind trực tiếp)* | — | `K_CtTemp.Tien2` | Thành tiền thanh toán sau chiết khấu (VND). Công thức: `Tien2 = Tien9 - Tien4`. |
| 30 | `Tien_Nt3` | `numeric(18,2)` | YES | Hidden | *(Không có trên lưới)* | — | `K_CtTemp.Tien_Nt3` | Tiền thuế GTGT dòng chi tiết (Ngoại tệ). Trong form bán hàng `ctbhd`, thuế GTGT tính tập trung ở cấp Header (`TTien_Nt3`), trường này mặc định là 0 hoặc phân bổ nếu cần. |
| 31 | `Tien3` | `numeric(18,0)` | YES | Hidden | *(Không có trên lưới)* | — | `K_CtTemp.Tien3` | Tiền thuế GTGT dòng chi tiết (VND). Mặc định là 0 trên form bán hàng. |
| 32 | `Chiet_Khau` | `numeric(18,2)` | YES | Visible | `Column12.Text1` (Rec 46) | Order 13 (`CK`, W: 25) | `K_CtTemp.Chiet_Khau` | **Tỷ lệ % chiết khấu dòng hàng** (0 đến 99). Người dùng nhập trực tiếp hoặc nạp tự động qua `SO_Get_Discount`. |
| 33 | `Tien_Nt4` | `numeric(18,2)` | YES | Calculated | *(Không bind trực tiếp)* | — | `K_CtTemp.Tien_Nt4` | **Tiền chiết khấu dòng hàng (Ngoại tệ)**. Công thức: `Tien_Nt4 = ROUND(Tien_Nt9 * Chiet_Khau / 100, 2)`. |
| 34 | `Tien4` | `numeric(18,0)` | YES | Calculated | *(Không bind trực tiếp)* | — | `K_CtTemp.Tien4` | Tiền chiết khấu dòng hàng (VND). Công thức: `Tien4 = ROUND(Tien9 * Chiet_Khau / 100, 0)`. |
| 35 | `Gia_Tb_TT` | `char(1)` | YES | Visible | `Column13.Text1` (Rec 48) | Order 14 (`TT`, W: 18) | `K_CtTemp.gia_tb_tt` | Cờ tính giá trung bình tức thời (`'C'`: Có, `'K'`: Không). Mặc định `'K'`. |

---

### PHÂN ĐỊNH RANH GIỚI BẤT KHẢ XÂM PHẠM: GIÁ VỐN VS GIÁ BÁN
Một trong những nguyên tắc cốt tử của hệ thống kế toán 1S (được pháp điển hóa tại **Fix #21 trong `All_fix.md`**) là sự phân tách triệt để giữa nhóm trường Giá bán và nhóm trường Giá vốn:

```
+-----------------------------------------------------------------------------------------+
|                  SỰ PHÂN TÁCH GIỮA NHÓM GIÁ BÁN VÀ NHÓM GIÁ VỐN                         |
+---------------------------------------------+-------------------------------------------+
|      NHÓM TRƯỜNG GIÁ BÁN (SELLING PRICE)    |        NHÓM TRƯỜNG GIÁ VỐN (COGS)         |
|   (Do Form & Người dùng thao tác tính toán) | (Do hàm lõi Save_Ct tự động tính toán ngầm)|
+---------------------------------------------+-------------------------------------------+
| - Gia_Nt9, Gia9 (Đơn giá bán trước CK)      | - Gia_Nt, Gia (Đơn giá vốn xuất kho)      |
| - Tien_Nt9, Tien9 (Thành tiền bán trước CK) | - Tien_Nt, Tien (Tiền vốn xuất kho)       |
| - Gia_Nt2, Gia2 (Đơn giá bán sau CK)        |                                           |
| - Tien_Nt2, Tien2 (Thành tiền thanh toán)   |                                           |
+---------------------------------------------+-------------------------------------------+
```

**CẢNH BÁO QUAN TRỌNG:**
1. Trong lịch sử phát triển, bản sửa Fix #17 từng đưa lệnh `REPLACE Gia_Nt WITH Gia_Nt9, Gia WITH Gia9` vào sự kiện xóa chiết khấu. Sai lầm này đã biến **giá vốn thành giá bán**, làm đảo lộn hoàn toàn báo cáo lãi lỗ gộp và sổ cái tài khoản 632!
2. Fix #21 đã chính thức loại bỏ `Gia_Nt` và `Gia` ra khỏi toàn bộ các lệnh `REPLACE` trên giao diện.
3. Bất kỳ lập trình viên nào bảo trì sau này **TUYỆT ĐỐI KHÔNG ĐƯỢC** gán `Gia_Nt = Gia_Nt9` hoặc `Tien_Nt = Tien_Nt9` trong bất kỳ tình huống nào!

---

## CHƯƠNG 4: PHÂN TÍCH CHUYÊN SÂU QUY ĐỔI ĐƠN VỊ TÍNH, VẬT TƯ & GIẢI MÃ HIỆN TƯỢNG NHẢY SỐ LƯỢNG

Hệ thống kế toán 1S vận hành song song **hai cơ chế quy đổi đơn vị tính hoàn toàn độc lập**, phục vụ cho hai bài toán sản xuất - kinh doanh khác biệt:

### 4.1. Hệ Thống 1: Quy Đổi ĐVT Phụ Thông Thường (`Loai_Vt = '1'`)
Áp dụng cho các mặt hàng thông thường có nhiều đơn vị đóng gói (VD: Lưu kho theo `Kg` hoặc `Viên`, bán theo `Thùng` hoặc `Kiện`):
- **Bộ trường dữ liệu:** `He_So9` (Hệ số quy đổi ĐVT phụ), `So_Luong9` (Số lượng xuất bán theo ĐVT bán), `So_Luong` (Số lượng theo ĐVT chuẩn lưu kho).
- **Quy trình hoạt động:**
  1. Khi chọn vật tư (`Ma_Vt.LostFocus`), procedure `dvt_get` (Rec 3) kiểm tra danh mục `M_DmVt`:
     - Nếu vật tư không có ĐVT phụ:
       ```foxpro
       REPLACE He_So9 WITH 1, So_Luong WITH So_Luong9 IN K_CtTemp
       ```
  2. Khi người dùng chọn ĐVT phụ khác trên cột ĐVT (`Column3.LostFocus` $\rightarrow$ `dvt_set`):
     ```foxpro
     DO CASE
         CASE ALLTRIM(otxtDvt.Value) == ALLTRIM(M_DmVt.Dvt)
             REPLACE He_So9 WITH 1 IN K_CtTemp
         CASE ALLTRIM(otxtDvt.Value) == ALLTRIM(M_DmVt.Dvt0)
             REPLACE He_So9 WITH IIF(M_DmVt.He_So0 = 0, 1, M_DmVt.He_So0) IN K_CtTemp
         CASE ALLTRIM(otxtDvt.Value) == ALLTRIM(M_DmVt.Dvt1)
             REPLACE He_So9 WITH IIF(M_DmVt.He_So1 = 0, 1, M_DmVt.He_So1) IN K_CtTemp
         CASE ALLTRIM(otxtDvt.Value) == ALLTRIM(M_DmVt.Dvt2)
             REPLACE He_So9 WITH IIF(M_DmVt.He_So2 = 0, 1, M_DmVt.He_So2) IN K_CtTemp
     ENDCASE
     REPLACE So_Luong WITH So_Luong9 * IIF(He_So9 <> 0, He_So9, 1) IN K_CtTemp
     ```
- **Ý nghĩa kế toán:** `So_Luong` (dùng để xuất kho và tính giá vốn) được nhân theo `He_So9`, còn `So_Luong9` giữ nguyên là số lượng bán giao dịch với khách hàng.

---

### 4.2. Hệ Thống 2: Quy Cách Kỹ Thuật Mặt Hàng Mút Xốp (`Loai_Vt = '2'`)
Đối với mặt hàng Mút xốp, quy cách bán hàng và tồn kho phụ thuộc vào kích thước hình học: **Số tấm** (`So_Tam`) và **Độ dày/Hệ số** (`He_So8`):
- **Bộ trường quy đổi:** `So_Tam` (Số tấm), `He_So8` (Hệ số độ dày), `So_Luong8` (SL bán quy đổi), `So_Luong9` (Số lượng xuất hiển thị), `So_Luong` (Số lượng kho).
- **Cơ cấu hiển thị trên Grid2:**
  - `ColSo_Tam` (Order 8, Caption `Sè tÊm`): Bind `K_CtTemp.So_Tam`.
  - `Column10` (Order 9, Caption `HÖ sè`): Bind `K_CtTemp.He_So8`.
  - `Column9` (Order 10, Caption `SL b¸n`): Bind `K_CtTemp.So_Luong8`.
  - `Column5` (Order 5, Caption `Sè l­îng`): Bind `K_CtTemp.So_Luong9`.
- **Hệ phương trình toán học chuẩn:**
  $$\text{Số lượng bán quy đổi } (\text{So\_Luong8}) = \text{ROUND}(\text{So\_Tam} \times \text{He\_So8}, 2)$$
  $$\text{Số lượng xuất trên lưới } (\text{So\_Luong9}) = \text{So\_Luong8}$$
  $$\text{Số lượng xuất tồn kho } (\text{So\_Luong}) = \text{So\_Luong8}$$
  $$\text{Thành tiền trước CK } (\text{Tien\_Nt9}) = \text{So\_Luong9} \times \text{Gia\_Nt9} = (\text{So\_Tam} \times \text{He\_So8}) \times \text{Gia\_Nt9}$$

*Lưu ý:* Khi nhập liệu, nếu người dùng nhập ngược từ cột Thành tiền (`_VARREAD2 = 'TIEN_NT9'`), đơn giá sẽ được tính ngược lại:
$$\text{Gia\_Nt9} = \text{ROUND}(\text{Tien\_Nt9} / \text{So\_Luong8}, 2) \quad (\text{với } \text{So\_Luong8} > 0)$$

---

### 4.3. Phân Định Cơ Chế Xử Lý Giữa 3 Nhóm Vật Tư (`Loai_Vt`)

| Nhóm Vật Tư | Tên Gọi Nghiệp Vụ | Quy Cách Đặc Trưng | Hàm Xử Lý Trong `LostFocus` (7 Cột Grid2) | Hành Vi Chi Tiết & Tác Động |
|:---:|:---|:---|:---:|:---|
| **`Loai_Vt = '1'`** | Hàng hóa thông thường | Nhập Số lượng trực tiếp, quy đổi ĐVT phụ qua `He_So9` | `=So_Luong2(THISFORM)` | Gọi hàm base class trong thư viện `core.app`. Hàm này mặc định: nếu có số tấm thì ép `Hệ số = 1` và `Số lượng = Số tấm * 1`. |
| **`Loai_Vt = '2'`** | Hàng Mút xốp | Nhập Số tấm (`So_Tam`) và Hệ số độ dày (`He_So8`), tính ra SL bán | `THISFORM.Calc_Loai2()` | Gọi phương thức modular tự viết trong form. Bảo toàn tích số `So_Tam * He_So8`, không gọi `So_Luong2`, đồng bộ `So_Luong8 = So_Luong9 = So_Luong`. |
| **`Loai_Vt = '3'`** | Hàng quy cách đặc thù | Hàng cuộn, khối, quy cách đa chiều phức tạp | `=So_Luong3(THISFORM)` | Gọi hàm chuyên dụng trong `core.app` xử lý theo thuật toán riêng của Loại 3. |

---

### 4.4. Giải Mã Gốc Rễ Hiện Tượng "Nhảy Số Lượng Về Bằng Số Tấm" & Tính Chập Chờn (Intermittent Bug)

#### A. Nguồn gốc kỹ thuật của lỗi
1. **Thiết kế thiếu nhánh trong mã nguồn gốc (`SCT_OUTPUT\ctbhd.txt`):**
   Trong toàn bộ 7 cột nhập liệu trên `Grid2` (Record 22, 24, 30, 32, 34, 42, 44), sự kiện `LostFocus` nguyên thủy của hệ thống chỉ có nhánh kiểm tra Loại 3:
   ```foxpro
   IF K_CtTemp.Loai_Vt = '3'
       =So_Luong3(THISFORM)
   ELSE
       =So_Luong2(THISFORM)
   ENDIF
   ```
2. **Cơ chế ngầm của `=So_Luong2(THISFORM)` trong `core.app`:**
   Hàm `=So_Luong2(THISFORM)` là hàm được biên dịch sẵn trong file thư viện nhị phân. Khi chạy, nó nhận diện sự xuất hiện của trường `So_Tam` và áp đặt công thức:
   $$\text{So\_Luong} = \text{So\_Tam} \times 1$$
   $$\text{He\_So} = 1$$
   Hậu quả là toàn bộ hệ số mà thủ kho hoặc kế toán đã nhập bị xóa sạch, biến `So_Luong` tụt thẳng về bằng đúng giá trị của `So_Tam`!

#### B. Tại sao lỗi chỉ "thỉnh thoảng xảy ra" (Intermittent Behavior)?
Hiện tượng này phụ thuộc 100% vào **chuỗi thao tác chuột/bàn phím của nhân viên kế toán tại Văn phòng (`VP_2014`)**:
- **Trường Hợp 1 — KHÔNG BỊ LỖI (Đơn hàng lưu đúng nguyên vẹn):**
  1. Kế toán bấm "Chọn phiếu xuất" (`cmdChonPhieuXuat` $\rightarrow$ `ctbhch.scx`).
  2. Dữ liệu từ kho `K_CtPx` được đổ vào `K_CtTemp`. Lúc này, các giá trị `So_Tam`, `He_So8`, `So_Luong8`, `So_Luong9`, `Tien_Nt9` đều chính xác 100%.
  3. Kế toán chỉ kiểm tra bằng mắt, **KHÔNG click chuột, KHÔNG dùng phím Tab/Enter đi vào các ô trong Grid2**.
  4. Kế toán bấm ngay nút **Lưu** (`Cmgnhan_huy1.Command1`).
  5. Sự kiện `LostFocus` của 7 cột Grid không bao giờ bị kích hoạt $\rightarrow$ Hàm `=So_Luong2(THISFORM)` không chạy $\rightarrow$ Dữ liệu lưu xuống `CtBH0` đúng hoàn toàn!
- **Trường Hợp 2 — LỖI KÍCH HOẠT (Số lượng bị nhảy về số tấm):**
  1. Kế toán lấy đơn từ kho lên form.
  2. Kế toán click chuột vào một dòng hàng mút để xem, hoặc nhấn Tab/Enter duyệt qua các cột, hoặc click vào cột Chiết khấu để gõ CK.
  3. Khi con trỏ rời khỏi ô (LostFocus) hoặc khi bấm Lưu (nút Lưu có lệnh `txtNgay_Ct.SetFocus()` để xả buffer làm ô grid bị mất focus):
     $\rightarrow$ Sự kiện `LostFocus` của ô đó lập tức kích hoạt.
     $\rightarrow$ Do `Loai_Vt = '2'` không thỏa `Loai_Vt = '3'`, luồng thực thi rơi vào nhánh `ELSE`.
     $\rightarrow$ Gọi `=So_Luong2(THISFORM)` $\rightarrow$ Toàn bộ hệ số bị ghi đè thành 1, số lượng tụt về bằng số tấm, thành tiền bị tính lại thành `Số tấm * Đơn giá`!

---

### 4.5. Kiến Trúc Module Giải Pháp `Calc_Loai2()` & Các Điểm Gia Cố Bắt Buộc

Thay vì sao chép cả trăm dòng mã xử lý lặp lại vào cả 7 cột trên `Grid2` (gây phình file `SCT` lên >210 KB như đã cảnh báo trong `All_fix.md`), hệ thống áp dụng thiết kế **Đóng Gói Hàm Dùng Chung Cấp Form (Modular Method)**:

#### A. Khai báo phương thức tại Form cấp cao (`frmdocitemd`, Rec 3)
Đăng ký `*calc_loai2` vào thuộc tính `reserved3` và thêm thủ tục vào memo `METHODS`:

```foxpro
PROCEDURE Calc_Loai2
    LOCAL lnSo_Tam, lnHe_So8, lnSo_Luong_Ban, lnDon_Gia_Nt, lnThanh_Tien_Nt
    LOCAL lnDon_Gia_VND, lnThanh_Tien_VND, lnTy_Gia, lnCK, lnTien_Nt4, lnTien_Nt2
    LOCAL lnTien4, lnTien2, lnGia_Nt2, lnGia2, lnArea, lnRec

    * 1. Lấy và chuẩn hóa tỷ giá an toàn
    lnTy_Gia = 1
    IF TYPE('K_PhTemp1.Ty_Gia') = 'N' AND K_PhTemp1.Ty_Gia > 0
        lnTy_Gia = K_PhTemp1.Ty_Gia
    ENDIF

    * 2. Tính toán số lượng chuẩn cho hàng Mút
    lnSo_Tam       = NVL(K_CtTemp.So_Tam, 0)
    lnHe_So8       = IIF(NVL(K_CtTemp.He_So8, 0) > 0, K_CtTemp.He_So8, 1)
    lnSo_Luong_Ban = ROUND(lnSo_Tam * lnHe_So8, 2)

    * 3. Tính toán đơn giá và thành tiền theo chiều thuận hoặc chiều nhập ngược:
    IF TYPE('THISFORM._VARREAD2') = 'C' AND UPPER(ALLTRIM(THISFORM._VARREAD2)) = 'TIEN_NT9'
        lnThanh_Tien_Nt  = NVL(K_CtTemp.Tien_Nt9, 0)
        * Safeguard: Chống chia cho 0
        lnDon_Gia_Nt     = IIF(lnSo_Luong_Ban > 0, ROUND(lnThanh_Tien_Nt / lnSo_Luong_Ban, 2), 0)
        lnDon_Gia_VND    = ROUND(lnDon_Gia_Nt * lnTy_Gia, 0)
        lnThanh_Tien_VND = ROUND(lnThanh_Tien_Nt * lnTy_Gia, 0)
    ELSE
        lnDon_Gia_Nt     = NVL(K_CtTemp.Gia_Nt9, 0)
        lnDon_Gia_VND    = ROUND(lnDon_Gia_Nt * lnTy_Gia, 0)
        lnThanh_Tien_Nt  = ROUND(lnSo_Luong_Ban * lnDon_Gia_Nt, 2)
        lnThanh_Tien_VND = ROUND(lnThanh_Tien_Nt * lnTy_Gia, 0)
    ENDIF

    * 4. Tính toán chiết khấu dòng
    lnCK = NVL(K_CtTemp.Chiet_Khau, 0)
    IF lnCK > 0
        lnTien_Nt4 = ROUND(lnThanh_Tien_Nt * lnCK / 100, 2)
        lnTien4    = ROUND(lnThanh_Tien_VND * lnCK / 100, 0)
        lnTien_Nt2 = lnThanh_Tien_Nt - lnTien_Nt4
        lnTien2    = lnThanh_Tien_VND - lnTien4
        lnGia_Nt2  = ROUND(lnDon_Gia_Nt * (100 - lnCK) / 100, 2)
        lnGia2     = ROUND(lnDon_Gia_VND * (100 - lnCK) / 100, 0)
    ELSE
        lnTien_Nt4 = 0
        lnTien4    = 0
        lnTien_Nt2 = lnThanh_Tien_Nt
        lnTien2    = lnThanh_Tien_VND
        lnGia_Nt2  = lnDon_Gia_Nt
        lnGia2     = lnDon_Gia_VND
    ENDIF

    * 5. Ghi đồng bộ vào Cursor K_CtTemp (TUYỆT ĐỐI KHÔNG ĐỤNG ĐẾN Gia_Nt/Gia/Tien_Nt/Tien)
    REPLACE So_Luong8  WITH lnSo_Luong_Ban, ;
            So_Luong9  WITH lnSo_Luong_Ban, ;
            So_Luong   WITH lnSo_Luong_Ban, ;
            Gia_Nt9    WITH lnDon_Gia_Nt, ;
            Gia9       WITH lnDon_Gia_VND, ;
            Tien_Nt9   WITH lnThanh_Tien_Nt, ;
            Tien9      WITH lnThanh_Tien_VND, ;
            Tien_Nt4   WITH lnTien_Nt4, ;
            Tien4      WITH lnTien4, ;
            Tien_Nt2   WITH lnTien_Nt2, ;
            Tien2      WITH lnTien2, ;
            Gia_Nt2    WITH lnGia_Nt2, ;
            Gia2       WITH lnGia2 IN K_CtTemp

    * 6. Cộng dồn và cập nhật Header K_PhTemp1
    lnArea = SELECT()
    SELECT K_CtTemp
    lnRec = RECNO()

    LOCAL laSumAmt[1], laSumAmt2[1], laSumCk[1], laSumCk2[1], laSumTien[1], laSumTienV[1]
    SELECT SUM(Tien_Nt2) FROM K_CtTemp WHERE NOT DELETED() INTO ARRAY laSumAmt
    SELECT SUM(Tien2)    FROM K_CtTemp WHERE NOT DELETED() INTO ARRAY laSumAmt2
    SELECT SUM(Tien_Nt4) FROM K_CtTemp WHERE NOT DELETED() INTO ARRAY laSumCk
    SELECT SUM(Tien4)    FROM K_CtTemp WHERE NOT DELETED() INTO ARRAY laSumCk2
    SELECT SUM(Tien_Nt9) FROM K_CtTemp WHERE NOT DELETED() INTO ARRAY laSumTien
    SELECT SUM(Tien9)    FROM K_CtTemp WHERE NOT DELETED() INTO ARRAY laSumTienV

    REPLACE TTien_Nt  WITH NVL(laSumTien[1], 0), ;
            TTien     WITH NVL(laSumTienV[1], 0), ;
            TTien_Nt2 WITH NVL(laSumAmt[1], 0), ;
            TTien2    WITH NVL(laSumAmt2[1], 0), ;
            TTien_Nt4 WITH NVL(laSumCk[1], 0), ;
            TTien4    WITH NVL(laSumCk2[1], 0) IN K_PhTemp1

    * Tự động tính lại thuế nếu có thuế suất
    IF !EMPTY(K_PhTemp1.Ma_Thue)
        =Thue_GTGT(THISFORM)
    ENDIF

    REPLACE TTien_Nt0 WITH K_PhTemp1.TTien_Nt2 + NVL(K_PhTemp1.TTien_Nt3, 0), ;
            TTien0    WITH K_PhTemp1.TTien2 + NVL(K_PhTemp1.TTien3, 0) IN K_PhTemp1

    IF lnRec > 0 AND lnRec <= RECCOUNT('K_CtTemp')
        GO lnRec IN K_CtTemp
    ENDIF
    SELECT (lnArea)

    * GIA CỐ ADVERSARIAL: Reset cờ tính ngược tránh rò rỉ sang dòng khác
    THISFORM._VARREAD2 = 'GIA_NT9'
    THISFORM.Refresh()
ENDPROC
```

#### B. Triển khai lệnh gọi tại 7 Record trên `Grid2` (Rec 22, 24, 30, 32, 34, 42, 44)
Tại mỗi ô trên lưới, chỉ cần gọi qua khối phân luồng:
```foxpro
DO CASE
    CASE K_CtTemp.Loai_Vt = '3'
        =So_Luong3(THISFORM)
    CASE K_CtTemp.Loai_Vt = '2'
        THISFORM.Calc_Loai2()
    OTHERWISE
        =So_Luong2(THISFORM)
ENDCASE
```

---

## CHƯƠNG 5: PHÂN TÍCH CHUYÊN SÂU TIỀN TỆ, CHIẾT KHẤU, THUẾ VAT & CÁC BẪY NGOẠI LỆ

### 5.1. Cơ Chế Song Tệ: Ngoại Tệ (`_Nt`) vs VND & An Toàn Phép Chia
Hệ thống 1S áp dụng chuẩn hạch toán kép (Dual-Currency Accounting):
- **Trường Ngoại tệ (`_Nt`):** Lưu trữ theo đồng tiền phát sinh gốc (`Ma_Tte`), làm tròn **2 chữ số thập phân** (`ROUND(..., 2)`).
- **Trường Nội tệ (VND - không đuôi `_Nt`):** Lưu trữ theo Việt Nam Đồng quy đổi qua `Ty_Gia`, làm tròn **0 chữ số thập phân** (`ROUND(..., 0)`).

| Khoản Mục Kế Toán | Ngoại Tệ (FC) | Nội Tệ (VND) | Quy Tắc Quy Đổi & Làm Tròn |
|:---|:---|:---|:---|
| Đơn giá trước CK | `Gia_Nt9` | `Gia9` | `Gia9 = ROUND(Gia_Nt9 * Ty_Gia, 0)` |
| Thành tiền trước CK | `Tien_Nt9` | `Tien9` | `Tien9 = ROUND(Tien_Nt9 * Ty_Gia, 0)` |
| Tiền chiết khấu dòng | `Tien_Nt4` | `Tien4` | `Tien4 = ROUND(Tien_Nt4 * Ty_Gia, 0)` |
| Đơn giá sau CK | `Gia_Nt2` | `Gia2` | `Gia2 = ROUND(Gia9 * (100 - Chiet_Khau) / 100, 0)` |
| Thành tiền sau CK | `Tien_Nt2` | `Tien2` | `Tien2 = Tien9 - Tien4` |
| Tổng tiền hàng sau CK | `TTien_Nt2` | `TTien2` | `TTien2 = SUM(CtBH0.Tien2)` |
| Tổng tiền thuế GTGT | `TTien_Nt3` | `TTien3` | `TTien3 = ROUND(TTien_Nt3 * Ty_Gia, 0)` |
| **Tổng thanh toán** | **`TTien_Nt0`** | **`TTien0`** | **`TTien_Nt0 = TTien_Nt2 + TTien_Nt3`** |

- **An toàn tỷ giá:** Nếu `Ty_Gia <= 0`, `.NULL.` hoặc sai kiểu dữ liệu, hàm luôn tự động fallback:
  ```foxpro
  lnTy_Gia = IIF(TYPE('K_PhTemp1.Ty_Gia') = 'N' AND K_PhTemp1.Ty_Gia > 0, K_PhTemp1.Ty_Gia, 1)
  ```
- **An toàn phép chia:** Phép tính tính ngược đơn giá `lnDon_Gia_Nt = IIF(lnSo_Luong_Ban > 0, ROUND(lnThanh_Tien_Nt / lnSo_Luong_Ban, 2), 0)` được bọc chặt chẽ bằng điều kiện `lnSo_Luong_Ban > 0`, triệt tiêu 100% rủi ro lỗi `Division by zero`.

---

### 5.2. Mối Quan Hệ Chiết Khấu Dòng (`Chiet_Khau`), Chiết Khấu Tổng (`TTien_Nt4`) và `TyLeCK`
1. **Chiết khấu theo từng dòng hàng (`K_CtTemp.Chiet_Khau`):**
   - Nhập trên lưới tại `Grid2.Column12` (Rec 46).
   - Tỷ lệ chiết khấu $0 \le \text{Chiet\_Khau} \le 99$.
   - Khi sửa đổi, hàm `=Chiet_Khau(THISFORM, .T.)` được gọi để tính lại dòng hiện tại và cộng dồn lên Header.
2. **Chiết khấu tổng cấp hóa đơn (`K_PhTemp1.TTien_Nt4`):**
   - Nhập tại ô `txtTong_Tien4` (Rec 107).
   - Khi sửa đổi, hàm `=Chiet_Khau(THISFORM, .F.)` được gọi để tự động phân bổ số tiền chiết khấu này xuống từng dòng hàng theo tỷ trọng thành tiền `Tien_Nt9`.
3. **Cột `TyLeCK` trong schema `CtBH`:**
   - Schema DB có trường `TyLeCK`, nhưng form `ctbhd` hiện tại không bind trường này vào bất kỳ control nào. Thay vào đó hệ thống theo dõi trực tiếp qua số tiền `TTien_Nt4` và tỷ lệ dòng `Chiet_Khau`.

---

### 5.3. Xử Lý Triệt Để Chiết Khấu Ẩn Khi `Chiet_Khau = 0` (Tuân Thủ Fix #21)
Khi người dùng xóa chiết khấu từ có số về `0`:
- Nếu chỉ gán `Chiet_Khau = 0` và `Tien_Nt4 = 0`, thì các trường `Tien_Nt2` và `Gia_Nt2` vẫn mang giá trị đã trừ chiết khấu cũ.
- Khi in phiếu hoặc tính thuế, hệ thống lấy `Tien_Nt2` làm căn cứ, khiến tổng tiền thanh toán vẫn bị giảm trừ ngầm!
- **Chuẩn hóa triệt để tại Rec 46 (`Chiet_Khau.LostFocus`) và Rec 59 (Nút Lưu):**
  ```foxpro
  REPLACE Chiet_Khau WITH 0, ;
          Tien_Nt4   WITH 0, ;
          Tien4      WITH 0, ;
          Tien_Nt2   WITH Tien_Nt9, ;
          Tien2      WITH Tien9, ;
          Gia_Nt2    WITH Gia_Nt9, ;
          Gia2       WITH Gia9 IN K_CtTemp
  ```
- **Bảo toàn giá vốn:** Tuyệt đối KHÔNG có `Gia_Nt`, `Gia`, `Tien_Nt`, `Tien` trong lệnh REPLACE này.

---

### 5.4. Cơ Chế Thuế GTGT & Sửa Lỗi Sót Tính Lại Thuế
- Khi chọn mã thuế tại `txtMa_Thue` (Rec 7), hệ thống nạp `Thue_GTGT = M_DmThue.Thue_GTGT`.
- Căn cứ tính thuế theo `Loai_Ck`:
  - Nếu `Loai_Ck = '1'` (Chiết khấu trước thuế): Thuế tính trên tiền sau CK (`TTien_Nt2`):
    $$\text{TTien\_Nt3} = \text{ROUND}(\text{TTien\_Nt2} \times \text{Thue\_GTGT} / 100, 2)$$
  - Nếu `Loai_Ck = '0'` hoặc khác (Chiết khấu sau thuế): Thuế tính trên tiền trước CK (`TTien_Nt`):
    $$\text{TTien\_Nt3} = \text{ROUND}(\text{TTien\_Nt} \times \text{Thue\_GTGT} / 100, 2)$$
- **PHÁT HIỆN LỖI SÓT TÍNH THUẾ TỪ AGENT 2 & GIẢI PHÁP GIA CỐ:**
  Khi người dùng xóa chiết khấu về 0 tại Rec 46 hoặc Rec 59, `TTien_Nt2` tăng lên nhưng code cũ không gọi lại `=Thue_GTGT(THISFORM)`, làm tiền thuế `TTien_Nt3` bị thiếu!
  **Giải pháp bắt buộc:** Ngay sau khi tính lại `TTien_Nt2`, phải gọi:
  ```foxpro
  =Thue_GTGT(THISFORM)
  REPLACE TTien_Nt0 WITH TTien_Nt2 + NVL(K_PhTemp1.TTien_Nt3, 0), ;
          TTien0    WITH TTien2 + NVL(K_PhTemp1.TTien3, 0) IN K_PhTemp1
  ```

---

### 5.5. Đẳng Thức Tổng Thanh Toán Tối Hậu: `TTien_Nt0 = TTien_Nt2 + TTien_Nt3`
Trong các bản sửa cũ trước Fix #10 từng xảy ra lỗi nghiêm trọng do trừ chiết khấu hai lần:
$$\text{TTien\_Nt0} = \text{TTien\_Nt2} + \text{TTien\_Nt3} - \text{TTien\_Nt4} \quad (\text{SAI NGHIỆM TRỌNG!})$$
Vì bản thân `TTien_Nt2` đã là tổng tiền **sau khi trừ chiết khấu** (`Tien_Nt2 = Tien_Nt9 - Tien_Nt4`).  
**Đẳng thức chuẩn mực đã được khôi phục:**
$$\mathbf{TTien\_Nt0} = \mathbf{TTien\_Nt2} + \mathbf{TTien\_Nt3}$$
$$\mathbf{TTien0} = \mathbf{TTien2} + \mathbf{TTien3}$$

---

### 5.6. Bẫy Hàng Khuyến Mại 1-10đ Trên Hóa Đơn Ngoại Tệ (USD)
Đoạn mã bẫy hàng khuyến mại cũ:
```foxpro
IF TYPE('K_CtTemp.Gia_Nt9') = 'N' AND BETWEEN(K_CtTemp.Gia_Nt9, 1, 10) ...
```
- **Rủi ro phát hiện từ Agent 2:** Nếu lập hóa đơn xuất khẩu bằng đồng **USD** (`Ma_Tte = 'USD'`), các sản phẩm có đơn giá thật từ $1.00 đến $10.00 (VD: $2.50, $5.00/chiếc) bị hệ thống hiểu lầm là hàng tặng khuyến mại 1 đồng, tự động xóa sạch chiết khấu của khách!
- **Gia cố bắt buộc:** Thêm điều kiện ràng buộc loại tiền tệ:
  ```foxpro
  IF ALLTRIM(K_PhTemp1.Ma_Tte) == ALLTRIM(M_Ma_Tte0) AND BETWEEN(K_CtTemp.Gia_Nt9, 1, 10) ...
  ```

---

## CHƯƠNG 6: ĐỐI SOÁT TOÀN DIỆN 108 BẢN GHI VS BASELINE (`SCT_OUTPUT\ctbhd.txt`) & TUÂN THỦ `All_fix.md`

### 6.1. Bảng Đối Soát Chi Tiết 11 Bản Ghi Có Logic Thay Đổi

Qua rà soát đối chiếu từng byte giữa toàn bộ 108 bản ghi của `FRM\ctbhd.scx` và mã nguồn baseline trong `SCT_OUTPUT\ctbhd.txt`:
- **97 bản ghi** giữ nguyên cấu trúc nguyên bản.
- **11 bản ghi** có thay đổi logic nghiệp vụ được thống kê chi tiết dưới đây:

| STT | RecNo | Đối Tượng | Phương Thức | Mã Nguồn Gốc (`SCT_OUTPUT\ctbhd.txt`) | Mã Nguồn Hiện Tại & Đã Gia Cố | Mục Đích Sửa Đổi & Liên Hệ `All_fix.md` |
|:---:|:---:|:---|:---|:---|:---|:---|
| 1 | **Rec 3** | `frmdocitemd` | `Init`<br>`RefreshDebtLabels`<br>`Calc_Loai2` | - Chỉ khởi tạo voucher cơ bản.<br>- Không có phương thức kiểm tra nợ realtime.<br>- Không có phương thức tính hàng mút. | - Nạp default `Ma_Nx='131'`, `Tk2='1311'`, `Ma_Bp`, `Ma_Xe` khi F2.<br>- Thêm dynamically 3 nhãn nợ: `lblGioiHan`, `lblCongNo`, `lblVm`.<br>- **Thêm Procedure `RefreshDebtLabels`**: Batch query SQL kiểm tra nợ TK 131.<br>- **Thêm Procedure `Calc_Loai2`**: Xử lý độc lập hàng mút, reset `_VARREAD2='GIA_NT9'`. | - Fix #13: Nạp bộ phận khi F2.<br>- Fix #14: Nạp mã xe khi F2.<br>- Fix #15: Default TK 131 & 1311.<br>- Fix #16: Nhãn công nợ realtime.<br>- Fix #23: Modular method hàng mút. |
| 2 | **Rec 12** | `txtMa_Dt` | `LostFocus`<br>`GotFocus` | Kiểm tra nợ từ cursor local `M_DmDt`, so sánh tại ngày chứng từ `Ngay_Ct`. Bị cache nợ và cảnh báo sai khi `Toi_Han = 0`. | - Query trực tiếp SQL Server lấy `Gioi_Han`, `Toi_Han` mới nhất.<br>- Đổi ngày kiểm tra sang `DATE()`.<br>- Bổ sung điều kiện `AND _Toi_Han <> 0`.<br>- Gọi `RefreshDebtLabels()` khi `_Ma_Change`. | - Fix #1: Chống cache nợ.<br>- Fix #2: Kiểm tra nợ tại ngày hiện tại.<br>- Fix #3: Sửa lỗi khi `Toi_Han = 0`.<br>- Fix #16: Cập nhật nhãn công nợ. |
| 3 | **Rec 22** | `Column1.Text1` (`Ma_Vt`) | `LostFocus` | `IF Loai_Vt = '3' =So_Luong3() ELSE =So_Luong2() ENDIF` | - Gán `THISFORM._VARREAD2 = 'GIA_NT9'`.<br>- `DO CASE`: `Loai_Vt='3'` $\rightarrow$ `So_Luong3()`, `Loai_Vt='2'` $\rightarrow$ `Calc_Loai2()`, `OTHERWISE` $\rightarrow$ `So_Luong2()`.<br>- Bọc `Ma_Tte = 'VND'` cho khuyến mại 1-10đ. | - Fix #23: Triệt tiêu nhảy số lượng.<br>- Fix #17: Xử lý khuyến mại.<br>- Gia cố Adversarial: Chống rò rỉ `_VARREAD2`. |
| 4 | **Rec 24** | `Column2.Text1` (`Ten_Vt`) | `LostFocus` | Nhánh `IF Loai_Vt = '3'` tương tự. | Tương tự Rec 22: Gán `_VARREAD2 = 'GIA_NT9'`, chuyển `DO CASE` gọi `Calc_Loai2()`, bọc tiền tệ VND. | - Fix #23 & Gia cố Adversarial. |
| 5 | **Rec 30** | `Column5.Text1` (`So_Luong9`) | `LostFocus` | Gọi ngầm `=So_Luong2(THISFORM)` làm nhảy SL về số tấm. | Gán `_VARREAD2 = 'GIA_NT9'`, chuyển `DO CASE` gọi `Calc_Loai2()`. | - Fix #23: Triệt tiêu nhảy số lượng. |
| 6 | **Rec 32** | `Column6.Text1` (`Gia_Nt9`) | `LostFocus` | Gọi ngầm `=So_Luong2(THISFORM)`. | Gán `_VARREAD2 = 'GIA_NT9'`, chuyển `DO CASE` gọi `Calc_Loai2()`. | - Fix #23: Triệt tiêu nhảy số lượng. |
| 7 | **Rec 34** | `Column7.Text1` (`Tien_Nt9`) | `LostFocus` | Gọi ngầm `=So_Luong2(THISFORM)`. | Gán `_VARREAD2 = 'TIEN_NT9'` (tính ngược đơn giá), chuyển `DO CASE` gọi `Calc_Loai2()`. | - Fix #23: Tính ngược giá từ thành tiền. |
| 8 | **Rec 42** | `Column10.Text1` (`He_So8`) | `LostFocus` | Gọi ngầm `=So_Luong2(THISFORM)`. | Gán `_VARREAD2 = 'GIA_NT9'`, chuyển `DO CASE` gọi `Calc_Loai2()`. | - Fix #23: Triệt tiêu nhảy số lượng. |
| 9 | **Rec 44** | `ColSo_Tam.Text1` (`So_Tam`) | `LostFocus` | Gọi ngầm `=So_Luong2(THISFORM)`. | Gán `_VARREAD2 = 'GIA_NT9'`, chuyển `DO CASE` gọi `Calc_Loai2()`. | - Fix #23: Triệt tiêu nhảy số lượng. |
| 10 | **Rec 46** | `Column12.Text1` (`Chiet_Khau`) | `LostFocus` | Chỉ gọi `=Chiet_Khau(THISFORM, .T.)`, để sót chiết khấu ẩn khi CK = 0. | Thêm nhánh `Chiet_Khau = 0`: Ép `Tien_Nt4=0`, `Tien_Nt2=Tien_Nt9`, `Gia_Nt2=Gia_Nt9`, gọi `=Thue_GTGT()`, tính lại `TTien_Nt2/4/0`. Không đụng `Gia_Nt/Gia`. | - Fix #5, #10, #17, #21: Chuẩn hóa CK = 0, bảo toàn giá vốn, cập nhật thuế. |
| 11 | **Rec 59** | `Cmgnhan_huy1` | `Command1.Click` (Nút Lưu) | Không kiểm tra nợ realtime, không xả buffer an toàn, không normalize chiết khấu, không chặn trùng số. | - Kiểm tra nợ SQL realtime tại `DATE()`.<br>- Focus sang `txtTen_Dt` nếu vượt nợ.<br>- Xả grid: `txtNgay_Ct.SetFocus()`.<br>- SCAN normalize chiết khấu = 0 trên `K_CtTemp`.<br>- Gọi `=Thue_GTGT(THISFORM)`.<br>- Vòng lặp `ST_Check_Number` chống trùng số.<br>- Gọi `=Save_Ct(THISFORM._Moi_Sua)`. | - Fix #1, #2, #4, #5, #9, #10, #17, #21: Chống trùng số, an toàn dữ liệu trước khi commit SQL Server. |

*(Ghi chú: Bản ghi Rec 57 `txtTen_HD` chỉ thay đổi thuộc tính hiển thị `Width = 200` thay vì `429` để nhường không gian cho 2 label nợ).*

---

### 6.2. Kiểm Tra Tuân Thủ Các Nguyên Tắc Kỹ Thuật Trong `All_fix.md`

| Tiêu Chí Kỹ Thuật | Yêu Cầu Tại `All_fix.md` | Kết Quả Thực Tế Trên Form | Đánh Giá |
|:---|:---|:---|:---:|
| **1. Cấm gọi `So_Luong2/3` sai ngữ cảnh** | Tuyệt đối không có `So_Luong2/3` trong sự kiện chiết khấu (`Rec 46`) hoặc nút Lưu (`Rec 59`). | Quét toàn bộ Rec 46 và Rec 59: **Hoàn toàn không có**. Chỉ xuất hiện trong `DO CASE` của 7 cột Grid. | **TUÂN THỦ 100%** |
| **2. Cấm flush grid bằng `ActiveColumn`** | Không dùng `ActiveColumn`/`EVALUATE()`. Bắt buộc đổi focus: `THISFORM.txtNgay_Ct.SetFocus()`. | Số lần xuất hiện của `ActiveColumn` trên toàn bộ form: **0**. | **TUÂN THỦ 100%** |
| **3. Kiểm tra nợ trực tiếp từ SQL Server** | Tránh cache cursor `M_DmDt`. Query trực tiếp `VTSYS.dbo.DmDt` lấy `Gioi_Han`, `Toi_Han`. | Cả Rec 12 và Rec 59 đều truy vấn SQL trực tiếp qua `oConnDataSource.Execute()`. | **TUÂN THỦ 100%** |
| **4. Xử lý `Toi_Han = 0`** | Điều kiện: `_No_Cu >= _Toi_Han AND ... AND _Toi_Han <> 0`. | Cả Rec 12 và Rec 59 đều có mệnh đề bảo vệ `AND _Toi_Han <> 0`. | **TUÂN THỦ 100%** |
| **5. Khai báo biến `PRIVATE` cho ADOCommand** | Các biến truyền vào ADOCommand (`?@_Var`) bắt buộc dùng `PRIVATE`, không dùng `LOCAL`. | Trong Rec 59 (vòng lặp trùng số): Khai báo tường minh `PRIVATE _Check_Dup, _Moi_Sua_Dup, _Stt_Dup`. | **TUÂN THỦ 100%** |
| **6. Kiểm soát dung lượng file memo SCT** | Áp dụng Rule 18 (Pack và compile VFP8). Dung lượng chuẩn ~180 KB, không phình >200 KB. | File `FRM\ctbhd.SCT` hiện tại đạt **180,354 bytes** (~176 KB). | **TUÂN THỦ 100%** |
| **7. Bảo toàn giá vốn xuất kho (COGS)** | Tuyệt đối không gán `Gia_Nt = Gia_Nt9` trong REPLACE chiết khấu (Fix #21). | Toàn bộ các sự kiện chỉ gán `Gia_Nt2 WITH Gia_Nt9`. 4 cột giá vốn nguyên vẹn 100%. | **TUÂN THỦ 100%** |

---

## CHƯƠNG 7: MA TRẬN KIỂM THỬ QA, SCRIPT SQL ĐỐI SOÁT & KHẮC PHỤC DỮ LIỆU LỊCH SỬ

### 7.1. Ma Trận Kiểm Thử QA Toàn Diện (Quality Assurance Test Matrix)

Để nghiệm thu toàn diện form `ctbhd.scx`, đội ngũ QA thực hiện kiểm thử theo ma trận 8 kịch bản nghiệp vụ sau:

| Mã Kịch Bản | Phân Loại Nghiệp Vụ | Dữ Liệu Đầu Vào | Thao Tác Thực Hiện | Kết Quả Mong Đợi (Acceptance Criteria) |
|:---:|:---|:---|:---|:---|
| **TC-01** | Nhập mới Hàng Mút (`Loai_Vt = '2'`) | `So_Tam = 10`, `He_So8 = 2.5`, `Gia_Nt9 = 100,000` | Nhập Số tấm, Hệ số, Đơn giá. Di chuyển chuột qua các cột khác. | - `So_Luong8 = 25`, `So_Luong9 = 25`, `So_Luong = 25`.<br>- `Tien_Nt9 = 2,500,000`.<br>- Không bị nhảy về `So_Luong = 10` hay `Tien = 1,000,000`. |
| **TC-02** | Kế toán VP lấy đơn kho qua `ctbhch` | Phiếu xuất kho có hàng mút (`So_Tam = 20`, `He_So = 1.5`, `SL = 30`) | Bấm `cmdChonPhieuXuat`, chọn đơn. Click chuột vào từng ô trên dòng mút, sau đó bấm Lưu. | - Khi click qua các ô: Số lượng vẫn giữ nguyên 30.<br>- Bấm Lưu: Dữ liệu ghi xuống `CtBH0` có `So_Luong9 = 30`, `Tien_Nt9 = 3,000,000`. |
| **TC-03** | Nhập ngược từ Thành tiền dòng Mút | `So_Tam = 10`, `He_So8 = 2` (`SL = 20`). Gõ `Tien_Nt9 = 2,000,000`. | Nhập thẳng cột Thành tiền, rời ô. | - Đơn giá tự tính ngược: `Gia_Nt9 = 100,000`.<br>- Chuyển sang dòng khác không làm sai lệch đơn giá dòng mới. |
| **TC-04** | Xóa chiết khấu về 0 có thuế VAT | Hàng có CK 20%, Thuế 10%. Sau đó sửa `Chiet_Khau = 0`. | Sửa `Chiet_Khau = 0`, nhấn Tab sang ô khác hoặc bấm Lưu. | - `Tien_Nt4 = 0`, `Tien_Nt2 = Tien_Nt9`, `Gia_Nt2 = Gia_Nt9`.<br>- Thuế GTGT `TTien_Nt3` tự động tính lại theo 100% tiền hàng.<br>- Tổng thanh toán `TTien_Nt0 = TTien_Nt2 + TTien_Nt3`. |
| **TC-05** | Hóa đơn Ngoại tệ (USD) có giá $1-$10 | `Ma_Tte = 'USD'`, `Gia_Nt9 = 5.00`, `Chiet_Khau = 10%`. | Nhập đơn giá $5.00 và CK 10% trên hóa đơn USD. | - Chiết khấu 10% được giữ nguyên, KHÔNG bị tự động xóa về 0.<br>- `Tien_Nt4 = 0.50`, `Tien_Nt2 = 4.50`. |
| **TC-06** | Kiểm tra hồi quy Hàng thường (`Loai_Vt = '1'`) | Vật tư thông thường có ĐVT phụ (`He_So9 = 12`). | Nhập `So_Luong9 = 5` thùng, đổi ĐVT. | - `So_Luong = 60` cái (trừ kho).<br>- `So_Luong9 = 5` thùng (bán).<br>- Hoạt động đúng theo chuẩn `core.app`. |
| **TC-07** | Kiểm tra hồi quy Hàng đặc thù (`Loai_Vt = '3'`) | Vật tư cuộn/khối nhóm 3. | Nhập quy cách dài x rộng x cao. | - Hàm `=So_Luong3(THISFORM)` chạy chính xác, không bị ảnh hưởng bởi `Calc_Loai2`. |
| **TC-08** | Kiểm tra nợ và chống trùng số phiếu | Khách hàng nợ vượt hạn mức; hoặc 2 máy cùng tạo phiếu lúc 10:00. | Máy 1 và Máy 2 cùng bấm Lưu số phiếu `HD2854`. | - Nếu quá nợ: Chặn lưu, focus sang ô tên khách `txtTen_Dt`.<br>- Nếu trùng số: Vòng lặp `ST_Check_Number` tự tăng lên `HD2855`, không bị crash DB. |

---

### 7.2. Script SQL Chẩn Đoán Phát Hiện Chứng Từ Sai Trên Cả Hai Cơ Sở Dữ Liệu
Chạy script kiểm tra dưới đây trên cả **`KH_2014`** và **`VP_2014`** để phát hiện toàn bộ các bản ghi `CtBH0` bị tổn thương do lỗi nhảy số lượng:

```sql
-- ==================================================================================
-- SCRIPT CHẨN ĐOÁN: PHÁT HIỆN HÀNG MÚT BỊ SAI SỐ LƯỢNG / THÀNH TIỀN DO LỖI SO_LUONG2
-- Áp dụng: Chạy trên cả 2 cơ sở dữ liệu KH_2014 và VP_2014 (READ-ONLY)
-- ==================================================================================

SELECT 
    h.Ngay_Ct,
    h.So_Ct,
    h.Ma_Dt,
    d.Stt,
    d.Stt0,
    d.Ma_Vt,
    d.Dvt,
    d.So_Tam,
    d.He_So8                                        AS He_So_Do_Day,
    d.So_Luong8                                     AS SL_Ban_Cursor,
    d.So_Luong9                                     AS SL_Xuat_Hien_Thi,
    d.So_Luong                                      AS SL_Ton_Kho,
    ROUND(d.So_Tam * d.He_So8, 2)                   AS SL_Dung_Chuan,
    d.Gia_Nt9                                       AS Don_Gia_Ban,
    d.Tien_Nt9                                      AS Thanh_Tien_Thuc_Luu,
    ROUND(ROUND(d.So_Tam * d.He_So8, 2) * d.Gia_Nt9, 2) AS Thanh_Tien_Dung_Chuan,
    CASE 
        -- Dấu hiệu 1: Số lượng bị nhảy về bằng đúng Số tấm (bỏ qua hệ số)
        WHEN d.He_So8 > 0 AND d.He_So8 <> 1 AND ABS(d.So_Luong9 - d.So_Tam) < 0.001 
             THEN N'LỖI NGUY HIỂM: Số lượng nhảy về bằng Số tấm'
        -- Dấu hiệu 2: Thành tiền bị tính bằng Số tấm * Đơn giá
        WHEN d.He_So8 > 0 AND d.He_So8 <> 1 AND ABS(d.Tien_Nt9 - ROUND(d.So_Tam * d.Gia_Nt9, 2)) < 1.0 
             THEN N'LỖI NGUY HIỂM: Thành tiền = Số tấm * Đơn giá'
        -- Dấu hiệu 3: Lệch giữa SL xuất và SL trừ kho
        WHEN ABS(ISNULL(d.So_Luong9, 0) - ISNULL(d.So_Luong, 0)) > 0.01 
             THEN N'CẢNH BÁO: Lệch SL xuất (So_Luong9) và SL tồn (So_Luong)'
        ELSE N'BÌNH THƯỜNG'
    END AS Phan_Loai_Trang_Thai
FROM dbo.CtBH0 d WITH (NOLOCK)
INNER JOIN dbo.CtBH h WITH (NOLOCK) ON h.Stt = d.Stt
INNER JOIN dbo.DmVt v WITH (NOLOCK) ON v.Ma_Vt = d.Ma_Vt
WHERE v.Loai_Vt = '2'
  AND ISNULL(d.So_Tam, 0) > 0
  AND ISNULL(d.He_So8, 0) > 0
  AND d.He_So8 <> 1
  AND (
      ABS(d.So_Luong9 - ROUND(d.So_Tam * d.He_So8, 2)) > 0.01
      OR ABS(d.Tien_Nt9 - ROUND(ROUND(d.So_Tam * d.He_So8, 2) * d.Gia_Nt9, 2)) > 1.0
      OR ABS(ISNULL(d.So_Luong9, 0) - ISNULL(d.So_Luong, 0)) > 0.01
  )
ORDER BY h.Ngay_Ct DESC, h.So_Ct;
```

---

### 7.3. Script SQL Khắc Phục Dữ Liệu Lịch Sử An Toàn (Transaction Safety)
Khi ban giám đốc phê duyệt điều chỉnh dữ liệu lịch sử cho các chứng từ chưa khóa sổ trong kỳ, quản trị viên sử dụng script dưới đây với cơ chế an toàn **BẮT BUỘC ROLLBACK ĐỂ KIỂM TRA TRƯỚC KHI COMMIT**:

```sql
-- ==================================================================================
-- SCRIPT KHẮC PHỤC DỮ LIỆU LỊCH SỬ HÀNG MÚT BỊ SAI SỐ LƯỢNG & THÀNH TIỀN
-- Chế độ an toàn: BEGIN TRANSACTION -> PRINT BÁO CÁO -> ROLLBACK (Mặc định)
-- Chỉ đổi 'ROLLBACK TRANSACTION' thành 'COMMIT TRANSACTION' khi đã kiểm tra 100% khớp!
-- ==================================================================================

BEGIN TRANSACTION;

-- Bước 1: Tạo bảng tạm lưu danh sách các dòng bị ảnh hưởng
SELECT 
    d.Stt,
    d.Stt0,
    d.So_Tam,
    d.He_So8,
    ROUND(d.So_Tam * d.He_So8, 2)                   AS New_So_Luong,
    d.Gia_Nt9,
    ROUND(ROUND(d.So_Tam * d.He_So8, 2) * d.Gia_Nt9, 2) AS New_Tien_Nt9,
    d.Chiet_Khau,
    ROUND(ROUND(ROUND(d.So_Tam * d.He_So8, 2) * d.Gia_Nt9, 2) * ISNULL(d.Chiet_Khau, 0) / 100, 2) AS New_Tien_Nt4,
    ROUND(ROUND(d.So_Tam * d.He_So8, 2) * d.Gia_Nt9, 2) - 
    ROUND(ROUND(ROUND(d.So_Tam * d.He_So8, 2) * d.Gia_Nt9, 2) * ISNULL(d.Chiet_Khau, 0) / 100, 2) AS New_Tien_Nt2
INTO #TmpFixCtBH0
FROM dbo.CtBH0 d
INNER JOIN dbo.CtBH h ON h.Stt = d.Stt
INNER JOIN dbo.DmVt v ON v.Ma_Vt = d.Ma_Vt
WHERE v.Loai_Vt = '2'
  AND ISNULL(d.So_Tam, 0) > 0
  AND ISNULL(d.He_So8, 0) > 0
  AND d.He_So8 <> 1
  AND (
      ABS(d.So_Luong9 - ROUND(d.So_Tam * d.He_So8, 2)) > 0.01
      OR ABS(d.Tien_Nt9 - ROUND(ROUND(d.So_Tam * d.He_So8, 2) * d.Gia_Nt9, 2)) > 1.0
  );

PRINT N'Số lượng bản ghi CtBH0 cần khắc phục: ' + CAST(@@ROWCOUNT AS VARCHAR(10));

-- Bước 2: Cập nhật bảng chi tiết CtBH0 (BẢO TOÀN NGUYÊN VẸN CỘT GIÁ VỐN Gia_Nt/Gia/Tien_Nt/Tien)
UPDATE d
SET 
    d.So_Luong8  = t.New_So_Luong,
    d.So_Luong9  = t.New_So_Luong,
    d.So_Luong   = t.New_So_Luong,
    d.Tien_Nt9   = t.New_Tien_Nt9,
    d.Tien9      = ROUND(t.New_Tien_Nt9 * h.Ty_Gia, 0),
    d.Tien_Nt4   = t.New_Tien_Nt4,
    d.Tien4      = ROUND(t.New_Tien_Nt4 * h.Ty_Gia, 0),
    d.Tien_Nt2   = t.New_Tien_Nt2,
    d.Tien2      = ROUND(t.New_Tien_Nt2 * h.Ty_Gia, 0),
    d.Gia_Nt2    = ROUND(d.Gia_Nt9 * (100 - ISNULL(d.Chiet_Khau, 0)) / 100, 2),
    d.Gia2       = ROUND(d.Gia9 * (100 - ISNULL(d.Chiet_Khau, 0)) / 100, 0)
FROM dbo.CtBH0 d
INNER JOIN #TmpFixCtBH0 t ON t.Stt0 = d.Stt0
INNER JOIN dbo.CtBH h ON h.Stt = d.Stt;

-- Bước 3: Cập nhật lại tổng thanh toán trên Header CtBH cho các chứng từ có dòng được sửa
UPDATE h
SET 
    h.TTien_Nt  = agg.Sum_Tien_Nt9,
    h.TTien     = agg.Sum_Tien9,
    h.TTien_Nt2 = agg.Sum_Tien_Nt2,
    h.TTien2    = agg.Sum_Tien2,
    h.TTien_Nt4 = agg.Sum_Tien_Nt4,
    h.TTien4    = agg.Sum_Tien4,
    h.TTien_Nt3 = CASE 
                    WHEN h.Loai_Ck = '1' THEN ROUND(agg.Sum_Tien_Nt2 * ISNULL(h.Thue_GTGT, 0) / 100, 2)
                    ELSE ROUND(agg.Sum_Tien_Nt9 * ISNULL(h.Thue_GTGT, 0) / 100, 2)
                  END,
    h.TTien3    = CASE 
                    WHEN h.Loai_Ck = '1' THEN ROUND(ROUND(agg.Sum_Tien_Nt2 * ISNULL(h.Thue_GTGT, 0) / 100, 2) * h.Ty_Gia, 0)
                    ELSE ROUND(ROUND(agg.Sum_Tien_Nt9 * ISNULL(h.Thue_GTGT, 0) / 100, 2) * h.Ty_Gia, 0)
                  END,
    h.TTien_Nt0 = agg.Sum_Tien_Nt2 + CASE 
                    WHEN h.Loai_Ck = '1' THEN ROUND(agg.Sum_Tien_Nt2 * ISNULL(h.Thue_GTGT, 0) / 100, 2)
                    ELSE ROUND(agg.Sum_Tien_Nt9 * ISNULL(h.Thue_GTGT, 0) / 100, 2)
                  END,
    h.TTien0    = agg.Sum_Tien2 + CASE 
                    WHEN h.Loai_Ck = '1' THEN ROUND(ROUND(agg.Sum_Tien_Nt2 * ISNULL(h.Thue_GTGT, 0) / 100, 2) * h.Ty_Gia, 0)
                    ELSE ROUND(ROUND(agg.Sum_Tien_Nt9 * ISNULL(h.Thue_GTGT, 0) / 100, 2) * h.Ty_Gia, 0)
                  END
FROM dbo.CtBH h
INNER JOIN (
    SELECT 
        d.Stt,
        SUM(d.Tien_Nt9) AS Sum_Tien_Nt9,
        SUM(d.Tien9)    AS Sum_Tien9,
        SUM(d.Tien_Nt2) AS Sum_Tien_Nt2,
        SUM(d.Tien2)    AS Sum_Tien2,
        SUM(d.Tien_Nt4) AS Sum_Tien_Nt4,
        SUM(d.Tien4)    AS Sum_Tien4
    FROM dbo.CtBH0 d
    WHERE d.Stt IN (SELECT DISTINCT Stt FROM #TmpFixCtBH0)
    GROUP BY d.Stt
) agg ON agg.Stt = h.Stt;

-- Bước 4: Kiểm tra kết quả sau khi update trong transaction
SELECT h.So_Ct, h.Ngay_Ct, h.TTien_Nt, h.TTien_Nt2, h.TTien_Nt3, h.TTien_Nt0
FROM dbo.CtBH h
WHERE h.Stt IN (SELECT DISTINCT Stt FROM #TmpFixCtBH0);

DROP TABLE #TmpFixCtBH0;

-- MẶC ĐỊNH LÀ ROLLBACK ĐỂ AN TOÀN TUYỆT ĐỐI. 
-- KHI THẨM ĐỊNH KẾT QUẢ KHỚP 100%, ĐỔI DÒNG DƯỚI THÀNH: COMMIT TRANSACTION;
ROLLBACK TRANSACTION;
PRINT N'Đã hoàn tất kiểm tra thử nghiệm (Rollback an toàn).';
```

---

## CHƯƠNG 8: CẨM NANG VẬN HÀNH, BẢO TRÌ & QUY TRÌNH ĐÓNG GÓI CHUẨN VFP8

### 8.1. Quy Trình Patch Form An Toàn Qua Thư Mục `scratch/` (Rule 18)
File `.SCX` thực chất là bảng FoxPro (`DBF`), và file `.SCT` là file memo liên kết (`FPT`).
Thư viện `dbf` trên Python khi cập nhật trường memo không tự động thu hồi các block rỗng cũ, làm file `SCT` phình to bất thường (từ 170 KB lên >210 KB). Do đó, quy trình patch form bắt buộc thực hiện qua 4 bước:

1. **Bước 1 — Sao lưu có Timestamp:**
   ```powershell
   $ts = Get-Date -Format "yyyyMMdd_HHmmss"
   Copy-Item "FRM\ctbhd.scx" "FRM\ctbhd.scx.bak_$ts"
   Copy-Item "FRM\ctbhd.SCT" "FRM\ctbhd.SCT.bak_$ts"
   ```
2. **Bước 2 — Patch DBF/FPT qua Python trong `scratch/`:**
   Copy file vào `scratch/`, sửa nội dung các Record bằng thư viện `dbf`, đóng table rồi copy ngược lại `FRM/`. Sau đó xóa ngay file trong `scratch/`.
3. **Bước 3 — Nén Memo Block và Biên Dịch Bằng VFP8 (Bắt buộc):**
   Chạy script nén và biên dịch trên Visual FoxPro 8 (chi tiết tại mục 8.2).
4. **Bước 4 — Kiểm tra dung lượng đầu ra:**
   ```powershell
   Get-Item "FRM\ctbhd.SCT" | Select-Object Length
   ```
   Dung lượng chuẩn sau khi Pack & Compile tối ưu phải nằm trong khoảng: **176 KB – 182 KB** (tương đương ~180,354 bytes).

---

### 8.2. Quy Trình Nén FPT Và Biên Dịch Bằng Visual FoxPro 8.0 GUI
Lệnh `PACK` thu hồi toàn bộ các block rác và sắp xếp lại memo, sau đó `COMPILE FORM` sinh bytecode sạch cho trường `OBJCODE`:

Tạo file script: `e:\1S2024\scratch\pack_and_compile.prg`
```foxpro
SET SAFETY OFF
SET TALK OFF
SET EXCLUSIVE ON

* 1. Mở file SCX ở chế độ độc quyền để Pack
USE e:\1S2024\FRM\ctbhd.scx IN 0 ALIAS ctbhd_scx EXCLUSIVE
SELECT ctbhd_scx
PACK
USE IN ctbhd_scx

* 2. Biên dịch Form sinh bytecode sạch
COMPILE FORM e:\1S2024\FRM\ctbhd.scx

MESSAGEBOX("Đã Pack và Compile ctbhd.scx thành công!", 64, "Thông báo")
RETURN
```

**Thao tác thực hiện:**
1. Mở phần mềm **Microsoft Visual FoxPro 8.0**.
2. Chọn menu **File $\rightarrow$ Open**, tại mục *Files of type* chọn **Program (*.prg)**.
3. Chọn file `e:\1S2024\scratch\pack_and_compile.prg` và bấm **Open**.
4. Chọn menu **Program $\rightarrow$ Run** (hoặc nhấn tổ hợp phím `Ctrl + E`).
5. Đợi hộp thoại thông báo hoàn tất, đóng VFP8 và xóa file `.prg` trong `scratch/`.

---

### 8.3. Phương Án Sao Lưu, Quản Lý Phiên Bản & Quy Trình Rollback Khẩn Cấp

#### A. Danh mục các bản Backup chuẩn của Form `ctbhd`
Trong thư mục `FRM/`, hệ thống luôn duy trì các mốc snapshot bảo vệ:
- `FRM\ctbhd.scx.bak_baseline`: Bản nguyên gốc trước khi can thiệp.
- `FRM\ctbhd.scx.bak_20261002_105202`: Bản sao lưu trước đợt nâng cấp modular `Calc_Loai2`.
- `FRM\ctbhd.scx.bak_pre_hardening`: Bản sao lưu trước khi áp dụng 5 gia cố phản biện từ Agent 2.

#### B. Quy trình Rollback khẩn cấp (Nếu xảy ra sự cố)
Nếu sau khi cập nhật người dùng gặp bất kỳ trục trặc nào:
1. Yêu cầu toàn bộ nhân viên kế toán và thủ kho đóng form `ctbhd`.
2. Chạy lệnh PowerShell khôi phục ngay lập tức:
   ```powershell
   Copy-Item -Force "FRM\ctbhd.scx.bak_20261002_105202" "FRM\ctbhd.scx"
   Copy-Item -Force "FRM\ctbhd.SCT.bak_20261002_105202" "FRM\ctbhd.SCT"
   ```
3. Mở Visual FoxPro 8 và chạy lệnh:
   ```foxpro
   COMPILE FORM e:\1S2024\FRM\ctbhd.scx
   ```
4. Hệ thống sẽ quay trở lại trạng thái hoạt động ổn định trước đó trong vòng chưa đầy 30 giây.

---

## LỜI KẾT & CHỮ KÝ PHÊ DUYỆT

Tài liệu này là đặc tả kỹ thuật chuẩn hóa cao nhất của hệ thống hóa đơn bán hàng `ctbhd`, giải quyết triệt để vấn đề nhảy số lượng hàng Mút xốp, thống nhất cơ chế chiết khấu - thuế VAT, và bảo vệ tuyệt đối tính toàn vẹn của cơ sở dữ liệu `VP_2014` & `KH_2014`.

Mọi thay đổi mã nguồn trong tương lai đối với form `ctbhd.scx` bắt buộc phải đối chiếu và tuân thủ nghiêm ngặt các nguyên tắc trong tài liệu này!
