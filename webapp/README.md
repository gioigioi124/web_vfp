# Web App Quản Lý Chứng Từ Bán Hàng 1S (`ctbhh` + `ctbhd`)

## Giới thiệu

Hệ thống Web Application hiện đại thay thế/mở rộng chức năng của 2 form Visual FoxPro 8.0 `ctbhh.scx` (danh sách chứng từ) và `ctbhd.scx` (nhập liệu chứng từ) trên nền tảng phần mềm kế toán 1S.

- **Backend:** FastAPI + pyodbc (Python 3)
- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS
- **Cơ sở dữ liệu:** Microsoft SQL Server 2014 (`VP_2014`, `KH_2014`, `VTSYS`)
- **Giai đoạn hiện tại:** **Giai đoạn 1 (100% READ-ONLY)**

---

## 🔒 Nguyên tắc an toàn dữ liệu (Giai đoạn 1)

- Tuyệt đối **KHÔNG có bất kỳ câu lệnh INSERT, UPDATE, DELETE** nào vào CSDL trong Giai đoạn 1.
- Mọi truy vấn CSDL đều là `SELECT ... WITH (NOLOCK)`.
- Chức năng thêm mới/sửa/xóa trên giao diện được bảo vệ ở chế độ xem an toàn.

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy

### 1. Khởi chạy 1-Click

Nhấp đúp vào file `run.bat` tại thư mục gốc:

```bat
e:\1S2024\html\webapp\run.bat
```

Script sẽ tự động khởi động:

- Backend Uvicorn tại `http://localhost:8000` (Swagger UI tại `http://localhost:8000/docs`)
- Frontend Vite tại `http://localhost:5173`
- Mở trình duyệt web truy cập tự động.

> **Routes (plan §1.4):** `/sales-invoices` (danh sách phiếu) và
> `/sales-invoices/:stt` (chi tiết/sửa phiếu). Không có màn đăng nhập ở Giai đoạn 1.

### 2. Khởi chạy thủ công

#### Backend:

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Frontend:

```bash
cd frontend
npm install
npm run dev
```

---

## ⌨️ Bảng phím tắt chuẩn VFP (khớp ctbhh / ctbhd / ctbhch)

Toàn bộ phím tắt giữ nguyên thói quen Visual FoxPro:

### Form danh sách chứng từ (`ctbhh`)

| Phím                     | Hành động                    | Trạng thái GĐ1   |
| :----------------------- | :--------------------------- | :--------------- |
| `F2` / `Ctrl+F2`         | Thêm mới / Thêm mới (SaveAs) | Khóa (read-only) |
| `F3`                     | Sửa chứng từ                 | Khóa (read-only) |
| `F6`                     | Nhập số IMEI (PN/PX/TL/HD)   | Khóa (read-only) |
| `F7`                     | In chứng từ                  | Hoạt động        |
| `Shift+F7` / `Ctrl+F7`   | Xem trước chứng từ           | Hoạt động        |
| `F8`                     | Xóa chứng từ                 | Khóa (read-only) |
| `F9`                     | Lọc chứng từ                 | Hoạt động        |
| `Space`                  | Đánh dấu dòng                | Hoạt động        |
| `Ctrl+A` / `Ctrl+U`      | Chọn tất cả / Bỏ chọn        | Hoạt động        |
| `Ctrl+Home` / `Ctrl+End` | Về dòng đầu / cuối           | Hoạt động        |
| `Enter`                  | Mở chi tiết dòng đang chọn   | Hoạt động        |
| `Esc`                    | Đóng / Quay lại danh sách    | Hoạt động        |

### Form nhập liệu (`ctbhd`)

| Phím      | Hành động                   |
| :-------- | :-------------------------- |
| `F4`      | Chọn tài khoản (trong lưới) |
| `F8`      | Xóa dòng hàng (trong lưới)  |
| `Ctrl+F7` | Xem trước                   |
| `Enter`   | Lưu / Chấp nhận             |
| `Esc`     | Hủy bỏ                      |

### Form chọn phiếu xuất (`ctbhch`)

| Phím                     | Hành động             |
| :----------------------- | :-------------------- |
| `Space`                  | Đánh dấu phiếu        |
| `Ctrl+A` / `Ctrl+U`      | Chọn tất cả / Bỏ chọn |
| `Ctrl+Home` / `Ctrl+End` | Về phiếu đầu / cuối   |
| `Enter`                  | Chấp nhận             |
| `Esc`                    | Hủy bỏ                |

> ⚠️ Không tự ý đổi sang tổ hợp khác (ví dụ KHÔNG dùng `Ctrl+N` thay `F2`).

---

## 📐 Quy chuẩn Nghiệp vụ & Kỹ thuật

1. **Đẳng thức tổng thanh toán tối hậu:**  
   $$\mathbf{TTien\_Nt0 = TTien\_Nt2 + TTien\_Nt3}$$  
   Triệt tiêu hoàn toàn lỗi trừ kép chiết khấu lịch sử.
2. **Quy chuẩn bảo vệ giá vốn (Fix #21):**  
   Tuyệt đối không gán giá vốn `Gia_Nt` từ đơn giá bán `Gia_Nt9`.
3. **Quy cách hàng Mút xốp (`Loai_Vt = '2'`):**  
   Thuật toán `Calc_Loai2`: $\text{Số lượng} = \text{Số tấm} \times \text{Hệ số độ dày}$.
4. **Chuyển đổi Unicode hai chiều:**  
   Xử lý TCVN3 sang Unicode NFC thông qua module `app.utils.unicode`.
