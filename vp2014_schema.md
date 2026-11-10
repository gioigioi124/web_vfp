# 📊 Cấu trúc Database VP_2014 & VTSYS

> Tự động trích xuất cấu trúc bảng của VP_2014 và VTSYS

## 🗄️ Database: VP_2014

**Tổng số bảng:** 41

### Danh sách các bảng

| STT | Schema | Tên Bảng | Số Dữ Liệu (Rows) |
|-----|--------|----------|-------------------|
| 1 | dbo | **BG** | 0 |
| 2 | dbo | **BG0** | 0 |
| 3 | dbo | **CdCt** | 0 |
| 4 | dbo | **CdCt0** | 0 |
| 5 | dbo | **CdK** | 0 |
| 6 | dbo | **CdkN** | 0 |
| 7 | dbo | **CdNTXT** | 0 |
| 8 | dbo | **CdNTXT0** | 0 |
| 9 | dbo | **CdZ** | 0 |
| 10 | dbo | **CtBH** | 0 |
| 11 | dbo | **CtBH0** | 0 |
| 12 | dbo | **CtCK** | 0 |
| 13 | dbo | **CtCK0** | 0 |
| 14 | dbo | **CtGS** | 0 |
| 15 | dbo | **CtK** | 0 |
| 16 | dbo | **CtK0** | 0 |
| 17 | dbo | **CtMH** | 0 |
| 18 | dbo | **CtMH0** | 0 |
| 19 | dbo | **CtN** | 0 |
| 20 | dbo | **CtNX** | 0 |
| 21 | dbo | **CtNX0** | 0 |
| 22 | dbo | **CtSX** | 0 |
| 23 | dbo | **CtSX0** | 0 |
| 24 | dbo | **CtT** | 0 |
| 25 | dbo | **CtT0** | 0 |
| 26 | dbo | **CtTG** | 0 |
| 27 | dbo | **CtTG0** | 0 |
| 28 | dbo | **CtTP** | 0 |
| 29 | dbo | **CtTP0** | 0 |
| 30 | dbo | **CtU** | 0 |
| 31 | dbo | **CtVAT** | 0 |
| 32 | dbo | **History_Ct** | 0 |
| 33 | dbo | **History_CtK** | 0 |
| 34 | dbo | **History_CtK0** | 0 |
| 35 | dbo | **History_CtT** | 0 |
| 36 | dbo | **History_CtT0** | 0 |
| 37 | dbo | **So_LuongDD** | 0 |
| 38 | dbo | **So_LuongHT** | 0 |
| 39 | dbo | **SoCai** | 0 |
| 40 | dbo | **SoCaiVT** | 0 |
| 41 | dbo | **ZChiTiet** | 0 |

---

### Chi tiết cấu trúc từng bảng (VP_2014)

#### Bảng: `dbo.BG`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | char | 20 | NO | ✅ |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Ngay_Ct | datetime | — | NO |  |  |
| So_Ct | char | 20 | YES |  |  |
| Ma_Dt | char | 16 | YES |  |  |
| Ma_Vm | char | 8 | YES |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Ty_Gia | numeric | — | NO |  |  |
| Ngay_Ct1 | datetime | — | YES |  |  |
| Ngay_Ct2 | datetime | — | YES |  |  |
| UserName | char | 16 | YES |  |  |
| Confirmed | bit | — | YES |  |  |
| Closed | char | 1 | YES |  |  |

---

#### Bảng: `dbo.BG0`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt0 | char | 20 | NO | ✅ |  |
| Stt | char | 20 | NO |  |  |
| Ma_Vt | char | 16 | YES |  |  |
| Dvt | varchar | 8 | YES |  |  |
| Gia | numeric | — | YES |  |  |
| CK | numeric | — | YES |  |  |

---

#### Bảng: `dbo.CdCt`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt_Tt | char | 20 | NO | ✅ |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Ngay_Ct | datetime | — | NO |  |  |
| So_Ct | char | 20 | YES |  |  |
| Ngay_LC | datetime | — | YES |  |  |
| So_LC | char | 20 | YES |  |  |
| Dien_Giai1 | nvarchar | 128 | YES |  |  |
| Dien_Giai2 | nvarchar | 128 | YES |  |  |
| Ma_Dt | char | 16 | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Han_Tt | int | — | YES |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Ty_Gia | numeric | — | YES |  |  |
| Ps_No_Nt | numeric | — | YES |  |  |
| Ps_No | numeric | — | YES |  |  |
| Ps_Co_Nt | numeric | — | YES |  |  |
| Ps_Co | numeric | — | YES |  |  |

---

#### Bảng: `dbo.CdCt0`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Htt0ID | bigint | — | NO | ✅ |  |
| No_Co | char | 1 | NO |  |  |
| Tk | char | 16 | NO |  |  |
| Ma_Dt | char | 16 | YES |  |  |
| Stt_Tt | char | 20 | NO |  |  |
| Stt_Tt0 | char | 20 | NO |  |  |
| Tien_Nt | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |

---

#### Bảng: `dbo.CdK`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| CdkID | bigint | — | NO | ✅ |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Tk | char | 16 | NO |  |  |
| Ma_Dt | char | 16 | YES |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Du_No | numeric | — | YES |  |  |
| Du_Co | numeric | — | YES |  |  |
| Du_No_Nt | numeric | — | YES |  |  |
| Du_Co_Nt | numeric | — | YES |  |  |
| Du_No0 | numeric | — | YES |  |  |
| Du_Co0 | numeric | — | YES |  |  |
| Du_No_Nt0 | numeric | — | YES |  |  |
| Du_Co_Nt0 | numeric | — | YES |  |  |

---

#### Bảng: `dbo.CdkN`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| CdkNID | bigint | — | NO | ✅ |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Tk | char | 16 | NO |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Du_No | numeric | — | YES |  |  |
| Du_No_Nt | numeric | — | YES |  |  |
| Du_Co | numeric | — | YES |  |  |
| Du_Co_Nt | numeric | — | YES |  |  |
| Du_No0 | numeric | — | YES |  |  |
| Du_No_Nt0 | numeric | — | YES |  |  |
| Du_Co0 | numeric | — | YES |  |  |
| Du_Co_Nt0 | numeric | — | YES |  |  |

---

#### Bảng: `dbo.CdNTXT`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt0 | char | 20 | NO | ✅ |  |
| Ma_DvCs | char | 2 | YES |  |  |
| Ma_Tte | char | 3 | YES |  |  |
| Ma_Kho | char | 16 | YES |  |  |
| Ma_Vt | char | 16 | YES |  |  |
| Dvt | varchar | 8 | YES |  |  |
| He_So9 | numeric | — | YES |  |  |
| So_Luong9 | numeric | — | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Tien_Nt | numeric | — | YES |  |  |
| Ngay_Ct | datetime | — | YES |  |  |

---

#### Bảng: `dbo.CdNTXT0`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| CdNTXT0ID | bigint | — | NO | ✅ |  |
| Stt0 | char | 20 | YES |  |  |
| Stt0_PX | char | 20 | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Tien_Nt | numeric | — | YES |  |  |

---

#### Bảng: `dbo.CdZ`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| CdZID | bigint | — | NO | ✅ |  |
| Ma_Dvcs | char | 2 | NO |  |  |
| Nam | int | — | YES |  |  |
| Thang | int | — | YES |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| Ma_Yt | char | 16 | YES |  |  |
| Ma_Dm_Sp | char | 16 | YES |  |  |
| Ma_Vt_Nh | char | 1 | YES |  |  |
| SL_Xuat | numeric | — | YES |  |  |
| Tien_Xuat | numeric | — | YES |  |  |
| Ton_Cuoi | numeric | — | YES |  |  |
| Du_Cuoi | numeric | — | YES |  |  |
| Loai_DD | char | 1 | YES |  |  |

---

#### Bảng: `dbo.CtBH`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | char | 20 | NO | ✅ |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Ma_Ct | char | 2 | NO |  |  |
| Nh_Ct | char | 1 | NO |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Ty_Gia | numeric | — | NO |  |  |
| Ngay_Ps | datetime | — | NO |  |  |
| Ngay_Ct | datetime | — | NO |  |  |
| So_Ct | char | 20 | YES |  |  |
| Ma_Xe | char | 8 | YES |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| Ma_HD | char | 16 | YES |  |  |
| Ma_Dt | char | 16 | NO |  |  |
| Ma_Nx | char | 16 | YES |  |  |
| Tk2 | char | 16 | YES |  |  |
| Tk3 | char | 16 | YES |  |  |
| Tk_Du3 | char | 16 | YES |  |  |
| Tk4 | char | 16 | YES |  |  |
| Ong_Ba | nvarchar | 64 | YES |  |  |
| Dia_Chi | nvarchar | 64 | YES |  |  |
| Dien_Giai0 | nvarchar | 128 | YES |  |  |
| Desc_EN0 | nvarchar | 128 | YES |  |  |
| TTien_Nt | numeric | — | YES |  |  |
| TTien_Nt0 | numeric | — | YES |  |  |
| TTien_Nt2 | numeric | — | YES |  |  |
| TTien_Nt3 | numeric | — | YES |  |  |
| TTien_Nt4 | numeric | — | YES |  |  |
| TTien | numeric | — | YES |  |  |
| TTien0 | numeric | — | YES |  |  |
| TTien3 | numeric | — | YES |  |  |
| TTien2 | numeric | — | YES |  |  |
| TTien4 | numeric | — | YES |  |  |
| Loai_Ck | char | 1 | YES |  |  |
| TyLeCK | numeric | — | YES |  |  |
| Han_Tt | int | — | YES |  |  |
| Ma_Thue | char | 4 | YES |  |  |
| Thue_GTGT | numeric | — | YES |  |  |
| Ma_DtGtGt | char | 20 | YES |  |  |
| Ten_DtGtGt | nvarchar | 128 | YES |  |  |
| So_Ct0 | char | 20 | YES |  |  |
| Ngay_Ct0 | datetime | — | YES |  |  |
| Stt_HBTL | char | 20 | YES |  |  |
| Confirmed | bit | — | YES |  |  |
| Posted | bit | — | YES |  |  |
| Printed | bit | — | YES |  |  |
| UserName | char | 16 | YES |  |  |

---

#### Bảng: `dbo.CtBH0`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt_PX | char | 20 | YES |  |  |
| Stt0 | char | 20 | NO | ✅ |  |
| Stt | char | 20 | NO |  |  |
| Tk | char | 16 | YES |  |  |
| Tk_Du | char | 16 | YES |  |  |
| Tk_Du2 | char | 16 | YES |  |  |
| Tk_Du4 | char | 16 | YES |  |  |
| Ma_Kho | char | 16 | YES |  |  |
| Ma_Vt | char | 16 | YES |  |  |
| Dvt | varchar | 8 | YES |  |  |
| Dvt_Ban | varchar | 8 | YES |  |  |
| So_Tam | numeric | — | YES |  |  |
| He_So8 | numeric | — | YES |  |  |
| So_Luong8 | numeric | — | YES |  |  |
| He_So9 | numeric | — | YES |  |  |
| So_Luong9 | numeric | — | YES |  |  |
| Gia_Nt9 | numeric | — | YES |  |  |
| Gia9 | numeric | — | YES |  |  |
| Tien_Nt9 | numeric | — | YES |  |  |
| Tien9 | numeric | — | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| Gia_Nt | numeric | — | YES |  |  |
| Gia | numeric | — | YES |  |  |
| Tien_Nt | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Gia_Nt2 | numeric | — | YES |  |  |
| Gia2 | numeric | — | YES |  |  |
| Tien_Nt2 | numeric | — | YES |  |  |
| Tien2 | numeric | — | YES |  |  |
| Tien_Nt3 | numeric | — | YES |  |  |
| Tien3 | numeric | — | YES |  |  |
| Chiet_Khau | numeric | — | YES |  |  |
| Tien_Nt4 | numeric | — | YES |  |  |
| Tien4 | numeric | — | YES |  |  |
| Gia_Tb_TT | char | 1 | YES |  |  |

---

#### Bảng: `dbo.CtCK`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | char | 20 | NO | ✅ |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Ma_Ct | char | 2 | NO |  |  |
| Nh_Ct | char | 1 | NO |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Ty_Gia | numeric | — | NO |  |  |
| TTien_Nt | numeric | — | YES |  |  |
| TTien | numeric | — | YES |  |  |
| Ngay_Ps | datetime | — | NO |  |  |
| Ngay_Ct | datetime | — | NO |  |  |
| So_Ct | char | 20 | YES |  |  |
| Ma_HD | char | 16 | YES |  |  |
| Ma_Dt | char | 16 | NO |  |  |
| Ong_Ba | nvarchar | 64 | YES |  |  |
| Dia_Chi | nvarchar | 64 | YES |  |  |
| Dien_Giai0 | nvarchar | 128 | YES |  |  |
| Desc_EN0 | nvarchar | 128 | YES |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| Ma_Km | char | 16 | YES |  |  |
| Ma_Nx | char | 16 | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Ma_Xe | char | 8 | YES |  |  |
| UserName | char | 16 | YES |  |  |
| Posted | bit | — | YES |  |  |
| Confirmed | bit | — | YES |  |  |
| Printed | bit | — | YES |  |  |
| Stt_PX | char | 20 | YES |  |  |

---

#### Bảng: `dbo.CtCK0`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt0 | char | 20 | NO | ✅ |  |
| Stt | char | 20 | NO |  |  |
| Tk | char | 16 | YES |  |  |
| Tk_Du | char | 16 | YES |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| Ma_Kho | char | 16 | YES |  |  |
| Ma_KhoN | char | 16 | YES |  |  |
| Ma_Vt | char | 16 | YES |  |  |
| Dvt | varchar | 8 | YES |  |  |
| He_So9 | numeric | — | YES |  |  |
| So_Luong9 | numeric | — | YES |  |  |
| Gia_Nt9 | numeric | — | YES |  |  |
| Gia9 | numeric | — | YES |  |  |
| Tien_Nt9 | numeric | — | YES |  |  |
| Tien9 | numeric | — | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| Gia_Nt | numeric | — | YES |  |  |
| Gia | numeric | — | YES |  |  |
| Tien_Nt | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Gia_Tb_TT | char | 1 | YES |  |  |
| Stt_PX | char | 20 | YES |  |  |

---

#### Bảng: `dbo.CtGS`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | char | 20 | NO | ✅ |  |
| Ma_Dvcs | char | 2 | NO |  |  |
| Ngay_Ct | datetime | — | YES |  |  |
| So_Ct | char | 20 | YES |  |  |
| Dien_Giai | nvarchar | 128 | YES |  |  |
| Tien_Nt | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Ngay_Ct1 | datetime | — | YES |  |  |
| Ngay_Ct2 | datetime | — | YES |  |  |
| Stt_Ct | char | 20 | YES |  |  |

---

#### Bảng: `dbo.CtK`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | char | 20 | NO | ✅ |  |
| Stt_Auto | char | 20 | YES |  |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Ma_Ct | char | 2 | NO |  |  |
| Nh_Ct | char | 1 | NO |  |  |
| So_Ct | char | 20 | YES |  |  |
| Ngay_Ct | datetime | — | YES |  |  |
| Ma_Dt | char | 16 | YES |  |  |
| Ong_Ba | nvarchar | 64 | YES |  |  |
| Dia_Chi | nvarchar | 64 | YES |  |  |
| Dien_Giai0 | nvarchar | 128 | YES |  |  |
| Desc_EN0 | nvarchar | 128 | YES |  |  |
| Ct_Di_Kem | char | 20 | YES |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Ty_Gia | numeric | — | YES |  |  |
| TTien_Nt | numeric | — | YES |  |  |
| TTien | numeric | — | YES |  |  |
| Confirmed | bit | — | YES |  |  |
| UserName | char | 16 | YES |  |  |
| Printed | bit | — | YES |  |  |

---

#### Bảng: `dbo.CtK0`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt0 | char | 20 | NO | ✅ |  |
| Stt | char | 20 | NO |  |  |
| Stt_NV | int | — | YES |  |  |
| Dien_Giai | nvarchar | 128 | YES |  |  |
| Desc_EN | nvarchar | 128 | YES |  |  |
| No_Co | char | 1 | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Tien_Nt | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Ma_Hd | char | 16 | YES |  |  |
| Ma_Dt | char | 16 | YES |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| Ma_Km | char | 16 | YES |  |  |

---

#### Bảng: `dbo.CtMH`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | char | 20 | NO | ✅ |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Ma_Ct | char | 2 | NO |  |  |
| Nh_Ct | char | 1 | NO |  |  |
| Ngay_Ct | datetime | — | NO |  |  |
| So_Ct | char | 20 | YES |  |  |
| Ma_HD | char | 16 | YES |  |  |
| Ma_Dt | char | 16 | NO |  |  |
| Ong_Ba | nvarchar | 64 | YES |  |  |
| Dia_Chi | nvarchar | 64 | YES |  |  |
| Dien_Giai0 | nvarchar | 128 | YES |  |  |
| Desc_EN0 | nvarchar | 128 | YES |  |  |
| Ma_Nx | char | 16 | YES |  |  |
| Ma_Km | char | 16 | YES |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| Ma_Xe | char | 8 | YES |  |  |
| TTien_Nt | numeric | — | YES |  |  |
| TTien_Nt0 | numeric | — | YES |  |  |
| TTien_Nt3 | numeric | — | YES |  |  |
| TTien_Nt5 | numeric | — | YES |  |  |
| TTien | numeric | — | YES |  |  |
| TTien0 | numeric | — | YES |  |  |
| TTien3 | numeric | — | YES |  |  |
| TTien5 | numeric | — | YES |  |  |
| Ma_Thue | char | 4 | YES |  |  |
| Thue_GTGT | numeric | — | YES |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Ty_Gia | numeric | — | NO |  |  |
| Posted | bit | — | YES |  |  |
| UserName | char | 16 | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Tk3 | char | 16 | YES |  |  |
| Tk_Du3 | char | 16 | YES |  |  |
| Tk5 | char | 16 | YES |  |  |
| Han_Tt | int | — | YES |  |  |
| Ma_DtGtGt | char | 20 | YES |  |  |
| Ten_DtGtGt | nvarchar | 128 | YES |  |  |
| So_Seri0 | char | 20 | YES |  |  |
| So_Ct0 | char | 20 | YES |  |  |
| Ngay_Ct0 | datetime | — | YES |  |  |
| Confirmed | bit | — | YES |  |  |
| Printed | bit | — | YES |  |  |
| Ngay_Ps | datetime | — | NO |  |  |

---

#### Bảng: `dbo.CtMH0`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt0 | char | 20 | NO | ✅ |  |
| Stt | char | 20 | NO |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| Ma_Kho | char | 16 | YES |  |  |
| Ma_Vt | char | 16 | YES |  |  |
| Dvt | varchar | 8 | YES |  |  |
| He_So9 | numeric | — | YES |  |  |
| So_Luong9 | numeric | — | YES |  |  |
| Gia_Nt9 | numeric | — | YES |  |  |
| Gia9 | numeric | — | YES |  |  |
| Tien_Nt9 | numeric | — | YES |  |  |
| Tien9 | numeric | — | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| Gia_Nt | numeric | — | YES |  |  |
| Gia | numeric | — | YES |  |  |
| Tien_Nt | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Tien_Nt3 | numeric | — | YES |  |  |
| Tien3 | numeric | — | YES |  |  |
| Tien_Nt5 | numeric | — | YES |  |  |
| Tien5 | numeric | — | YES |  |  |
| Gia_Tb_TT | char | 1 | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Tk_Du | char | 16 | YES |  |  |
| Tk_Du5 | char | 16 | YES |  |  |
| Stt_PN | char | 20 | YES |  |  |

---

#### Bảng: `dbo.CtN`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| CtNID | bigint | — | NO | ✅ |  |
| Ma_Dvcs | char | 2 | NO |  |  |
| Ngay_Ct | datetime | — | YES |  |  |
| So_Ct | char | 20 | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Ma_Hd | char | 16 | YES |  |  |
| Ma_Dt | char | 16 | YES |  |  |
| Ma_Vt | char | 16 | YES |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Dien_Giai | nvarchar | 128 | YES |  |  |
| Ps_No | numeric | — | YES |  |  |
| Ps_No_Nt | numeric | — | YES |  |  |
| Ps_Co | numeric | — | YES |  |  |
| Ps_Co_Nt | numeric | — | YES |  |  |

---

#### Bảng: `dbo.CtNX`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | char | 20 | NO | ✅ |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Ma_Ct | char | 2 | NO |  |  |
| Nh_Ct | char | 1 | NO |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Ty_Gia | numeric | — | NO |  |  |
| TTien_Nt | numeric | — | YES |  |  |
| TTien | numeric | — | YES |  |  |
| Ngay_Ps | datetime | — | NO |  |  |
| Ngay_Ct | datetime | — | NO |  |  |
| So_Ct | char | 20 | YES |  |  |
| Ma_HD | char | 16 | YES |  |  |
| Ma_Dt | char | 16 | NO |  |  |
| Ong_Ba | nvarchar | 64 | YES |  |  |
| Dia_Chi | nvarchar | 64 | YES |  |  |
| Dien_Giai0 | nvarchar | 128 | YES |  |  |
| Desc_EN0 | nvarchar | 128 | YES |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| Ma_Km | char | 16 | YES |  |  |
| Ma_Nx | char | 16 | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Ma_Xe | char | 8 | YES |  |  |
| UserName | char | 16 | YES |  |  |
| Posted | bit | — | YES |  |  |
| Confirmed | bit | — | YES |  |  |
| Printed | bit | — | YES |  |  |

---

#### Bảng: `dbo.CtNX0`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt0 | char | 20 | NO | ✅ |  |
| Stt | char | 20 | NO |  |  |
| Tk | char | 16 | YES |  |  |
| Tk_Du | char | 16 | YES |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| Ma_Kho | char | 16 | YES |  |  |
| Ma_Vt | char | 16 | YES |  |  |
| Dvt | varchar | 8 | YES |  |  |
| He_So9 | numeric | — | YES |  |  |
| So_Luong9 | numeric | — | YES |  |  |
| Gia_Nt9 | numeric | — | YES |  |  |
| Gia9 | numeric | — | YES |  |  |
| Tien_Nt9 | numeric | — | YES |  |  |
| Tien9 | numeric | — | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| Gia_Nt | numeric | — | YES |  |  |
| Gia | numeric | — | YES |  |  |
| Tien_Nt | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Gia_Tb_TT | char | 1 | YES |  |  |
| Stt_PX | char | 20 | YES |  |  |

---

#### Bảng: `dbo.CtSX`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | char | 20 | NO | ✅ |  |
| Ma_Dvcs | char | 2 | NO |  |  |
| Ngay_Ct | datetime | — | YES |  |  |
| So_Ct | char | 20 | YES |  |  |
| Ma_Vt | char | 16 | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| Loai_Ct | char | 1 | YES |  |  |
| Ngay_CtX | datetime | — | YES |  |  |
| So_CtX | char | 20 | YES |  |  |
| Ma_Dt | char | 16 | YES |  |  |
| Ong_Ba | nvarchar | 64 | YES |  |  |
| Dia_Chi | nvarchar | 64 | YES |  |  |
| Dien_Giai | nvarchar | 128 | YES |  |  |
| Ma_Nx | char | 16 | YES |  |  |
| Ma_Kho | char | 16 | YES |  |  |
| Ma_KhoN | char | 16 | YES |  |  |
| UserName | char | 16 | YES |  |  |
| Confirmed | bit | — | YES |  |  |
| Lap_CtX | char | 1 | YES |  |  |
| Printed | bit | — | YES |  |  |

---

#### Bảng: `dbo.CtSX0`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt0 | char | 20 | NO | ✅ |  |
| Stt | char | 20 | NO |  |  |
| Loai_Yt | char | 1 | YES |  |  |
| Ma_Vt_Nh | char | 1 | YES |  |  |
| Ma_Vt | char | 16 | YES |  |  |
| Dinh_Muc | numeric | — | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| So_Luong0 | numeric | — | YES |  |  |

---

#### Bảng: `dbo.CtT`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | char | 20 | NO | ✅ |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Ma_Ct | char | 2 | NO |  |  |
| Kieu_Ct | char | 1 | YES |  |  |
| Nh_Ct | char | 1 | NO |  |  |
| Ngay_Ct | datetime | — | NO |  |  |
| So_Ct | char | 20 | YES |  |  |
| So_Seri | char | 20 | YES |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Ty_Gia | numeric | — | NO |  |  |
| Ma_Dt0 | char | 16 | YES |  |  |
| Ong_Ba | nvarchar | 64 | YES |  |  |
| Dia_Chi | nvarchar | 64 | YES |  |  |
| Dien_Giai0 | nvarchar | 128 | YES |  |  |
| Desc_EN0 | nvarchar | 128 | YES |  |  |
| TTien_Nt | numeric | — | YES |  |  |
| TTien | numeric | — | YES |  |  |
| TTien_Nt3 | numeric | — | YES |  |  |
| TTien3 | numeric | — | YES |  |  |
| TTien_Nt0 | numeric | — | YES |  |  |
| TTien0 | numeric | — | YES |  |  |
| Han_Tt | int | — | YES |  |  |
| Ct_Di_Kem | nvarchar | 128 | YES |  |  |
| So_Ct0 | char | 20 | YES |  |  |
| Ngay_Ct0 | datetime | — | YES |  |  |
| UserName | char | 16 | YES |  |  |
| Posted | bit | — | YES |  |  |
| Confirmed | bit | — | YES |  |  |
| Printed | bit | — | YES |  |  |

---

#### Bảng: `dbo.CtT0`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | char | 20 | NO |  |  |
| Stt0 | char | 20 | NO | ✅ |  |
| Tien_Nt | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Tien_Nt3 | numeric | — | YES |  |  |
| Tien3 | numeric | — | YES |  |  |
| Ma_Dt | char | 16 | YES |  |  |
| Ma_Hd | char | 16 | YES |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| Ma_Km | char | 16 | YES |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| Tk_No | char | 16 | YES |  |  |
| Tk_Co | char | 16 | YES |  |  |
| Tk_No3 | char | 16 | YES |  |  |
| Tk_Co3 | char | 16 | YES |  |  |
| Dien_Giai | nvarchar | 128 | YES |  |  |
| Desc_EN | nvarchar | 128 | YES |  |  |
| Ma_Thue | char | 4 | YES |  |  |
| Thue_GtGt | numeric | — | YES |  |  |
| Ma_DtGtGt | char | 20 | YES |  |  |
| Ten_DtGtGt | nvarchar | 128 | YES |  |  |
| Ngay_Ct0 | datetime | — | YES |  |  |
| So_Ct0 | char | 20 | YES |  |  |
| So_Seri0 | char | 20 | YES |  |  |
| Loai_VAT | char | 1 | YES |  |  |
| Dieu_Chinh | char | 1 | YES |  |  |
| Stt_Nv | int | — | YES |  |  |

---

#### Bảng: `dbo.CtTG`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | char | 20 | NO | ✅ |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Ma_Ct | char | 2 | NO |  |  |
| Nh_Ct | char | 1 | NO |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Ty_Gia | numeric | — | NO |  |  |
| TTien_Nt | numeric | — | YES |  |  |
| TTien | numeric | — | YES |  |  |
| Ngay_Ps | datetime | — | NO |  |  |
| Ngay_Ct | datetime | — | NO |  |  |
| So_Ct | char | 20 | YES |  |  |
| Ma_HD | char | 16 | YES |  |  |
| Ma_Dt | char | 16 | NO |  |  |
| Ong_Ba | nvarchar | 64 | YES |  |  |
| Dia_Chi | nvarchar | 64 | YES |  |  |
| Dien_Giai0 | nvarchar | 128 | YES |  |  |
| Desc_EN0 | nvarchar | 128 | YES |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| Ma_Km | char | 16 | YES |  |  |
| Ma_Nx | char | 16 | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Ma_Xe | char | 8 | YES |  |  |
| UserName | char | 16 | YES |  |  |
| Posted | bit | — | YES |  |  |
| Confirmed | bit | — | YES |  |  |
| Printed | bit | — | YES |  |  |

---

#### Bảng: `dbo.CtTG0`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt0 | char | 20 | NO | ✅ |  |
| Stt | char | 20 | NO |  |  |
| Tk | char | 16 | YES |  |  |
| Tk_Du | char | 16 | YES |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| Ma_Kho | char | 16 | YES |  |  |
| Ma_KhoN | char | 16 | YES |  |  |
| Ma_Vt | char | 16 | YES |  |  |
| Dvt | varchar | 8 | YES |  |  |
| He_So9 | numeric | — | YES |  |  |
| So_Luong9 | numeric | — | YES |  |  |
| Gia_Nt9 | numeric | — | YES |  |  |
| Gia9 | numeric | — | YES |  |  |
| Tien_Nt9 | numeric | — | YES |  |  |
| Tien9 | numeric | — | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| Gia_Nt | numeric | — | YES |  |  |
| Gia | numeric | — | YES |  |  |
| Tien_Nt | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Gia_Tb_TT | char | 1 | YES |  |  |

---

#### Bảng: `dbo.CtTP`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | char | 20 | NO | ✅ |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Ma_Ct | char | 2 | NO |  |  |
| Nh_Ct | char | 1 | NO |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Ty_Gia | numeric | — | NO |  |  |
| TTien_Nt | numeric | — | YES |  |  |
| TTien | numeric | — | YES |  |  |
| Ngay_Ps | datetime | — | NO |  |  |
| Ngay_Ct | datetime | — | NO |  |  |
| So_Ct | char | 20 | YES |  |  |
| Ma_HD | char | 16 | YES |  |  |
| Ma_Dt | char | 16 | NO |  |  |
| Ong_Ba | nvarchar | 64 | YES |  |  |
| Dia_Chi | nvarchar | 64 | YES |  |  |
| Dien_Giai0 | nvarchar | 128 | YES |  |  |
| Desc_EN0 | nvarchar | 128 | YES |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| Ma_Km | char | 16 | YES |  |  |
| Ma_Nx | char | 16 | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Ma_Xe | char | 8 | YES |  |  |
| UserName | char | 16 | YES |  |  |
| Posted | bit | — | YES |  |  |
| Confirmed | bit | — | YES |  |  |
| Printed | bit | — | YES |  |  |

---

#### Bảng: `dbo.CtTP0`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt0 | char | 20 | NO | ✅ |  |
| Stt | char | 20 | NO |  |  |
| Tk | char | 16 | YES |  |  |
| Tk_Du | char | 16 | YES |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| Ma_Kho | char | 16 | YES |  |  |
| Ma_Vt | char | 16 | YES |  |  |
| Dvt | varchar | 8 | YES |  |  |
| He_So9 | numeric | — | YES |  |  |
| So_Luong9 | numeric | — | YES |  |  |
| Gia_Nt9 | numeric | — | YES |  |  |
| Gia9 | numeric | — | YES |  |  |
| Tien_Nt9 | numeric | — | YES |  |  |
| Tien9 | numeric | — | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| Gia_Nt | numeric | — | YES |  |  |
| Gia | numeric | — | YES |  |  |
| Tien_Nt | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Gia_Tb_TT | char | 1 | YES |  |  |
| Stt_PN | char | 20 | YES |  |  |

---

#### Bảng: `dbo.CtU`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | char | 20 | NO | ✅ |  |
| Ten_Dvi_A | nvarchar | 64 | YES |  |  |
| Tk_NH_A | char | 20 | YES |  |  |
| Ten_NH_A | nvarchar | 64 | YES |  |  |
| Ten_TP_A | nvarchar | 64 | YES |  |  |
| Ten_Dvi_B | nvarchar | 64 | YES |  |  |
| Tk_NH_B | char | 20 | YES |  |  |
| Ten_NH_B | nvarchar | 64 | YES |  |  |
| Ten_TP_B | nvarchar | 64 | YES |  |  |

---

#### Bảng: `dbo.CtVAT`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| VATID | bigint | — | NO | ✅ |  |
| Ma_Dvcs | char | 2 | NO |  |  |
| Stt | char | 20 | NO |  |  |
| Ngay_Ct | datetime | — | YES |  |  |
| Ngay_Ct0 | datetime | — | YES |  |  |
| So_Ct0 | char | 20 | YES |  |  |
| So_Seri0 | char | 20 | YES |  |  |
| Dien_Giai | nvarchar | 128 | YES |  |  |
| Ghi_Chu | nvarchar | 128 | YES |  |  |
| Ma_DtGTGT | char | 20 | YES |  |  |
| Ten_DtGTGT | nvarchar | 64 | YES |  |  |
| Thue_GTGT | numeric | — | YES |  |  |
| Tk | char | 16 | YES |  |  |
| No_Co | char | 1 | YES |  |  |
| Tk_Du | char | 16 | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| Gia | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Tien3 | numeric | — | YES |  |  |
| Dieu_Chinh | char | 1 | YES |  |  |
| Loai_VAT | char | 1 | YES |  |  |
| UserName | char | 16 | YES |  |  |

---

#### Bảng: `dbo.History_Ct`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Ma_Dvcs | char | 2 | NO |  |  |
| Stt | char | 20 | YES |  |  |
| Ma_Nvu | char | 1 | YES |  |  |
| Ma_Ct | char | 2 | YES |  |  |
| Kieu_Ct | char | 1 | YES |  |  |
| Ngay_Ct | datetime | — | YES |  |  |
| So_Ct | char | 20 | YES |  |  |
| Dien_Giai | nvarchar | 128 | YES |  |  |
| Creator | char | 16 | YES |  |  |
| CrtTime | datetime | — | YES |  |  |
| Deletor | char | 16 | YES |  |  |
| DelTime | datetime | — | YES |  |  |

---

#### Bảng: `dbo.History_CtK`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt_Log | bigint | — | NO | ✅ |  |
| Stt | char | 20 | NO |  |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Ma_Ct | char | 2 | NO |  |  |
| Nh_Ct | char | 1 | NO |  |  |
| So_Ct | char | 20 | YES |  |  |
| Ngay_Ct | datetime | — | YES |  |  |
| Ma_Dt | char | 16 | YES |  |  |
| Ong_Ba | nvarchar | 64 | YES |  |  |
| Dia_Chi | nvarchar | 64 | YES |  |  |
| Dien_Giai0 | nvarchar | 128 | YES |  |  |
| Desc_EN0 | nvarchar | 128 | YES |  |  |
| Ct_Di_Kem | char | 20 | YES |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Ty_Gia | numeric | — | YES |  |  |
| TTien_Nt | numeric | — | YES |  |  |
| TTien | numeric | — | YES |  |  |
| Confirmed | bit | — | YES |  |  |
| UserName | char | 16 | YES |  |  |
| Updator | char | 16 | YES |  |  |
| UdtTime | datetime | — | YES |  |  |

---

#### Bảng: `dbo.History_CtK0`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt_Log | bigint | — | NO |  |  |
| Stt0 | char | 20 | NO |  |  |
| Stt | char | 20 | NO |  |  |
| Stt_NV | int | — | YES |  |  |
| Dien_Giai | nvarchar | 128 | YES |  |  |
| Desc_EN | nvarchar | 128 | YES |  |  |
| No_Co | char | 1 | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Tien_Nt | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Ma_Dt | char | 16 | YES |  |  |
| Ma_Hd | char | 16 | YES |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| Ma_Km | char | 16 | YES |  |  |

---

#### Bảng: `dbo.History_CtT`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt_Log | bigint | — | NO | ✅ |  |
| Stt | char | 20 | NO |  |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Ma_Ct | char | 2 | NO |  |  |
| Kieu_Ct | char | 1 | YES |  |  |
| Nh_Ct | char | 1 | NO |  |  |
| Ngay_Ct | datetime | — | NO |  |  |
| So_Ct | char | 20 | YES |  |  |
| So_Seri | char | 20 | YES |  |  |
| Ma_Dt0 | char | 16 | YES |  |  |
| Ong_Ba | nvarchar | 64 | YES |  |  |
| Dia_Chi | nvarchar | 64 | YES |  |  |
| Dien_Giai0 | nvarchar | 128 | YES |  |  |
| Desc_EN0 | nvarchar | 128 | YES |  |  |
| TTien_Nt | numeric | — | YES |  |  |
| TTien_Nt0 | numeric | — | YES |  |  |
| TTien_Nt3 | numeric | — | YES |  |  |
| TTien | numeric | — | YES |  |  |
| TTien0 | numeric | — | YES |  |  |
| TTien3 | numeric | — | YES |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Ty_Gia | numeric | — | NO |  |  |
| Posted | bit | — | YES |  |  |
| UserName | char | 16 | YES |  |  |
| Han_Tt | int | — | YES |  |  |
| Ct_Di_Kem | nvarchar | 128 | YES |  |  |
| So_Ct0 | char | 20 | YES |  |  |
| Ngay_Ct0 | datetime | — | YES |  |  |
| Confirmed | bit | — | YES |  |  |
| Updator | char | 16 | YES |  |  |
| UdtTime | datetime | — | YES |  |  |

---

#### Bảng: `dbo.History_CtT0`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt_Log | bigint | — | NO |  |  |
| Stt0 | char | 20 | NO |  |  |
| Stt | char | 20 | NO |  |  |
| Tien_Nt | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Tien_Nt3 | numeric | — | YES |  |  |
| Tien3 | numeric | — | YES |  |  |
| Ma_Dt | char | 16 | YES |  |  |
| Ma_Hd | char | 16 | YES |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| Ma_Km | char | 16 | YES |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| Tk_No | char | 16 | YES |  |  |
| Tk_Co | char | 16 | YES |  |  |
| Tk_No3 | char | 16 | YES |  |  |
| Tk_Co3 | char | 16 | YES |  |  |
| Dien_Giai | nvarchar | 128 | YES |  |  |
| Desc_EN | nvarchar | 128 | YES |  |  |
| Ma_Thue | char | 4 | YES |  |  |
| Thue_GTGT | numeric | — | YES |  |  |
| Ma_DtGtGt | char | 20 | YES |  |  |
| Ten_DtGtGt | nvarchar | 128 | YES |  |  |
| Ngay_Ct0 | datetime | — | YES |  |  |
| So_Ct0 | char | 20 | YES |  |  |
| So_Seri0 | char | 20 | YES |  |  |
| Hoa_Don | char | 1 | YES |  |  |
| Loai_VAT | char | 1 | YES |  |  |
| Dieu_Chinh | char | 1 | YES |  |  |
| Stt_Nv | int | — | YES |  |  |

---

#### Bảng: `dbo.So_LuongDD`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| DDID | bigint | — | NO | ✅ |  |
| Ma_Dvcs | char | 2 | NO |  |  |
| Nam | int | — | YES |  |  |
| Thang | int | — | YES |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| Ty_Le_Ht | numeric | — | YES |  |  |

---

#### Bảng: `dbo.So_LuongHT`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| HTID | bigint | — | NO | ✅ |  |
| Ma_Dvcs | char | 2 | NO |  |  |
| Ma_Yt | char | 16 | YES |  |  |
| Ngay_Ct | datetime | — | YES |  |  |
| Ma_Sp_Di | char | 16 | YES |  |  |
| Ma_Sp_Den | char | 16 | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| Gia | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |

---

#### Bảng: `dbo.SoCai`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| SoCaiID | bigint | — | NO | ✅ |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Stt | char | 20 | NO |  |  |
| Stt0 | char | 20 | YES |  |  |
| Stt_Bt | char | 1 | YES |  |  |
| Ma_Ct | char | 2 | NO |  |  |
| Nh_Ct | char | 1 | NO |  |  |
| Ngay_Ct | datetime | — | NO |  |  |
| So_Ct | char | 20 | YES |  |  |
| Ngay_LC | datetime | — | YES |  |  |
| So_LC | char | 20 | YES |  |  |
| Ma_Dt0 | char | 16 | YES |  |  |
| Ong_Ba | nvarchar | 64 | YES |  |  |
| Dien_Giai | nvarchar | 128 | YES |  |  |
| Desc_EN | nvarchar | 128 | YES |  |  |
| Tk_No | char | 16 | NO |  |  |
| Ma_Dt_No | char | 16 | YES |  |  |
| Tk_Co | char | 16 | NO |  |  |
| Ma_Dt_Co | char | 16 | YES |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Ty_Gia | numeric | — | NO |  |  |
| Tien_Nt | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| Ma_Hd | char | 16 | YES |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| Ma_Km | char | 16 | YES |  |  |
| Dien_GiaiN | nvarchar | 128 | YES |  |  |
| Dien_GiaiC | nvarchar | 128 | YES |  |  |
| Desc_ENN | nvarchar | 128 | YES |  |  |
| Desc_ENC | nvarchar | 128 | YES |  |  |
| Stt_GS | char | 20 | YES |  |  |

---

#### Bảng: `dbo.SoCaiVT`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | char | 20 | NO | ✅ |  |
| Stt0 | char | 20 | NO | ✅ |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Ma_Ct | char | 2 | NO |  |  |
| Nh_Ct | char | 1 | NO |  |  |
| Ngay_Ct | datetime | — | NO |  |  |
| So_Ct | char | 20 | YES |  |  |
| Ma_Tte | char | 3 | NO |  |  |
| Ty_Gia | numeric | — | NO |  |  |
| Dien_Giai | nvarchar | 128 | YES |  |  |
| Desc_EN | nvarchar | 128 | YES |  |  |
| Ma_Hd | char | 16 | YES |  |  |
| Ma_Dt | char | 16 | YES |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| Ma_Xe | char | 8 | YES |  |  |
| Ma_Km | char | 16 | YES |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| Ma_Kho | char | 16 | YES |  |  |
| Ma_KhoN | char | 16 | YES |  |  |
| Ma_Vt | char | 16 | YES |  |  |
| Dvt | varchar | 8 | YES |  |  |
| Gia_Tb_TT | char | 1 | YES |  |  |
| He_So9 | numeric | — | YES |  |  |
| So_Luong9 | numeric | — | YES |  |  |
| Gia_Nt9 | numeric | — | YES |  |  |
| Gia9 | numeric | — | YES |  |  |
| Tien_Nt9 | numeric | — | YES |  |  |
| Tien9 | numeric | — | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| Gia_Nt | numeric | — | YES |  |  |
| Gia | numeric | — | YES |  |  |
| Tien_Nt | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Gia_Nt2 | numeric | — | YES |  |  |
| Gia2 | numeric | — | YES |  |  |
| Tien_Nt2 | numeric | — | YES |  |  |
| Tien2 | numeric | — | YES |  |  |
| Tien_Nt3 | numeric | — | YES |  |  |
| Tien3 | numeric | — | YES |  |  |
| Tien_Nt4 | numeric | — | YES |  |  |
| Tien4 | numeric | — | YES |  |  |
| Tien_Nt5 | numeric | — | YES |  |  |
| Tien5 | numeric | — | YES |  |  |
| Ma_Nx | char | 16 | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Tk_Du | char | 16 | YES |  |  |
| Tk2 | char | 16 | YES |  |  |
| Tk_Du2 | char | 16 | YES |  |  |
| Tk3 | char | 16 | YES |  |  |
| Tk_Du3 | char | 16 | YES |  |  |
| Tk4 | char | 16 | YES |  |  |
| Tk_Du4 | char | 16 | YES |  |  |
| Tk5 | char | 16 | YES |  |  |
| Tk_Du5 | char | 16 | YES |  |  |
| UserName | char | 16 | YES |  |  |
| Posted | bit | — | YES |  |  |

---

#### Bảng: `dbo.ZChiTiet`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| ZCTID | bigint | — | NO | ✅ |  |
| Ma_Dvcs | char | 2 | NO |  |  |
| Nam | int | — | YES |  |  |
| Thang | int | — | YES |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| Ma_Yt | char | 16 | YES |  |  |
| Ma_Vt | char | 16 | YES |  |  |
| So_LuongDM | numeric | — | YES |  |  |
| So_LuongTT | numeric | — | YES |  |  |
| TienDM | numeric | — | YES |  |  |
| TienTT | numeric | — | YES |  |  |
| Tong_SL_DM | numeric | — | YES |  |  |
| Tong_T_DM | numeric | — | YES |  |  |
| So_LuongSP | numeric | — | YES |  |  |
| So_LuongDD | numeric | — | YES |  |  |
| Tong_SL | numeric | — | YES |  |  |
| Tong_Tien | numeric | — | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| ZPBID | bigint | — | NO |  |  |
| Loai_Ps | char | 1 | YES |  |  |

---

## 🗄️ Database: VTSYS

**Tổng số bảng:** 67

### Danh sách các bảng

| STT | Schema | Tên Bảng | Số Dữ Liệu (Rows) |
|-----|--------|----------|-------------------|
| 1 | dbo | **DinhMuc** | 0 |
| 2 | dbo | **DmBp** | 0 |
| 3 | dbo | **DmDt** | 0 |
| 4 | dbo | **DmDvCs** | 0 |
| 5 | dbo | **DmHd** | 0 |
| 6 | dbo | **DmHdVt** | 0 |
| 7 | dbo | **DmKho** | 0 |
| 8 | dbo | **DmKm** | 0 |
| 9 | dbo | **DmKs** | 0 |
| 10 | dbo | **DmMDSD** | 0 |
| 11 | dbo | **DmNam** | 0 |
| 12 | dbo | **DmNhDm** | 0 |
| 13 | dbo | **DmNhDt** | 0 |
| 14 | dbo | **DmNhKv** | 0 |
| 15 | dbo | **DmNhTs** | 0 |
| 16 | dbo | **DmNhVt** | 0 |
| 17 | dbo | **DmNvon** | 0 |
| 18 | dbo | **DmNx** | 0 |
| 19 | dbo | **DmSp** | 0 |
| 20 | dbo | **DmStt** | 0 |
| 21 | dbo | **DmTGTS** | 0 |
| 22 | dbo | **DmThue** | 0 |
| 23 | dbo | **DmTk** | 0 |
| 24 | dbo | **DmTte** | 0 |
| 25 | dbo | **DmVm** | 0 |
| 26 | dbo | **DmVt** | 0 |
| 27 | dbo | **DmVtD** | 0 |
| 28 | dbo | **DmXe** | 0 |
| 29 | dbo | **DmYt** | 0 |
| 30 | dbo | **Document** | 0 |
| 31 | dbo | **DocumentNumber** | 0 |
| 32 | dbo | **KQT01** | 0 |
| 33 | dbo | **KQT021** | 0 |
| 34 | dbo | **KQT031** | 0 |
| 35 | dbo | **KQT032** | 0 |
| 36 | dbo | **KQT040** | 0 |
| 37 | dbo | **KQT041** | 0 |
| 38 | dbo | **KQT042** | 0 |
| 39 | dbo | **KQT043** | 0 |
| 40 | dbo | **KQT044** | 0 |
| 41 | dbo | **KQT045** | 0 |
| 42 | dbo | **KQT048** | 0 |
| 43 | dbo | **KQT049** | 0 |
| 44 | dbo | **KQT04A** | 0 |
| 45 | dbo | **KQT05** | 0 |
| 46 | dbo | **KQT10** | 0 |
| 47 | dbo | **KQTQD15** | 0 |
| 48 | dbo | **Loged** | 0 |
| 49 | dbo | **Memvar** | 0 |
| 50 | dbo | **Menu** | 0 |
| 51 | dbo | **NKBK03** | 0 |
| 52 | dbo | **NKCT08** | 0 |
| 53 | dbo | **PhanBoHS** | 0 |
| 54 | dbo | **Report** | 0 |
| 55 | dbo | **ST_Field** | 0 |
| 56 | dbo | **ST_File** | 0 |
| 57 | dbo | **ST_Store** | 0 |
| 58 | dbo | **sysdiagrams** | 0 |
| 59 | dbo | **TSCD** | 0 |
| 60 | dbo | **TSCD0** | 0 |
| 61 | dbo | **TSCDChuyen** | 0 |
| 62 | dbo | **TSCDKhauHao** | 0 |
| 63 | dbo | **TSCDKhauHao0** | 0 |
| 64 | dbo | **TSCDTien** | 0 |
| 65 | dbo | **UserList** | 0 |
| 66 | dbo | **UserRights** | 0 |
| 67 | dbo | **ZPhanBo** | 0 |

---

### Chi tiết cấu trúc từng bảng (VTSYS)

#### Bảng: `dbo.DinhMuc`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| DinhMucID | bigint | — | NO | ✅ |  |
| NamDM | int | — | YES |  |  |
| Loai_Yt | char | 1 | YES |  |  |
| Ma_Vt_Nh | char | 1 | YES |  |  |
| Ma_Sp | char | 16 | NO |  |  |
| Ma_Dm_Sp | char | 16 | NO |  |  |
| So_LuongSP | numeric | — | NO |  |  |
| Dinh_Muc01 | numeric | — | YES |  |  |
| Dinh_Muc02 | numeric | — | YES |  |  |
| Dinh_Muc03 | numeric | — | YES |  |  |
| Dinh_Muc04 | numeric | — | YES |  |  |
| Dinh_Muc05 | numeric | — | YES |  |  |
| Dinh_Muc06 | numeric | — | YES |  |  |
| Dinh_Muc07 | numeric | — | YES |  |  |
| Dinh_Muc08 | numeric | — | YES |  |  |
| Dinh_Muc09 | numeric | — | YES |  |  |
| Dinh_Muc10 | numeric | — | YES |  |  |
| Dinh_Muc11 | numeric | — | YES |  |  |
| Dinh_Muc12 | numeric | — | YES |  |  |
| Gia_Nt | numeric | — | YES |  |  |
| Tien_Nt | numeric | — | YES |  |  |

---

#### Bảng: `dbo.DmBp`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| BpID | bigint | — | NO | ✅ |  |
| Ma_Bp | char | 16 | NO |  |  |
| Ten_Bp | nvarchar | 64 | NO |  |  |
| Ten_Bp2 | nvarchar | 64 | YES |  |  |
| Bp_Me | char | 16 | YES |  |  |
| UserName | char | 16 | YES |  |  |
| Bac_Bp | tinyint | — | NO |  |  |
| Bp_Cuoi | char | 1 | NO |  |  |
| Stt_Bp | char | 18 | NO |  |  |

---

#### Bảng: `dbo.DmDt`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| DTID | bigint | — | NO | ✅ |  |
| Ma_Dt | char | 16 | NO |  |  |
| Ten_Dt | nvarchar | 64 | NO |  |  |
| Ten_Dt2 | nvarchar | 64 | YES |  |  |
| Dia_Chi | nvarchar | 128 | YES |  |  |
| Ms_Thue | char | 20 | YES |  |  |
| Doi_Tac | nvarchar | 64 | YES |  |  |
| Phone | char | 20 | YES |  |  |
| Tk_NH | char | 20 | YES |  |  |
| Dc_NH | nvarchar | 64 | YES |  |  |
| Email | nvarchar | 128 | YES |  |  |
| WEB | nvarchar | 128 | YES |  |  |
| Ma_Vm | char | 8 | YES |  |  |
| GiaoDich2 | char | 16 | YES |  |  |
| Ma_Kv | char | 16 | YES |  |  |
| Ma_Nh_Dt | char | 16 | YES |  |  |
| Stt_Nh_Dt | char | 18 | NO |  |  |
| Dinh_Chi | char | 1 | NO |  |  |
| Han_Tt | int | — | YES |  |  |
| Kieu_Cn | char | 1 | YES |  |  |
| Gioi_Han | numeric | — | YES |  |  |
| Toi_Han | numeric | — | YES |  |  |
| Loai_Dt | char | 1 | YES |  |  |

---

#### Bảng: `dbo.DmDvCs`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| DvCsID | bigint | — | NO | ✅ |  |
| Ma_DvCs | char | 2 | NO |  |  |
| Ten_DvCs | nvarchar | 64 | NO |  |  |
| Ten_DvCs2 | nvarchar | 64 | YES |  |  |
| Dia_Chi | nvarchar | 64 | YES |  |  |
| Ms_Thue | char | 20 | YES |  |  |
| Tk_NH | char | 20 | YES |  |  |
| Ten_NH | nvarchar | 64 | YES |  |  |
| Ten_TP | nvarchar | 64 | YES |  |  |
| Ma_Th | char | 1 | NO |  |  |
| Ngay_Bd_Ht | datetime | — | YES |  |  |
| Ngay_Kt_Ht | datetime | — | YES |  |  |
| W_ID | char | 2 | NO |  |  |
| fax | varchar | 16 | YES |  |  |
| dien_thoai | varchar | 16 | YES |  |  |

---

#### Bảng: `dbo.DmHd`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| HDID | bigint | — | NO | ✅ |  |
| Ma_Hd | char | 16 | NO |  |  |
| Ten_Hd | nvarchar | 64 | NO |  |  |
| Ten_Hd2 | nvarchar | 64 | YES |  |  |
| Loai_HD | char | 1 | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Ma_Dt | char | 16 | YES |  |  |
| Tien_HD | numeric | — | YES |  |  |
| Tien_HD_Nt | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Tien_Nt | numeric | — | YES |  |  |
| Ngay_Ky | datetime | — | YES |  |  |
| Ngay_HD1 | datetime | — | YES |  |  |
| Ngay_HD2 | datetime | — | YES |  |  |

---

#### Bảng: `dbo.DmHdVt`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| HDVTID | bigint | — | NO | ✅ |  |
| Ma_HD | char | 16 | YES |  |  |
| Ma_Vt | char | 16 | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| Gia_Nt | numeric | — | YES |  |  |
| Tien_Nt | numeric | — | YES |  |  |

---

#### Bảng: `dbo.DmKho`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| KHOID | bigint | — | NO | ✅ |  |
| Ma_Kho | char | 16 | NO |  |  |
| Ten_Kho | nvarchar | 64 | NO |  |  |
| Ten_Kho2 | nvarchar | 64 | YES |  |  |

---

#### Bảng: `dbo.DmKm`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| KMID | bigint | — | NO | ✅ |  |
| Ma_Km | char | 16 | NO |  |  |
| Ten_Km | nvarchar | 64 | NO |  |  |
| Ten_Km2 | nvarchar | 64 | YES |  |  |
| Ma_Km_Me | char | 16 | YES |  |  |
| Bac_Km | tinyint | — | YES |  |  |
| Stt_Km | char | 18 | YES |  |  |

---

#### Bảng: `dbo.DmKs`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| KsID | bigint | — | NO | ✅ |  |
| Stt | char | 20 | NO |  |  |
| Tk_Di | char | 16 | YES |  |  |
| Tk_Den | char | 16 | YES |  |  |
| Dien_Giai | nvarchar | 128 | YES |  |  |
| Dien_Giai2 | nvarchar | 128 | YES |  |  |
| Tag | char | 1 | YES |  |  |

---

#### Bảng: `dbo.DmMDSD`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| MDSDID | bigint | — | NO | ✅ |  |
| Ma_MDSD | char | 8 | NO |  |  |
| Ten_MDSD | nvarchar | 64 | YES |  |  |
| Ten_MDSD2 | nvarchar | 64 | YES |  |  |

---

#### Bảng: `dbo.DmNam`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| DmNamID | bigint | — | NO | ✅ |  |
| Ma_Db | varchar | 20 | NO |  |  |
| Nam | char | 4 | NO |  |  |

---

#### Bảng: `dbo.DmNhDm`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| NhDmID | bigint | — | NO | ✅ |  |
| Ma_Nh_Dm | char | 16 | YES |  |  |
| Ten_Nh_Dm | nvarchar | 64 | YES |  |  |
| Ten_Nh_Dm2 | nvarchar | 64 | YES |  |  |
| Dvt | varchar | 8 | YES |  |  |

---

#### Bảng: `dbo.DmNhDt`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| NHDTID | bigint | — | NO | ✅ |  |
| Ma_Nh_Dt | char | 16 | YES |  |  |
| Ten_Nh_Dt | nvarchar | 64 | NO |  |  |
| Ten_Nh_Dt2 | nvarchar | 64 | YES |  |  |
| Nh_Me_Dt | char | 16 | YES |  |  |
| Nh_Cuoi_Dt | char | 1 | NO |  |  |
| Bac_Nh_Dt | tinyint | — | NO |  |  |
| Stt_Nh_Dt | char | 18 | NO |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| Gioi_HanN | numeric | — | YES |  |  |
| Toi_HanN | numeric | — | YES |  |  |

---

#### Bảng: `dbo.DmNhKv`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| NHKVID | bigint | — | NO | ✅ |  |
| Ma_Nh_Kv | char | 16 | YES |  |  |
| Ten_Nh_Kv | nvarchar | 64 | NO |  |  |
| Ten_Nh_Kv2 | nvarchar | 64 | YES |  |  |
| Nh_Me_Kv | char | 16 | YES |  |  |
| Nh_Cuoi_Kv | char | 1 | NO |  |  |
| Bac_Nh_Kv | tinyint | — | NO |  |  |
| Stt_Nh_Kv | char | 18 | NO |  |  |

---

#### Bảng: `dbo.DmNhTs`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| NHTSID | bigint | — | NO | ✅ |  |
| Ma_Nh_Ts | char | 16 | NO |  |  |
| Ten_Nh_Ts | nvarchar | 64 | YES |  |  |
| Ten_Nh_Ts2 | nvarchar | 64 | YES |  |  |
| Nh_Me_Ts | char | 16 | YES |  |  |
| Nh_Cuoi_Ts | char | 1 | NO |  |  |
| Bac_Nh_Ts | tinyint | — | NO |  |  |
| Stt_Nh_Ts | char | 18 | NO |  |  |

---

#### Bảng: `dbo.DmNhVt`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| NHVTID | bigint | — | NO | ✅ |  |
| Ma_Nh_Vt | char | 16 | YES |  |  |
| Ten_Nh_Vt | nvarchar | 64 | NO |  |  |
| Ten_Nh_Vt2 | nvarchar | 64 | YES |  |  |
| Nh_Me_Vt | char | 16 | YES |  |  |
| Nh_Cuoi_Vt | char | 1 | NO |  |  |
| Bac_Nh_Vt | tinyint | — | NO |  |  |
| Stt_Nh_Vt | char | 18 | NO |  |  |

---

#### Bảng: `dbo.DmNvon`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| NVONID | bigint | — | NO | ✅ |  |
| Ma_Nvon | char | 8 | NO |  |  |
| Ten_Nvon | nvarchar | 64 | YES |  |  |
| Ten_Nvon2 | nvarchar | 64 | YES |  |  |
| Loai_Nvon | char | 1 | YES |  |  |

---

#### Bảng: `dbo.DmNx`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| NXID | bigint | — | NO | ✅ |  |
| Ma_Nx | char | 16 | NO |  |  |
| Ten_Nx | nvarchar | 64 | NO |  |  |
| Ten_Nx2 | nvarchar | 64 | YES |  |  |
| Dinh_Khoan | char | 1 | YES |  |  |
| Ct_Nx | char | 20 | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Ct_Kt | char | 1 | YES |  |  |
| Ma_Ct_Kt | char | 2 | YES |  |  |

---

#### Bảng: `dbo.DmSp`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| SPID | bigint | — | NO | ✅ |  |
| Ma_Sp | char | 16 | NO |  |  |
| Ten_Sp | nvarchar | 64 | NO |  |  |
| Ten_Sp2 | nvarchar | 64 | YES |  |  |
| Dvt | varchar | 8 | YES |  |  |
| SP_CT | char | 1 | YES |  |  |
| Loai_Sp | char | 1 | YES |  |  |
| Ma_Sp_Me | char | 16 | YES |  |  |
| Khau_Hao | char | 1 | YES |  |  |

---

#### Bảng: `dbo.DmStt`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Ma_Dvcs | char | 2 | NO |  |  |
| Stt | char | 20 | NO |  |  |

---

#### Bảng: `dbo.DmTGTS`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| TGTSID | bigint | — | NO | ✅ |  |
| Ma_TGTS | char | 8 | NO |  |  |
| Ten_TGTS | nvarchar | 64 | YES |  |  |
| Ten_TGTS2 | nvarchar | 64 | YES |  |  |
| Loai_TGTS | char | 1 | NO |  |  |

---

#### Bảng: `dbo.DmThue`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| THUEID | bigint | — | NO | ✅ |  |
| Ma_Thue | char | 4 | NO |  |  |
| Ten_Thue | nvarchar | 64 | NO |  |  |
| Ten_Thue2 | nvarchar | 64 | YES |  |  |
| Loai_Thue | char | 1 | YES |  |  |
| Gia_Thue | char | 1 | YES |  |  |
| Thue_GTGT | numeric | — | YES |  |  |
| Tk | char | 16 | YES |  |  |

---

#### Bảng: `dbo.DmTk`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| TKID | bigint | — | NO | ✅ |  |
| Tk | char | 16 | NO |  |  |
| Ten_Tk | nvarchar | 100 | YES |  |  |
| Ten_Tk_Eng | nvarchar | 100 | YES |  |  |
| Loai_Tk | char | 1 | YES |  |  |
| Bac_Tk | tinyint | — | YES |  |  |
| Tk_Me | char | 16 | YES |  |  |
| Tk_Nt | char | 1 | YES |  |  |
| Tk_Dt | char | 1 | YES |  |  |
| Tk_Ct | char | 1 | YES |  |  |
| Tk_Gt | char | 1 | YES |  |  |
| Tk_Sc | char | 1 | YES |  |  |
| Tk_Km | char | 1 | YES |  |  |
| Tk_VV | char | 1 | YES |  |  |

---

#### Bảng: `dbo.DmTte`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| TTEID | bigint | — | NO | ✅ |  |
| Ma_Tte | char | 3 | NO |  |  |
| Ngay_TyGia | datetime | — | NO |  |  |
| Ten_Tte | nvarchar | 64 | NO |  |  |
| Ten_Tte2 | nvarchar | 64 | YES |  |  |
| Ty_Gia | numeric | — | YES |  |  |
| Ky_Hieu | char | 3 | YES |  |  |

---

#### Bảng: `dbo.DmVm`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| VMID | bigint | — | NO | ✅ |  |
| Ma_Vm | char | 8 | NO |  |  |
| Ten_Vm | nvarchar | 64 | NO |  |  |
| Ten_Vm2 | nvarchar | 64 | YES |  |  |

---

#### Bảng: `dbo.DmVt`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| VTID | bigint | — | NO | ✅ |  |
| Ma_Vt | char | 16 | NO |  |  |
| Ten_Vt | nvarchar | 64 | YES |  |  |
| Ten_Vt2 | nvarchar | 64 | YES |  |  |
| Loai_Vt | char | 1 | YES |  |  |
| Khung_CK | char | 1 | YES |  |  |
| He_SoF | numeric | — | YES |  |  |
| Dvt | varchar | 8 | YES |  |  |
| Dvt_Ban | varchar | 8 | YES |  |  |
| Gia_Mua | numeric | — | YES |  |  |
| Gia_Ban | numeric | — | YES |  |  |
| He_So0 | numeric | — | YES |  |  |
| Dvt0 | varchar | 8 | YES |  |  |
| Gia_Ban0 | numeric | — | YES |  |  |
| Gia_Mua0 | numeric | — | YES |  |  |
| He_So1 | numeric | — | YES |  |  |
| Dvt1 | varchar | 8 | YES |  |  |
| Gia_Ban1 | numeric | — | YES |  |  |
| Gia_Mua1 | numeric | — | YES |  |  |
| He_So2 | numeric | — | YES |  |  |
| Dvt2 | varchar | 8 | YES |  |  |
| Gia_Ban2 | numeric | — | YES |  |  |
| Gia_Mua2 | numeric | — | YES |  |  |
| Ma_Nh_Vt | char | 16 | YES |  |  |
| Stt_Nh_Vt | char | 18 | YES |  |  |
| SL_Ton_Min | numeric | — | YES |  |  |
| SL_Ton_Max | numeric | — | YES |  |  |
| Tk_Vt | char | 16 | YES |  |  |
| Tk_Gv | char | 16 | YES |  |  |
| Tk_Dt | char | 16 | YES |  |  |
| Tk_Ck | char | 16 | YES |  |  |
| Tk_HBTL | char | 16 | YES |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| Ma_Nh_Dm | char | 16 | YES |  |  |
| Dinh_Chi | char | 1 | YES |  |  |
| Ma_Sp_Sd | char | 16 | YES |  |  |

---

#### Bảng: `dbo.DmVtD`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| VTDID | bigint | — | NO | ✅ |  |
| Ma_Vt_Me | char | 16 | NO |  |  |
| Ma_Vt | char | 16 | NO |  |  |
| SL_VT | numeric | — | NO |  |  |

---

#### Bảng: `dbo.DmXe`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| XeID | bigint | — | NO | ✅ |  |
| Ma_Xe | char | 8 | NO |  |  |
| So_Hieu | char | 8 | YES |  |  |
| Ten_Xe | nvarchar | 64 | NO |  |  |

---

#### Bảng: `dbo.DmYt`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| YTID | bigint | — | NO | ✅ |  |
| Ma_Yt | char | 16 | YES |  |  |
| Ten_Yt | nvarchar | 64 | YES |  |  |
| Ten_Yt2 | nvarchar | 64 | YES |  |  |
| Tk_Cp | nvarchar | 64 | YES |  |  |
| Tk_Yt | nvarchar | 64 | YES |  |  |
| Loai_Yt | char | 1 | YES |  |  |

---

#### Bảng: `dbo.Document`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| CtID | bigint | — | NO | ✅ |  |
| Ma_Ct | char | 2 | NO |  |  |
| Ten_Ct | nvarchar | 64 | NO |  |  |
| Ten_Ct2 | nvarchar | 64 | YES |  |  |
| Ma_Nvu | char | 1 | NO |  |  |
| Nh_Ct | char | 1 | NO |  |  |
| Ct_HD | char | 1 | NO |  |  |
| Ct_CP | char | 1 | NO |  |  |
| No_Co | char | 1 | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Report | varchar | 8 | NO |  |  |
| HD_Ck | char | 1 | NO |  |  |
| BP_Ck | char | 1 | NO |  |  |
| Thue | varchar | 2 | YES |  |  |
| CT_IN | char | 2 | YES |  |  |

---

#### Bảng: `dbo.DocumentNumber`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Ma_DvCs | char | 2 | NO | ✅ |  |
| Ma_Ct | char | 2 | NO | ✅ |  |
| So_Ct_Type | char | 1 | YES |  |  |
| So_Ct_Last | char | 20 | YES |  |  |
| Tieu_De | nvarchar | 64 | YES |  |  |
| Tieu_De2 | nvarchar | 64 | YES |  |  |
| Carry_Vars | nvarchar | 256 | YES |  |  |

---

#### Bảng: `dbo.KQT01`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | numeric | — | NO | ✅ |  |
| In_Ck | char | 1 | YES |  |  |
| Ts_Nc | char | 1 | YES |  |  |
| Bold | char | 1 | YES |  |  |
| Dau | numeric | — | YES |  |  |
| Bac_Ts | tinyint | — | YES |  |  |
| Loai_Ts | char | 1 | YES |  |  |
| Tk_Me | char | 16 | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Ma_Ts | char | 4 | YES |  |  |
| Chi_Tieu | nvarchar | 100 | YES |  |  |
| TMinh | char | 16 | YES |  |  |
| Chi_Tieu_E | nvarchar | 100 | YES |  |  |
| Tk_Nb_Ck | char | 1 | YES |  |  |
| Len_Ps_Nt | char | 1 | YES |  |  |
| Tom_Luoc | char | 1 | YES |  |  |

---

#### Bảng: `dbo.KQT021`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | numeric | — | NO | ✅ |  |
| In_Ck | char | 1 | YES |  |  |
| Bold | char | 1 | YES |  |  |
| Chi_Tieu | nvarchar | 128 | YES |  |  |
| Tminh | char | 16 | YES |  |  |
| Ma_So | char | 4 | YES |  |  |
| Ma_So0 | char | 4 | YES |  |  |
| Bac | tinyint | — | YES |  |  |
| Tk_No | char | 16 | YES |  |  |
| Tk_Co | char | 16 | YES |  |  |
| Tk | nvarchar | 100 | YES |  |  |
| Bieu_Thuc | nvarchar | 100 | YES |  |  |
| Dau | numeric | — | YES |  |  |
| Chi_Tieu_E | nvarchar | 128 | YES |  |  |
| Cong_Thuc | nvarchar | 128 | YES |  |  |
| Tom_Luoc | char | 1 | YES |  |  |

---

#### Bảng: `dbo.KQT031`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | numeric | — | NO | ✅ |  |
| In_Ck | char | 1 | YES |  |  |
| Bold | char | 1 | YES |  |  |
| TMinh | char | 16 | YES |  |  |
| Ma_So | char | 8 | YES |  |  |
| Ma_So0 | char | 8 | YES |  |  |
| Chi_Tieu | nvarchar | 128 | YES |  |  |
| Chi_Tieu_E | nvarchar | 128 | YES |  |  |
| Cach_Tinh | char | 48 | YES |  |  |
| Tk | varchar | 108 | YES |  |  |
| Tk_No | varchar | 108 | YES |  |  |
| Tk_Co | varchar | 108 | YES |  |  |
| Loai_Ct | char | 4 | YES |  |  |
| Loai_Ts | char | 1 | YES |  |  |
| Dau | numeric | — | YES |  |  |
| Ky_Truoc | numeric | — | YES |  |  |
| Ky_Nay | numeric | — | YES |  |  |
| Ky_TruocNt | numeric | — | YES |  |  |
| Ky_NayNt | numeric | — | YES |  |  |
| Tom_Luoc | char | 1 | YES |  |  |
| IDS | numeric | — | YES |  |  |

---

#### Bảng: `dbo.KQT032`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | numeric | — | NO | ✅ |  |
| In_Ck | char | 1 | YES |  |  |
| Bold | char | 1 | YES |  |  |
| TMinh | char | 16 | YES |  |  |
| Ma_So | char | 8 | YES |  |  |
| Ma_So0 | char | 8 | YES |  |  |
| Chi_Tieu | char | 128 | YES |  |  |
| Chi_Tieu_E | char | 128 | YES |  |  |
| Cach_Tinh | char | 48 | YES |  |  |
| Tk_No | char | 108 | YES |  |  |
| Tk_Co | char | 108 | YES |  |  |
| Dau | numeric | — | YES |  |  |
| Bac | tinyint | — | YES |  |  |
| Ky_Truoc | numeric | — | YES |  |  |
| Ky_Nay | numeric | — | YES |  |  |
| Ky_TruocNt | numeric | — | YES |  |  |
| Ky_NayNt | numeric | — | YES |  |  |
| Tom_Luoc | char | 1 | YES |  |  |
| IDS | numeric | — | YES |  |  |

---

#### Bảng: `dbo.KQT040`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | bigint | — | NO | ✅ |  |
| Ma_Dvcs | char | 2 | NO |  |  |
| Var_Repo | varchar | 8 | NO |  |  |
| Var_Year | int | — | YES |  |  |
| Var_Name | char | 20 | YES |  |  |
| Var_Value | nvarchar | 1000 | YES |  |  |

---

#### Bảng: `dbo.KQT041`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | numeric | — | NO | ✅ |  |
| In_Ck | char | 1 | YES |  |  |
| Bold | char | 1 | YES |  |  |
| Chi_Tieu | nvarchar | 128 | YES |  |  |
| Ma_So | char | 4 | YES |  |  |
| Ma_So0 | char | 4 | YES |  |  |
| Bac | tinyint | — | YES |  |  |
| Tk_No | nvarchar | 100 | YES |  |  |
| Tk_Co | nvarchar | 100 | YES |  |  |
| Dau | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Chi_Tieu_E | nvarchar | 128 | YES |  |  |

---

#### Bảng: `dbo.KQT042`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | numeric | — | NO | ✅ |  |
| In_Ck | char | 1 | YES |  |  |
| Bold | char | 1 | YES |  |  |
| Chi_Tieu | nvarchar | 128 | YES |  |  |
| Ma_So | char | 4 | YES |  |  |
| Ma_So0 | char | 4 | YES |  |  |
| Bac | tinyint | — | YES |  |  |
| Dau | numeric | — | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Chi_Tieu_E | nvarchar | 128 | YES |  |  |

---

#### Bảng: `dbo.KQT043`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | numeric | — | NO | ✅ |  |
| In_Ck | char | 1 | YES |  |  |
| Bold | char | 1 | YES |  |  |
| Chi_Tieu | nvarchar | 128 | YES |  |  |
| Ma_So | char | 4 | YES |  |  |
| Ma_So0 | char | 4 | YES |  |  |
| Bac | tinyint | — | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Dau | numeric | — | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Ps_Co | numeric | — | YES |  |  |
| Du_No2 | numeric | — | YES |  |  |
| Ps_No | numeric | — | YES |  |  |
| Du_No1 | numeric | — | YES |  |  |
| Chi_Tieu_E | nvarchar | 128 | YES |  |  |

---

#### Bảng: `dbo.KQT044`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | numeric | — | NO | ✅ |  |
| Bold | char | 1 | YES |  |  |
| Chi_Tieu | nvarchar | 128 | YES |  |  |
| Ma_So | char | 4 | YES |  |  |
| Ma_So0 | char | 4 | YES |  |  |
| Bac | tinyint | — | YES |  |  |
| Ky_Truoc | numeric | — | YES |  |  |
| Ky_Nay | numeric | — | YES |  |  |
| Chi_Tieu1 | nvarchar | 256 | YES |  |  |
| Chi_Tieu2 | nvarchar | 256 | YES |  |  |
| Bang1 | nvarchar | 256 | YES |  |  |
| Bang2 | nvarchar | 256 | YES |  |  |
| DVT | varchar | 8 | YES |  |  |
| SoChiTieu2 | numeric | — | YES |  |  |
| SoChiTieu1 | numeric | — | YES |  |  |
| Chi_Tieu_E | nvarchar | 128 | YES |  |  |

---

#### Bảng: `dbo.KQT045`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | numeric | — | NO | ✅ |  |
| In_Ck | char | 1 | YES |  |  |
| Bold | char | 1 | YES |  |  |
| Chi_Tieu | nvarchar | 128 | YES |  |  |
| Ma_So | char | 4 | YES |  |  |
| Ma_So0 | char | 4 | YES |  |  |
| Bac | tinyint | — | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Dau | numeric | — | YES |  |  |
| Loai_Tk | char | 1 | YES |  |  |
| Loai_Ts | char | 1 | YES |  |  |
| Du_Dau | numeric | — | YES |  |  |
| Du_Dau_Qh | numeric | — | YES |  |  |
| Tang | numeric | — | YES |  |  |
| Giam | numeric | — | YES |  |  |
| Du_Cuoi | numeric | — | YES |  |  |
| Du_Cuoi_Qh | numeric | — | YES |  |  |
| Tien0_Tong | numeric | — | YES |  |  |
| Chi_Tieu_E | nvarchar | 128 | YES |  |  |

---

#### Bảng: `dbo.KQT048`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | numeric | — | NO | ✅ |  |
| In_Ck | char | 1 | YES |  |  |
| Bold | char | 1 | YES |  |  |
| Chi_Tieu | nvarchar | 128 | YES |  |  |
| Ma_So | char | 4 | YES |  |  |
| Ma_So0 | char | 4 | YES |  |  |
| Bac | tinyint | — | YES |  |  |
| Tk_No | char | 16 | YES |  |  |
| Tk_Co | char | 16 | YES |  |  |
| Dau | numeric | — | YES |  |  |
| Ky_Nay | numeric | — | YES |  |  |
| Ke_Hoach | numeric | — | YES |  |  |
| Chi_Tieu_E | nvarchar | 128 | YES |  |  |
| Ky_Truoc | numeric | — | YES |  |  |

---

#### Bảng: `dbo.KQT049`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | numeric | — | NO | ✅ |  |
| In_Ck | char | 1 | YES |  |  |
| Bold | char | 1 | YES |  |  |
| Chi_Tieu | nvarchar | 128 | YES |  |  |
| Dau | numeric | — | YES |  |  |
| Bac | tinyint | — | YES |  |  |
| Ma_So | char | 4 | YES |  |  |
| Ma_So0 | char | 4 | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Tien_Nt | numeric | — | YES |  |  |
| Chi_Tieu_E | nvarchar | 128 | YES |  |  |

---

#### Bảng: `dbo.KQT04A`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | bigint | — | NO | ✅ |  |
| Ma_Dvcs | char | 2 | NO |  |  |
| Var_Repo | varchar | 8 | NO |  |  |
| Var_Year | int | — | YES |  |  |
| Var_Name | char | 20 | YES |  |  |
| Var_Value | numeric | — | YES |  |  |

---

#### Bảng: `dbo.KQT05`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | numeric | — | NO | ✅ |  |
| Stt0 | char | 4 | YES |  |  |
| In_Ck | char | 1 | YES |  |  |
| Bold | char | 1 | YES |  |  |
| Ten_Ct | nvarchar | 100 | YES |  |  |
| So_Ct1 | char | 4 | YES |  |  |
| So_Ct2 | char | 4 | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Tien3 | numeric | — | YES |  |  |
| Dau | numeric | — | YES |  |  |
| Bac | tinyint | — | YES |  |  |
| Ma_So0 | char | 4 | YES |  |  |
| Ma_So | char | 4 | YES |  |  |
| No_Co | char | 1 | YES |  |  |
| Tk | nvarchar | 100 | YES |  |  |
| No_Co3 | char | 1 | YES |  |  |
| Tk3 | nvarchar | 100 | YES |  |  |
| Proce | nvarchar | 64 | YES |  |  |
| Kieu_Ps | char | 1 | YES |  |  |
| Dieu_Kien | nvarchar | 100 | YES |  |  |
| Line | char | 1 | YES |  |  |

---

#### Bảng: `dbo.KQT10`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | numeric | — | NO | ✅ |  |
| In_Ck | char | 1 | YES |  |  |
| Bold | char | 1 | YES |  |  |
| Ten_Ct | nvarchar | 100 | YES |  |  |
| So_Ct1 | char | 4 | YES |  |  |
| So_Ct2 | char | 4 | YES |  |  |
| Tien | numeric | — | YES |  |  |
| Tien3 | numeric | — | YES |  |  |
| Dau | numeric | — | YES |  |  |
| Bac | tinyint | — | YES |  |  |
| Ma_So0 | char | 4 | YES |  |  |
| Ma_So | char | 4 | YES |  |  |
| No_Co | char | 1 | YES |  |  |
| Tk | nvarchar | 100 | YES |  |  |
| No_Co3 | char | 1 | YES |  |  |
| Tk3 | nvarchar | 100 | YES |  |  |
| Proce | nvarchar | 64 | YES |  |  |
| Kieu_Ps | char | 1 | YES |  |  |
| Dieu_Kien | nvarchar | 100 | YES |  |  |
| Line | char | 1 | YES |  |  |

---

#### Bảng: `dbo.KQTQD15`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt_Order | numeric | — | YES |  |  |
| Nhom_Bc | char | 1 | YES |  |  |
| In_Ck | char | 1 | YES |  |  |
| In_Tieu_De | char | 1 | YES |  |  |
| Bold | char | 1 | YES |  |  |
| Chi_Tieu | varchar | 254 | YES |  |  |
| Chi_Tieu_E | varchar | 254 | YES |  |  |
| Ma_So | varchar | 6 | YES |  |  |
| Bac | tinyint | — | YES |  |  |
| Loai_Tk | varchar | 10 | YES |  |  |
| Tk | varchar | 48 | YES |  |  |
| Tk_Du | varchar | 48 | YES |  |  |
| Not_Tk_Du | varchar | 48 | YES |  |  |
| Ma_Km | varchar | 32 | YES |  |  |
| Cong_Thuc | varchar | 128 | YES |  |  |
| Hien_Dau | int | — | YES |  |  |

---

#### Bảng: `dbo.Loged`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| LogID | bigint | — | NO | ✅ |  |
| UserID | smallint | — | NO |  |  |
| UserName | char | 16 | NO |  |  |
| Full_Name | nvarchar | 64 | NO |  |  |
| Pc_Name | char | 20 | NO |  |  |
| Log_Name | nvarchar | 64 | NO |  |  |
| In_Time | datetime | — | NO |  |  |
| Out_Time | datetime | — | YES |  |  |

---

#### Bảng: `dbo.Memvar`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Stt | smallint | — | NO | ✅ |  |
| Var_Name | char | 20 | NO |  |  |
| Type | char | 1 | NO |  |  |
| Value | nvarchar | 64 | YES |  |  |
| Value_Eng | nvarchar | 64 | YES |  |  |
| Access | bit | — | NO |  |  |
| Memo | nvarchar | 100 | YES |  |  |
| Memo_Eng | nvarchar | 100 | YES |  |  |
| Var_Format | char | 8 | YES |  |  |
| Picture | nvarchar | 64 | YES |  |  |

---

#### Bảng: `dbo.Menu`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| MenuID | bigint | — | NO | ✅ |  |
| PadNum | tinyint | — | NO |  |  |
| BarNum | tinyint | — | NO |  |  |
| BarNum0 | tinyint | — | NO |  |  |
| SubBar | bit | — | NO |  |  |
| HotKey | tinyint | — | NO |  |  |
| Bar | nvarchar | 64 | NO |  |  |
| Bar_Eng | nvarchar | 64 | NO |  |  |
| Visible | bit | — | NO |  |  |
| Skiped | bit | — | NO |  |  |
| Def_Code | char | 1 | NO |  |  |
| Proce | varchar | 180 | NO |  |  |
| Message | nvarchar | 70 | NO |  |  |
| Report | varchar | 8 | YES |  |  |
| Imge | varchar | 32 | YES |  |  |
| IsInput | bit | — | NO |  |  |

---

#### Bảng: `dbo.NKBK03`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| NKBK03ID | bigint | — | NO | ✅ |  |
| Nhom_NC | char | 1 | YES |  |  |
| Nhom_Tk | char | 1 | YES |  |  |
| Ten_Nhom | nvarchar | 64 | YES |  |  |

---

#### Bảng: `dbo.NKCT08`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| NKCT08ID | bigint | — | NO | ✅ |  |
| Nhom_NC | char | 1 | YES |  |  |
| Nhom_Tk | char | 1 | YES |  |  |
| Ten_Nhom | nvarchar | 64 | YES |  |  |

---

#### Bảng: `dbo.PhanBoHS`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| ZPBHSID | bigint | — | NO | ✅ |  |
| ZPBID | bigint | — | NO |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| He_So | numeric | — | YES |  |  |

---

#### Bảng: `dbo.Report`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| ReportID | bigint | — | NO | ✅ |  |
| Nhom_BC | nvarchar | 64 | YES |  |  |
| Bar | nvarchar | 80 | YES |  |  |
| Bar_Eng | nvarchar | 80 | YES |  |  |
| Title | nvarchar | 80 | YES |  |  |
| Title_Eng | nvarchar | 80 | YES |  |  |
| Proce | varchar | 180 | YES |  |  |
| Report | char | 20 | YES |  |  |
| Bmp_Name | char | 8 | YES |  |  |
| Def_Code | varchar | 60 | YES |  |  |
| Decision_No | char | 20 | YES |  |  |
| PrintSign | char | 1 | YES |  |  |

---

#### Bảng: `dbo.ST_Field`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| Ma_Field | varchar | 10 | NO |  |  |
| Ma_File | varchar | 16 | YES |  |  |
| Field_Name | varchar | 10 | YES |  |  |

---

#### Bảng: `dbo.ST_File`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| FileID | bigint | — | NO | ✅ |  |
| Ma_File | varchar | 16 | YES |  |  |
| Ten_File | nvarchar | 64 | YES |  |  |
| FieldList | nvarchar | 128 | YES |  |  |
| FieldName | varchar | 10 | YES |  |  |
| FieldOrder | nvarchar | 128 | YES |  |  |
| FilterFieldList | nvarchar | 128 | YES |  |  |
| FilterType | bit | — | YES |  |  |
| MatchCase | bit | — | YES |  |  |
| StartPos | int | — | YES |  |  |
| CodeNested | bit | — | YES |  |  |

---

#### Bảng: `dbo.ST_Store`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| ID_String | char | 20 | NO | ✅ |  |
| Var_Value | nvarchar | 255 | NO |  |  |

---

#### Bảng: `dbo.sysdiagrams`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| name | nvarchar | 128 | NO |  |  |
| principal_id | int | — | NO |  |  |
| diagram_id | int | — | NO | ✅ |  |
| version | int | — | YES |  |  |
| definition | varbinary | MAX | YES |  |  |

---

#### Bảng: `dbo.TSCD`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| TSCDID | char | 20 | NO | ✅ |  |
| Ma_Dvcs | char | 2 | NO |  |  |
| Ma_Ts | char | 16 | YES |  |  |
| The_Ts | char | 16 | YES |  |  |
| Ten_Ts | nvarchar | 64 | YES |  |  |
| Dien_Giai | nvarchar | 128 | YES |  |  |
| Dvt | varchar | 8 | YES |  |  |
| So_Luong | numeric | — | YES |  |  |
| Ma_Nh_Ts | char | 16 | YES |  |  |
| Stt_Nh_Ts | char | 18 | NO |  |  |
| Nuoc_Sx | nvarchar | 64 | YES |  |  |
| Nam_Sx | int | — | YES |  |  |
| Tk | char | 16 | YES |  |  |
| Ma_MDSD | char | 8 | YES |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| Loai_TSDC | char | 1 | YES |  |  |
| Ngay_Ts | datetime | — | YES |  |  |
| Tinh_KH | char | 1 | YES |  |  |
| Ngay_KH | datetime | — | YES |  |  |
| So_Thang | int | — | YES |  |  |
| Tk_No | char | 16 | YES |  |  |
| Tk_Co | char | 16 | YES |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| Ma_Km | char | 16 | YES |  |  |
| Ma_Giam_Ts | char | 8 | YES |  |  |
| Ngay_Giam | datetime | — | YES |  |  |

---

#### Bảng: `dbo.TSCD0`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| TSCD0ID | char | 20 | NO | ✅ |  |
| TSCDID | char | 20 | NO |  |  |
| Loai_Ps | char | 1 | YES |  |  |
| Ma_TGTS | char | 8 | YES |  |  |
| Ngay_Ps | datetime | — | YES |  |  |
| Dien_Giai | nvarchar | 128 | YES |  |  |
| Ma_Nvon | char | 8 | YES |  |  |
| Tien0 | numeric | — | YES |  |  |
| Tien1 | numeric | — | YES |  |  |
| So_Thang | int | — | YES |  |  |
| Tien4 | numeric | — | YES |  |  |

---

#### Bảng: `dbo.TSCDChuyen`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| ChuyenTSID | bigint | — | NO | ✅ |  |
| TSCDID | char | 20 | NO |  |  |
| Ngay_Ps | datetime | — | YES |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| So_Thang | int | — | YES |  |  |
| Tk_No | char | 16 | YES |  |  |

---

#### Bảng: `dbo.TSCDKhauHao`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| KhauHaoID | bigint | — | NO | ✅ |  |
| Ma_Dvcs | char | 2 | NO |  |  |
| Thang | int | — | YES |  |  |
| Nam | int | — | YES |  |  |
| Loai_TSDC | char | 1 | YES |  |  |
| Stt | char | 20 | NO |  |  |
| Ngay_Ct | datetime | — | YES |  |  |
| So_Ct | char | 20 | YES |  |  |
| Dien_Giai | nvarchar | 128 | YES |  |  |

---

#### Bảng: `dbo.TSCDKhauHao0`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| KhauHao0ID | bigint | — | NO | ✅ |  |
| KhauHaoID | bigint | — | YES |  |  |
| TSCDID | char | 20 | YES |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| Ngay_KH | datetime | — | YES |  |  |
| Tien2_N1 | numeric | — | YES |  |  |
| Tien2_N2 | numeric | — | YES |  |  |
| Tien2_N3 | numeric | — | YES |  |  |
| Tien2_N4 | numeric | — | YES |  |  |
| Sua_Ck | char | 1 | YES |  |  |

---

#### Bảng: `dbo.TSCDTien`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| TienTSID | char | 20 | NO | ✅ |  |
| TSCDID | char | 20 | NO |  |  |
| Loai_Ps | char | 1 | YES |  |  |
| Ngay_KH | datetime | — | YES |  |  |
| Ma_Bp | char | 16 | YES |  |  |
| Tien0 | numeric | — | YES |  |  |
| Tien1 | numeric | — | YES |  |  |
| Tien0_N1 | numeric | — | YES |  |  |
| Tien1_N1 | numeric | — | YES |  |  |
| Tien0_N2 | numeric | — | YES |  |  |
| Tien1_N2 | numeric | — | YES |  |  |
| Tien0_N3 | numeric | — | YES |  |  |
| Tien1_N3 | numeric | — | YES |  |  |
| Tien0_N4 | numeric | — | YES |  |  |
| Tien1_N4 | numeric | — | YES |  |  |
| So_Thang | int | — | YES |  |  |
| Tien2 | numeric | — | YES |  |  |
| Tien2_N1 | numeric | — | YES |  |  |
| Tien2_N2 | numeric | — | YES |  |  |
| Tien2_N3 | numeric | — | YES |  |  |
| Tien2_N4 | numeric | — | YES |  |  |

---

#### Bảng: `dbo.UserList`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| UserID | smallint | — | NO | ✅ |  |
| UserName | char | 16 | YES |  |  |
| User_PWD | int | — | YES |  |  |
| FullName | nvarchar | 64 | YES |  |  |
| Loai_User | char | 1 | YES |  |  |
| CanDelete | char | 1 | YES |  |  |
| User_PWD_NET | nvarchar | 100 | YES |  |  |
| Email | nvarchar | 64 | YES |  |  |
| Activate | bit | — | YES |  |  |
| LastLogin | smalldatetime | — | YES |  |  |

---

#### Bảng: `dbo.UserRights`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| RightID | bigint | — | NO | ✅ |  |
| UserID | bigint | — | NO |  |  |
| Func_ID | bigint | — | NO |  |  |
| Func_Type | char | 1 | NO |  |  |
| Right_1 | char | 1 | YES |  |  |
| Right_2 | char | 1 | YES |  |  |
| Right_3 | char | 1 | YES |  |  |
| Right_4 | char | 1 | YES |  |  |

---

#### Bảng: `dbo.ZPhanBo`
**Số dòng:** 0 rows

| Cột | Kiểu | Độ dài | Nullable | PK | FK |
|-----|------|--------|----------|----|----|
| ZPBID | bigint | — | NO | ✅ |  |
| Ma_Dvcs | char | 2 | NO |  |  |
| Loai_Pb | char | 1 | YES |  |  |
| Ma_Yt | char | 16 | YES |  |  |
| Ma_Sp | char | 16 | YES |  |  |
| Dien_Giai | nvarchar | 128 | YES |  |  |
| Loai_Yt | char | 1 | YES |  |  |
| Ma_Yt0 | char | 16 | YES |  |  |
| Yt_Di01 | char | 16 | YES |  |  |
| Yt_Di02 | char | 16 | YES |  |  |
| Yt_Di03 | char | 16 | YES |  |  |
| Yt_Di04 | char | 16 | YES |  |  |
| Yt_Di05 | char | 16 | YES |  |  |
| SLuong_Ck | char | 1 | YES |  |  |

---

