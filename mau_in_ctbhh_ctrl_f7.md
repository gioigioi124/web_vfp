# Đặc Tả Mẫu In Khi Nhấn `Ctrl+F7` Trong `ctbhh` (Chuyển Lên Web)

> **Mục đích:** Tài liệu phân tích chi tiết luồng xử lý phím tắt `Ctrl+F7` trên form danh sách chứng từ bán hàng (`FRM\ctbhh.scx`), xác định chính xác file mẫu in Visual FoxPro (`.frx`/`.frt`), giải mã toàn bộ tọa độ, kích thước, font chữ, đường kẻ, biểu thức dữ liệu và logic tiền xử lý để làm chuẩn thiết kế lại bản in trên Web (`PrintPreview.tsx` + `/api/print/{stt}`).

---

## 1. Luồng Xử Lý Khi Nhấn `Ctrl+F7` Trong `ctbhh.scx`

### 1.1. Ánh xạ phím tắt & kiểm tra quyền (`FRM\ctbhh.scx`)

1. **Chuyển đổi phím tắt (`frmdocitemh.GotFocus`, Rec 3):**
   ```foxpro
   ON KEY LABEL CTRL+F7 KEYBOARD [{SHIFT+F7}]
   ```
   Do sự kiện `KeyPress` của Form trong VFP8 không bắt trực tiếp `Ctrl+F7`, hệ thống ánh xạ `Ctrl+F7` thành `Shift+F7`.
2. **Bắt phím (`frmdocitemh.KeyPress`, Rec 3):**
   ```foxpro
   CASE nKeyCode = 90 AND nShiftAltCtrl = 1 && Shift+F7 - Xem chung tu
       NODEFAULT
       THISFORM.CmdGrpControl.Command4.Click
   ```
3. **Nút "Xem phiếu" (`CmdgrpControl.Command4.Click`, Rec 7):**
   - Kiểm tra quyền in chứng từ (`RightNo = 4`) qua stored procedure `ST_Get_DocumentID` và `ST_Check_Right` trong `VTSYS`.
   - Rẽ nhánh theo **database đang đăng nhập** (`M_MA_DB`) và **mã chứng từ** (`_Ma_Ct`):
     ```foxpro
     IF UPPER(ALLTRIM(M_MA_DB)) <> ALLTRIM(M_DB_KHO) AND (_Ma_Ct = 'X1' OR _Ma_Ct = 'N5')
         =In_Ct_Hd(THISFORM, .T.)
     ELSE
         =In_Ct_Kh(THISFORM, .T.)
     ENDIF
     ```
   - Trong đó tham số `.T.` là chế độ **Preview** (xem trước trên màn hình rồi mới in; khác với phím `F7` / `Command5.Click` truyền `.F.` để in thẳng).

### 1.2. Xác định chính xác file mẫu bản in (`.frx` / `.frt`)

Cả hai hàm `In_Ct_Hd` và `In_Ct_Kh` đều nằm trong `FXP\ctbh.FXP` và gọi `GenRepoX` để render báo cáo:

| Ngữ cảnh sử dụng | Mã chứng từ (`Ma_Ct`) | Hàm VFP gọi | File mẫu in thực tế | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| **Văn phòng (`VP_2014`)** (`M_MA_DB <> M_DB_KHO`) | **`X1`** (Phiếu xuất bán — đơn hàng thông thường) | `In_Ct_Hd(THISFORM, .T.)` | **`RPT\ctpxg.frx`** (+ `ctpxg.FRT`) | **Mẫu chính cần chuyển lên web** |
| **Văn phòng (`VP_2014`)** (`M_MA_DB <> M_DB_KHO`) | **`N5`** (Hàng bán bị trả lại) | `In_Ct_Hd(THISFORM, .T.)` | **`RPT\ctpng.frx`** (+ `ctpng.FRT`) | Gần giống hệt `ctpxg.frx` (chỉ khác 2 điểm, xem §6) |
| **Kho (`KH_2014`)** (`M_MA_DB = M_DB_KHO`) | `X1` / `N5` | `In_Ct_Kh(THISFORM, .T.)` | Mở `FRM\DocPrint.scx` chọn liên (`1..3`) → `RPT\ctpx.frx` / `RPT\CTPN.FRX` | Không in đơn giá, thành tiền, chiết khấu |

> **Lưu ý đối chiếu với Web hiện tại:** Component `html/webapp/frontend/src/components/PrintPreview.tsx` hiện đang dùng bố cục giả lập kiểu Hóa đơn GTGT (`01GTKT0/001`, tiêu đề *"HÓA ĐƠN BÁN HÀNG KIÊM PHIẾU XUẤT KHO"*), **chưa đúng** với mẫu `RPT\ctpxg.frx` thực tế mà kế toán nhìn thấy khi nhấn `Ctrl+F7` trên phần mềm VFP.

---

## 2. Logic Tiền Xử Lý Dữ Liệu Trước Khi Đổ Vào Mẫu `ctpxg.frx`

Trước khi gọi `REPORT FORM E:\1S2024\RPT\CTPXG NOCONSOLE PREVIEW`, hàm `In_Ct_Hd` thực hiện các bước chuẩn bị biến và cursor sau (cần tái tạo chính xác trên backend/frontend web):

1. **Hỏi in nợ cũ (`M.In_NoCk`):**
   - Trên VFP, `Ctrl+F7` (Preview) hiện hộp thoại hỏi *"Có in nợ cũ hay không?"* (`Yes` → `M.In_NoCk = 'C'`, `No` → `M.In_NoCk = 'K'`). *(Ghi chú: riêng phím `F7` in nhanh trên `ctbhh.scx` đã được patch hook `MessageBoxA` để tự động chọn `No` / `M.In_NoCk = 'K'`.)*
   - Nếu `M.In_NoCk = 'C'` và chứng từ đã ghi sổ (`Posted = 1`), VFP gọi SP `GL_Alert_ClosingAccount4Customer` để lấy số dư nợ cũ `_Du_Dau`.
2. **Đọc tùy chọn in giá (`_InGia`):**
   - Lấy từ ô `txtInGia` ở góc dưới bên phải form `ctbhh.scx` (`"1-In giá; 0-Không in giá"`):
     - `_InGia = '1'`: In đầy đủ đơn giá, thành tiền, chiết khấu, thanh toán, tổng tiền, tiền bằng chữ.
     - `_InGia = '0'`: Ẩn toàn bộ các số tiền (chỉ in số lượng, quy cách).
3. **Truy vấn Header (`K_PRTemp` ← `EXEC CtBH_One_Get @p_Stt = ...`):**
   - Cung cấp các biến `m.*`: `Ngay_Ct`, `So_Ct`, `Ten_Dt`, `Dien_Giai0`, `Ten_Bp`, `Ma_Xe`, `TTien_Nt2`, `Loai_Ck`, `Ma_Tte`, `SQLTime` (`GETDATE()` lúc lấy phiếu), `FullName` (họ tên người dùng từ `UserList`).
   - **Tiêu đề phiếu (`M.Tieu_De`):** Lấy từ `M_DmCt.Tieu_De` (trong bảng `VTSYS.dbo.DocumentNumber`):
     - `X1`: `"Phiếu xuất bán"` (hiển thị in hoa hoặc nguyên bản tùy cấu hình; trong DB lưu `"Phiếu xuất bán"`).
     - `N5`: `"Phiếu nhập hàng trả lại"`.
   - **Địa chỉ & Điện thoại khách hàng (`_Dia_Chi`, `_Dien_Thoai`):**
     - **Quan trọng:** `In_Ct_Hd` tra bảng danh mục đối tượng **`VTSYS.dbo.DmDt`** theo `Ma_Dt` để lấy `DmDt.Dia_Chi` → `_Dia_Chi` và `DmDt.Phone` → `_Dien_Thoai`. Nó **không** lấy `CtBH.Dia_Chi` (và cũng không fallback về `CtBH.Dia_Chi` nếu `DmDt` trống).
4. **Truy vấn & biến đổi Detail (`P_CtTemp` ← `EXEC CtBH0_Get @p_Stt = ...`):**
   - **Quy tắc cực kỳ quan trọng với mặt hàng Mút / Tính theo hệ số (`Loai_Vt = '2'` hoặc `'3'`):**
     - Trước khi đổ sang report, `In_Ct_Hd` duyệt qua `P_CtTemp` và **gán lại `So_Luong9 = So_Tam`** đối với các dòng có `Loai_Vt = '2'` hoặc `Loai_Vt = '3'` (trong khi `Loai_Vt = '1'` hoặc `'4'` vẫn giữ nguyên `So_Luong9`).
     - Vì thế trên bảng in `ctpxg.frx`:
       - Cột **`Cm(Kg)`** (`1`) hiển thị `He_So8` (chỉ hiện khi `Loai_Vt IN ('2', '3')`).
       - Cột **`S.Lượng`** (`2`) hiển thị `So_Luong9` sau biến đổi (tức **Số tấm** đối với `Loai_Vt` 2/3, và **Số lượng** đối với `Loai_Vt` 1/4).
       - Cột **`Đơn giá`** (`3`) hiển thị `Gia_Nt9`.
       - Cột **`Thành tiền`** (`4=3x2x1`) hiển thị `Tien_Nt9` (`= Đơn giá × Số tấm × Cm(Kg)` với loại 2/3; `= Đơn giá × Số lượng` với loại 1/4).
       - Cột **`CK`** (`5`) hiển thị `ALLTRIM(STR(Chiet_Khau)) + '%'` (chỉ hiện khi `_InGia = '1'` và `Chiet_Khau > 0`).
       - Cột **`Thanh toán`** (`6=4-(4x5)`) hiển thị `Tien_Nt2`.
5. **Tính tổng số thứ & tiền bằng chữ:**
   - `m.TSo_Loai`: Tổng cột `So_Luong9` trên `P_CtTemp` (sau khi đã quy đổi `So_Tam` cho loại 2/3), hiển thị dạng `<TSo_Loai> thứ`.
   - `M.Thanh_Tien`: Chuỗi đọc số tiền `m.TTien_Nt2` thành chữ tiếng Việt.

---

## 3. Thông Số Trang In & Hệ Quy Chiếu Tọa Độ (`RPT\ctpxg.frx`)

File `.frx` của Visual FoxPro lưu tọa độ theo đơn vị **FRU** (*FoxPro Report Units*: `1 inch = 10,000 FRU = 25.4 mm` $\Rightarrow$ `1 mm = 393.7008 FRU`).

- **Khổ giấy:** A4 dọc (`PAPERSIZE = 9`, `ORIENTATION = 0` → `210 mm × 297 mm`).
- **Vùng thiết kế ngang:** Bắt đầu từ `HPOS = 2000 FRU` (`5.08 mm`), bề rộng vùng in `WIDTH = 80667 FRU` (`204.89 mm`). Khung bảng chính rộng **`195.79 mm`** (từ `X = 2.4 mm` đến `X = 198.2 mm`).
- **Cấu trúc 3 Band trong `.frx`:**
  1. **Page Header** (Band Rec 2): Cao `29,167 FRU` (**`74.08 mm`**) — chứa thông tin công ty, logo, tiêu đề phiếu, hộp ngày/số phiếu, thông tin khách hàng và 2 dòng tiêu đề cột của bảng.
  2. **Detail** (Band Rec 3): Cao `2,709 FRU` (**`6.88 mm` / dòng**) — lặp lại cho từng dòng hàng hóa, hỗ trợ giãn dòng (`STRETCH = .T.`) khi tên hàng dài.
  3. **Page Footer** (Band Rec 4): Cao `33,646 FRU` (**`85.46 mm`**) — chứa dòng tổng cộng, khối nợ cũ (ẩn/hiện theo điều kiện), số tiền bằng chữ, 4 cột chữ ký, tên người lập và số trang.
  - *Cơ chế khung bảng liền mạch của VFP:* Khung chữ nhật ngoài (`Rec 16`) và 8 đường kẻ dọc phân cột (`Rec 63, 76, 82, 66, 18, 59, 51, 19`) được đặt kéo dài từ đầu tiêu đề bảng (trong Page Header) xuống hết phần Detail đến sát dòng Tổng cộng (trong Page Footer). Nhờ vậy khi chuyển lên Web, chỉ cần dựng một `<table>` chuẩn có viền ngoài `2px solid #000`, kẻ dọc `1px solid #000`, kẻ ngang giữa các dòng dữ liệu nét chấm/mảnh (`1px dotted #000`), và dòng tổng ở `<tfoot>` hoặc hàng cuối bảng.
- **Font chữ (TCVN3 → Unicode Web):**
  - VFP dùng bộ font TCVN3: `.VnArialH`, `.VnArial`, `.VnArial NarrowH`, `.VnArial Narrow`, `VnSkua`, `VnSkuaH`.
  - Khi chuyển lên Web, sử dụng font Unicode **`Arial Narrow`** / **`Arial`** / **`sans-serif`** tương ứng với cỡ `pt` giữ nguyên như trong `.frx` (`10pt`, `11pt`, `12pt`, `14pt`, `16pt`, `20pt`).

---

## 4. Sơ Đồ Bố Cục Tổng Quan Trang In (`ctpxg.frx`)

```text
+-----------------------------------------------------------------------------------------------+
|  [LOGO.jpg]        CÔNG TY TNHH CHĂN GA GỐI ĐỆM VIMATT VIỆT NAM                               |
|  (41.5 x 22.5 mm)  Điện thoại: 84-31.3.914.242  -  Fax: 84-31.3.914.247                       |
|                    <Ten_Bp - nếu có>                                                          |
|                                                                +----------------------------+ |
|                      PHIẾU XUẤT BÁN                            | Ngày:        <Ngay_Ct>     | |
|                      Số xe: <Ma_Xe>                            | Số phiếu:    <So_Ct>       | |
|                                                                |       <SQLTime>            | |
|  Khách hàng:  <Ten_Dt> (<Dien_Giai0>)                          +----------------------------+ |
|  Địa chỉ:     <_Dia_Chi>                       Điện thoại: <_Dien_Thoai>                      |
+-----+-------------------------+-----+--------+---------+-----------+-------------+-----+------+
| STT |        Loại hàng        | ĐVT | Cm(Kg) | S.Lượng |  Đơn giá  | Thành tiền  | CK  |Thanh |
|     |                         |     |        |         |           |             |     | toán |
|-----+-------------------------+-----+--------+---------+-----------+-------------+-----+------+
|  A  |            B            |  C  |   1    |    2    |     3     |   4=3x2x1   |  5  |6=4-..|
+=====+=========================+=====+========+=========+===========+=============+=====+======+
|  1  | <ten_vt>                | cái |        |    1    |   984 000 |     984 000 |     |984000|
| . . | . . . . . . . . . . . . | . . | . . .  | . . . . | . . . . . | . . . . . . | . . | . . .|
|  2  | <ten_vt (Mút loại 2)>   | tấm |  10.00 |    2    |     5 000 |     100 000 | 10% |90 000|
+=====+=========================+=====+========+=========+===========+=============+=====+======+
|      Tổng cộng:  <TSo_Loai> thứ                                  Tổng tiền:     <TTien_Nt2>   |
|                                                                  [Nợ cũ:]       [<_Du_Dau>]   |
|                                                                  [Tổng nợ:]     [<Du+TT>]     |
|  Bằng chữ :  <Thanh_Tien (tiền bằng chữ)>                                                     |
|                                                                                               |
|      chủ hàng            người lập           lái xe           người giao hàng                 |
|  (Ký & ghi rõ họ tên) (Ký & ghi rõ họ tên) (Ký & ghi rõ họ tên) (Ký & ghi rõ họ tên)          |
|                                                                                               |
|                   <FullName>                                       Trang: 1 / 1               |
+-----------------------------------------------------------------------------------------------+
```

---

## 5. Đặc Tả Chi Tiết Từng Thành Phần Trong Trang In (`ctpxg.frx`)

### 5.1. Phần Đầu Trang (`Page Header`: Y từ `0 mm` đến `74.1 mm`)

#### A. Khối thương hiệu công ty & Logo
| Rec | Thành phần | Tọa độ (X, Y) | Kích thước (W × H) | Font / Kiểu / Cỡ | Căn lề | Biểu thức VFP / Nội dung | Nguồn dữ liệu thực tế |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 39 | **Logo công ty** | `2.6 mm, 9.0 mm` | `41.5 × 22.5 mm` | Ảnh (`Scale fill`) | Giữa | `M_BMP + [logo.jpg]` | File `IMG\LOGO.jpg` (`229×134 px`) |
| 32 | **Tên công ty** | `44.7 mm, 6.1 mm` | `148.7 × 8.2 mm` | `.VnArialH`, Bold, `16pt` | Giữa | `M_Ten_Dvi` | `VTSYS..DmDvCs.Ten_DvCs` (`Công ty TNHH Chăn Ga Gối Đệm Vimatt Việt Nam`) |
| 33 | **ĐT & Fax cty** | `44.7 mm, 14.8 mm` | `148.7 × 5.3 mm` | `.VnArial`, Regular, `12pt` | Giữa | `'Điện thoại: ' + M_Dien_Thoai + ' - Fax: ' + M_Fax` | `VTSYS..DmDvCs.dien_thoai`, `DmDvCs.fax` |
| 50 | **Tên bộ phận** | `44.7 mm, 20.6 mm` | `148.7 × 5.3 mm` | `.VnArial`, Regular, `12pt` | Giữa | `alltrim(m.ten_bp)` | `CtBH_One_Get.Ten_Bp` (để trống nếu `NULL`) |

#### B. Tiêu đề phiếu & Hộp thông tin chứng từ (góc phải)
| Rec | Thành phần | Tọa độ (X, Y) | Kích thước (W × H) | Font / Kiểu / Cỡ | Căn lề | Biểu thức VFP / Nội dung | Nguồn dữ liệu / Ghi chú |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 9 | **Tiêu đề phiếu** | `46.6 mm, 28.0 mm` | `108.7 × 10.3 mm` | `.VnArialH`, Bold, `20pt` | Giữa | `M.Tieu_De` | `VTSYS..DocumentNumber.Tieu_De` (`Phiếu xuất bán` với `X1`) |
| 40 | **Số xe** | `46.6 mm, 39.2 mm` | `108.7 × 5.6 mm` | `.VnArial Narrow`, Bold, `12pt` | Giữa | `' Số xe: ' + alltrim(m.ma_xe)` | `CtBH.Ma_Xe` (chữ `"Số xe:"` vẫn hiển thị kể cả khi `Ma_Xe` rỗng) |
| 55 | **Khung hộp góc phải** | `156.6 mm, 31.2 mm` | `41.5 × 18.5 mm` | Viền liền `1px` | — | Hình chữ nhật (`PEN=1/8`) | Bao quanh 3 dòng Ngày / Số phiếu / Giờ SQL |
| 56 | Nhãn `"Ngày: "` | `158.0 mm, 32.3 mm` | `15.9 × 5.6 mm` | `.VnArial Narrow`, Bold, `12pt` | Trái | `"Ngày: "` | Nhãn tĩnh |
| 5 | Giá trị Ngày chứng từ | `168.3 mm, 32.3 mm` | `28.8 × 5.6 mm` | `.VnArial Narrow`, Bold, `12pt` | Phải | `m.Ngay_Ct` (`@D`) | `CtBH.Ngay_Ct` (định dạng `dd/mm/yyyy` hoặc theo `SET DATE`) |
| 6 | Nhãn `"Số phiếu: "` | `158.0 mm, 38.1 mm` | `20.1 × 5.6 mm` | `.VnArial Narrow`, Bold, `12pt` | Trái | `"Số phiếu: "` | Nhãn tĩnh |
| 7 | Giá trị Số phiếu | `177.0 mm, 38.1 mm` | `20.4 × 5.6 mm` | `.VnArial Narrow`, Bold, `12pt` | Phải | `M.So_Ct` | `CtBH.So_Ct` (ví dụ `HD1468`) |
| 54 | Thời gian hệ thống | `158.0 mm, 43.7 mm` | `39.4 × 5.3 mm` | `.VnArial Narrow`, Italic, `12pt` | Giữa | `m.SQLTime` | `CtBH_One_Get.SQLTime` (`GETDATE()` từ SQL Server) |

#### C. Thông tin khách hàng
| Rec | Thành phần | Tọa độ (X, Y) | Kích thước (W × H) | Font / Kiểu / Cỡ | Căn lề | Biểu thức VFP / Nội dung | Nguồn dữ liệu |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 24 | Nhãn `"Khách hàng:"` | `6.3 mm, 46.6 mm` | `24.1 × 5.6 mm` | `.VnArial Narrow`, Bold, `12pt` | Trái | `"Khách hàng:"` | Nhãn tĩnh |
| 8 | Tên KH + Diễn giải | `31.2 mm, 46.6 mm` | `147.4 × 5.6 mm` | `.VnArial NarrowH`, Bold, `12pt` | Trái | `alltrim(m.ten_dt) + ' (' + alltrim(m.Dien_Giai0) + ')'` | `CtBH_One_Get.Ten_Dt` và `CtBH.Dien_Giai0` |
| 38 | Nhãn `"Địa chỉ:"` | `6.3 mm, 53.2 mm` | `24.1 × 5.6 mm` | `.VnArial Narrow`, Bold, `12pt` | Trái | `"Địa chỉ:"` | Nhãn tĩnh |
| 23 | Giá trị Địa chỉ | `31.2 mm, 53.2 mm` | `100.3 × 5.6 mm` | `.VnArial Narrow`, Bold, `12pt` | Trái | `_Dia_Chi` | **`VTSYS..DmDt.Dia_Chi`** (tra theo `Ma_Dt`) |
| 42 | Nhãn `"Điện thoại:"` | `133.9 mm, 53.2 mm` | `21.4 × 5.6 mm` | `.VnArial Narrow`, Bold, `12pt` | Trái | `"Điện thoại:"` | Nhãn tĩnh |
| 41 | Giá trị Điện thoại | `156.6 mm, 53.2 mm` | `37.6 × 5.6 mm` | `.VnArial Narrow`, Bold, `12pt` | Trái | `_Dien_Thoai` | **`VTSYS..DmDt.Phone`** (tra theo `Ma_Dt`) |

---

### 5.2. Bảng Chi Tiết Hàng Hóa (Header bảng + `Detail` Band `6.88 mm`/dòng)

Khung ngoài bảng (`Rec 16`) có tọa độ bắt đầu `X = 2.4 mm`, `Y = 59.5 mm`, tổng bề rộng **`195.79 mm`**, viền ngoài `2px solid #000` (`PEN=2/8`). Phần tiêu đề bảng gồm **2 hàng** ngăn bởi đường kẻ ngang `1px solid` (`Rec 22` tại `Y = 68.0 mm`) và chốt đáy bằng đường kẻ ngang `2px solid` (`Rec 73` tại `Y = 73.3 mm`).

#### A. Cấu trúc 9 cột & Tiêu đề bảng
| STT Cột | Tọa độ X (`mm`) | Bề rộng (`mm`) | Tỷ lệ (`%`) | Nhãn hàng 1 (`Y=61.6mm`, `.VnArial Narrow 12pt`) | Nhãn hàng 2 (`Y=68.8mm`, `VnSkua 12pt`) |
| :-: | :--- | :--- | :-: | :--- | :--- |
| **1** | `2.4 .. 10.6` | `8.20 mm` | `4.19%` | `"STT"` | `"A"` |
| **2** | `10.6 .. 70.4` | `59.80 mm` | `30.54%` | `"Loại hàng"` | `"B"` |
| **3** | `70.4 .. 81.8` | `11.38 mm` | `5.81%` | `"ĐVT"` | `"C"` |
| **4** | `81.8 .. 96.3` | `14.55 mm` | `7.43%` | `"Cm(Kg)"` | `"1"` |
| **5** | `96.3 .. 111.1` | `14.82 mm` | `7.57%` | `"S.Lượng"` | `"2"` |
| **6** | `111.1 .. 135.2` | `24.08 mm` | `12.30%` | `"Đơn giá"` | `"3"` |
| **7** | `135.2 .. 161.7` | `26.46 mm` | `13.51%` | `"Thành tiền"` | `"4=3x2x1"` |
| **8** | `161.7 .. 170.1` | `8.47 mm` | `4.32%` | `"CK"` | `"5"` |
| **9** | `170.1 .. 198.2` | `28.05 mm` | `14.32%` | `"Thanh toán"` | `IIF(m.Loai_Ck = '2', '6=4-(4x5)', '6')` |

#### B. Dữ liệu từng dòng (`Detail` Band, `Y` bắt đầu tại `~79.6 mm`, cao `6.88 mm`, `STRETCH = .T.`)
Mỗi dòng dữ liệu kết thúc bằng đường kẻ ngang nét chấm `1px dotted` (`Rec 45`, `PEN=1/1`, `FLOAT = .T.`).

| Rec | Cột | Biểu thức VFP | Font / Kiểu / Cỡ | Căn lề | Format (`PICTURE`) | Điều kiện hiển thị (`SUPEXPR`) | Ý nghĩa thực tế |
| :-: | :-: | :--- | :--- | :-: | :--- | :--- | :--- |
| 62 | 1 | `_stt` (biến đếm `COUNT` reset mỗi report) | `.VnArial Narrow`, Regular, `12pt` | Giữa | — | Luôn hiện | Số thứ tự `1, 2, 3...` |
| 11 | 2 | `alltrim(ten_vt)` | `.VnArial Narrow`, **Bold**, `12pt` | Trái | — | Luôn hiện (tự xuống dòng nếu dài) | Tên vật tư / hàng hóa (`DmVt.Ten_Vt`) |
| 75 | 3 | `dvt` | `.VnArial Narrow`, Regular, `11pt` | Giữa | — | Luôn hiện | Đơn vị tính (`CtBH0.Dvt`) |
| 80 | 4 | `he_so8` | `.VnArial Narrow`, Regular, `12pt` | Phải | `@Z 999.99` | **`INLIST(Loai_Vt, '2', '3')`** | Độ dày (cm) / hệ số — ẩn nếu là hàng loại 1 hoặc 4; ẩn nếu bằng 0 (`@Z`) |
| 65 | 5 | `So_Luong9` | `.VnArial Narrow`, Regular, `12pt` | Phải | `@Z 99 999.99` | Luôn hiện (ẩn nếu 0) | **Số tấm (`So_Tam`)** nếu `Loai_Vt IN ('2','3')`; **`So_Luong9`** nếu `Loai_Vt IN ('1','4')` |
| 13 | 6 | `Gia_Nt9` | `.VnArial Narrow`, Regular, `12pt` | Phải | `@Z 999 999 999` | **`_InGia='1'`** | Đơn giá bán (ẩn nếu `_InGia='0'` hoặc giá = 0) |
| 58 | 7 | `tien_Nt9` | `.VnArial Narrow`, Regular, `12pt` | Phải | `@Z 999 999 999 999` | **`_InGia='1'`** | Thành tiền trước chiết khấu (`Gia_Nt9 * So_Luong_Goc` hoặc `Gia_Nt9 * So_Tam * He_So8`) |
| 53 | 8 | `ALLTRIM(STR(Chiet_Khau)) + '%'` | `.VnArial Narrow`, Regular, `12pt` | Trái | — | **`_InGia='1' and Chiet_Khau>0`** | Phần trăm chiết khấu dòng hàng (chỉ hiện khi `> 0`) |
| 15 | 9 | `tien_Nt2` | `.VnArial Narrow`, Regular, `12pt` | Phải | `@Z 999 999 999 999` | **`_InGia='1'`** | Thanh toán sau chiết khấu dòng hàng |

> **Lưu ý về định dạng `@Z` trong VFP:** Tiền tố `@Z` khiến giá trị bằng `0` được in thành **khoảng trắng (trống)** thay vì số `0`, và dấu phân cách hàng nghìn là **dấu cách** (`999 999 999 999`).

---

### 5.3. Phần Chân Trang (`Page Footer`: Cao `85.5 mm`, từ `Y = 91.3 mm` đến `~165 mm`)

> **Cơ chế phân trang nhiều trang (`recno()=reccount()`):** Hầu hết các thành phần ở Page Footer đều gắn điều kiện `recno()=reccount()` — nghĩa là **chỉ in ở trang cuối cùng của phiếu** (trừ số trang `Trang: X / Y` ở góc dưới bên phải luôn in ở mọi trang). Đường kẻ ngang trên cùng `Rec 31` (`2px solid` tại `Y = 91.3 mm`) + `Rec 17` (`1px solid` tại `Y = 91.5 mm`) chốt đáy bảng hàng hóa.

#### A. Dòng Tổng cộng & Khối Nợ cũ (nếu có)
| Rec | Thành phần | Tọa độ (X, Y) | Kích thước (W × H) | Font / Kiểu / Cỡ | Căn lề | Biểu thức VFP | Điều kiện (`SUPEXPR`) |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- | :--- |
| 44 | Nhãn `"Tổng cộng"` | `15.3 mm, 92.9 mm` | `17.7 × 4.8 mm` | `.VnArial Narrow`, Bold, `12pt` | Trái | `"Tổng cộng"` | `recno()=reccount()` |
| 43 | Tổng số lượng/thứ | `34.9 mm, 92.1 mm` | `26.7 × 6.3 mm` | `.VnArial Narrow`, Bold, `14pt` | Trái | `alltrim(str(m.TSo_Loai)) + ' thứ'` | `recno()=reccount()` |
| 21 | Nhãn `"Tổng tiền"` | `138.6 mm, 92.9 mm` | `15.6 × 4.8 mm` | `.VnArial Narrow`, Bold, `12pt` | Trái | `"Tổng tiền"` | `recno()=reccount()` |
| 20 | Giá trị Tổng tiền | `156.4 mm, 92.3 mm` | `40.5 × 5.6 mm` | `.VnArial Narrow`, Bold, `12pt` | Phải | `m.ttien_nt2` (`@Z 999 999 999 999`) | `_InGia='1' and recno()=reccount()` |
| 25 | Nhãn `"Nợ cũ:"` | `138.6 mm, 99.5 mm` | `10.6 × 4.8 mm` | `.VnArial Narrow`, Bold, `12pt` | Trái | `"Nợ cũ:"` | `M.In_NoCk='C' and recno()=reccount()` |
| 26 | Giá trị Nợ cũ | `156.4 mm, 99.5 mm` | `40.5 × 5.3 mm` | `.VnArial Narrow`, Bold, `12pt` | Phải | `_Du_Dau` (`@Z 999 999 999 999`) | `M.In_NoCk='C' and recno()=reccount()` |
| 29 | Nhãn `"Tổng nợ:"` | `138.6 mm, 105.6 mm` | `14.8 × 4.8 mm` | `.VnArial Narrow`, Bold, `12pt` | Trái | `"Tổng nợ:"` | `M.In_NoCk='C' and recno()=reccount()` |
| 27 | Giá trị Tổng nợ | `156.4 mm, 105.0 mm` | `40.5 × 5.3 mm` | `.VnArial Narrow`, Bold, `12pt` | Phải | `_Du_Dau + m.Ttien_Nt2` (`@Z 999 999 999 999`) | `M.In_NoCk='C' and recno()=reccount()` |

#### B. Tiền bằng chữ, 4 cột chữ ký & Chân trang
| Rec | Thành phần | Tọa độ (X, Y) | Kích thước (W × H) | Font / Kiểu / Cỡ | Căn lề | Biểu thức VFP | Điều kiện (`SUPEXPR`) |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- | :--- |
| 37 | Nhãn `"Bằng chữ :"` | `5.8 mm, 112.4 mm` | `19.8 × 5.8 mm` | `.VnArial Narrow`, Regular, `14pt` | Trái | `"Bằng chữ :"` | `recno()=reccount()` |
| 36 | Số tiền bằng chữ | `29.6 mm, 112.4 mm` | `163.2 × 12.2 mm` | `.VnArial Narrow`, Regular, `14pt` | Trái | `ALLTRIM(M.Thanh_Tien)` | `_InGia='1' and recno()=reccount()` |
| 28 / 30 | Chữ ký cột 1 | `16.9 mm, 124.6 mm` | `18.0 mm` / `29.9 mm` | `.VnArial NarrowH` / `.VnArial Narrow`, `12pt` | Giữa | `"chủ hàng"` + `"(Ký & ghi rõ họ tên)"` | `recno()=reccount()` |
| 48 / 49 | Chữ ký cột 2 | `64.0 mm, 124.6 mm` | `18.8 mm` / `29.9 mm` | `.VnArial NarrowH` / `.VnArial Narrow`, `12pt` | Giữa | `"người lập"` + `"(Ký & ghi rõ họ tên)"` | `recno()=reccount()` |
| 46 / 47 | Chữ ký cột 3 | `113.0 mm, 124.6 mm` | `11.1 mm` / `29.9 mm` | `.VnArial NarrowH` / `.VnArial Narrow`, `12pt` | Giữa | **`"lái xe"`** + `"(Ký & ghi rõ họ tên)"` | `recno()=reccount()` |
| 34 / 35 | Chữ ký cột 4 | `153.7 mm, 124.6 mm` | `31.8 mm` / `29.9 mm` | `.VnArial NarrowH` / `.VnArial Narrow`, `12pt` | Giữa | `"người giao hàng"` + `"(Ký & ghi rõ họ tên)"` | `recno()=reccount()` |
| 60 | Tên người lập phiếu | `50.0 mm, 160.1 mm` | `41.8 × 5.0 mm` | `VnSkuaH`, Regular, `10pt` | Giữa | `m.FullName` | `recno()=reccount()` (nằm dưới cột `"người lập"`) |
| 83 | Số trang | `162.2 mm, 160.1 mm` | `28.6 × 4.5 mm` | `VnSkua`, Regular, `10pt` | Giữa | `'[Trang: ] + ALLTRIM(STR(_PAGENO)) + [ / ] + ALLTRIM(STR(_PageTotal))'` | Luôn hiện trên mọi trang |

---

## 6. Sự Khác Biệt Giữa `ctpxg.frx` (`X1`) Và `ctpng.frx` (`N5`)

Khi người dùng đứng trên chứng từ **Hàng bán bị trả lại (`Ma_Ct = 'N5'`)** và nhấn `Ctrl+F7`, `In_Ct_Hd` dùng mẫu **`RPT\ctpng.frx`**. Bố cục và 97/99 record giống hệt `ctpxg.frx`, chỉ khác đúng **2 điểm**:

1. **Chữ ký cột 3 (`Rec 46`):** Đổi từ `"lái xe"` (`ctpxg.frx`) thành **`"Kiểm hàng"`** (`ctpng.frx`).
2. **Định dạng cột `S.Lượng` (`Rec 65`):** `PICTURE` đổi từ `"@Z 99 999.99"` (`ctpxg.frx`) thành `"@Z 99 999"` (`ctpng.frx`).

---

## 7. Hướng Dẫn Chuyển Lên Web (`html/webapp`)

Để bản in trên Web (`Ctrl+F7` / `F7` trong `VoucherList.tsx` & `PrintPreview.tsx`) giống với bản in của VFP:

### 7.1. Bổ sung dữ liệu ở Backend (`backend/app/routers/print.py` & repository)

Hiện tại `GET /api/print/{stt}` trả về `header` từ `CtBH_One_Get` và `items` từ `CtBH0_Get`, nhưng còn thiếu hoặc chưa tách rõ một số trường mà `ctpxg.frx` sử dụng:
1. **Thông tin đơn vị (`company`):** Đọc từ `VTSYS.dbo.DmDvCs` (`Ten_DvCs`, `dien_thoai`, `fax`) và ảnh `LOGO.jpg` đặt trong `frontend/public/logo.jpg`.
2. **Địa chỉ & Điện thoại khách hàng (`customer_address`, `customer_phone`):** Truy vấn từ `VTSYS.dbo.DmDt` (`Dia_Chi`, `Phone`) theo `header.ma_dt`.
3. **Tiêu đề phiếu (`title`):** Lấy theo `Ma_Ct` (`X1` → `"PHIẾU XUẤT BÁN"`, `N5` → `"PHIẾU NHẬP HÀNG TRẢ LẠI"`).
4. **Tính sẵn hoặc trả thêm cho bảng chi tiết (`items`):**
   - `so_luong_in`: nếu `loai_vt in ('2', '3')` thì lấy `so_tam`, ngược lại lấy `so_luong9`.
   - `he_so_in`: chỉ hiển thị khi `loai_vt in ('2', '3')` và `!= 0`.
   - `tso_loai`: `sum(so_luong_in)` của tất cả các dòng, hiển thị `<tso_loai> thứ`.
   - `tong_tien_chu`: đọc từ `ttien_nt2` (Lưu ý: `ctpxg.frx` đọc `m.TTien_Nt2`, không phải `TTien_Nt0` nếu có thuế/khác biệt, cần kiểm tra lại nghiệp vụ thực tế của công ty hiện tại không dùng VAT hay có dùng VAT).
5. **Tùy chọn in (`in_gia`, `in_no_ck`, `du_dau`):**
   - Hỗ trợ query param `?in_gia=1|0` (tương ứng `txtInGia` trên `ctbhh`) và `?in_no_ck=C|K` (nếu `C`, gọi `GL_Alert_ClosingAccount4Customer` lấy `_Du_Dau` khi `Posted = 1`).

### 7.2. Quy tắc CSS in ấn trên Frontend (`PrintPreview.tsx`)

1. **Thiết lập trang in CSS:**
   ```css
   @page {
     size: A4 portrait;
     margin: 5mm 6mm 6mm 5mm;
   }
   ```
2. **Font & Bảng 9 cột:**
   - Dùng `font-family: "Arial Narrow", Arial, sans-serif; color: #000;`.
   - Sử dụng `<colgroup>` với đúng tỷ lệ phần trăm 9 cột từ §5.2 (`4.19%`, `30.54%`, `5.81%`, `7.43%`, `7.57%`, `12.30%`, `13.51%`, `4.32%`, `14.32%`).
   - Định dạng số kiểu VFP (dấu phân cách hàng nghìn bằng khoảng trắng hoặc dấu phẩy theo thói quen kế toán, giá trị `0` hiển thị khoảng trắng giống `@Z`).
   - Đường viền ngoài bảng `2px solid #000`, kẻ dọc `1px solid #000`, kẻ ngang phân cách giữa các dòng hàng `1px dotted #000`, tiêu đề 2 hàng (`STT / A`, `Loại hàng / B`, `ĐVT / C`, `Cm(Kg) / 1`, `S.Lượng / 2`, `Đơn giá / 3`, `Thành tiền / 4=3x2x1`, `CK / 5`, `Thanh toán / 6=4-(4x5)`).
3. **Phần cuối trang (`Tổng cộng`, `Bằng chữ`, `4 cột chữ ký`, `FullName`):**
   - Đặt trong khối không bị ngắt trang giữa chừng (`break-inside: avoid;`), `4 cột chữ ký` chia đều (`chủ hàng`, `người lập` + tên `FullName` ở dưới, `lái xe` hoặc `Kiểm hàng` nếu `N5`, `người giao hàng`).
