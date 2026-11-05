# Báo cáo review tracking — <Flow / REQ-xxx>

- **Phạm vi**: <flow, màn hình, platform>
- **Nguồn behavior**: <Chạy flow thật trên URL test | REQ + Figma/mô tả>
- **Mixpanel project**: <tên / Not used>
- **Ngày review**: <YYYY-MM-DD>

## 1. Tóm tắt

- Event đề xuất: <n> | Đang có: <n> | Thiếu: <n> | Sai/rủi ro: <n>
- Report làm được: <n> / <tổng> | Một phần: <n> | Chưa làm được: <n>
- Vấn đề lớn nhất: <1-2 câu>

## 2. Flow và event

| # | Bước người dùng | Event đề xuất | Thời điểm bắn | Property bắt buộc | Hiện trạng | Ghi chú |
|---|---|---|---|---|---|---|
| 1 | Mở trang Sign in | `Sign In Viewed` | Khi trang render xong | `source` | ✅ Có | |
| 2 | Submit thành công | `Sign In Completed` | Sau API 200 | `method` | ❌ Thiếu | TR-01 |

## 3. Findings

| Mã | Loại | Checklist | Bằng chứng | Vấn đề | Đề xuất |
|---|---|---|---|---|---|
| TR-RISK-01 | Thiết kế | TR-20 | Req dòng 12 | Bắn `Payment Completed` lúc click | Bắn sau khi server xác nhận |
| TR-BUG-01 | Đã tái hiện | TR-21 | Request #3, #4 | `Page Viewed` bắn 2 lần | Debounce/guard |

## 4. Report khai thác được

| Câu hỏi business | Loại report | Trạng thái | Đang có | Còn thiếu |
|---|---|---|---|---|
| | | Làm được / Một phần / Chưa làm được | | |

## 5. Open questions

- `Q-01`: <câu hỏi cho PO/dev, ví dụ "bắn event khi click hay khi API success?">

## 6. Chưa kiểm chứng

- <phần Not verified và lý do: thiếu môi trường, event server-side, mobile native…>
